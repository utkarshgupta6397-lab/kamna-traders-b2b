import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, XCircle, Minus, FileText, ArrowRight, IndianRupee } from 'lucide-react';
import Link from 'next/link';

interface DocumentationTableProps {
  items: any[];
  allSteps: string[];
  columnCounters: Record<string, number>;
  isLoading: boolean;
}

export default function DocumentationTable({ items, allSteps, columnCounters, isLoading }: DocumentationTableProps) {
  const router = useRouter();
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-white rounded-xl border border-gray-200">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1A2766]"></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="w-full py-16 flex flex-col items-center justify-center bg-white rounded-xl border border-gray-200">
        <FileText className="text-gray-300 mb-4" size={48} />
        <h3 className="text-lg font-medium text-gray-900">No orders found</h3>
        <p className="text-gray-500 mt-1">Try adjusting your filters or search terms.</p>
      </div>
    );
  }

  const renderStatusCell = (stepName: string, stepData: any) => {
    if (!stepData) {
      return (
        <div className="flex justify-center" title="Pending">
          <Minus className="text-gray-300" size={16} />
        </div>
      );
    }

    const { status, completedByName, completedAt, updatedAt, notes } = stepData;
    let icon = <Minus className="text-gray-300" size={16} />;
    let title = 'Pending';
    
    if (status === 'COMPLETED') {
      icon = <CheckCircle2 className="text-emerald-500" size={18} />;
      title = `Completed by ${completedByName || 'System'} on ${completedAt ? new Date(completedAt).toLocaleDateString() : 'Unknown'}`;
    } else if (status === 'IN_PROGRESS') {
      icon = <div className="h-4 w-4 rounded-full border-2 border-blue-500 bg-white" />;
      title = `In Progress (Updated ${updatedAt ? new Date(updatedAt).toLocaleDateString() : 'Unknown'})`;
    } else if (status === 'BLOCKED' || status === 'REJECTED') {
      icon = <XCircle className="text-red-500" size={18} />;
      title = `Blocked / Rejected: ${notes || 'No remarks'}`;
    } else if (status === 'PENDING' && stepName.toLowerCase().includes('review')) {
      icon = <Clock className="text-orange-500" size={18} />;
      title = 'Waiting for Review';
    }

    return (
      <div className="flex justify-center group relative cursor-help">
        {icon}
        {/* Simple tooltip implementation (in production, use Radix UI Tooltip or similar for robust positioning) */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50 pointer-events-none">
          {title}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto hide-scrollbar">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200 sticky top-0 z-20">
            <tr>
              {/* Frozen Columns */}
              <th className="px-4 py-3 font-semibold sticky left-0 bg-gray-50 z-30 shadow-[1px_0_0_0_#e5e7eb]">
                # / Customer
              </th>
              <th className="px-4 py-3 font-semibold sticky left-[160px] bg-gray-50 z-30 shadow-[1px_0_0_0_#e5e7eb] min-w-[120px]">
                Order Info
              </th>
              <th className="px-4 py-3 font-semibold sticky left-[280px] bg-gray-50 z-30 shadow-[1px_0_0_0_#e5e7eb] min-w-[150px]">
                Current Stage
              </th>
              <th className="px-4 py-3 font-semibold sticky left-[430px] bg-gray-50 z-30 shadow-[1px_0_0_0_#e5e7eb] min-w-[100px]">
                Progress
              </th>
              
              {/* Dynamic Steps Columns */}
              {allSteps.map(step => (
                <th key={step} className="px-4 py-3 font-medium text-center min-w-[140px] max-w-[160px] whitespace-normal">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <span>{step}</span>
                    <span className="bg-gray-200 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full">
                      {columnCounters[step] || 0}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item, idx) => (
              <tr 
                key={item.id} 
                className={`transition-colors relative ${item.isOverdue ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'} ${idx % 2 === 0 && !item.isOverdue ? 'bg-white' : ''}`}
                onMouseEnter={() => setHoveredRow(item.id)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {/* Frozen Columns */}
                <td className={`px-4 py-3 sticky left-0 z-10 shadow-[1px_0_0_0_#e5e7eb] ${item.isOverdue ? 'bg-red-50 group-hover:bg-red-100' : (idx % 2 === 0 ? 'bg-white group-hover:bg-gray-50' : 'bg-gray-50')}`}>
                  <div className="font-semibold text-gray-900 truncate max-w-[140px]">{item.customerName}</div>
                  <div className="text-xs text-gray-500 truncate max-w-[140px]">{item.assignedExecutive}</div>
                </td>
                <td className={`px-4 py-3 sticky left-[160px] z-10 shadow-[1px_0_0_0_#e5e7eb] ${item.isOverdue ? 'bg-red-50' : (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50')}`}>
                  <div className="font-medium text-[#1A2766]">{item.orderNumber}</div>
                  <div className="text-xs text-gray-500">{new Date(item.orderDate).toLocaleDateString()}</div>
                </td>
                <td className={`px-4 py-3 sticky left-[280px] z-10 shadow-[1px_0_0_0_#e5e7eb] ${item.isOverdue ? 'bg-red-50' : (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50')}`}>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    item.currentStage === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 
                    item.isOverdue ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                  } whitespace-normal text-center leading-tight`}>
                    {item.currentStage}
                  </span>
                </td>
                <td className={`px-4 py-3 sticky left-[430px] z-10 shadow-[1px_0_0_0_#e5e7eb] ${item.isOverdue ? 'bg-red-50' : (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50')}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full" 
                        style={{ width: `${item.workflowPercentage}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-medium text-gray-600">{item.workflowPercentage}%</span>
                  </div>
                </td>

                {/* Dynamic Step Columns */}
                {allSteps.map(step => (
                  <td key={step} className="px-4 py-3">
                    {renderStatusCell(step, item.stepsMap[step])}
                  </td>
                ))}

                {/* Quick Actions Hover Overlay on the entire row */}
                {hoveredRow === item.id && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-white/90 backdrop-blur shadow-sm p-1.5 rounded-lg border border-gray-200 z-40">
                    <Link href={`/staff/dashboard/solar-orders/orders/${item.id}`}>
                      <button className="text-xs font-medium text-gray-600 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors">
                        Order
                      </button>
                    </Link>
                    <Link href={`/staff/dashboard/solar-orders/orders/${item.id}/documentation`}>
                      <button className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors flex items-center gap-1">
                        Docs <ArrowRight size={12} />
                      </button>
                    </Link>
                  </div>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex justify-between items-center">
        <span>Showing {items.length} orders</span>
        <span className="italic">Horizontal scroll to view all stages →</span>
      </div>
    </div>
  );
}
