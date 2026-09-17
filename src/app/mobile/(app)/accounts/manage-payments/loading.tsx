import React from 'react';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function ManagePaymentsLoading() {
  return (
    <div className="flex-1 flex flex-col font-sans min-h-0 bg-[#F8F9FB]">
      <header className="sticky top-0 z-50 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)] shrink-0">
        <div className="flex items-center px-1 min-h-[56px] py-1">
          <Link
            href="/mobile/accounts"
            className="flex items-center gap-1 px-3 py-2 active:opacity-60 transition-opacity"
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="font-bold text-[15px]">Manage Payments</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-[430px] mx-auto w-full flex flex-col gap-4 animate-pulse">
        {/* Top Summary Card Skeleton */}
        <div className="bg-white rounded-[20px] p-5 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
          <div className="h-3 w-36 bg-slate-200 rounded mb-3" />
          <div className="h-8 w-44 bg-slate-200 rounded mb-2" />
          <div className="h-3 w-28 bg-slate-100 rounded" />
        </div>

        {/* View Tabs Skeleton */}
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 bg-slate-200 rounded-full" />
          <div className="h-9 w-28 bg-slate-200 rounded-full" />
        </div>

        {/* Filter Pills Skeleton */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <div className="h-7 w-14 bg-slate-200 rounded-full" />
          <div className="h-7 w-20 bg-slate-200 rounded-full" />
          <div className="h-7 w-20 bg-slate-200 rounded-full" />
          <div className="h-7 w-20 bg-slate-200 rounded-full" />
        </div>

        {/* List Items Skeleton */}
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-[16px] p-4 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col gap-2.5"
            >
              <div className="flex justify-between items-center">
                <div className="h-4 w-32 bg-slate-200 rounded" />
                <div className="h-5 w-24 bg-slate-100 rounded-full" />
              </div>
              <div className="h-3 w-20 bg-slate-100 rounded" />
              <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                <div className="h-5 w-24 bg-slate-200 rounded" />
                <div className="h-4 w-28 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
