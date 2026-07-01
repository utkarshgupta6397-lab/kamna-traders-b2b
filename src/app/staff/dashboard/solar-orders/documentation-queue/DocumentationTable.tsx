import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, XCircle, FileText, ArrowRight, Check } from 'lucide-react';
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
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1A2766]"></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="w-full py-16 flex flex-col items-center justify-center bg-white rounded-lg border border-gray-200 shadow-sm">
        <FileText className="text-gray-300 mb-4" size={40} />
        <h3 className="text-base font-medium text-gray-900">No orders found</h3>
        <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or search terms.</p>
      </div>
    );
  }

  const renderStatusCell = (stepName: string, stepData: any, isRowHovered: boolean, isColHovered: boolean) => {
    let icon = <div className="h-3 w-3 rounded-full border-2 border-gray-300" />;
    let statusText = 'Pending';
    let completedBy = '';
    let completedAtTime = '';
    let updatedAtTime = '';
    let notesText = '';
    
    if (stepData) {
      const { status, completedByName, completedAt, updatedAt, notes } = stepData;
      notesText = notes || '';
      updatedAtTime = updatedAt ? new Date(updatedAt).toLocaleString() : '';
      
      if (status === 'COMPLETED') {
        icon = <div className="h-4 w-4 bg-emerald-500 rounded-full flex items-center justify-center"><Check size={10} className="text-white" strokeWidth={3} /></div>;
        statusText = 'Completed';
        completedBy = completedByName || 'System';
        completedAtTime = completedAt ? new Date(completedAt).toLocaleString() : '';
      } else if (status === 'IN_PROGRESS') {
        icon = <div className="h-3.5 w-3.5 rounded-full bg-blue-500" />;
        statusText = 'In Progress';
      } else if (status === 'BLOCKED' || status === 'REJECTED') {
        icon = <XCircle className="text-red-500" size={16} />;
        statusText = status === 'BLOCKED' ? 'Blocked' : 'Rejected';
      } else if (status === 'PENDING' && stepName.toLowerCase().includes('review')) {
        icon = <Clock className="text-orange-500" size={16} />;
        statusText = 'Waiting for Review';
      }
    }

    const isCrossHovered = isRowHovered && isColHovered;

    return (
      <div className={`flex justify-center group relative cursor-help w-full h-full items-center p-1.5 rounded transition-colors ${isCrossHovered ? 'bg-blue-100/50' : ''}`}>
        {icon}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 p-2.5 bg-gray-900 text-white text-[11px] rounded shadow-lg z-50 pointer-events-none min-w-[200px] text-left leading-relaxed">
          <div className="font-semibold text-sm mb-1 border-b border-gray-700 pb-1">{stepName}</div>
          <div className="flex justify-between gap-4"><span className="text-gray-400">Status:</span> <span>{statusText}</span></div>
          {completedBy && <div className="flex justify-between gap-4"><span className="text-gray-400">By:</span> <span>{completedBy}</span></div>}
          {completedAtTime && <div className="flex justify-between gap-4"><span className="text-gray-400">Time:</span> <span>{completedAtTime}</span></div>}
          {updatedAtTime && !completedAtTime && <div className="flex justify-between gap-4"><span className="text-gray-400">Updated:</span> <span>{updatedAtTime}</span></div>}
          {notesText && <div className="mt-1 pt-1 border-t border-gray-700 text-gray-300 italic">"{notesText}"</div>}
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 text-[11px] font-medium text-gray-600 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm w-fit">
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-4 bg-emerald-500 rounded-full flex items-center justify-center"><Check size={10} className="text-white" strokeWidth={3} /></div>
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3.5 w-3.5 rounded-full bg-blue-500" />
          <span>Current</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full border-2 border-gray-300" />
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="text-orange-500" size={14} />
          <span>Review</span>
        </div>
        <div className="flex items-center gap-1.5">
          <XCircle className="text-red-500" size={14} />
          <span>Rejected</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col relative z-0">
        <div className="overflow-x-auto hide-scrollbar">
          <table className="w-full text-left whitespace-nowrap table-fixed border-collapse">
            <thead className="text-[10px] text-gray-700 bg-gray-50 border-b border-gray-200 sticky top-0 z-20 shadow-sm">
              <tr>
                {/* Frozen Columns Left */}
                <th className="px-2 py-2 font-semibold sticky left-0 bg-gray-50 z-30 shadow-[1px_0_0_0_#e5e7eb] w-[40px] text-center align-bottom pb-3">
                  #
                </th>
                <th className="px-3 py-2 font-semibold sticky left-[40px] bg-gray-50 z-30 shadow-[1px_0_0_0_#e5e7eb] w-[180px] align-bottom pb-3">
                  Customer
                </th>
                
                {/* Scrollable Context Columns */}
                <th className="px-3 py-2 font-semibold w-[140px] align-bottom pb-3 bg-gray-50">
                  Current Stage
                </th>
                <th className="px-3 py-2 font-semibold w-[90px] align-bottom pb-3 bg-gray-50">
                  Progress
                </th>
                
                {/* Dynamic Steps Columns */}
                {allSteps.map(step => (
                  <th 
                    key={step} 
                    className={`px-1 font-medium text-center w-[45px] max-w-[45px] transition-colors h-[110px] align-bottom pb-2 cursor-help relative bg-gray-50 ${hoveredCol === step ? 'bg-blue-50/50' : ''}`}
                    onMouseEnter={() => setHoveredCol(step)}
                    onMouseLeave={() => setHoveredCol(null)}
                    title={step}
                  >
                    <div className="flex flex-col items-center justify-end h-full gap-2 relative">
                      <div className="flex items-end justify-start w-full h-[80px] overflow-visible pb-1 relative">
                        <span 
                          className="text-[11px] font-medium leading-none tracking-tight text-gray-500 whitespace-nowrap absolute bottom-2 left-2 origin-bottom-left"
                          style={{ transform: 'rotate(-55deg)' }}
                        >
                          {step}
                        </span>
                      </div>
                      <span className="bg-gray-200 text-gray-600 text-[9px] px-1.5 py-0.5 rounded-sm font-semibold w-[30px] text-center">
                        {columnCounters[step] || 0}
                      </span>
                    </div>
                  </th>
                ))}

                {/* Frozen Right Action Column */}
                <th className="px-2 py-2 font-semibold sticky right-0 bg-gray-50 z-30 shadow-[-1px_0_0_0_#e5e7eb] w-[60px] text-center align-bottom pb-3">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, idx) => {
                const isRowHovered = hoveredRow === item.id;
                
                let baseRowClass = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
                if (item.isOverdue) baseRowClass = 'bg-red-50/30';
                if (isRowHovered) baseRowClass = 'bg-blue-50/40';

                let frozenClass = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                if (item.isOverdue) frozenClass = 'bg-red-50/90';
                if (isRowHovered) frozenClass = 'bg-blue-50/80';
                
                return (
                  <tr 
                    key={item.id} 
                    className={`transition-colors h-[54px] ${baseRowClass}`}
                    onMouseEnter={() => setHoveredRow(item.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    {/* Frozen Columns Left */}
                    <td className={`px-2 py-1.5 sticky left-0 z-10 shadow-[1px_0_0_0_#f3f4f6] text-center text-[11px] font-medium text-gray-400 transition-colors ${frozenClass}`}>
                      {idx + 1}
                    </td>
                    <td className={`px-3 py-1.5 sticky left-[40px] z-10 shadow-[1px_0_0_0_#f3f4f6] transition-colors ${frozenClass}`}>
                      <div className="flex flex-col justify-center">
                        <span className="text-[12px] font-bold text-gray-900 truncate w-[160px]" title={item.customerName}>{item.customerName}</span>
                        <span className="text-[11px] font-medium text-[#1A2766] truncate w-[160px]">{item.orderNumber}</span>
                        <span className="text-[10px] text-gray-400 truncate w-[160px]">{item.assignedExecutive}</span>
                      </div>
                    </td>

                    {/* Scrollable Context Columns */}
                    <td className={`px-3 py-1.5 transition-colors ${baseRowClass}`}>
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
                    <td className={`px-3 py-1.5 transition-colors ${baseRowClass}`}>
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
                    {allSteps.map(step => {
                      const isColHovered = hoveredCol === step;
                      return (
                        <td 
                          key={step} 
                          className={`px-1.5 py-1.5 align-middle transition-colors ${isColHovered && !isRowHovered ? 'bg-blue-50/30' : ''}`}
                          onMouseEnter={() => setHoveredCol(step)}
                          onMouseLeave={() => setHoveredCol(null)}
                        >
                          {renderStatusCell(step, item.stepsMap[step], isRowHovered, isColHovered)}
                        </td>
                      );
                    })}

                    {/* Frozen Right Action Column */}
                    <td className={`px-2 py-1.5 sticky right-0 z-10 shadow-[-1px_0_0_0_#f3f4f6] text-center transition-colors ${frozenClass}`}>
                      <Link href={`/staff/dashboard/solar-orders/orders/${item.id}/documentation`}>
                        <button className="text-gray-400 hover:text-[#1A2766] bg-white hover:bg-blue-50 border border-gray-200 rounded-md p-1.5 shadow-sm transition-all" title="View Docs">
                          <ArrowRight size={14} />
                        </button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 text-[11px] text-gray-500 flex justify-between items-center z-10">
          <span>Showing {items.length} orders</span>
          <span className="italic">Horizontal scroll to view all stages &rarr;</span>
        </div>
      </div>
    </div>
  );
}
