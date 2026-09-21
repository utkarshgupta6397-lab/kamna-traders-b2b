import React from 'react';
import {
  TrendingUp,
  PieChart,
  Package,
  CreditCard,
  BarChart3,
  Activity,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

export default function OverviewSection() {
  // Row 1 Static Data Placeholders
  const performanceHeights = [45, 68, 52, 85, 64, 90];
  const performanceMonths = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

  const orderLegendItems = [
    { label: 'Fulfilled', color: 'bg-emerald-400' },
    { label: 'Dispatched', color: 'bg-blue-400' },
    { label: 'Processing', color: 'bg-amber-400' },
    { label: 'On Hold', color: 'bg-slate-300' },
  ];

  const inventoryRows = [1, 2, 3, 4];

  // Row 2 Static Data Placeholders
  const paymentPoints = [25, 45, 38, 70, 62, 88];
  const paymentMonths = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

  const categories = [
    { name: 'Solar Panels', width: '84%', color: 'bg-blue-400' },
    { name: 'Inverters', width: '68%', color: 'bg-indigo-400' },
    { name: 'Wire & Cables', width: '52%', color: 'bg-emerald-400' },
    { name: 'Accessories', width: '36%', color: 'bg-amber-400' },
  ];

  const operationsStatus = [
    { label: 'Completed', color: 'bg-emerald-400' },
    { label: 'In Progress', color: 'bg-blue-400' },
    { label: 'Pending Review', color: 'bg-amber-400' },
    { label: 'Blocked / Hold', color: 'bg-rose-400' },
  ];

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
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-[10px] font-medium text-slate-600">
            <span>Last 6 Months</span>
            <ChevronDown size={11} className="text-slate-400" />
          </div>
        </div>

        {/* Static Neutral Bar Chart Placeholder - Expands to fill available card height */}
        <div className="flex-1 flex flex-col justify-end py-2 min-h-0">
          <div className="space-y-4 w-full opacity-35 mb-2">
            <div className="h-px bg-slate-200 w-full border-t border-dashed border-slate-200" />
            <div className="h-px bg-slate-200 w-full border-t border-dashed border-slate-200" />
          </div>
          <div className="grid grid-cols-6 gap-2 items-end flex-1 h-full min-h-[60px] px-1">
            {performanceHeights.map((height, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 h-full justify-end">
                <div
                  className="w-full max-w-[32px] bg-slate-200/90 rounded-t"
                  style={{ height: `${height}%` }}
                />
                <span className="text-[10px] font-medium text-slate-400 shrink-0">
                  {performanceMonths[i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Continuous aggregation</span>
          <span className="font-medium text-slate-500">Neutral placeholder</span>
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

        {/* Static Neutral Donut Chart Area - Centered with balanced breathing room */}
        <div className="flex-1 flex items-center justify-around py-2 min-h-0 gap-3">
          <div className="relative flex items-center justify-center shrink-0">
            <div className="w-20 h-20 xl:w-24 xl:h-24 aspect-square rounded-full border-[10px] xl:border-[12px] border-slate-200/90 flex items-center justify-center">
              <div className="w-10 h-10 xl:w-12 xl:h-12 rounded-full bg-slate-50 flex items-center justify-center">
                <div className="w-5 h-1.5 bg-slate-200 rounded" />
              </div>
            </div>
          </div>

          <div className="space-y-2 w-32 shrink-0">
            {orderLegendItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${item.color} opacity-80`} />
                  <span className="text-[11px] font-medium text-slate-600">{item.label}</span>
                </div>
                <div className="w-5 h-2.5 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Real-time dispatch sync</span>
          <span className="font-medium text-slate-500">Pipeline states</span>
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

          <Link
            href="/staff/dashboard/operations/current-stock"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1A2766] hover:underline"
          >
            <span>Current Stock</span>
            <ArrowRight size={11} />
          </Link>
        </div>

        {/* Static Inventory Rows - Distributed evenly across available height */}
        <div className="flex-1 py-1 divide-y divide-slate-100 min-h-0 flex flex-col justify-around">
          {inventoryRows.map((row) => (
            <div key={row} className="py-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-5 h-5 rounded bg-slate-100 shrink-0" />
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="h-2.5 w-3/4 bg-slate-200 rounded" />
                  <div className="h-2 w-1/2 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="h-3 w-8 bg-slate-200 rounded" />
                <div className="h-3.5 w-10 bg-slate-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Primary warehouse coverage</span>
          <span className="font-medium text-slate-500">Live balance</span>
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
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-[10px] font-medium text-slate-600">
            <span>Invoiced vs Cleared</span>
          </div>
        </div>

        {/* Static Area / Stepped Chart Placeholder */}
        <div className="flex-1 flex flex-col justify-end py-2 min-h-0">
          {/* Neutral summary pills */}
          <div className="flex items-center justify-between gap-2 px-1 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 opacity-80" />
              <span className="text-[10px] text-slate-500 font-medium">Inflows</span>
              <div className="w-8 h-2 bg-slate-200 rounded ml-1" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 opacity-80" />
              <span className="text-[10px] text-slate-500 font-medium">Receivables</span>
              <div className="w-8 h-2 bg-slate-200 rounded ml-1" />
            </div>
          </div>

          <div className="grid grid-cols-6 gap-2 items-end flex-1 h-full min-h-[60px] px-1">
            {paymentPoints.map((height, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 h-full justify-end">
                <div
                  className="w-full max-w-[32px] bg-amber-100/90 border border-amber-200/80 rounded-t"
                  style={{ height: `${height}%` }}
                />
                <span className="text-[10px] font-medium text-slate-400 shrink-0">
                  {paymentMonths[i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Zoho Books reconciliation</span>
          <span className="font-medium text-slate-500">Collection rate</span>
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

        {/* Static Horizontal Bar Chart Placeholders - Distributed across card height */}
        <div className="flex-1 py-1.5 flex flex-col justify-around min-h-0">
          {categories.map((cat, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-700">{cat.name}</span>
                <div className="w-10 h-2.5 bg-slate-200 rounded" />
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${cat.color} rounded-full opacity-80`}
                  style={{ width: cat.width }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Core product lines</span>
          <span className="font-medium text-slate-500">Volume share</span>
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

        {/* Static Donut / Status Ring and Legend - Centered with balanced breathing room */}
        <div className="flex-1 flex items-center justify-around py-2 min-h-0 gap-3">
          <div className="relative flex items-center justify-center shrink-0">
            <div className="w-20 h-20 xl:w-24 xl:h-24 aspect-square rounded-full border-[10px] xl:border-[12px] border-slate-200/90 flex items-center justify-center">
              <div className="w-10 h-10 xl:w-12 xl:h-12 rounded-full bg-cyan-50/50 flex items-center justify-center">
                <div className="w-5 h-1.5 bg-cyan-300 rounded" />
              </div>
            </div>
          </div>

          <div className="space-y-2 w-32 shrink-0">
            {operationsStatus.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${item.color} opacity-80`} />
                  <span className="text-[11px] font-medium text-slate-600 truncate max-w-[70px]">
                    {item.label}
                  </span>
                </div>
                <div className="w-6 h-2.5 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Fulfillment pipeline status</span>
          <span className="font-medium text-slate-500">Auto routing</span>
        </div>
      </div>
    </div>
  );
}
