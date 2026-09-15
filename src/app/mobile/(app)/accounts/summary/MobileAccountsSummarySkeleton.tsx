import React from "react";
import { ChevronLeft, RefreshCw, Search } from "lucide-react";

export default function MobileAccountsSummarySkeleton() {
  return (
    <div className="flex-1 flex flex-col font-sans min-h-0 bg-[#F8F9FB] animate-pulse">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-3 min-h-[56px] py-1">
          <div className="flex items-center gap-1 py-2 opacity-60">
            <ChevronLeft size={24} strokeWidth={2.5} />
            <div className="h-4 w-28 bg-white/20 rounded" />
          </div>
          <div className="p-2 text-white/50">
            <RefreshCw size={19} />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 py-4 max-w-[430px] mx-auto w-full space-y-4">
        {/* View Mode indicator & Date Filter Pills */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="h-6 w-24 bg-slate-200 rounded-full" />
            <div className="h-3 w-16 bg-slate-200 rounded" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 w-16 bg-slate-200 rounded-full shrink-0" />
            ))}
          </div>
        </div>

        {/* Primary Metric: Total Outstanding */}
        <div className="bg-white p-4 rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100 space-y-2">
          <div className="h-3 w-28 bg-slate-200 rounded" />
          <div className="h-8 w-44 bg-slate-200 rounded-lg" />
          <div className="h-3 w-32 bg-slate-100 rounded" />
        </div>

        {/* Collected & Pending 2-column grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-3.5 rounded-[18px] shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-slate-100 space-y-2">
            <div className="h-3 w-16 bg-slate-200 rounded" />
            <div className="h-6 w-28 bg-slate-200 rounded-md" />
            <div className="h-2.5 w-20 bg-slate-100 rounded" />
          </div>
          <div className="bg-white p-3.5 rounded-[18px] shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-slate-100 space-y-2">
            <div className="h-3 w-16 bg-slate-200 rounded" />
            <div className="h-6 w-28 bg-slate-200 rounded-md" />
            <div className="h-2.5 w-20 bg-slate-100 rounded" />
          </div>
        </div>

        {/* Collection Efficiency */}
        <div className="bg-white p-4 rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100 flex items-center justify-between">
          <div className="space-y-2 flex-1 mr-4">
            <div className="h-3 w-32 bg-slate-200 rounded" />
            <div className="h-6 w-20 bg-slate-200 rounded-md" />
            <div className="h-2.5 w-28 bg-slate-100 rounded" />
          </div>
          <div className="w-16 h-16 rounded-full bg-slate-200 shrink-0" />
        </div>

        {/* Total Billed */}
        <div className="bg-white p-3.5 rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-slate-100 flex items-center justify-between">
          <div className="h-3.5 w-20 bg-slate-200 rounded" />
          <div className="h-4 w-24 bg-slate-200 rounded" />
        </div>

        {/* Collapsible Key Exposure Skeleton Header */}
        <div className="bg-white p-4 rounded-[18px] shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-slate-100 flex items-center justify-between">
          <div className="h-4 w-28 bg-slate-200 rounded" />
          <div className="h-4 w-4 bg-slate-200 rounded-full" />
        </div>

        {/* Collapsible Summary Counts Skeleton Header */}
        <div className="bg-white p-4 rounded-[18px] shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-slate-100 flex items-center justify-between">
          <div className="h-4 w-32 bg-slate-200 rounded" />
          <div className="h-4 w-4 bg-slate-200 rounded-full" />
        </div>

        {/* Invoices Header + Search */}
        <div className="pt-2 space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="h-4 w-20 bg-slate-300 rounded" />
            <div className="h-4 w-12 bg-slate-200 rounded-full" />
          </div>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={17} />
            <div className="w-full h-11 bg-white border border-slate-200 rounded-xl" />
          </div>

          {/* Invoice Card Skeletons */}
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white p-4 rounded-[18px] shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-slate-100 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 w-28 bg-slate-200 rounded" />
                <div className="h-5 w-16 bg-slate-200 rounded-full" />
              </div>
              <div className="space-y-1">
                <div className="h-3.5 w-48 bg-slate-200 rounded" />
                <div className="h-2.5 w-32 bg-slate-100 rounded" />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-50">
                <div className="space-y-1">
                  <div className="h-2 w-10 bg-slate-100 rounded" />
                  <div className="h-3.5 w-16 bg-slate-200 rounded" />
                </div>
                <div className="space-y-1">
                  <div className="h-2 w-10 bg-slate-100 rounded" />
                  <div className="h-3.5 w-16 bg-slate-200 rounded" />
                </div>
                <div className="space-y-1">
                  <div className="h-2 w-10 bg-slate-100 rounded" />
                  <div className="h-3.5 w-16 bg-slate-200 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
