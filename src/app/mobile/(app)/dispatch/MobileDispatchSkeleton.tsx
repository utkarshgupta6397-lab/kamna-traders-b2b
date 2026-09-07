import React from 'react';
import { RefreshCw } from 'lucide-react';

export default function MobileDispatchSkeleton() {
  return (
    <div className="flex-1 flex flex-col font-sans bg-[#F8F9FB] animate-pulse">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-3 min-h-[56px] py-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-white/20" />
            <div className="flex flex-col gap-1">
              <div className="h-4 w-28 bg-white/30 rounded" />
              <div className="h-2.5 w-36 bg-white/20 rounded" />
            </div>
          </div>
          <div className="p-2.5 rounded-full text-white/50">
            <RefreshCw size={19} />
          </div>
        </div>

        {/* Tab Navigation Skeleton */}
        <div className="flex px-2 border-t border-white/10 bg-[#162154] gap-4 py-3">
          <div className="h-4 w-32 bg-white/30 rounded" />
          <div className="h-4 w-28 bg-white/10 rounded" />
        </div>
      </header>

      {/* Main Content Area Skeleton */}
      <main className="flex-1 overflow-y-auto px-4 py-5 max-w-[430px] mx-auto w-full pb-20 space-y-4">
        {/* Section title */}
        <div className="flex items-center gap-2 px-1">
          <div className="h-3.5 w-44 bg-slate-200 rounded" />
          <div className="h-4 w-6 bg-slate-200 rounded-full" />
        </div>

        {/* Order Cards Skeleton */}
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-[20px] p-4 border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col gap-3"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-2.5">
              <div className="flex flex-col gap-1.5">
                <div className="h-5 w-28 bg-slate-200 rounded-md" />
                <div className="h-3 w-20 bg-slate-100 rounded" />
              </div>
              <div className="h-5 w-20 bg-slate-200 rounded-md" />
            </div>

            <div className="flex flex-col gap-2">
              <div className="h-4 w-3/4 bg-slate-200 rounded" />
              <div className="h-3 w-1/2 bg-slate-100 rounded" />
            </div>

            <div className="w-full h-11 bg-slate-100 rounded-[14px] mt-1" />
          </div>
        ))}
      </main>
    </div>
  );
}
