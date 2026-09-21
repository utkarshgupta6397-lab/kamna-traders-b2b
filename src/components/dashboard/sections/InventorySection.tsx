import React from 'react';
import { Package, AlertTriangle, ArrowLeftRight, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function InventorySection() {
  const stockAlertRows = [1, 2, 3, 4, 5];
  const movementRows = [1, 2, 3, 4, 5];

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

        {/* Static Warehouse Bar Distribution - Fills vertical workspace */}
        <div className="flex-1 flex flex-col justify-around py-3 min-h-0">
          {['Primary Hub', 'Warehouse 2', 'Regional Depo', 'Transit Bin', 'Central Solar Vault'].map((wh, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">{wh}</span>
                <div className="h-3.5 w-12 bg-slate-200 rounded" />
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-200/90 rounded-full"
                  style={{ width: `${Math.min(95, (idx + 1) * 20)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Active SKU balance tracking</span>
          <span className="font-medium text-slate-500">Warehouse stock</span>
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

        {/* Static Alert Rows */}
        <div className="flex-1 py-2 divide-y divide-slate-100 min-h-0 flex flex-col justify-around">
          {stockAlertRows.map((row) => (
            <div key={row} className="py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-100 shrink-0 flex items-center justify-center text-rose-600">
                  <span className="text-xs font-bold">!</span>
                </div>
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="h-3 w-3/4 bg-slate-200 rounded" />
                  <div className="h-2 w-1/3 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="h-4 w-16 bg-rose-100/70 rounded-full shrink-0" />
            </div>
          ))}
        </div>

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Automated reorder triggers</span>
          <span className="font-medium text-slate-500">Alert threshold</span>
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
            <ArrowRight size={13} />
          </Link>
        </div>

        {/* Static Movement Rows */}
        <div className="flex-1 py-2 divide-y divide-slate-100 min-h-0 flex flex-col justify-around">
          {movementRows.map((row) => (
            <div key={row} className="py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-7 h-7 rounded-lg bg-slate-100 shrink-0" />
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="h-3 w-2/3 bg-slate-200 rounded" />
                  <div className="h-2 w-1/2 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="h-4 w-14 bg-slate-100 rounded-full shrink-0" />
            </div>
          ))}
        </div>

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>In-transit shipment log</span>
          <span className="font-medium text-slate-500">Audit trail</span>
        </div>
      </div>
    </div>
  );
}
