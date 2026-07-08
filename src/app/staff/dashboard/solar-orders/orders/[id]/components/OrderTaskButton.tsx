'use client';

import { ClipboardList } from 'lucide-react';
import { useGlobalTaskDrawer } from '../../../components/global-tasks/GlobalTaskDrawerProvider';

export default function OrderTaskButton({ order }: { order: any }) {
  const { openNewTaskModal } = useGlobalTaskDrawer();

  const isInactive = ['DRAFT', 'REJECTED', 'COMPLETED', 'CANCELLED'].includes(order.status);

  return (
    <button
      onClick={() => openNewTaskModal(order)}
      disabled={isInactive}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition-colors border ${
        isInactive 
          ? 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600'
      }`}
      title={isInactive ? "Tasks can only be created for active orders." : "Create New Task"}
    >
      <ClipboardList size={14} />
      <span>+ New Task</span>
    </button>
  );
}
