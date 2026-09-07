import React from 'react';
import { Search } from 'lucide-react';

export default function MobileCustomerStatementSkeleton() {
  return (
    <div className="flex-1 flex flex-col gap-3 p-3 max-w-[430px] mx-auto w-full animate-pulse">
      {/* Search Input Skeleton */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
          <div className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg" />
        </div>
      </div>

      {/* Customer Header Card Skeleton */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex justify-between items-start">
        <div className="flex flex-col gap-2 flex-1 mr-3">
          <div className="h-4 w-3/4 bg-slate-200 rounded" />
          <div className="h-3 w-1/2 bg-slate-100 rounded" />
        </div>
        <div className="h-6 w-14 bg-slate-100 rounded" />
      </div>

      {/* Date Range Quick Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-7 w-20 bg-white border border-slate-200 rounded-full shrink-0" />
        ))}
      </div>

      {/* Financial Summary KPI Cards */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Total Invoiced' },
          { label: 'Total Paid' },
          { label: 'Balance' },
        ].map((kpi, i) => (
          <div
            key={i}
            className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1.5"
          >
            <div className="h-2.5 w-14 bg-slate-200 rounded-full" />
            <div className="h-4 w-16 bg-slate-200 rounded" />
          </div>
        ))}
      </div>

      {/* Transactions Table Skeleton */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between">
          <div className="h-3 w-20 bg-slate-200 rounded" />
          <div className="h-3 w-16 bg-slate-200 rounded" />
        </div>

        <div className="divide-y divide-slate-100">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-3 flex justify-between items-center">
              <div className="flex flex-col gap-1.5 flex-1 mr-2">
                <div className="h-4 w-28 bg-slate-200 rounded" />
                <div className="h-2.5 w-36 bg-slate-100 rounded" />
              </div>
              <div className="h-4 w-16 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
