import React from 'react';
import { CheckSquare } from 'lucide-react';

interface PendingActionsCardProps {
  loading?: boolean;
}

export default function PendingActionsCard({ loading = true }: PendingActionsCardProps) {
  const rows = [1, 2, 3, 4];

  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between h-[320px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
            <CheckSquare size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Pending Actions</h2>
            <p className="text-xs text-slate-400">Tasks requiring staff attention</p>
          </div>
        </div>
      </div>

      {/* Task Skeleton Rows */}
      <div className="flex-1 py-2 divide-y divide-slate-100">
        {loading ? (
          rows.map((row) => (
            <div key={row} className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Checkbox placeholder */}
                <div className="w-4 h-4 rounded-md border border-slate-200 bg-slate-50 shrink-0" />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="h-3 w-3/4 bg-slate-200/80 rounded animate-pulse" />
                  <div className="h-2 w-1/3 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
              {/* Priority/Status Chip Placeholder */}
              <div className="h-5 w-16 bg-slate-100 rounded-full animate-pulse shrink-0" />
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-slate-400">
            No pending actions at this time
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-400">
        <span>Assigned to staff queue</span>
        <span className="font-medium">Actionable items</span>
      </div>
    </div>
  );
}
