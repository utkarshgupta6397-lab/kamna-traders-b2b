import React from 'react';
import { Package, AlertTriangle, ArrowLeftRight } from 'lucide-react';
import Link from 'next/link';
import WipWidget from '../WipWidget';

export default function InventorySection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 h-full w-full">
      {/* 1. Inventory Balance & Categories */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Package size={15} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">Inventory Distribution</h2>
              <p className="text-[11px] text-slate-400">Warehouse balances</p>
            </div>
          </div>
          <Link
            href="/staff/dashboard/operations/current-stock"
            className="text-xs font-semibold text-[#1A2766] hover:underline"
          >
            All Warehouses
          </Link>
        </div>

        {/* Large translucent WIP Watermark + subtle icon */}
        <WipWidget size="md" />

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Active SKU balance tracking</span>
        </div>
      </div>

      {/* 2. Stock Alerts & Low Stock Items */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <AlertTriangle size={15} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">Stock Alerts</h2>
              <p className="text-[11px] text-slate-400">Low stock & reorder levels</p>
            </div>
          </div>
          <Link
            href="/staff/settings"
            className="text-xs font-semibold text-slate-500 hover:underline"
          >
            Alert Rules
          </Link>
        </div>

        {/* Large translucent WIP Watermark + subtle icon */}
        <WipWidget size="md" />

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Automated reorder triggers</span>
        </div>
      </div>

      {/* 3. Inter-Warehouse Movement & Transfers */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <ArrowLeftRight size={15} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">Inventory Movement</h2>
              <p className="text-[11px] text-slate-400">Transfers & receipts</p>
            </div>
          </div>
          <Link
            href="/staff/dashboard/operations/transfers"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1A2766] hover:underline"
          >
            <span>Transfers</span>
          </Link>
        </div>

        {/* Large translucent WIP Watermark + subtle icon */}
        <WipWidget size="md" />

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>In-transit shipment log</span>
        </div>
      </div>
    </div>
  );
}
