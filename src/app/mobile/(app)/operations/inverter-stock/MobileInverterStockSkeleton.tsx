'use client';
import { Search } from 'lucide-react';

export default function MobileInverterStockSkeleton() {
  return (
    <div className="flex-1 flex flex-col bg-[#F8F9FB] animate-pulse">
      {/* Summary Stats Skeleton */}
      <div className="grid grid-cols-3 gap-2 p-3 pb-2 shrink-0">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="bg-white rounded-[14px] p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col gap-2"
          >
            <div className="h-2.5 w-14 bg-slate-200 rounded-full" />
            <div className="h-5 w-10 bg-slate-200 rounded-md" />
          </div>
        ))}
      </div>

      {/* Search + Filter Bar Skeleton */}
      <div className="px-3 pb-3 flex gap-2 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
          <div className="w-full h-10 bg-white border border-slate-200 rounded-xl" />
        </div>
        <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl shrink-0" />
      </div>

      {/* Brand Section + Cards Skeleton */}
      <div className="flex-1 px-3 space-y-3">
        {/* Brand heading */}
        <div className="h-4 w-24 bg-slate-200 rounded-full mt-1" />
        {/* Config cards */}
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-2">
                <div className="h-5 w-20 bg-slate-200 rounded-md" />
                <div className="h-5 w-14 bg-slate-100 rounded-md" />
                <div className="h-5 w-16 bg-slate-100 rounded-md" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-8 bg-slate-200 rounded-md" />
                <div className="h-4 w-4 bg-slate-200 rounded-full" />
              </div>
            </div>
          </div>
        ))}

        {/* Second brand */}
        <div className="h-4 w-32 bg-slate-200 rounded-full mt-4" />
        {[1, 2].map(i => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-2">
                <div className="h-5 w-16 bg-slate-200 rounded-md" />
                <div className="h-5 w-12 bg-slate-100 rounded-md" />
                <div className="h-5 w-20 bg-slate-100 rounded-md" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-8 bg-slate-200 rounded-md" />
                <div className="h-4 w-4 bg-slate-200 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
