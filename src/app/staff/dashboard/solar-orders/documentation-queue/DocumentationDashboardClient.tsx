'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, RefreshCw, Download } from 'lucide-react';
import DocumentationDashboardKPIs from './DocumentationDashboardKPIs';
import DocumentationTable from './DocumentationTable';
import AuthorityBatchButton from './AuthorityBatchButton';
import SolarQuickFilters from '../components/SolarQuickFilters';
import SolarAdvancedFilters from '../components/SolarAdvancedFilters';
import { useTableSorting } from '../hooks/useTableSorting';
import { useSolarFilters } from '../hooks/useSolarFilters';

export default function DocumentationDashboardClient() {
  const [data, setData] = useState<any>(null);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [activeFilter, setActiveFilter] = useState<{ type: string; value: string } | null>(null);
  
  // Sorting
  const { sortField, sortDirection, handleSort, setSortField, setSortDirection } = useTableSorting('orderDate', 'desc');
  const filters = useSolarFilters(allOrders);

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const params = new URLSearchParams();
      params.set('limit', 'all');
      if (activeFilter && activeFilter.type !== 'All') {
        params.set(activeFilter.type, activeFilter.value);
      }
      if (sortField) params.set('sortField', sortField);
      if (sortDirection) params.set('sortDirection', sortDirection);
      if (filters.hasOutstandingPayment) params.set('hasOutstandingPayment', 'true');

      const res = await fetch(`/api/solar-orders/documentation-dashboard?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      const json = await res.json();
      setData(json);
      setAllOrders(json.items || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeFilter, filters.hasOutstandingPayment, sortField, sortDirection]);

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
    <div className="space-y-3">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <SolarQuickFilters 
            search={filters.search}
            setSearch={filters.setSearch}
            setPage={filters.setPage}
            showFilters={filters.showFilters}
            setShowFilters={filters.setShowFilters}
            activeFilterCount={filters.activeFilterCount}
            statusFilter={filters.statusFilter}
            setStatusFilter={filters.setStatusFilter}
            statusCounts={filters.statusCounts}
            hasOutstandingPayment={filters.hasOutstandingPayment}
            setHasOutstandingPayment={filters.setHasOutstandingPayment}
            showStatusTabs={false}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing || isLoading}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-md text-[13px] font-medium hover:bg-gray-50 hover:text-[#1A2766] transition-colors disabled:opacity-50 w-full sm:w-auto"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          
          <button
            onClick={handleExportCSV}
            disabled={isLoading || !data?.items?.length}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-md text-[13px] font-medium hover:bg-gray-50 hover:text-[#1A2766] transition-colors disabled:opacity-50 w-full sm:w-auto"
          >
            <Download size={14} />
            Export
          </button>

          <AuthorityBatchButton eligibleCount={data?.summary?.eligibleForAuthoritySignature || 0} />
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

      {filters.showFilters && (
        <SolarAdvancedFilters 
          filterOptions={filters.filterOptions}
          systemTypes={filters.systemTypes}
          setSystemTypes={filters.setSystemTypes}
          quarters={filters.quarters}
          setQuarters={filters.setQuarters}
          leadSources={filters.leadSources}
          setLeadSources={filters.setLeadSources}
          assignedTo={filters.assignedTo}
          setAssignedTo={filters.setAssignedTo}
          leadSourceSearch={filters.leadSourceSearch}
          setLeadSourceSearch={filters.setLeadSourceSearch}
          assigneeSearch={filters.assigneeSearch}
          setAssigneeSearch={filters.setAssigneeSearch}
          activeFilterCount={filters.activeFilterCount}
          resetFilters={filters.resetFilters}
          toggleArrayItem={filters.toggleArrayItem}
        />
      )}

      {/* Main Table */}
      <DocumentationTable 
        items={filters.paginatedOrders} 
        allSteps={data?.allSteps || []} 
        columnCounters={data?.columnCounters || {}} 
        isLoading={isLoading && !isRefreshing} 
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
      />

      {/* Pagination Footer */}
      {!isLoading && filters.totalPages > 0 && (
        <div className="px-6 py-2.5 border border-gray-200 bg-white rounded-xl shadow-sm flex items-center justify-between mt-4">
          <div className="flex items-center gap-3 text-[11px] text-gray-500 font-medium">
            <span>Showing {(filters.page - 1) * filters.limit + 1} to {Math.min(filters.page * filters.limit, filters.filteredOrders.length)} of {filters.filteredOrders.length}</span>
            <div className="h-3 w-px bg-gray-300"></div>
            <div className="flex items-center gap-1.5">
              <span>Rows per page:</span>
              <select 
                value={filters.limit} 
                onChange={(e) => { filters.setLimit(parseInt(e.target.value)); filters.setPage(1); }}
                className="bg-transparent border-none text-gray-700 font-semibold focus:ring-0 cursor-pointer text-[11px] py-0 pr-6"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <button
              disabled={filters.page === 1}
              onClick={() => filters.setPage(filters.page - 1)}
              className="inline-flex items-center justify-center w-7 h-7 rounded bg-white border border-gray-200 text-gray-600 disabled:opacity-50 disabled:bg-transparent hover:bg-gray-50 transition-colors shadow-sm"
            >
              {'<'}
            </button>
            <span className="text-xs font-bold px-3 text-gray-700">{filters.page} <span className="text-gray-400 font-normal">/ {filters.totalPages}</span></span>
            <button
              disabled={filters.page === filters.totalPages}
              onClick={() => filters.setPage(filters.page + 1)}
              className="inline-flex items-center justify-center w-7 h-7 rounded bg-white border border-gray-200 text-gray-600 disabled:opacity-50 disabled:bg-transparent hover:bg-gray-50 transition-colors shadow-sm"
            >
              {'>'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
