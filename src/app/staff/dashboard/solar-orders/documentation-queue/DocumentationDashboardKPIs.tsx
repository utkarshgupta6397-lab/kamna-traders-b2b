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
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {/* Total Orders Card */}
      <div 
        className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${
          !activeFilter ? 'ring-2 ring-[#1A2766] border-[#1A2766] shadow-md' : 'border-gray-200 hover:border-[#1A2766]/50 hover:shadow-sm'
        }`}
        onClick={() => onFilterChange('All', null)}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-50 text-[#1A2766] rounded-lg">
            <ListTodo size={18} />
          </div>
          <h3 className="text-sm font-semibold text-gray-700">Total Orders</h3>
        </div>
        <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
        <p className="text-xs text-gray-500 mt-1">In Documentation</p>
      </div>

      {/* Completed Card */}
      <div 
        className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${
          isCardActive('documentationStage', 'Completed') ? 'ring-2 ring-emerald-500 border-emerald-500 shadow-md' : 'border-gray-200 hover:border-emerald-300 hover:shadow-sm'
        }`}
        onClick={() => handleCardClick('documentationStage', 'Completed')}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 size={18} />
          </div>
          <h3 className="text-sm font-semibold text-gray-700">Completed</h3>
        </div>
        <p className="text-2xl font-bold text-emerald-600">{summary.completed}</p>
        <p className="text-xs text-gray-500 mt-1">Ready for execution</p>
      </div>

      {/* In Progress Card */}
      <div 
        className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${
          isCardActive('status', 'IN_PROGRESS') ? 'ring-2 ring-blue-500 border-blue-500 shadow-md' : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
        }`}
        onClick={() => handleCardClick('status', 'IN_PROGRESS')}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Clock size={18} />
          </div>
          <h3 className="text-sm font-semibold text-gray-700">In Progress</h3>
        </div>
        <p className="text-2xl font-bold text-blue-600">{summary.inProgress}</p>
        <p className="text-xs text-gray-500 mt-1">Active workflows</p>
      </div>

      {/* Pending Review Card */}
      <div 
        className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${
          isCardActive('status', 'PENDING_REVIEW') ? 'ring-2 ring-orange-500 border-orange-500 shadow-md' : 'border-gray-200 hover:border-orange-300 hover:shadow-sm'
        }`}
        onClick={() => handleCardClick('status', 'PENDING_REVIEW')}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-orange-50 text-orange-500 rounded-lg">
            <Clock4 size={18} />
          </div>
          <h3 className="text-sm font-semibold text-gray-700">Pending Review</h3>
        </div>
        <p className="text-2xl font-bold text-orange-500">{summary.pendingReview}</p>
        <p className="text-xs text-gray-500 mt-1">Needs attention</p>
      </div>

      {/* Overdue Card */}
      <div 
        className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${
          isCardActive('status', 'OVERDUE') ? 'ring-2 ring-red-500 border-red-500 shadow-md' : 'border-gray-200 hover:border-red-300 hover:shadow-sm'
        }`}
        onClick={() => handleCardClick('status', 'OVERDUE')}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-red-50 text-red-600 rounded-lg">
            <AlertCircle size={18} />
          </div>
          <h3 className="text-sm font-semibold text-gray-700">Overdue</h3>
        </div>
        <p className="text-2xl font-bold text-red-600">{summary.overdue}</p>
        <p className="text-xs text-gray-500 mt-1">&gt; 3 days inactive</p>
      </div>

      {/* Average Completion Time */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
            <Timer size={18} />
          </div>
          <h3 className="text-sm font-semibold text-gray-700">Avg. Time</h3>
        </div>
        <p className="text-2xl font-bold text-gray-900">{summary.averageCompletionTime}</p>
        <p className="text-xs text-gray-500 mt-1">Across completed</p>
      </div>
    </div>
  );
}
