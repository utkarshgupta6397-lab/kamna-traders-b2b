'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, RefreshCw, Download } from 'lucide-react';
import DocumentationDashboardKPIs from './DocumentationDashboardKPIs';
import DocumentationTable from './DocumentationTable';

export default function DocumentationDashboardClient() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<{ type: string; value: string } | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (activeFilter && activeFilter.type !== 'All') {
        params.set(activeFilter.type, activeFilter.value);
      }

      const res = await fetch(`/api/solar-orders/documentation-dashboard?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery, activeFilter]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleFilterChange = (type: string, value: string | null) => {
    if (!value || type === 'All') {
      setActiveFilter(null);
    } else {
      setActiveFilter({ type, value });
    }
  };

  const handleExportCSV = () => {
    if (!data?.items || data.items.length === 0) return;
    
    const headers = ['Order Number', 'Customer Name', 'Assigned Executive', 'Current Stage', 'Workflow %', 'Overdue'];
    const csvRows = [headers.join(',')];

    data.items.forEach((item: any) => {
      const values = [
        item.orderNumber,
        `"${item.customerName}"`,
        `"${item.assignedExecutive}"`,
        `"${item.currentStage}"`,
        `${item.workflowPercentage}%`,
        item.isOverdue ? 'Yes' : 'No'
      ];
      csvRows.push(values.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Documentation_Dashboard_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1A2766] transition-colors" size={16} />
            <input
              type="text"
              placeholder="Search orders, customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchDashboardData()}
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] transition-all"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg border transition-colors ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
            title="Toggle Filters"
          >
            <Filter size={18} />
          </button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing || isLoading}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 hover:text-[#1A2766] transition-colors disabled:opacity-50 w-full sm:w-auto"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh All
          </button>
          
          <button
            onClick={handleExportCSV}
            disabled={isLoading || !data?.items?.length}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#1A2766] text-white rounded-lg text-sm font-medium hover:bg-[#1A2766]/90 transition-colors disabled:opacity-50 w-full sm:w-auto shadow-sm"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      {data && (
        <DocumentationDashboardKPIs 
          summary={data.summary} 
          onFilterChange={handleFilterChange} 
          activeFilter={activeFilter} 
        />
      )}

      {/* Main Table */}
      <DocumentationTable 
        items={data?.items || []} 
        allSteps={data?.allSteps || []} 
        columnCounters={data?.columnCounters || {}} 
        isLoading={isLoading && !isRefreshing} 
      />
    </div>
  );
}
