'use client';
import { Search } from 'lucide-react';

export default function MobileWireCableStockSkeleton() {
  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F9FB] animate-pulse">
      {/* Summary Cards Skeleton */}
      <div className="grid grid-cols-3 gap-2 p-3 pb-2 shrink-0">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-[14px] p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col gap-2">
            <div className="h-3 w-16 bg-slate-200 rounded-full" />
            <div className="h-5 w-12 bg-slate-200 rounded-md" />
          </div>
        ))}
      </div>

      {/* Measurement Toggle Skeleton */}
      <div className="px-3 pb-3 shrink-0">
        <div className="bg-white h-10 w-full rounded-xl border border-slate-200 p-1 flex">
          <div className="h-full w-1/2 bg-slate-200 rounded-lg" />
        </div>
      </div>

      {/* Filter Bar Skeleton */}
      <div className="px-3 pb-3 flex flex-col gap-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
          <div className="w-full h-10 bg-white border border-slate-200 rounded-xl" />
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="h-4 w-20 bg-slate-200 rounded-full" />
          <div className="h-8 w-8 bg-slate-200 rounded-full" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="flex-1 bg-white rounded-t-2xl shadow-[0_-4px_12px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col border-t border-slate-200 mt-1">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between">
          <div className="h-4 w-32 bg-slate-200 rounded-full" />
          <div className="h-4 w-16 bg-slate-200 rounded-full" />
        </div>
        <div className="p-4 space-y-4">
          {/* Sub-category Header */}
          <div className="h-6 w-32 bg-slate-200 rounded-md" />
          {/* Brand Header */}
          <div className="h-5 w-24 bg-slate-100 rounded-md ml-4" />
          {/* Rows */}
          {[1, 2, 3].map(i => (
            <div key={i} className="flex justify-between items-center ml-8 py-1">
              <div className="h-4 w-20 bg-slate-100 rounded-md" />
              <div className="h-4 w-16 bg-slate-200 rounded-md" />
            </div>
          ))}
          {/* Brand Header 2 */}
          <div className="h-5 w-28 bg-slate-100 rounded-md ml-4 mt-6" />
          {[1, 2].map(i => (
            <div key={i} className="flex justify-between items-center ml-8 py-1">
              <div className="h-4 w-24 bg-slate-100 rounded-md" />
              <div className="h-4 w-14 bg-slate-200 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
