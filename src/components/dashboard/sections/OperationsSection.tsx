import React from 'react';
import { CheckSquare, Clock, ShieldCheck, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import WipWidget from '../WipWidget';

export default function OperationsSection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 h-full w-full">
      {/* 1. Pending Actions & Priority Queue */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <CheckSquare size={15} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">Pending Actions</h2>
              <p className="text-[11px] text-slate-400">Action items queue</p>
            </div>
          </div>
          <span className="text-xs font-medium text-slate-400">High priority</span>
        </div>

        {/* Large translucent WIP Watermark + subtle icon */}
        <WipWidget size="md" />

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Assigned to staff queue</span>
        </div>
      </div>

      {/* 2. Today's Operational Workload */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <Clock size={15} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">Today&apos;s Workload</h2>
              <p className="text-[11px] text-slate-400">Operational schedule</p>
            </div>
          </div>
          <span className="text-xs font-medium text-slate-400">Daily milestones</span>
        </div>

        {/* Large translucent WIP Watermark + subtle icon */}
        <WipWidget size="md" />

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Real-time milestone tracker</span>
        </div>
      </div>

      {/* 3. Approvals & Stock Verifications */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <ShieldCheck size={15} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">Approvals & Transfers</h2>
              <p className="text-[11px] text-slate-400">Governance & sign-offs</p>
            </div>
          </div>
          <Link
            href="/staff/dashboard/operations/stock-approval"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1A2766] hover:underline"
          >
            <span>Stock Approvals</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {/* Large translucent WIP Watermark + subtle icon */}
        <WipWidget size="md" />

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Dual-custody verification</span>
        </div>
      </div>
    </div>
  );
}
