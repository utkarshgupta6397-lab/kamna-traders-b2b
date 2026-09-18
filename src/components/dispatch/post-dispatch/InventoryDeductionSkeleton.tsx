'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface Props {
  invoiceId?: string;
  invoiceNumber?: string;
}

export default function InventoryDeductionSkeleton({ invoiceId, invoiceNumber }: Props) {
  const displayInvoice = invoiceNumber || invoiceId || '';

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16 animate-in fade-in duration-150">
      {/* 1. COMPACT POS HEADER STRIP SKELETON */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-1.5 rounded-lg border border-slate-200 text-slate-400 bg-slate-50">
              <ArrowLeft size={16} />
            </div>

            <div className="flex items-center gap-2 text-xs">
              {displayInvoice ? (
                <span className="font-bold text-slate-900 font-mono text-sm">{displayInvoice}</span>
              ) : (
                <div className="h-5 w-24 bg-slate-200 rounded animate-pulse" />
              )}
              <span className="text-slate-300">·</span>
              <div className="h-4 w-36 bg-slate-200 rounded animate-pulse" />
              <span className="text-slate-300">·</span>
              <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
              <span className="text-slate-300">·</span>
              <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-8 w-24 bg-slate-100 border border-slate-200 rounded-lg animate-pulse" />
            <div className="h-8 w-8 bg-slate-100 border border-slate-200 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>

      {/* 2. MAIN POS WORKSPACE SKELETON */}
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        {/* Horizontal Ribbon Skeleton */}
        <div>
          <div className="h-4 w-32 bg-slate-200 rounded mb-2 animate-pulse" />
          <div className="flex items-stretch gap-3 overflow-x-hidden">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className="min-w-[170px] max-w-[200px] sm:min-w-[190px] sm:max-w-[210px] shrink-0 p-2.5 rounded-xl border border-slate-200 bg-white space-y-2.5 animate-pulse"
              >
                <div className="w-full h-24 bg-slate-100 rounded-lg" />
                <div className="h-4 bg-slate-200 rounded w-4/5" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div className="h-4 w-12 bg-slate-200 rounded" />
                  <div className="h-4 w-16 bg-slate-100 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Item Workspace Skeleton */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden animate-pulse">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
            <div className="space-y-1.5 w-1/2">
              <div className="h-5 bg-slate-200 rounded w-3/4" />
              <div className="h-3.5 bg-slate-100 rounded w-1/2" />
            </div>
            <div className="h-8 w-44 bg-slate-200 rounded-xl" />
          </div>
          <div className="p-5 space-y-4">
            <div className="h-28 bg-slate-50 border border-slate-200 rounded-xl" />
          </div>
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
            <div className="h-4 w-40 bg-slate-200 rounded" />
            <div className="h-9 w-32 bg-slate-200 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
