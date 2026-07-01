import { CheckCircle2, Clock, AlertCircle, ListTodo, Timer, Clock4 } from 'lucide-react';

interface DocumentationDashboardKPIsProps {
  summary: {
    total: number;
    completed: number;
    inProgress: number;
    pendingReview: number;
    overdue: number;
    averageCompletionTime: string;
  };
  onFilterChange: (filterType: string, value: string | null) => void;
  activeFilter: { type: string; value: string } | null;
}

export default function DocumentationDashboardKPIs({ summary, onFilterChange, activeFilter }: DocumentationDashboardKPIsProps) {
  
  const handleCardClick = (type: string, value: string) => {
    if (activeFilter?.type === type && activeFilter?.value === value) {
      onFilterChange(type, null);
    } else {
      onFilterChange(type, value);
    }
  };

  const isCardActive = (type: string, value: string) => activeFilter?.type === type && activeFilter?.value === value;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* Total Orders Card */}
      <div 
        className={`bg-white rounded-lg border p-2.5 cursor-pointer transition-all flex items-center gap-3 ${
          !activeFilter ? 'ring-1 ring-[#1A2766] border-[#1A2766] shadow-sm' : 'border-gray-200 hover:border-[#1A2766]/50 hover:bg-gray-50'
        }`}
        onClick={() => onFilterChange('All', null)}
      >
        <div className="p-1.5 bg-blue-50 text-[#1A2766] rounded-md shrink-0">
          <ListTodo size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Total Orders</h3>
          <div className="flex items-baseline gap-1.5">
            <p className="text-lg font-bold text-gray-900 leading-none">{summary.total}</p>
            <p className="text-[9px] text-gray-400 truncate">In Doc Pipeline</p>
          </div>
        </div>
      </div>

      {/* Completed Card */}
      <div 
        className={`bg-white rounded-lg border p-2.5 cursor-pointer transition-all flex items-center gap-3 ${
          isCardActive('documentationStage', 'Completed') ? 'ring-1 ring-emerald-500 border-emerald-500 shadow-sm' : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
        }`}
        onClick={() => handleCardClick('documentationStage', 'Completed')}
      >
        <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md shrink-0">
          <CheckCircle2 size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Completed</h3>
          <div className="flex items-baseline gap-1.5">
            <p className="text-lg font-bold text-emerald-600 leading-none">{summary.completed}</p>
            <p className="text-[9px] text-gray-400 truncate">Ready</p>
          </div>
        </div>
      </div>

      {/* In Progress Card */}
      <div 
        className={`bg-white rounded-lg border p-2.5 cursor-pointer transition-all flex items-center gap-3 ${
          isCardActive('status', 'IN_PROGRESS') ? 'ring-1 ring-blue-500 border-blue-500 shadow-sm' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
        }`}
        onClick={() => handleCardClick('status', 'IN_PROGRESS')}
      >
        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md shrink-0">
          <Clock size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">In Progress</h3>
          <div className="flex items-baseline gap-1.5">
            <p className="text-lg font-bold text-blue-600 leading-none">{summary.inProgress}</p>
            <p className="text-[9px] text-gray-400 truncate">Active</p>
          </div>
        </div>
      </div>

      {/* Pending Review Card */}
      <div 
        className={`bg-white rounded-lg border p-2.5 cursor-pointer transition-all flex items-center gap-3 ${
          isCardActive('status', 'PENDING_REVIEW') ? 'ring-1 ring-orange-500 border-orange-500 shadow-sm' : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
        }`}
        onClick={() => handleCardClick('status', 'PENDING_REVIEW')}
      >
        <div className="p-1.5 bg-orange-50 text-orange-500 rounded-md shrink-0">
          <Clock4 size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Review</h3>
          <div className="flex items-baseline gap-1.5">
            <p className="text-lg font-bold text-orange-500 leading-none">{summary.pendingReview}</p>
            <p className="text-[9px] text-gray-400 truncate">Pending</p>
          </div>
        </div>
      </div>

      {/* Overdue Card */}
      <div 
        className={`bg-white rounded-lg border p-2.5 cursor-pointer transition-all flex items-center gap-3 ${
          isCardActive('status', 'OVERDUE') ? 'ring-1 ring-red-500 border-red-500 shadow-sm' : 'border-gray-200 hover:border-red-300 hover:bg-gray-50'
        }`}
        onClick={() => handleCardClick('status', 'OVERDUE')}
      >
        <div className="p-1.5 bg-red-50 text-red-600 rounded-md shrink-0">
          <AlertCircle size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Overdue</h3>
          <div className="flex items-baseline gap-1.5">
            <p className="text-lg font-bold text-red-600 leading-none">{summary.overdue}</p>
            <p className="text-[9px] text-gray-400 truncate">&gt; 3 days inactive</p>
          </div>
        </div>
      </div>

      {/* Average Completion Time */}
      <div className="bg-white rounded-lg border border-gray-200 p-2.5 flex items-center gap-3">
        <div className="p-1.5 bg-purple-50 text-purple-600 rounded-md shrink-0">
          <Timer size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Avg. Time</h3>
          <div className="flex items-baseline gap-1.5">
            <p className="text-lg font-bold text-gray-900 leading-none">{summary.averageCompletionTime}</p>
            <p className="text-[9px] text-gray-400 truncate">To complete</p>
          </div>
        </div>
      </div>
    </div>
  );
}
