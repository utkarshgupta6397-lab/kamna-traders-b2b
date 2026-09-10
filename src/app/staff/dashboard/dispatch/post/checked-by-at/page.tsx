'use client';

import React from 'react';
import DesktopPostDispatchView from '@/app/staff/dashboard/dispatch/incoming/DesktopPostDispatchView';

export default function Page() {
  return (
    <div className="flex flex-col h-full bg-slate-50/50 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-white flex-shrink-0">
        <h1 className="text-xl font-bold text-[#1A2766]">Checked By / At</h1>
        <p className="text-xs text-gray-500 mt-0.5">Upload supporting documents and record Checked By and Checked At details.</p>
      </div>
      <div className="flex-1 overflow-auto">
        <DesktopPostDispatchView initialTab="check_pending" />
      </div>
    </div>
  );
}
