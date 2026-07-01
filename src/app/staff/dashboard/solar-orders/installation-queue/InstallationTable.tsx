'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock, XCircle, FileText, ArrowRight, Check, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

interface InstallationTableProps {
  items: any[];
  allSteps: string[];
  columnCounters: Record<string, number>;
  isLoading: boolean;
}

const isValidValue = (val: any) => {
  if (val === null || val === undefined) return false;
  const s = String(val).trim().toLowerCase();
  return s !== '' && s !== '?' && s !== 'undefined' && s !== 'null' && s !== 'n/a';
};

const formatDateTime = (dateStr: string) => {
  if (!isValidValue(dateStr)) return '';
  const d = new Date(dateStr);
  const datePart = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timePart = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${datePart} • ${timePart}`;
};

// ─── Status helpers ───────────────────────────────────────────────────────────
type StepStatus = 'COMPLETED' | 'IN_PROGRESS' | 'BLOCKED' | 'REJECTED' | 'PENDING_REVIEW' | 'PENDING';

const deriveStatus = (stepName: string, stepData: any): StepStatus => {
  if (!stepData) return 'PENDING';
  const { status } = stepData;
  if (status === 'COMPLETED') return 'COMPLETED';
  if (status === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (status === 'BLOCKED') return 'BLOCKED';
  if (status === 'REJECTED') return 'REJECTED';
  if (status === 'PENDING' && stepName.toLowerCase().includes('review')) return 'PENDING_REVIEW';
  return 'PENDING';
};

const STATUS_STYLES: Record<StepStatus, { chip: string; icon: string }> = {
  COMPLETED:     { chip: 'bg-emerald-500 border-emerald-600 text-white shadow-sm',           icon: '✓' },
  IN_PROGRESS:   { chip: 'bg-indigo-500   border-indigo-600   text-white shadow-sm',            icon: '●' },
  PENDING_REVIEW:{ chip: 'bg-orange-400 border-orange-500 text-white shadow-sm',            icon: '⏳' },
  BLOCKED:       { chip: 'bg-red-50     border-red-200    text-red-500 shadow-sm',           icon: '✕' },
  REJECTED:      { chip: 'bg-red-50     border-red-200    text-red-500 shadow-sm',           icon: '✕' },
  PENDING:       { chip: 'bg-white      border-gray-200   text-gray-300 hover:border-gray-300 hover:text-gray-400', icon: '·' },
};

const STATUS_LABELS: Record<StepStatus, string> = {
  COMPLETED:     'Completed',
  IN_PROGRESS:   'In Progress',
  PENDING_REVIEW:'Waiting for Review',
  BLOCKED:       'Blocked',
  REJECTED:      'Rejected',
  PENDING:       'Pending',
};

// ─── Portal Tooltip Component ─────────────────────────────────────────────────
function TooltipPortal({ activeTooltip }: { activeTooltip: any }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !activeTooltip) return null;

  const { rect, stepName, completedBy, completedAt, updatedAt, notes } = activeTooltip;
  const status = activeTooltip.status as StepStatus;

  const isFlipped = rect.top < 150;

  const style = isFlipped ? {
    left: rect.left + rect.width / 2,
    top: rect.bottom + 8,
    transform: 'translate(-50%, 0)',
  } : {
    left: rect.left + rect.width / 2,
    top: rect.top - 8,
    transform: 'translate(-50%, -100%)',
  };

  const content = (
    <div 
      className="fixed z-[99999] w-[260px] pointer-events-none bg-gray-950 text-white text-[11px] rounded-lg shadow-2xl border border-gray-800 p-3 text-left leading-relaxed animate-in fade-in duration-150"
      style={style}
    >
      <div className="font-semibold text-[12px] mb-1.5 border-b border-gray-700 pb-1.5 text-gray-100">{stepName}</div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-gray-400">Status</span>
        <span className={`font-medium ${status === 'COMPLETED' ? 'text-emerald-400' : status === 'IN_PROGRESS' ? 'text-indigo-400' : status === 'BLOCKED' || status === 'REJECTED' ? 'text-red-400' : status === 'PENDING_REVIEW' ? 'text-orange-400' : 'text-gray-400'}`}>
          {STATUS_LABELS[status]}
        </span>
      </div>
      {completedBy  && <div className="flex items-center justify-between mb-0.5"><span className="text-gray-400">Completed By</span><span className="text-gray-200 text-right max-w-[140px] truncate" title={completedBy}>{completedBy}</span></div>}
      {completedAt  && <div className="flex items-center justify-between mb-0.5"><span className="text-gray-400">Completed</span><span className="text-gray-200 text-right">{completedAt}</span></div>}
      {updatedAt && !completedAt && <div className="flex items-center justify-between mb-0.5"><span className="text-gray-400">Updated</span><span className="text-gray-200 text-right">{updatedAt}</span></div>}
      {notes && <div className="mt-1.5 pt-1.5 border-t border-gray-700 text-gray-400 italic text-[10px]">"{notes}"</div>}
      
      {isFlipped ? (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-px border-[5px] border-transparent border-b-gray-800" />
      ) : (
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-[5px] border-transparent border-t-gray-800" />
      )}
    </div>
  );

  return createPortal(content, document.body);
}

export default function InstallationTable({ items, allSteps, isLoading }: InstallationTableProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<any>(null);

  if (isLoading) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-700" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="w-full py-16 flex flex-col items-center justify-center bg-white rounded-lg border border-gray-200 shadow-sm">
        <FileText className="text-gray-300 mb-4" size={40} />
        <h3 className="text-base font-medium text-gray-900">No installations found</h3>
        <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or search terms.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <TooltipPortal activeTooltip={activeTooltip} />

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col relative z-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" style={{ minWidth: '1000px' }}>
            <thead className="text-[11px] text-gray-700 bg-gray-50 border-b border-gray-200 sticky top-0 z-20">
              <tr>
                <th className="px-1.5 py-2 font-semibold sticky left-0 z-30 bg-gray-50 shadow-[1px_0_0_#e5e7eb] border-r border-gray-200 w-[30px] text-center align-middle">
                  #
                </th>
                <th className="px-2.5 py-2 font-semibold sticky left-[30px] z-30 bg-gray-50 shadow-[1px_0_0_#e5e7eb] border-r border-gray-200 w-[190px] align-middle">
                  Customer
                </th>
                <th className="px-2.5 py-2 font-semibold bg-gray-50 border-r border-gray-200 w-[140px] align-middle">
                  Current Stage
                </th>
                <th className="px-2.5 py-2 font-semibold bg-gray-50 border-r border-gray-200 w-[100px] align-middle">
                  Progress
                </th>

                {allSteps.map((step) => {
                  const isColHov = hoveredStep === step;
                  return (
                    <th
                      key={step}
                      className={`min-w-[100px] px-2 py-2 text-center border-r border-gray-200 font-semibold align-middle transition-colors ${isColHov ? 'bg-gray-100' : 'bg-gray-50'}`}
                      onMouseEnter={() => setHoveredStep(step)}
                      onMouseLeave={() => setHoveredStep(null)}
                    >
                      {step}
                    </th>
                  );
                })}

                <th className="px-1.5 py-2 font-semibold sticky right-0 z-30 bg-gray-50 shadow-[-1px_0_0_#e5e7eb] border-l border-gray-200 w-[46px] text-center align-middle">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {items.map((item, idx) => {
                const isRowHov = hoveredRow === item.id;
                const base = isRowHov ? 'bg-indigo-50/40' : item.isOverdue ? 'bg-red-50/20' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30';
                const frozen = isRowHov ? 'bg-indigo-50/80' : item.isOverdue ? 'bg-red-50/80' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${base}`}
                    style={{ height: 42 }}
                    onMouseEnter={() => setHoveredRow(item.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td className={`px-1.5 py-2 sticky left-0 z-10 border-r border-gray-100 text-center text-[10px] text-gray-400 font-medium transition-colors align-middle ${frozen}`}>
                      {idx + 1}
                    </td>

                    <td className={`px-2.5 py-2 sticky left-[30px] z-10 border-r border-gray-100 transition-colors align-middle ${frozen}`}>
                      <span className="block text-[11px] font-bold text-gray-900 truncate w-[180px]" title={item.customerName}>{item.customerName}</span>
                      <span className="block text-[9.5px] font-medium text-gray-500 truncate w-[180px] mt-0.5">
                        <span className="text-teal-700 font-bold">{item.orderNumber}</span> · {item.assignedExecutive}
                      </span>
                    </td>

                    <td className={`px-2.5 py-2 border-r border-gray-100 transition-colors align-middle ${base}`}>
                      <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-[4px] text-[9.5px] font-bold max-w-[130px] shadow-sm border ${
                        item.currentStage === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        item.isOverdue ? 'bg-red-50 text-red-700 border-red-200' : 'bg-teal-50 text-teal-700 border-teal-200'
                      }`} title={item.currentStage}>
                        {item.currentStage === 'Completed' ? <CheckCircle2 size={11} className="shrink-0" /> : <Clock size={11} className="shrink-0" />}
                        <span className="truncate">{item.currentStage}</span>
                      </span>
                    </td>

                    <td className={`px-2.5 py-2 border-r border-gray-100 transition-colors align-middle ${base}`}>
                      <div className="flex flex-col justify-center gap-0.5 w-full min-w-[80px]">
                        <div className="flex items-center gap-1.5 w-full">
                          <div className="w-full h-[4px] bg-gray-200 rounded-full overflow-hidden shadow-inner flex-grow">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${item.workflowPercentage}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-gray-800 shrink-0 w-[24px] text-right">{item.workflowPercentage}%</span>
                        </div>
                        <span className="text-[8.5px] font-medium text-gray-400 text-left">
                          {item.completedSteps !== undefined && item.totalSteps !== undefined ? `${item.completedSteps} / ${item.totalSteps} Tasks` : ''}
                        </span>
                      </div>
                    </td>

                    {allSteps.map((step, si) => {
                      const stepData = item.stepsMap?.[step];
                      const status = deriveStatus(step, stepData);
                      const style = STATUS_STYLES[status];
                      const isColHov = hoveredStep === step;
                      const isCross = isRowHov && isColHov;

                      const completedBy = isValidValue(stepData?.completedByName) ? stepData.completedByName : '';
                      const completedAt = formatDateTime(stepData?.completedAt);
                      const updatedAt   = formatDateTime(stepData?.updatedAt);
                      const notes       = isValidValue(stepData?.notes) ? stepData.notes : '';

                      const isLast = si === allSteps.length - 1;

                      return (
                        <td
                          key={step}
                          className={`px-0.5 py-2 text-center transition-colors align-middle ${isLast ? 'border-r border-gray-200' : 'border-r border-gray-50'} ${
                            isCross ? 'bg-indigo-50/60' : isColHov && !isRowHov ? 'bg-gray-50' : ''
                          }`}
                          onMouseEnter={() => setHoveredStep(step)}
                          onMouseLeave={() => {
                            setHoveredStep(null);
                            setActiveTooltip(null);
                          }}
                        >
                          <div className="relative flex items-center justify-center">
                            <button
                              className={`w-[26px] h-[26px] rounded-[4px] border flex items-center justify-center text-[10px] font-bold transition-all hover:scale-110 cursor-default ${style.chip}`}
                              title=""
                              tabIndex={-1}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setActiveTooltip({
                                  rect, stepName: step, status, completedBy, completedAt, updatedAt, notes
                                });
                              }}
                            >
                              {status === 'COMPLETED'      ? <Check size={12} strokeWidth={3} /> :
                               status === 'IN_PROGRESS'    ? <span className="w-2 h-2 rounded-full bg-white block shadow-sm" /> :
                               status === 'PENDING_REVIEW' ? <Clock size={10} strokeWidth={2.5} /> :
                               status === 'BLOCKED' || status === 'REJECTED' ? <XCircle size={12} strokeWidth={2.5} /> :
                               <span className="w-1 h-1 rounded-full bg-gray-300 block" />}
                            </button>
                          </div>
                        </td>
                      );
                    })}

                    <td className={`px-1.5 py-2 sticky right-0 z-10 border-l border-gray-100 text-center transition-colors align-middle ${frozen}`}>
                      <div className="flex justify-center items-center h-full">
                        <Link href={`/staff/dashboard/solar-orders/orders/${item.id}/installation`}>
                          <button className="text-gray-400 hover:text-teal-700 bg-white hover:bg-teal-50 border border-gray-200 rounded p-1 shadow-sm transition-all" title="View Installation">
                            <ArrowRight size={12} />
                          </button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
