import React from 'react';
import { Package, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface InventoryStatusCardProps {
  loading?: boolean;
}

export default function InventoryStatusCard({ loading = true }: InventoryStatusCardProps) {
  // 4 skeleton placeholder rows
  const rows = [1, 2, 3, 4];

  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between h-[320px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <Package size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Inventory Status</h2>
            <p className="text-xs text-slate-400">Stock balance overview</p>
          </div>
        </div>

        <Link
          href="/staff/dashboard/operations/current-stock"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#1A2766] hover:underline"
        >
          <span>View stock</span>
          <ArrowRight size={13} />
        </Link>
      </div>

      {/* List/Table Skeleton */}
      <div className="flex-1 py-2 divide-y divide-slate-100">
        {loading ? (
          rows.map((row) => (
            <div key={row} className="py-2.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-slate-100 shrink-0 animate-pulse" />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="h-3.5 w-3/4 bg-slate-200/80 rounded animate-pulse" />
                  <div className="h-2.5 w-1/2 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="h-4 w-12 bg-slate-200 rounded animate-pulse" />
                <div className="h-5 w-16 bg-slate-100 rounded-full animate-pulse" />
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-slate-400">
            Inventory metrics will appear here
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-400">
        <span>Across primary warehouses</span>
        <span className="font-medium">Real-time sync ready</span>
      </div>
    </div>
  );
}
