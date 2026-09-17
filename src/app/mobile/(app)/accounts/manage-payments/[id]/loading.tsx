import React from 'react';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function PaymentDetailLoading() {
  return (
    <div className="flex-1 flex flex-col font-sans min-h-0 bg-[#F8F9FB]">
      <header className="sticky top-0 z-40 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)] shrink-0">
        <div className="flex items-center justify-between px-2 min-h-[56px] py-1">
          <Link
            href="/mobile/accounts/manage-payments"
            className="flex items-center gap-1 px-3 py-2 active:opacity-60 transition-opacity"
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="font-bold text-[15px]">Payments</span>
          </Link>
          <span className="font-bold text-[16px] tracking-tight">Payment Details</span>
          <div className="w-16" />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-[430px] mx-auto w-full flex flex-col gap-4 pb-12 animate-pulse">
        {/* Status Card Skeleton */}
        <div className="bg-white rounded-[20px] p-5 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div className="h-3 w-24 bg-slate-200 rounded" />
            <div className="h-6 w-28 bg-slate-100 rounded-full" />
          </div>
          <div className="h-10 w-full bg-slate-50 rounded-xl" />
        </div>

        {/* Action Area Skeleton */}
        <div className="bg-white rounded-[20px] p-4 border border-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.06)] flex flex-col gap-2.5">
          <div className="h-3 w-36 bg-slate-200 rounded" />
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="h-12 bg-slate-100 rounded-xl" />
            <div className="h-12 bg-slate-200 rounded-xl" />
          </div>
        </div>

        {/* Customer Information Card Skeleton */}
        <div className="bg-white rounded-[20px] p-5 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col gap-3">
          <div className="h-3 w-36 bg-slate-200 rounded" />
          <div className="h-5 w-48 bg-slate-200 rounded" />
          <div className="h-3 w-32 bg-slate-100 rounded" />
        </div>

        {/* Payment Amount & Details Card Skeleton */}
        <div className="bg-white rounded-[20px] p-5 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col gap-4">
          <div className="h-3 w-28 bg-slate-200 rounded" />
          <div className="grid grid-cols-2 gap-4 pb-3 border-b border-slate-50">
            <div>
              <div className="h-3 w-14 bg-slate-100 rounded mb-2" />
              <div className="h-7 w-28 bg-slate-200 rounded" />
            </div>
            <div>
              <div className="h-3 w-20 bg-slate-100 rounded mb-2" />
              <div className="h-6 w-16 bg-slate-100 rounded-md" />
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="h-3 w-24 bg-slate-100 rounded" />
                <div className="h-3 w-28 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Photo Proof Section Skeleton */}
        <div className="bg-white rounded-[20px] p-5 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col gap-3">
          <div className="h-3 w-36 bg-slate-200 rounded" />
          <div className="h-44 w-full bg-slate-200 rounded-xl" />
        </div>
      </main>
    </div>
  );
}
