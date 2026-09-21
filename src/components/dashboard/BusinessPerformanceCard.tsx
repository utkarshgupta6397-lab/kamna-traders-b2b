import React from 'react';
import { TrendingUp, ChevronDown } from 'lucide-react';

interface BusinessPerformanceCardProps {
  loading?: boolean;
}

export default function BusinessPerformanceCard({
  loading = true,
}: BusinessPerformanceCardProps) {
  // 6 neutral placeholder bars for "Last 6 Months"
  const barHeights = [40, 65, 55, 80, 70, 85];
  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between h-[320px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <TrendingUp size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Business Performance</h2>
            <p className="text-xs text-slate-400">Sales & revenue trend</p>
          </div>
        </div>

        {/* Period Selector Placeholder */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600 cursor-default">
          <span>Last 6 Months</span>
          <ChevronDown size={14} className="text-slate-400" />
        </div>
      </div>

      {/* Chart Skeleton Area */}
      <div className="flex-1 flex flex-col justify-end pt-6 pb-2">
        {loading ? (
          <div className="h-full flex flex-col justify-between">
            {/* Grid line placeholders */}
            <div className="space-y-6 w-full opacity-60">
              <div className="h-px bg-slate-100 w-full border-t border-dashed border-slate-200" />
              <div className="h-px bg-slate-100 w-full border-t border-dashed border-slate-200" />
              <div className="h-px bg-slate-100 w-full border-t border-dashed border-slate-200" />
            </div>

            {/* Skeleton Bars with varied heights */}
            <div className="grid grid-cols-6 gap-3 items-end h-36 px-2 pt-2">
              {barHeights.map((height, i) => (
                <div key={i} className="flex flex-col items-center gap-2 h-full justify-end">
                  <div
                    className="w-full max-w-[36px] bg-slate-200/70 rounded-t-md animate-pulse"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[11px] font-medium text-slate-400">
                    {months[i]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-slate-400">
            Performance chart data will appear here
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-400">
        <span>Performance metrics update automatically</span>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-slate-300" />
          <span>Neutral placeholder</span>
        </div>
      </div>
    </div>
  );
}
