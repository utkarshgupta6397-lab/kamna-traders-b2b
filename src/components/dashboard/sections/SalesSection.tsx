import React from 'react';
import { TrendingUp, ShoppingBag, DollarSign, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import WipWidget from '../WipWidget';

export default function SalesSection() {
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

        {/* Large translucent WIP Watermark + subtle icon */}
        <WipWidget size="md" />

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Weekly velocity pattern</span>
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

        {/* Large translucent WIP Watermark + subtle icon */}
        <WipWidget size="md" />

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Automated KPI rollups</span>
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

        {/* Large translucent WIP Watermark + subtle icon */}
        <WipWidget size="md" />

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Direct ERP order link</span>
        </div>
      </div>
    </div>
  );
}
