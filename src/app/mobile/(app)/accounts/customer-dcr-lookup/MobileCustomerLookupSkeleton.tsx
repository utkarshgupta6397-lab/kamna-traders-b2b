import React from 'react';
import { Search, ChevronDown } from 'lucide-react';

export default function MobileCustomerLookupSkeleton() {
  return (
    <div className="flex-1 flex flex-col gap-4 animate-pulse px-4 pt-4 pb-8 max-w-[430px] mx-auto w-full">
      {/* Customer Selector Skeleton */}
      <div className="flex items-stretch gap-2">
        <div className="flex-1 flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
          <div className="flex flex-col gap-1.5 flex-1 mr-2">
            <div className="h-2.5 w-20 bg-slate-200 rounded" />
            <div className="h-4 w-36 bg-slate-200 rounded-md" />
          </div>
          <ChevronDown className="text-slate-300 shrink-0" size={20} />
        </div>
      </div>

      {/* Customer Header Box */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex justify-between items-start">
        <div className="flex flex-col gap-1.5 flex-1 mr-2">
          <div className="h-4 w-32 bg-slate-200 rounded" />
          <div className="h-3 w-20 bg-slate-100 rounded" />
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="h-2.5 w-14 bg-slate-100 rounded" />
          <div className="h-5 w-20 bg-slate-200 rounded" />
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm flex flex-col gap-2">
            <div className="h-2.5 w-20 bg-slate-200 rounded-full" />
            <div className="h-6 w-10 bg-slate-200 rounded-md" />
          </div>
        ))}
      </div>

      {/* Invoices List Skeleton */}
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <div className="h-4 w-28 bg-slate-200 rounded" />
              <div className="h-4 w-16 bg-slate-200 rounded" />
            </div>
            <div className="h-3 w-32 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
