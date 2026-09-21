import React from 'react';
import { TrendingUp, ShoppingBag, DollarSign, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export default function SalesSection() {
  const recentOrderRows = [1, 2, 3, 4, 5];
  const summaryMetrics = [
    { title: 'Gross Revenue', subtitle: '30-day window' },
    { title: 'Average Order Value', subtitle: 'Across all channels' },
    { title: 'Completed Orders', subtitle: 'Invoiced & cleared' },
    { title: 'Customer Conversion', subtitle: 'Quote-to-dispatch' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 h-full w-full">
      {/* 1. Sales Trend & Channel Breakdown */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <TrendingUp size={15} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">Sales Velocity & Trend</h2>
              <p className="text-[11px] text-slate-400">Periodic revenue flow</p>
            </div>
          </div>
          <span className="text-xs font-medium text-slate-400">Monthly breakdown</span>
        </div>

        {/* Static Neutral Bar Graph Placeholder */}
        <div className="flex-1 flex flex-col justify-end py-4 min-h-0">
          <div className="space-y-6 w-full opacity-40 mb-3">
            <div className="h-px bg-slate-200 w-full border-t border-dashed border-slate-200" />
            <div className="h-px bg-slate-200 w-full border-t border-dashed border-slate-200" />
            <div className="h-px bg-slate-200 w-full border-t border-dashed border-slate-200" />
          </div>
          <div className="grid grid-cols-6 gap-2.5 items-end flex-1 max-h-[220px] px-1">
            {[35, 60, 48, 75, 82, 92].map((height, i) => (
              <div key={i} className="flex flex-col items-center gap-2 h-full justify-end">
                <div
                  className="w-full max-w-[34px] bg-blue-200/80 rounded-t"
                  style={{ height: `${height}%` }}
                />
                <span className="text-[11px] font-medium text-slate-400">W{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Weekly velocity pattern</span>
          <span className="font-medium text-slate-500">Sales pipeline</span>
        </div>
      </div>

      {/* 2. Key Sales Metrics Summary */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <DollarSign size={15} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">Sales Summary</h2>
              <p className="text-[11px] text-slate-400">Performance indicators</p>
            </div>
          </div>
          <span className="text-xs font-medium text-slate-400">YTD summary</span>
        </div>

        {/* 4 Static Metric Tiles */}
        <div className="grid grid-cols-2 gap-3 flex-1 py-3 min-h-0 items-center">
          {summaryMetrics.map((metric, idx) => (
            <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 flex flex-col justify-between h-[80px]">
              <span className="text-xs font-bold text-slate-700 truncate">{metric.title}</span>
              <div className="h-4 w-20 bg-slate-200 rounded" />
              <span className="text-[11px] text-slate-400 truncate">{metric.subtitle}</span>
            </div>
          ))}
        </div>

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Automated KPI rollups</span>
          <span className="font-medium text-slate-500">Real-time metrics</span>
        </div>
      </div>

      {/* 3. Recent Orders & Sales Activity */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
              <ShoppingBag size={15} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">Recent Orders</h2>
              <p className="text-[11px] text-slate-400">Latest customer orders</p>
            </div>
          </div>

          <Link
            href="/staff/dashboard/cart"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1A2766] hover:underline"
          >
            <span>Open Cart</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>

        {/* Static Order Rows */}
        <div className="flex-1 py-2 divide-y divide-slate-100 min-h-0 flex flex-col justify-around">
          {recentOrderRows.map((row) => (
            <div key={row} className="py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-7 h-7 rounded-lg bg-slate-100 shrink-0" />
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="h-3 w-3/4 bg-slate-200 rounded" />
                  <div className="h-2 w-1/3 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-3.5 w-12 bg-slate-200 rounded" />
                <div className="h-4 w-12 bg-slate-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Direct ERP order link</span>
          <span className="font-medium text-slate-500">Live order feed</span>
        </div>
      </div>
    </div>
  );
}
