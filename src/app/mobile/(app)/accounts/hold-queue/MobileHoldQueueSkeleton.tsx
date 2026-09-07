import React from 'react';
import Link from 'next/link';
import { ChevronLeft, Search, ChevronDown, RefreshCw } from 'lucide-react';

export default function MobileHoldQueueSkeleton() {
  return (
    <div className="flex-1 flex flex-col font-sans bg-slate-50 min-h-screen pb-[env(safe-area-inset-bottom)] animate-pulse">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)]">
        <div className="flex items-center px-1 min-h-[56px] py-1">
          <Link href="/mobile/accounts" className="flex items-center gap-1 px-3 py-2">
            <ChevronLeft size={24} strokeWidth={2.5} />
            <div className="flex flex-col">
              <span className="font-bold text-[15px] leading-tight">Hold Queue</span>
              <span className="text-[10px] text-blue-200">Management approval</span>
            </div>
          </Link>
        </div>
      </header>

      <main className="flex-1 px-3 py-4 flex flex-col gap-4">
        {/* Top Info Bar */}
        <div className="flex justify-between items-center mb-1">
          <div className="h-4 w-24 bg-slate-200 rounded" />
          <div className="flex items-center gap-2">
            <div className="h-6 w-20 bg-white border border-slate-200 rounded" />
            <div className="h-6 w-28 bg-slate-200 rounded" />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
              <div className="h-2.5 w-16 bg-slate-200 rounded-full" />
              <div className="h-6 w-20 bg-slate-200 rounded-md" />
            </div>
          ))}
        </div>

        {/* Search & Sort */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <div className="w-full h-10 bg-white border border-slate-200 rounded-xl" />
          </div>
          <div className="w-32 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-between px-3">
            <div className="h-3 w-16 bg-slate-200 rounded" />
            <ChevronDown size={14} className="text-slate-300" />
          </div>
        </div>

        {/* Customer Cards Skeleton */}
        <div className="flex flex-col gap-3 pb-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3"
            >
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1.5 flex-1 mr-2">
                  <div className="h-4 w-3/4 bg-slate-200 rounded-md" />
                  <div className="h-3 w-24 bg-slate-100 rounded" />
                </div>
                <div className="h-4 w-10 bg-slate-100 rounded-full" />
              </div>

              <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100">
                <div className="flex flex-col gap-1">
                  <div className="h-2.5 w-12 bg-slate-100 rounded" />
                  <div className="h-4 w-16 bg-slate-200 rounded font-bold" />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="h-2.5 w-10 bg-slate-100 rounded" />
                  <div className="h-4 w-12 bg-slate-200 rounded" />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="h-2.5 w-12 bg-slate-100 rounded" />
                  <div className="h-4 w-10 bg-slate-200 rounded" />
                </div>
              </div>

              <div className="h-9 w-full bg-slate-100 rounded-lg" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
