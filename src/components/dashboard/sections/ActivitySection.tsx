import React from 'react';
import { History, Users, Radio } from 'lucide-react';
import WipWidget from '../WipWidget';

export default function ActivitySection() {
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

        {/* Large translucent WIP Watermark + subtle icon */}
        <WipWidget size="md" />

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Immutable audit logging</span>
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

        {/* Large translucent WIP Watermark + subtle icon */}
        <WipWidget size="md" />

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Role-based activity monitoring</span>
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

        {/* Large translucent WIP Watermark + subtle icon */}
        <WipWidget size="md" />

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Zoho Creator & Books sync</span>
        </div>
      </div>
    </div>
  );
}
