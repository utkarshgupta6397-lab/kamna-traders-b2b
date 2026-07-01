'use client';
import { useState } from 'react';
import { Clock, XCircle, FileText, ArrowRight, Check, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

interface DocumentationTableProps {
  items: any[];
  allSteps: string[];
  columnCounters: Record<string, number>;
  isLoading: boolean;
}

// ─── Phase Definitions ────────────────────────────────────────────────────────
const PHASES = [
  { key: 'Registration', label: 'Registration', bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-800',   dot: 'bg-blue-400' },
  { key: 'Approvals',    label: 'Approvals',    bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-800',  dot: 'bg-amber-400' },
  { key: 'Vendor',       label: 'Vendor',       bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', dot: 'bg-purple-400' },
  { key: 'Department',   label: 'Department',   bg: 'bg-teal-50',   border: 'border-teal-200',   text: 'text-teal-800',   dot: 'bg-teal-400' },
  { key: 'Subsidy',      label: 'Subsidy',      bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-800',  dot: 'bg-green-400' },
  { key: 'Other',        label: 'Other',        bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-700',   dot: 'bg-gray-400' },
];

const getPhase = (stepName: string) => {
  const n = stepName.toLowerCase();
  if (n.includes('document upload') || n.includes('customer registration') || n.includes('vendor portal')) return 'Registration';
  if (n.includes('review') || n.includes('notaris') || n.includes('signature')) return 'Approvals';
  if (n.includes('stamp') || n.includes('dcr') || n.includes('file upload')) return 'Vendor';
  if (n.includes('customer portal') || n.includes('electricity') || n.includes('department')) return 'Department';
  if (n.includes('subsidy')) return 'Subsidy';
  return 'Other';
};

const phaseConfig = (phase: string) => PHASES.find(p => p.key === phase) ?? PHASES[PHASES.length - 1];

// Build a short abbreviation for any step name (max 3 chars)
const toAbbr = (name: string): string => {
  const stop = new Set(['&', 'and', 'or', 'the', 'a', 'an', 'of', 'for', 'to', 'in', 'at', 'by', 'from']);
  const words = name.split(/[\s\/\-]+/).filter(w => !stop.has(w.toLowerCase()));
  if (words.length === 1) return words[0].substring(0, 3).toUpperCase();
  if (words.length === 2) return (words[0][0] + words[1].substring(0, 2)).toUpperCase();
  return words.slice(0, 3).map(w => w[0]).join('').toUpperCase();
};

const isValidValue = (val: any) => {
  if (val === null || val === undefined) return false;
  const s = String(val).trim().toLowerCase();
  return s !== '' && s !== '?' && s !== 'undefined' && s !== 'null' && s !== 'n/a';
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
  IN_PROGRESS:   { chip: 'bg-blue-500   border-blue-600   text-white shadow-sm',            icon: '●' },
  PENDING_REVIEW:{ chip: 'bg-orange-400 border-orange-500 text-white shadow-sm',            icon: '⏳' },
  BLOCKED:       { chip: 'bg-red-500    border-red-600    text-white shadow-sm',             icon: '✕' },
  REJECTED:      { chip: 'bg-red-500    border-red-600    text-white shadow-sm',             icon: '✕' },
  PENDING:       { chip: 'bg-white      border-gray-300   text-gray-400',                   icon: '·' },
};

const STATUS_LABELS: Record<StepStatus, string> = {
  COMPLETED:     'Completed',
  IN_PROGRESS:   'In Progress',
  PENDING_REVIEW:'Waiting for Review',
  BLOCKED:       'Blocked',
  REJECTED:      'Rejected',
  PENDING:       'Pending',
};

// ─── Tooltip component ────────────────────────────────────────────────────────
function StepTooltip({
  stepName, status, completedBy, completedAt, updatedAt, notes,
}: {
  stepName: string; status: StepStatus; completedBy: string;
  completedAt: string; updatedAt: string; notes: string;
}) {
  return (
    <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150
      absolute z-[9999] bottom-full left-1/2 -translate-x-1/2 mb-2 w-[220px]
      bg-gray-950 text-white text-[11px] rounded-lg shadow-xl border border-gray-800
      p-3 text-left leading-relaxed">
      <div className="font-semibold text-[12px] mb-1.5 border-b border-gray-700 pb-1.5 text-gray-100">{stepName}</div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-gray-400">Status</span>
        <span className={`font-medium ${status === 'COMPLETED' ? 'text-emerald-400' : status === 'IN_PROGRESS' ? 'text-blue-400' : status === 'BLOCKED' || status === 'REJECTED' ? 'text-red-400' : status === 'PENDING_REVIEW' ? 'text-orange-400' : 'text-gray-400'}`}>
          {STATUS_LABELS[status]}
        </span>
      </div>
      {completedBy  && <div className="flex items-center justify-between mb-0.5"><span className="text-gray-400">Completed By</span><span className="text-gray-200 text-right max-w-[120px]">{completedBy}</span></div>}
      {completedAt  && <div className="flex items-center justify-between mb-0.5"><span className="text-gray-400">Completed</span><span className="text-gray-200">{completedAt}</span></div>}
      {updatedAt && !completedAt && <div className="flex items-center justify-between mb-0.5"><span className="text-gray-400">Updated</span><span className="text-gray-200">{updatedAt}</span></div>}
      {notes && <div className="mt-1.5 pt-1.5 border-t border-gray-700 text-gray-400 italic text-[10px]">"{notes}"</div>}
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-[5px] border-transparent border-t-gray-950" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DocumentationTable({ items, allSteps, columnCounters, isLoading }: DocumentationTableProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);

  // Group allSteps into phases (in order)
  const groupedSteps = (() => {
    const groups: { phase: string; steps: string[] }[] = [];
    if (!allSteps.length) return groups;
    let cur = getPhase(allSteps[0]);
    let grp: { phase: string; steps: string[] } = { phase: cur, steps: [] };
    for (const step of allSteps) {
      const p = getPhase(step);
      if (p !== cur) { groups.push(grp); cur = p; grp = { phase: p, steps: [] }; }
      grp.steps.push(step);
    }
    groups.push(grp);
    return groups;
  })();

  // Build abbreviation map (deduplicate collisions by appending digit)
  const abbrMap: Record<string, string> = {};
  const seen: Record<string, number> = {};
  for (const step of allSteps) {
    let abbr = toAbbr(step);
    if (seen[abbr] !== undefined) { seen[abbr]++; abbr = abbr.substring(0, 2) + seen[abbr]; }
    else seen[abbr] = 0;
    abbrMap[step] = abbr;
  }

  if (isLoading) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1A2766]" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="w-full py-16 flex flex-col items-center justify-center bg-white rounded-lg border border-gray-200 shadow-sm">
        <FileText className="text-gray-300 mb-4" size={40} />
        <h3 className="text-base font-medium text-gray-900">No orders found</h3>
        <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or search terms.</p>
      </div>
    );
  }

  const getStepSubtitle = (currentStage: string) => {
    if (currentStage === 'Completed') return 'All done';
    const i = allSteps.indexOf(currentStage);
    return i >= 0 ? `Step ${i + 1} of ${allSteps.length}` : '';
  };

  const hoveredPhase = hoveredStep ? getPhase(hoveredStep) : null;

  return (
    <div className="flex flex-col gap-2">

      {/* ── Legend row ── */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <button
          onClick={() => setLegendOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 flex-wrap">
            {/* Status chips */}
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mr-1">Legend</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-600">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-emerald-500 text-white text-[9px] font-bold">✓</span> Completed
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-600">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-blue-500 text-white text-[9px]">●</span> In Progress
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-600">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded border border-gray-300 bg-white text-gray-400 text-[9px]">·</span> Pending
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-600">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-orange-400 text-white text-[9px]">⏳</span> Review
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-600">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-red-500 text-white text-[9px]">✕</span> Blocked/Rejected
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 shrink-0 ml-4">
            <span>{legendOpen ? 'Hide' : 'Show'} step abbreviations</span>
            {legendOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </div>
        </button>

        {legendOpen && (
          <div className="border-t border-gray-100 px-4 py-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-1.5">
            {allSteps.map(step => (
              <div key={step} className="flex items-center gap-1.5 text-[11px] text-gray-600">
                <span className="font-bold text-gray-800 font-mono text-[11px] w-8 shrink-0">{abbrMap[step]}</span>
                <span className="text-gray-500">{step}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col relative z-0">
        <div className="overflow-x-auto">
          <table className="text-left border-collapse" style={{ minWidth: 'max-content' }}>
            <thead className="text-[11px] text-gray-700 bg-gray-50 border-b border-gray-200 sticky top-0 z-20">
              <tr>
                {/* ── Frozen left ── */}
                <th className="px-2 py-3 font-semibold sticky left-0 z-30 bg-gray-50 shadow-[1px_0_0_#e5e7eb] border-r border-gray-200 w-[38px] text-center">
                  #
                </th>
                <th className="px-3 py-3 font-semibold sticky left-[38px] z-30 bg-gray-50 shadow-[1px_0_0_#e5e7eb] border-r border-gray-200 w-[190px]">
                  Customer
                </th>
                <th className="px-3 py-3 font-semibold bg-gray-50 border-r border-gray-200 w-[150px]">
                  Current Stage
                </th>
                <th className="px-3 py-3 font-semibold bg-gray-50 border-r border-gray-200 w-[90px]">
                  Progress
                </th>

                {/* ── Phase group headers ── */}
                {groupedSteps.map(group => {
                  const cfg = phaseConfig(group.phase);
                  return (
                    <th
                      key={group.phase}
                      colSpan={group.steps.length}
                      className={`px-2 py-0 border-r border-gray-200 text-center transition-colors ${cfg.bg} ${cfg.text} ${hoveredPhase === group.phase ? 'brightness-95' : ''}`}
                    >
                      <div className="flex items-center justify-center gap-1.5 py-2">
                        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        <span className="font-bold text-[11px] tracking-wide">{group.phase}</span>
                        <span className={`text-[9px] font-medium opacity-70`}>{group.steps.length}</span>
                      </div>
                    </th>
                  );
                })}

                {/* ── Frozen right ── */}
                <th className="px-2 py-3 font-semibold sticky right-0 z-30 bg-gray-50 shadow-[-1px_0_0_#e5e7eb] border-l border-gray-200 w-[60px] text-center">
                  Action
                </th>
              </tr>

              {/* ── Step abbreviation sub-row ── */}
              <tr className="border-b border-gray-200">
                {/* Span the frozen cols */}
                <th colSpan={4} className="sticky left-0 z-30 bg-gray-50 border-r border-gray-200 px-3 py-1.5">
                  <span className="text-[10px] text-gray-400 italic">Hover chips for full name</span>
                </th>

                {allSteps.map(step => {
                  const cfg = phaseConfig(getPhase(step));
                  const isColHov = hoveredStep === step;
                  return (
                    <th
                      key={step}
                      className={`w-[38px] min-w-[38px] max-w-[38px] py-1.5 text-center border-r border-gray-200 transition-colors cursor-default ${cfg.bg} ${isColHov ? 'brightness-90' : ''}`}
                      title={step}
                      onMouseEnter={() => setHoveredStep(step)}
                      onMouseLeave={() => setHoveredStep(null)}
                    >
                      <span className={`text-[10px] font-bold font-mono ${cfg.text}`}>{abbrMap[step]}</span>
                    </th>
                  );
                })}

                <th className="sticky right-0 z-30 bg-gray-50 border-l border-gray-200 w-[60px]" />
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {items.map((item, idx) => {
                const isRowHov = hoveredRow === item.id;
                const base = isRowHov ? 'bg-blue-50/40' : item.isOverdue ? 'bg-red-50/20' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40';
                const frozen = isRowHov ? 'bg-blue-50/80' : item.isOverdue ? 'bg-red-50/80' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${base}`}
                    style={{ height: 56 }}
                    onMouseEnter={() => setHoveredRow(item.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    {/* # */}
                    <td className={`px-2 py-2 sticky left-0 z-10 border-r border-gray-100 text-center text-[11px] text-gray-400 font-medium transition-colors ${frozen}`}>
                      {idx + 1}
                    </td>

                    {/* Customer */}
                    <td className={`px-3 py-2 sticky left-[38px] z-10 border-r border-gray-100 transition-colors ${frozen}`}>
                      <span className="block text-[12px] font-bold text-gray-900 truncate w-[170px]" title={item.customerName}>{item.customerName}</span>
                      <span className="block text-[11px] font-medium text-[#1A2766] truncate w-[170px]">{item.orderNumber}</span>
                      <span className="block text-[10px] text-gray-400 truncate w-[170px]">{item.assignedExecutive}</span>
                    </td>

                    {/* Current Stage */}
                    <td className={`px-3 py-2 border-r border-gray-100 transition-colors ${base}`}>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold max-w-[130px] truncate ${
                        item.currentStage === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                        item.isOverdue ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`} title={item.currentStage}>
                        {item.currentStage}
                      </span>
                      <span className="block text-[9px] text-gray-400 mt-0.5">{getStepSubtitle(item.currentStage)}</span>
                    </td>

                    {/* Progress */}
                    <td className={`px-3 py-2 border-r border-gray-100 transition-colors ${base}`}>
                      <div className="flex flex-col gap-1 w-[70px]">
                        <span className="text-[11px] font-bold text-gray-700 text-right">{item.workflowPercentage}%</span>
                        <div className="w-full h-[3px] bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${item.workflowPercentage}%` }} />
                        </div>
                      </div>
                    </td>

                    {/* ── Per-phase chip groups ── */}
                    {groupedSteps.map(group => {
                      const cfg = phaseConfig(group.phase);
                      // Count completed steps in this phase for this order
                      const phaseDone = group.steps.filter(s => {
                        const d = item.stepsMap?.[s];
                        return d?.status === 'COMPLETED';
                      }).length;

                      return group.steps.map((step, si) => {
                        const stepData = item.stepsMap?.[step];
                        const status = deriveStatus(step, stepData);
                        const style = STATUS_STYLES[status];
                        const isColHov = hoveredStep === step;
                        const isCross = isRowHov && isColHov;

                        const completedBy = isValidValue(stepData?.completedByName) ? stepData.completedByName : '';
                        const completedAt = isValidValue(stepData?.completedAt) ? new Date(stepData.completedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
                        const updatedAt   = isValidValue(stepData?.updatedAt)    ? new Date(stepData.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
                        const notes       = isValidValue(stepData?.notes)        ? stepData.notes : '';

                        // Phase separator between groups
                        const isLastInGroup = si === group.steps.length - 1;

                        return (
                          <td
                            key={step}
                            className={`py-2 text-center transition-colors align-middle ${isLastInGroup ? 'border-r border-gray-200' : 'border-r border-gray-100'} ${
                              isColHov && !isRowHov ? `${cfg.bg}` : isCross ? 'bg-blue-50' : ''
                            }`}
                            style={{ width: 38, minWidth: 38, maxWidth: 38 }}
                            onMouseEnter={() => setHoveredStep(step)}
                            onMouseLeave={() => setHoveredStep(null)}
                          >
                            {/* Chip */}
                            <div className="relative group flex items-center justify-center">
                              <button
                                className={`w-[28px] h-[28px] rounded-md border flex items-center justify-center text-[11px] font-bold transition-transform hover:scale-110 cursor-default ${style.chip}`}
                                title=""
                                tabIndex={-1}
                              >
                                {status === 'COMPLETED'      ? <Check size={12} strokeWidth={3} /> :
                                 status === 'IN_PROGRESS'    ? <span className="w-2 h-2 rounded-full bg-white block" /> :
                                 status === 'PENDING_REVIEW' ? <Clock size={11} /> :
                                 status === 'BLOCKED' || status === 'REJECTED' ? <XCircle size={12} /> :
                                 <span className="w-1.5 h-1.5 rounded-full bg-gray-300 block" />}
                              </button>
                              <StepTooltip
                                stepName={step}
                                status={status}
                                completedBy={completedBy}
                                completedAt={completedAt}
                                updatedAt={updatedAt}
                                notes={notes}
                              />
                            </div>
                          </td>
                        );
                      });
                    })}

                    {/* Action */}
                    <td className={`px-2 py-2 sticky right-0 z-10 border-l border-gray-100 text-center transition-colors ${frozen}`}>
                      <Link href={`/staff/dashboard/solar-orders/orders/${item.id}/documentation`}>
                        <button className="text-gray-400 hover:text-[#1A2766] bg-white hover:bg-blue-50 border border-gray-200 rounded-md p-1.5 shadow-sm transition-all" title="View Documentation">
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

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-[11px] text-gray-500 flex justify-between items-center">
          <span>{items.length} orders in queue</span>
          <div className="flex items-center gap-3">
            {groupedSteps.map(g => {
              const cfg = phaseConfig(g.phase);
              return (
                <span key={g.phase} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {g.phase} · {g.steps.length}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
