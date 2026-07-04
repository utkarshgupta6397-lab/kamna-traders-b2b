import { Search, Filter } from 'lucide-react';

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
  };
  hasOutstandingPayment: boolean;
  setHasOutstandingPayment: (val: boolean) => void;
  showStatusTabs?: boolean;
}

export default function SolarQuickFilters({
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
  showStatusTabs = true
}: SolarQuickFiltersProps) {
  return (
    <div className="flex items-center gap-3 w-full xl:w-auto">
      <div className="relative w-full sm:w-64 group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={14} />
        <input
          type="text"
          placeholder="Search orders..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-8 pr-4 py-1.5 text-xs bg-gray-50/50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
        />
      </div>
      
      <button
        onClick={() => setShowFilters(!showFilters)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${showFilters || activeFilterCount > 0 ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
      >
        <Filter size={14} />
        Filters {activeFilterCount > 0 && `(${activeFilterCount})`} {showFilters ? '▲' : '▼'}
      </button>

      {showStatusTabs && (
        <>
          <div className="h-5 w-px bg-gray-200 hidden sm:block"></div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 xl:pb-0">
            {[
              { id: 'All', label: 'All', count: statusCounts.all },
              { id: 'PENDING_APPROVAL', label: 'Pending Approval', count: statusCounts.pendingApproval },
              { id: 'EXECUTION', label: 'Execution', count: statusCounts.execution },
              { id: 'COMPLETED', label: 'Completed', count: statusCounts.completed },
              { id: 'REJECTED', label: 'Rejected / Cancelled', count: statusCounts.rejected },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setStatusFilter(tab.id); setPage(1); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                  statusFilter === tab.id
                    ? 'bg-blue-50 text-blue-700 border-blue-200' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  statusFilter === tab.id ? 'bg-blue-100/50' : 'bg-gray-100'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
      
      {(showStatusTabs ? <div className="h-4 w-px bg-gray-200 mx-1"></div> : <div className="h-5 w-px bg-gray-200 hidden sm:block"></div>)}
      
      <button
        onClick={() => { setHasOutstandingPayment(!hasOutstandingPayment); setPage(1); }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors whitespace-nowrap ${
          hasOutstandingPayment
            ? 'bg-red-50 text-red-700 border-red-200 shadow-sm border' 
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-transparent'
        }`}
      >
        Outstanding Payment
      </button>
    </div>
  );
}
