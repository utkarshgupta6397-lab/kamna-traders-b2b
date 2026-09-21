import React from 'react';
import { History, Shield, Users, Radio } from 'lucide-react';

export default function ActivitySection() {
  const auditEvents = [1, 2, 3, 4];
  const userActions = [1, 2, 3, 4];
  const systemAlerts = [1, 2, 3, 4];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 h-full min-h-0">
      {/* 1. Audit Log & System Events */}
      <div className="bg-white rounded-lg p-3.5 border border-slate-200/80 shadow-2xs flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <History size={14} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">System Audit Trail</h2>
              <p className="text-[10px] text-slate-400">Security & change log</p>
            </div>
          </div>
          <span className="text-[10px] font-medium text-slate-400">All services</span>
        </div>

        {/* Static Audit Rows */}
        <div className="flex-1 py-1 divide-y divide-slate-100 min-h-0 flex flex-col justify-around">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="py-1.5 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <div className="w-6 h-6 rounded-full bg-slate-100 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="h-2.5 w-4/5 bg-slate-200 rounded" />
                  <div className="h-2 w-1/2 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="h-2.5 w-10 bg-slate-100 rounded shrink-0 mt-1" />
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Immutable audit logging</span>
          <span className="font-medium text-slate-500">Security audit</span>
        </div>
      </div>

      {/* 2. Staff Activity & Dispatch Workflows */}
      <div className="bg-white rounded-lg p-3.5 border border-slate-200/80 shadow-2xs flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Users size={14} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">Staff Portal Activity</h2>
              <p className="text-[10px] text-slate-400">User actions & logins</p>
            </div>
          </div>
          <span className="text-[10px] font-medium text-slate-400">Active sessions</span>
        </div>

        {/* Static Staff Rows */}
        <div className="flex-1 py-1 divide-y divide-slate-100 min-h-0 flex flex-col justify-around">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="py-1.5 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <div className="w-6 h-6 rounded-full bg-blue-50 border border-blue-100 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="h-2.5 w-3/4 bg-slate-200 rounded" />
                  <div className="h-2 w-2/5 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="h-2.5 w-10 bg-slate-100 rounded shrink-0 mt-1" />
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Role-based activity monitoring</span>
          <span className="font-medium text-slate-500">Staff feed</span>
        </div>
      </div>

      {/* 3. Real-Time Integration Events & SSE */}
      <div className="bg-white rounded-lg p-3.5 border border-slate-200/80 shadow-2xs flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <Radio size={14} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">Live Integration Feed</h2>
              <p className="text-[10px] text-slate-400">Zoho sync & webhooks</p>
            </div>
          </div>
          <span className="text-[10px] font-medium text-slate-400">Connected</span>
        </div>

        {/* Static Integration Rows */}
        <div className="flex-1 py-1 divide-y divide-slate-100 min-h-0 flex flex-col justify-around">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="py-1.5 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <div className="w-6 h-6 rounded bg-emerald-50 border border-emerald-100 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="h-2.5 w-5/6 bg-slate-200 rounded" />
                  <div className="h-2 w-1/3 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="h-3.5 w-12 bg-slate-100 rounded-full shrink-0" />
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Zoho Creator & Books sync</span>
          <span className="font-medium text-slate-500">Live listener</span>
        </div>
      </div>
    </div>
  );
}
