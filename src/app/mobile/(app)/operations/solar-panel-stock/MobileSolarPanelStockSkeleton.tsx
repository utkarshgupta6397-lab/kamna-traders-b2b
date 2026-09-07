import React from 'react';
import { Search, SlidersHorizontal, MoreVertical } from 'lucide-react';

export default function MobileSolarPanelStockSkeleton() {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F8F9FB] animate-pulse">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-2 p-3 pb-0 shrink-0">
        {[
          { label: 'SKUs', w: 'w-10' },
          { label: 'Total Stock', w: 'w-16' },
          { label: 'Warehouses', w: 'w-8' },
        ].map((kpi, i) => (
          <div
            key={i}
            className="bg-white rounded-[14px] p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col justify-center"
          >
            <div className="h-2.5 w-12 bg-slate-200 rounded-full mb-2" />
            <div className={`h-5 ${kpi.w} bg-slate-200 rounded-md`} />
          </div>
        ))}
      </div>

      {/* DCR / Non-DCR tab switcher */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="bg-white rounded-xl border border-slate-200 p-1 flex gap-1">
          <div className="flex-1 h-8 bg-slate-200 rounded-lg" />
          <div className="flex-1 h-8 bg-slate-100 rounded-lg" />
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="px-3 pb-3 shrink-0 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
          <div className="w-full h-10 bg-white border border-slate-200 rounded-xl" />
        </div>
        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
          <SlidersHorizontal size={18} className="text-slate-300" />
        </div>
        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
          <MoreVertical size={18} className="text-slate-300" />
        </div>
      </div>

      {/* Series list Table Skeleton */}
      <div className="flex-1 overflow-hidden bg-white rounded-t-2xl shadow-[0_-4px_12px_rgba(0,0,0,0.02)] border-t border-slate-200 flex flex-col">
        <div className="h-[42px] px-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="h-3 w-16 bg-slate-200 rounded-full" />
          <div className="h-3 w-20 bg-slate-200 rounded-full" />
        </div>

        <div className="divide-y divide-slate-100">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0" />
                <div className="h-4 w-36 bg-slate-200 rounded-md" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-14 bg-slate-200 rounded-md" />
                <div className="w-3.5 h-3.5 bg-slate-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
