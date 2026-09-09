'use client';

import React from 'react';
import { PackageMinus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function Page() {
  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">Inventory Deduction</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
              Phase 2 — Coming Soon
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Automated stock deduction module for completed dispatch shipments.
          </p>
        </div>
        <Link
          href="/staff/dashboard/dispatch/incoming"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#1A2766] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Dispatch
        </Link>
      </div>

      {/* Notice Card */}
      <div className="flex-1 overflow-auto bg-gray-50/30 flex items-center justify-center p-8">
        <div className="flex flex-col items-center text-center max-w-md bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center border border-amber-100 mb-4 text-amber-600">
            <PackageMinus size={32} />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 mb-2">
            Scheduled for Phase 2
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Inventory Deduction Module</h2>
          <p className="text-xs text-gray-500 leading-relaxed mb-6">
            Phase 1 implements Zoho Books invoice synchronization, receiving proof upload & verification, and physical checked-by audit workflows. Automated inventory deductions will be introduced in Phase 2.
          </p>
          <Link
            href="/staff/dashboard/dispatch/incoming"
            className="px-4 py-2 bg-[#1A2766] text-white text-xs font-bold rounded-lg hover:bg-blue-900 transition-colors shadow-sm"
          >
            Go to Active Workflows
          </Link>
        </div>
      </div>
    </div>
  );
}
