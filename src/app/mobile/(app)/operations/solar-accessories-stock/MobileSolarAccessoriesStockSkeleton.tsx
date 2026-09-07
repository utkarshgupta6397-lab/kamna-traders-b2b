import React from 'react';
import { Search, SlidersHorizontal, MoreVertical, Wrench } from 'lucide-react';

export default function MobileSolarAccessoriesStockSkeleton() {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F8F9FB] animate-pulse">
      {/* Search + Filter + Actions */}
      <div className="px-3 pt-3 pb-3 shrink-0 flex gap-2">
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

      {/* Main List Skeleton */}
      <div className="flex-1 overflow-y-auto px-3 pb-6 flex flex-col gap-3">
        {/* Grand Total banner */}
        <div className="bg-[#1A2766] rounded-[14px] px-4 py-3.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Wrench size={18} className="text-white/40" />
            <div className="h-3.5 w-24 bg-white/20 rounded-md" />
          </div>
          <div className="h-5 w-16 bg-white/20 rounded-md" />
        </div>

        {/* Category cards */}
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-[14px] border border-slate-200 shadow-sm p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5 flex-1 mr-3">
              <div className="w-5 h-5 rounded-full bg-slate-100 shrink-0" />
              <div className="h-4 w-40 bg-slate-200 rounded-md" />
            </div>
            <div className="h-5 w-12 bg-slate-200 rounded-md shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
