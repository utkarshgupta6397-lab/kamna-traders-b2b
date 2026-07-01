'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, RefreshCw, Download } from 'lucide-react';
import InstallationDashboardKPIs from './InstallationDashboardKPIs';
import InstallationTable from './InstallationTable';

export default function InstallationDashboardClient() {
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

      const res = await fetch(`/api/solar-orders/installation-dashboard?${params.toString()}`);
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
    a.download = `Installation_Dashboard_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64 group">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-teal-700 transition-colors" size={14} />
            <input
              type="text"
              placeholder="Search orders, customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchDashboardData()}
              className="w-full pl-8 pr-3 py-1.5 text-[13px] bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-700/20 focus:border-teal-700 transition-all"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1.5 rounded-md border transition-colors ${showFilters ? 'bg-teal-50 border-teal-200 text-teal-600' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
            title="Toggle Filters"
          >
            <Filter size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing || isLoading}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-md text-[13px] font-medium hover:bg-gray-50 hover:text-teal-700 transition-colors disabled:opacity-50 w-full sm:w-auto"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          
          <button
            onClick={handleExportCSV}
            disabled={isLoading || !data?.items?.length}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-teal-700 text-white rounded-md text-[13px] font-medium hover:bg-teal-800 transition-colors disabled:opacity-50 w-full sm:w-auto shadow-sm"
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* KPIs */}
      {data && (
        <InstallationDashboardKPIs 
          summary={data.summary} 
          columnCounters={data.columnCounters}
          isLoading={false}
        />
      )}

      {/* Main Table */}
      <InstallationTable 
        items={data?.items || []} 
        allSteps={data?.allSteps || []} 
        columnCounters={data?.columnCounters || {}} 
        isLoading={isLoading && !isRefreshing} 
      />
    </div>
  );
}
