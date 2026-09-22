import React from 'react';
import {
  TrendingUp,
  PieChart,
  Package,
  CreditCard,
  BarChart3,
  Activity,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import WipWidget from '../WipWidget';

export default function OverviewSection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2 gap-2.5 h-full w-full min-h-0 overflow-y-auto lg:overflow-hidden pr-0.5">
      {/* ========================================================================= */}
      {/* ROW 1: PRIMARY OVERVIEW ANALYTICS (3 CARDS)                               */}
      {/* ========================================================================= */}

      {/* 1. Business Performance Card */}
      <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden h-full min-h-0">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <TrendingUp size={14} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">Business Performance</h2>
              <p className="text-[10px] text-slate-400">Sales & revenue trend</p>
            </div>
          </div>
        </div>

        {/* Large translucent WIP Watermark + subtle icon */}
        <WipWidget size="md" />

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Continuous aggregation</span>
        </div>
      </div>

      {/* 2. Order Status Distribution Card */}
      <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden h-full min-h-0">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <PieChart size={14} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">Order Status</h2>
              <p className="text-[10px] text-slate-400">Pipeline distribution</p>
            </div>
          </div>
          <span className="text-[10px] font-medium text-slate-400">All channels</span>
        </div>

        {/* Large translucent WIP Watermark + subtle icon */}
        <WipWidget size="md" />

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Real-time dispatch sync</span>
        </div>
      </div>

      {/* 3. Inventory Status Summary Card */}
      <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden h-full min-h-0">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Package size={14} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">Inventory Status</h2>
              <p className="text-[10px] text-slate-400">Stock balance overview</p>
            </div>
          </div>

          {/* Genuine navigation link preserved */}
          <Link
            href="/staff/dashboard/operations/current-stock"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1A2766] hover:underline"
          >
            <span>Current Stock</span>
            <ArrowRight size={11} />
          </Link>
        </div>

        {/* Large translucent WIP Watermark + subtle icon */}
        <WipWidget size="md" />

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Primary warehouse coverage</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ROW 2: EXPANDED OPERATIONAL ANALYTICS (3 CARDS)                           */}
      {/* ========================================================================= */}

      {/* 4. Payment Collection Trend Card */}
      <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden h-full min-h-0">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <CreditCard size={14} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">Payment Collection</h2>
              <p className="text-[10px] text-slate-400">Receivables & inflow trend</p>
            </div>
          </div>
        </div>

        {/* Large translucent WIP Watermark + subtle icon */}
        <WipWidget size="md" />

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Zoho Books reconciliation</span>
        </div>
      </div>

      {/* 5. Sales by Category Card */}
      <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden h-full min-h-0">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
              <BarChart3 size={14} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">Sales by Category</h2>
              <p className="text-[10px] text-slate-400">Product line contribution</p>
            </div>
          </div>
          <span className="text-[10px] font-medium text-slate-400">FY 2026</span>
        </div>

        {/* Large translucent WIP Watermark + subtle icon */}
        <WipWidget size="md" />

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Core product lines</span>
        </div>
      </div>

      {/* 6. Operations Overview Workflow Card */}
      <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden h-full min-h-0">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-100">
              <Activity size={14} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">Operations Overview</h2>
              <p className="text-[10px] text-slate-400">Workflow & task queue</p>
            </div>
          </div>
          <span className="text-[10px] font-medium text-slate-400">Live tracker</span>
        </div>

        {/* Large translucent WIP Watermark + subtle icon */}
        <WipWidget size="md" />

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Fulfillment pipeline status</span>
        </div>
      </div>
    </div>
  );
}
