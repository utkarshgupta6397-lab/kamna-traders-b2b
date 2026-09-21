import React from 'react';
import { Box, CheckSquare, Clock, ShieldCheck, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function OperationsSection() {
  const pendingTasks = [1, 2, 3, 4, 5];
  const approvalRows = [1, 2, 3, 4, 5];

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

        {/* Static Task Rows */}
        <div className="flex-1 py-2 divide-y divide-slate-100 min-h-0 flex flex-col justify-around">
          {pendingTasks.map((task) => (
            <div key={task} className="py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-4 h-4 rounded border border-slate-300 bg-slate-50 shrink-0" />
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="h-3 w-3/4 bg-slate-200 rounded" />
                  <div className="h-2 w-1/3 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="h-4 w-16 bg-slate-100 rounded-full shrink-0" />
            </div>
          ))}
        </div>

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Assigned to staff queue</span>
          <span className="font-medium text-slate-500">Immediate action</span>
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

        {/* Static Workload Metrics */}
        <div className="grid grid-cols-2 gap-3 flex-1 py-3 min-h-0 items-center">
          {[
            { label: 'Dispatch Queue', desc: 'Ready for loading' },
            { label: 'Stock Verification', desc: 'Physical audit' },
            { label: 'Pending Transfers', desc: 'In-transit review' },
            { label: 'Customer Holds', desc: 'Review required' },
          ].map((item, idx) => (
            <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 flex flex-col justify-between h-[80px]">
              <span className="text-xs font-bold text-slate-700 truncate">{item.label}</span>
              <div className="h-4 w-16 bg-slate-200 rounded" />
              <span className="text-[11px] text-slate-400 truncate">{item.desc}</span>
            </div>
          ))}
        </div>

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Real-time milestone tracker</span>
          <span className="font-medium text-slate-500">Live operational pace</span>
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

        {/* Static Approval Rows */}
        <div className="flex-1 py-2 divide-y divide-slate-100 min-h-0 flex flex-col justify-around">
          {approvalRows.map((row) => (
            <div key={row} className="py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-7 h-7 rounded-lg bg-slate-100 shrink-0" />
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="h-3 w-3/5 bg-slate-200 rounded" />
                  <div className="h-2 w-2/5 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="h-4 w-14 bg-emerald-50 border border-emerald-100 rounded-full shrink-0" />
            </div>
          ))}
        </div>

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Dual-custody verification</span>
          <span className="font-medium text-slate-500">Security verified</span>
        </div>
      </div>
    </div>
  );
}
