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
import { WORKFLOW_QUEUE_DEFAULT_SORT_FIELD, WORKFLOW_QUEUE_DEFAULT_SORT_DIR } from '@/lib/solar-workflow-config';

export default function DocumentationDashboardClient() {
  const [data, setData] = useState<any>(null);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [activeFilter, setActiveFilter] = useState<{ type: string; value: string } | null>(null);
  
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [filterOptions, setFilterOptions] = useState<any>({ systemTypes: [], quarters: [], leadSources: [], assignees: [] });
  const [statusCounts, setStatusCounts] = useState<any>({ all: 0, pendingApproval: 0, execution: 0, completed: 0, rejected: 0 });

  // Sorting
  const { sortField, sortDirection, handleSort, setSortField, setSortDirection } = useTableSorting(WORKFLOW_QUEUE_DEFAULT_SORT_FIELD, WORKFLOW_QUEUE_DEFAULT_SORT_DIR);
  const filters = useSolarFilters();

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const params = new URLSearchParams();
      params.set('page', filters.page.toString());
      params.set('limit', filters.limit.toString());
      
      if (activeFilter && activeFilter.type !== 'All') {
        params.set(activeFilter.type, activeFilter.value);
      }
      
      if (sortField) params.set('sortField', sortField);
      if (sortDirection) params.set('sortDirection', sortDirection);
      if (filters.search) params.set('search', filters.search);
      if (filters.statusFilter && filters.statusFilter !== 'All') params.set('status', filters.statusFilter);
      if (filters.hasOutstandingPayment) params.set('hasOutstandingPayment', 'true');
      
      if (filters.systemTypes.length > 0) params.set('systemType', filters.systemTypes.join(','));
      if (filters.quarters.length > 0) params.set('quarters', filters.quarters.join(','));
      if (filters.leadSources.length > 0) params.set('leadSource', filters.leadSources.join(','));
      if (filters.assignedTo.length > 0) params.set('assignedTo', filters.assignedTo.join(','));

      const res = await fetch(`/api/solar-orders/documentation-dashboard?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      const json = await res.json();
      setData(json);
      setAllOrders(json.items || []);
      
      if (json.pagination) {
        setTotalPages(json.pagination.pages || 1);
        setTotalOrders(json.pagination.total || 0);
      }
      if (json.filterOptions) setFilterOptions(json.filterOptions);
      if (json.statusCounts) setStatusCounts(json.statusCounts);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [
    activeFilter, sortField, sortDirection, 
    filters.page, filters.limit, filters.search, filters.statusFilter, 
    filters.hasOutstandingPayment, filters.systemTypes, filters.quarters, 
    filters.leadSources, filters.assignedTo
  ]);

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
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm sticky top-0 z-10 w-full overflow-hidden">
        <SolarQuickFilters 
          search={filters.search}
          setSearch={filters.setSearch}
          setPage={filters.setPage}
          showFilters={filters.showFilters}
          setShowFilters={filters.setShowFilters}
          activeFilterCount={filters.activeFilterCount}
          statusFilter={filters.statusFilter}
          setStatusFilter={filters.setStatusFilter}
          statusCounts={statusCounts}
          hasOutstandingPayment={filters.hasOutstandingPayment}
          setHasOutstandingPayment={filters.setHasOutstandingPayment}
          showStatusTabs={false}
        >
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing || isLoading}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-md text-[13px] font-medium hover:bg-gray-50 hover:text-[#1A2766] transition-colors disabled:opacity-50 w-full sm:w-auto h-8"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          
          <button
            onClick={handleExportCSV}
            disabled={isLoading || !data?.items?.length}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-md text-[13px] font-medium hover:bg-gray-50 hover:text-[#1A2766] transition-colors disabled:opacity-50 w-full sm:w-auto h-8"
          >
            <Download size={14} />
            Export
          </button>

          <AuthorityBatchButton eligibleCount={data?.summary?.eligibleForAuthoritySignature || 0} />
        </SolarQuickFilters>
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
          filterOptions={filterOptions}
          systemTypes={filters.systemTypes}
          setSystemTypes={filters.setSystemTypes}
          quarters={filters.quarters}
          setQuarters={filters.setQuarters}
          leadSources={filters.leadSources}
          setLeadSources={filters.setLeadSources}
          assignedTo={filters.assignedTo}
          setAssignedTo={filters.setAssignedTo}
          activeFilterCount={filters.activeFilterCount}
          resetFilters={filters.resetFilters}
          toggleArrayItem={filters.toggleArrayItem}
        />
      )}

      {/* Main Table */}
      <DocumentationTable 
        items={allOrders} 
        allSteps={data?.allSteps || []} 
        columnCounters={data?.columnCounters || {}} 
        isLoading={isLoading && !isRefreshing} 
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
      />

      {/* Pagination Footer */}
        {!isLoading && totalPages > 0 && (
          <div className="px-6 py-2.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3 text-[11px] text-gray-500 font-medium">
              <span>Showing {(filters.page - 1) * filters.limit + 1} to {Math.min(filters.page * filters.limit, totalOrders)} of {totalOrders}</span>
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
                <RefreshCw size={14} className="hidden" /> {/* just for spacing match */}
                <span className="sr-only">Previous</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <span className="text-xs font-bold px-3 text-gray-700">{filters.page} <span className="text-gray-400 font-normal">/ {totalPages}</span></span>
              <button
                disabled={filters.page === totalPages}
                onClick={() => filters.setPage(filters.page + 1)}
                className="inline-flex items-center justify-center w-7 h-7 rounded bg-white border border-gray-200 text-gray-600 disabled:opacity-50 disabled:bg-transparent hover:bg-gray-50 transition-colors shadow-sm"
              >
                <span className="sr-only">Next</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
