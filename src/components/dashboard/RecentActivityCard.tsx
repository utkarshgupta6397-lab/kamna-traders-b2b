import React from 'react';
import { History } from 'lucide-react';

interface RecentActivityCardProps {
  loading?: boolean;
}

export default function RecentActivityCard({ loading = true }: RecentActivityCardProps) {
  const rows = [1, 2, 3, 4];

  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between h-[320px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <History size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Recent Activity</h2>
            <p className="text-xs text-slate-400">System audit log events</p>
          </div>
        </div>
      </div>

      {/* Activity Skeleton Rows */}
      <div className="flex-1 py-2 divide-y divide-slate-100">
        {loading ? (
          rows.map((row) => (
            <div key={row} className="py-2.5 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {/* Avatar/icon skeleton */}
                <div className="w-7 h-7 rounded-full bg-slate-100 shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="h-3 w-4/5 bg-slate-200/80 rounded animate-pulse" />
                  <div className="h-2.5 w-1/2 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
              {/* Timestamp placeholder */}
              <div className="h-3 w-14 bg-slate-100 rounded shrink-0 animate-pulse mt-1" />
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-slate-400">
            Recent activity entries will appear here
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-400">
        <span>Automatic event streaming</span>
        <span className="font-medium">Live audit feed</span>
      </div>
    </div>
  );
}
