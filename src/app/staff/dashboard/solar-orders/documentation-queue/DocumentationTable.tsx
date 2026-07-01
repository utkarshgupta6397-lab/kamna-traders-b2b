import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, XCircle, Minus, FileText, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface DocumentationTableProps {
  items: any[];
  allSteps: string[];
  columnCounters: Record<string, number>;
  isLoading: boolean;
}

export default function DocumentationTable({ items, allSteps, columnCounters, isLoading }: DocumentationTableProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-white rounded-xl border border-gray-200">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1A2766]"></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="w-full py-16 flex flex-col items-center justify-center bg-white rounded-lg border border-gray-200">
        <FileText className="text-gray-300 mb-4" size={40} />
        <h3 className="text-base font-medium text-gray-900">No orders found</h3>
        <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or search terms.</p>
      </div>
    );
  }

  const renderStatusCell = (stepName: string, stepData: any) => {
    if (!stepData) {
      return (
        <div className="flex justify-center" title="Pending">
          <div className="h-2 w-2 rounded-full bg-gray-300" />
        </div>
      );
    }

    const { status, completedByName, completedAt, updatedAt, notes } = stepData;
    let icon = <div className="h-2 w-2 rounded-full bg-gray-300" />;
    let title = 'Pending';
    
    if (status === 'COMPLETED') {
      icon = <CheckCircle2 className="text-emerald-500" size={16} />;
      title = `Completed by ${completedByName || 'System'} on ${completedAt ? new Date(completedAt).toLocaleDateString() : 'Unknown'}`;
    } else if (status === 'IN_PROGRESS') {
      icon = <div className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.3)]" />;
      title = `In Progress (Updated ${updatedAt ? new Date(updatedAt).toLocaleDateString() : 'Unknown'})`;
    } else if (status === 'BLOCKED' || status === 'REJECTED') {
      icon = <XCircle className="text-red-500" size={16} />;
      title = `Blocked / Rejected: ${notes || 'No remarks'}`;
    } else if (status === 'PENDING' && stepName.toLowerCase().includes('review')) {
      icon = <Clock className="text-orange-500" size={15} />;
      title = 'Waiting for Review';
    } else if (status === 'PENDING') {
      icon = <div className="h-2 w-2 rounded-full bg-gray-300" />;
      title = 'Pending';
    }

    return (
      <div className="flex justify-center group relative cursor-help">
        {icon}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-900 text-white text-[11px] rounded whitespace-nowrap z-50 pointer-events-none">
          <div className="font-semibold mb-0.5">{stepName}</div>
          {title}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
    );
  };

  const getStepSubtitle = (currentStage: string) => {
    if (currentStage === 'Completed') return 'Done';
    const index = allSteps.indexOf(currentStage);
    return index >= 0 ? `Step ${index + 1}/${allSteps.length}` : '';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto hide-scrollbar">
        <table className="w-full text-left whitespace-nowrap table-fixed">
          <thead className="text-[10px] text-gray-500 uppercase bg-gray-50 border-b border-gray-200 sticky top-0 z-20">
            <tr>
              {/* Frozen Columns Left */}
              <th className="px-3 py-2 font-semibold sticky left-0 bg-gray-50 z-30 shadow-[1px_0_0_0_#e5e7eb] w-[150px]">
                Customer
              </th>
              <th className="px-3 py-2 font-semibold sticky left-[150px] bg-gray-50 z-30 shadow-[1px_0_0_0_#e5e7eb] w-[120px]">
                Order
              </th>
              <th className="px-3 py-2 font-semibold sticky left-[270px] bg-gray-50 z-30 shadow-[1px_0_0_0_#e5e7eb] w-[140px]">
                Current Stage
              </th>
              <th className="px-3 py-2 font-semibold sticky left-[410px] bg-gray-50 z-30 shadow-[1px_0_0_0_#e5e7eb] w-[90px]">
                Progress
              </th>
              
              {/* Dynamic Steps Columns */}
              {allSteps.map(step => (
                <th key={step} className="px-1.5 py-2 font-medium text-center w-[50px]">
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <span className="text-[9px] leading-[10px] whitespace-normal break-words w-full h-[20px] overflow-hidden truncate px-0.5" title={step}>
                      {step.split(' ').map(w => w[0]).join('') /* Initials or tiny text? Let's just use tiny text */}
                      {step.split(' ').length > 1 ? step.split(' ').slice(0, 2).map(w => w.substring(0, 3)).join(' ') : step.substring(0, 5)}
                    </span>
                    <span className="bg-gray-200 text-gray-600 text-[8px] px-1 py-0 rounded-sm font-semibold">
                      {columnCounters[step] || 0}
                    </span>
                  </div>
                </th>
              ))}

              {/* Frozen Right Action Column */}
              <th className="px-2 py-2 font-semibold sticky right-0 bg-gray-50 z-30 shadow-[-1px_0_0_0_#e5e7eb] w-[60px] text-center">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, idx) => (
              <tr 
                key={item.id} 
                className={`transition-colors h-[48px] ${item.isOverdue ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-gray-50'} ${idx % 2 === 0 && !item.isOverdue ? 'bg-white' : ''}`}
              >
                {/* Frozen Columns Left */}
                <td className={`px-3 py-1.5 sticky left-0 z-10 shadow-[1px_0_0_0_#f3f4f6] ${item.isOverdue ? 'bg-red-50/90' : (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50')}`}>
                  <div className="text-[13px] font-semibold text-gray-900 truncate w-[130px]" title={item.customerName}>{item.customerName}</div>
                  <div className="text-[11px] text-gray-500 truncate w-[130px]">{item.assignedExecutive}</div>
                </td>
                <td className={`px-3 py-1.5 sticky left-[150px] z-10 shadow-[1px_0_0_0_#f3f4f6] ${item.isOverdue ? 'bg-red-50/90' : (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50')}`}>
                  <div className="text-[12px] font-medium text-[#1A2766]">{item.orderNumber}</div>
                  <div className="text-[10px] text-gray-500">{new Date(item.orderDate).toLocaleDateString()}</div>
                </td>
                <td className={`px-3 py-1.5 sticky left-[270px] z-10 shadow-[1px_0_0_0_#f3f4f6] ${item.isOverdue ? 'bg-red-50/90' : (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50')}`}>
                  <div className="flex flex-col items-start max-w-[120px]">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium truncate w-full ${
                      item.currentStage === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 
                      item.isOverdue ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                    }`} title={item.currentStage}>
                      {item.currentStage}
                    </span>
                    <span className="text-[9px] text-gray-500 mt-0.5 font-medium">{getStepSubtitle(item.currentStage)}</span>
                  </div>
                </td>
                <td className={`px-3 py-1.5 sticky left-[410px] z-10 shadow-[1px_0_0_0_#f3f4f6] ${item.isOverdue ? 'bg-red-50/90' : (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50')}`}>
                  <div className="flex flex-col gap-1 w-[70px]">
                    <span className="text-[11px] font-bold text-gray-700 text-right leading-none">{item.workflowPercentage}%</span>
                    <div className="w-full h-[3px] bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full" 
                        style={{ width: `${item.workflowPercentage}%` }}
                      ></div>
                    </div>
                  </div>
                </td>

                {/* Dynamic Step Columns */}
                {allSteps.map(step => (
                  <td key={step} className="px-1.5 py-1.5 align-middle">
                    {renderStatusCell(step, item.stepsMap[step])}
                  </td>
                ))}

                {/* Frozen Right Action Column */}
                <td className={`px-2 py-1.5 sticky right-0 z-10 shadow-[-1px_0_0_0_#f3f4f6] text-center ${item.isOverdue ? 'bg-red-50/90' : (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50')}`}>
                  <Link href={`/staff/dashboard/solar-orders/orders/${item.id}/documentation`}>
                    <button className="text-gray-400 hover:text-[#1A2766] bg-white hover:bg-blue-50 border border-gray-200 rounded-md p-1.5 shadow-sm transition-all" title="View Docs">
                      <ArrowRight size={14} />
                    </button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 text-[11px] text-gray-500 flex justify-between items-center">
        <span>Showing {items.length} orders</span>
        <span className="italic">Horizontal scroll to view all stages &rarr;</span>
      </div>
    </div>
  );
}
