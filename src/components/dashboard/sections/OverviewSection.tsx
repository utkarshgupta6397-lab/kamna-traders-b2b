import React from 'react';
import { TrendingUp, PieChart, Package, ChevronDown, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function OverviewSection() {
  const barHeights = [45, 68, 52, 85, 64, 90];
  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

  const legendItems = [
    { label: 'Fulfilled', color: 'bg-emerald-400' },
    { label: 'Dispatched', color: 'bg-blue-400' },
    { label: 'Processing', color: 'bg-amber-400' },
    { label: 'On Hold', color: 'bg-slate-300' },
  ];

  const inventoryRows = [1, 2, 3, 4, 5];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 h-full w-full">
      {/* 1. Business Performance Card */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <TrendingUp size={15} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">Business Performance</h2>
              <p className="text-[11px] text-slate-400">Sales & revenue trend</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
            <span>Last 6 Months</span>
            <ChevronDown size={13} className="text-slate-400" />
          </div>
        </div>

        {/* Static Neutral Bar Chart Placeholder - Expands to fill height */}
        <div className="flex-1 flex flex-col justify-end py-4 min-h-0">
          <div className="space-y-6 w-full opacity-40 mb-3">
            <div className="h-px bg-slate-200 w-full border-t border-dashed border-slate-200" />
            <div className="h-px bg-slate-200 w-full border-t border-dashed border-slate-200" />
            <div className="h-px bg-slate-200 w-full border-t border-dashed border-slate-200" />
          </div>
          <div className="grid grid-cols-6 gap-2.5 items-end flex-1 max-h-[220px] px-1">
            {barHeights.map((height, i) => (
              <div key={i} className="flex flex-col items-center gap-2 h-full justify-end">
                <div
                  className="w-full max-w-[34px] bg-slate-200/90 rounded-t"
                  style={{ height: `${height}%` }}
                />
                <span className="text-[11px] font-medium text-slate-400">
                  {months[i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Continuous aggregation ready</span>
          <span className="font-medium text-slate-500">Neutral placeholder</span>
        </div>
      </div>

      {/* 2. Order Status Distribution Card */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <PieChart size={15} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">Order Status</h2>
              <p className="text-[11px] text-slate-400">Pipeline distribution</p>
            </div>
          </div>
          <span className="text-xs font-medium text-slate-400">All channels</span>
        </div>

        {/* Static Neutral Donut Chart Area - Expands to fill height */}
        <div className="flex-1 flex flex-col sm:flex-row items-center justify-around py-4 min-h-0 gap-4">
          <div className="relative flex items-center justify-center shrink-0">
            <div className="w-32 h-32 lg:w-36 lg:h-36 rounded-full border-[14px] border-slate-200/90 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                <div className="w-8 h-2 bg-slate-200 rounded" />
              </div>
            </div>
          </div>

          <div className="space-y-3 w-32 shrink-0">
            {legendItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${item.color} opacity-75`} />
                  <span className="text-xs font-medium text-slate-600">{item.label}</span>
                </div>
                <div className="w-5 h-3 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Real-time dispatch sync</span>
          <span className="font-medium text-slate-500">Pipeline states</span>
        </div>
      </div>

      {/* 3. Inventory Status Summary Card */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Package size={15} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">Inventory Status</h2>
              <p className="text-[11px] text-slate-400">Stock balance overview</p>
            </div>
          </div>

          <Link
            href="/staff/dashboard/operations/current-stock"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1A2766] hover:underline"
          >
            <span>Current Stock</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {/* Static Inventory Rows - Fills vertical workspace cleanly */}
        <div className="flex-1 py-2 divide-y divide-slate-100 min-h-0 flex flex-col justify-around">
          {inventoryRows.map((row) => (
            <div key={row} className="py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-7 h-7 rounded-lg bg-slate-100 shrink-0" />
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="h-3 w-3/4 bg-slate-200 rounded" />
                  <div className="h-2 w-1/2 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-3.5 w-10 bg-slate-200 rounded" />
                <div className="h-4 w-12 bg-slate-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Primary warehouse coverage</span>
          <span className="font-medium text-slate-500">Live balance</span>
        </div>
      </div>
    </div>
  );
}
