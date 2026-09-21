import React from 'react';
import { PieChart } from 'lucide-react';

interface OrderStatusCardProps {
  loading?: boolean;
}

export default function OrderStatusCard({ loading = true }: OrderStatusCardProps) {
  const legendItems = [
    { label: 'Fulfilled', color: 'bg-emerald-400' },
    { label: 'Dispatched', color: 'bg-blue-400' },
    { label: 'Processing', color: 'bg-amber-400' },
    { label: 'On Hold', color: 'bg-slate-300' },
  ];

  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between h-[320px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <PieChart size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Order Status</h2>
            <p className="text-xs text-slate-400">Distribution overview</p>
          </div>
        </div>
      </div>

      {/* Donut Chart Skeleton Area */}
      <div className="flex-1 flex items-center justify-around py-4">
        {loading ? (
          <>
            {/* Donut skeleton */}
            <div className="relative flex items-center justify-center">
              <div className="w-32 h-32 rounded-full border-[12px] border-slate-200/80 animate-pulse flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                  <div className="w-8 h-2 bg-slate-200 rounded animate-pulse" />
                </div>
              </div>
            </div>

            {/* Skeleton legend rows */}
            <div className="space-y-3 w-36">
              {legendItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${item.color} opacity-60`} />
                    <span className="text-xs font-medium text-slate-600">{item.label}</span>
                  </div>
                  <div className="w-6 h-3 bg-slate-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-slate-400">
            Order distribution data will appear here
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-400">
        <span>Order pipeline states</span>
        <span className="font-medium">Active tracking</span>
      </div>
    </div>
  );
}
