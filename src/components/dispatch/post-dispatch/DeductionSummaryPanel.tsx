'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function DeductionSummaryPanel({ data }: any) {
  const lines = data?.lines || [];
  const totalLines = lines.length;
  
  let deducted = 0, autoApproved = 0, approvalReq = 0, draft = 0, unallocated = 0;
  
  lines.forEach((l: any) => {
    const s = l.allocation?.status || 'NOT_ALLOCATED';
    const c = l.allocation?.classification || 'NOT_ALLOCATED';
    if (s === 'DEDUCTED') deducted++;
    else if (s === 'NOT_ALLOCATED') unallocated++;
    else if (c === 'APPROVAL_REQUIRED' || s === 'SUBMITTED_FOR_APPROVAL' || s === 'APPROVED' || s === 'REJECTED') approvalReq++;
    else if (c === 'AUTO_APPROVED') autoApproved++;
    else draft++;
  });
  
  const isComplete = totalLines > 0 && deducted === totalLines;

  return (
    <div className="space-y-3">
      {/* Top Stats Strip */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white px-3 py-2 rounded-lg border border-slate-200/60 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total Lines</div>
          <div className="text-lg font-bold text-slate-900 mt-0.5">{totalLines}</div>
        </div>

        <div className="bg-white px-3 py-2 rounded-lg border border-slate-200/60 shadow-2xs">
          <div className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide">Deducted</div>
          <div className="text-lg font-bold text-emerald-700 mt-0.5">{deducted}</div>
        </div>

        <div className="bg-white px-3 py-2 rounded-lg border border-slate-200/60 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Ready (Auto)</div>
          <div className="text-lg font-bold text-slate-800 mt-0.5">{autoApproved}</div>
        </div>

        <div className="bg-white px-3 py-2 rounded-lg border border-slate-200/60 shadow-2xs">
          <div className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide">Approval Req.</div>
          <div className="text-lg font-bold text-amber-700 mt-0.5">{approvalReq}</div>
        </div>

        <div className="bg-white px-3 py-2 rounded-lg border border-slate-200/60 shadow-2xs col-span-2 sm:col-span-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Unallocated</div>
          <div className="text-lg font-bold text-slate-600 mt-0.5">{unallocated}</div>
        </div>
      </div>

      {isComplete && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>All Invoice Lines Successfully Deducted from Inventory</span>
        </div>
      )}
    </div>
  );
}

