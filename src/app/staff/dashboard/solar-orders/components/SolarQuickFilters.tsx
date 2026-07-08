import React, { useState, useEffect } from 'react';
import { Search, Filter, AlertCircle, X } from 'lucide-react';

interface SolarQuickFiltersProps {
  search: string;
  setSearch: (val: string) => void;
  setPage: (val: number) => void;
  showFilters: boolean;
  setShowFilters: (val: boolean) => void;
  activeFilterCount: number;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  statusCounts: {
    all: number;
    pendingApproval: number;
    execution: number;
    completed: number;
    rejected: number;
    cancelled: number;
  };
  hasOutstandingPayment: boolean;
  setHasOutstandingPayment: (val: boolean) => void;
  showStatusTabs?: boolean;
  children?: React.ReactNode;
}

const SolarQuickFilters = React.memo(function SolarQuickFilters({
  search,
  setSearch,
  setPage,
  showFilters,
  setShowFilters,
  activeFilterCount,
  statusFilter,
  setStatusFilter,
  statusCounts,
  hasOutstandingPayment,
  setHasOutstandingPayment,
  showStatusTabs = true,
  children
}: SolarQuickFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearch !== search) {
        setSearch(localSearch);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [localSearch, search, setSearch, setPage]);

  // Handle external search resets
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  return (
    <div className="flex flex-col lg:flex-row items-center gap-3 w-full">
      {/* 1. Global Search */}
      <div className="relative w-full lg:w-[360px] shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
          placeholder="Search by Order No, Customer, Mobile, Salesman..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-[13px] text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors h-8"
        />
        {localSearch && (
          <button 
            onClick={() => { setLocalSearch(''); setSearch(''); setPage(1); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* 2. Filters & Status Chips */}
      <div className="flex flex-1 items-center gap-2 overflow-x-auto custom-scrollbar pb-1 lg:pb-0 flex-nowrap min-w-0 w-full">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors shrink-0 h-8 border ${
            showFilters 
              ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-inner' 
              : activeFilterCount > 0
                ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Filter size={14} className={activeFilterCount > 0 ? "fill-current" : ""} />
          {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
        </button>

        {showStatusTabs && (
          <>
            <div className="h-4 w-px bg-gray-200 shrink-0 mx-1"></div>
            
            {[
              { label: 'All Orders', value: 'All', count: statusCounts.all },
              { label: 'Pending Approval', value: 'PENDING_APPROVAL', count: statusCounts.pendingApproval },
              { label: 'Execution', value: 'EXECUTION', count: statusCounts.execution },
              { label: 'Completed', value: 'COMPLETED', count: statusCounts.completed },
              { label: 'Rejected', value: 'REJECTED', count: statusCounts.rejected },
              { label: 'Cancelled', value: 'CANCELLED', count: statusCounts.cancelled }
            ].map(tab => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors shrink-0 h-8 ${
                  statusFilter === tab.value 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'bg-white text-gray-600 border border-transparent hover:bg-gray-50 hover:border-gray-200'
                }`}
              >
                {tab.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  statusFilter === tab.value 
                    ? 'bg-white/20 text-white' 
                    : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* 3. Actions / Right side */}
      <div className="flex items-center gap-2 shrink-0 w-full lg:w-auto justify-end">
        <button
          onClick={() => setHasOutstandingPayment(!hasOutstandingPayment)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors border h-8 ${
            hasOutstandingPayment
              ? 'bg-red-50 text-red-700 border-red-200 shadow-inner'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <AlertCircle size={14} className={hasOutstandingPayment ? 'fill-current opacity-20' : 'text-gray-400'} />
          Outstanding Payment
        </button>

        {children && (
          <>
            <div className="h-4 w-px bg-gray-200 hidden lg:block"></div>
            {children}
          </>
        )}
      </div>
    </div>
  );
});

export default SolarQuickFilters;
