import React from 'react';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function RecordPaymentLoading() {
  return (
    <div className="flex-1 flex flex-col font-sans min-h-0 bg-[#F8F9FB]">
      <header className="sticky top-0 z-40 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)] shrink-0">
        <div className="flex items-center justify-between px-2 min-h-[56px] py-1">
          <Link
            href="/mobile/accounts/manage-payments"
            className="flex items-center gap-1 px-3 py-2 active:opacity-60 transition-opacity"
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="font-bold text-[15px]">Cancel</span>
          </Link>
          <span className="font-bold text-[16px] tracking-tight">Record Payment</span>
          <div className="w-12" />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-[430px] mx-auto w-full pb-10 flex flex-col gap-5 animate-pulse">
        {/* Customer Field Skeleton */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <div className="h-3 w-20 bg-slate-200 rounded" />
            <div className="h-3 w-10 bg-slate-100 rounded" />
          </div>
          <div className="h-12 w-full bg-white border border-slate-200 rounded-xl" />
        </div>

        {/* Amount Field Skeleton */}
        <div className="flex flex-col gap-1.5">
          <div className="h-3 w-32 bg-slate-200 rounded" />
          <div className="h-14 w-full bg-white border border-slate-200 rounded-xl" />
        </div>

        {/* Date Field Skeleton */}
        <div className="flex flex-col gap-1.5">
          <div className="h-3 w-28 bg-slate-200 rounded" />
          <div className="h-12 w-full bg-white border border-slate-200 rounded-xl" />
        </div>

        {/* Payment Mode Skeleton */}
        <div className="flex flex-col gap-1.5">
          <div className="h-3 w-28 bg-slate-200 rounded" />
          <div className="grid grid-cols-4 gap-2 bg-slate-100 p-1.5 rounded-2xl">
            <div className="h-11 bg-slate-200 rounded-xl" />
            <div className="h-11 bg-slate-200 rounded-xl" />
            <div className="h-11 bg-slate-200 rounded-xl" />
            <div className="h-11 bg-slate-200 rounded-xl" />
          </div>
        </div>

        {/* Photo Capture Skeleton */}
        <div className="flex flex-col gap-1.5">
          <div className="h-3 w-40 bg-slate-200 rounded" />
          <div className="h-32 w-full bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200" />
        </div>

        {/* Submit Button Skeleton */}
        <div className="h-14 w-full bg-slate-200 rounded-xl mt-2" />
      </main>
    </div>
  );
}
