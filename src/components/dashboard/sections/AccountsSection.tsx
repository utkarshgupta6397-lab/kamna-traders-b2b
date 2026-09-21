import React from 'react';
import { FileText, CreditCard, DollarSign, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function AccountsSection() {
  const paymentRows = [1, 2, 3, 4];
  const financialMetrics = [
    { title: 'Due Within 7 Days', desc: 'Active credit periods' },
    { title: 'Overdue Receivables', desc: 'Collection queue' },
    { title: 'Payment Inflows Today', desc: 'Direct bank & cash' },
    { title: 'DCR Hold Accounts', desc: 'Awaiting compliance' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 h-full min-h-0">
      {/* 1. Customer Receivables & Aging */}
      <div className="bg-white rounded-lg p-3.5 border border-slate-200/80 shadow-2xs flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-100">
              <FileText size={14} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">Receivables & Aging</h2>
              <p className="text-[10px] text-slate-400">Aging brackets overview</p>
            </div>
          </div>
          <Link
            href="/staff/dashboard/accounts"
            className="text-[10px] font-semibold text-[#1A2766] hover:underline"
          >
            Ledgers
          </Link>
        </div>

        {/* Static Aging Distribution Placeholder */}
        <div className="flex-1 flex flex-col justify-center space-y-2.5 py-2 min-h-0">
          {['0 - 15 Days (Current)', '16 - 30 Days', '31 - 60 Days', '60+ Days'].map((bucket, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-slate-600">{bucket}</span>
                <div className="h-3 w-12 bg-slate-200 rounded" />
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-300 rounded-full"
                  style={{ width: `${Math.max(15, 60 - idx * 14)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Zoho Books synchronized</span>
          <span className="font-medium text-slate-500">Aging balance</span>
        </div>
      </div>

      {/* 2. Pending Payments & Financial Workload */}
      <div className="bg-white rounded-lg p-3.5 border border-slate-200/80 shadow-2xs flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <CreditCard size={14} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">Pending Payments</h2>
              <p className="text-[10px] text-slate-400">Cashflow & collections</p>
            </div>
          </div>
          <Link
            href="/staff/dashboard/accounts/manage-payments"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1A2766] hover:underline"
          >
            <span>Payments</span>
            <ArrowRight size={11} />
          </Link>
        </div>

        {/* Static Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 flex-1 py-1.5 min-h-0 items-center">
          {financialMetrics.map((item, idx) => (
            <div key={idx} className="p-2.5 rounded-md bg-slate-50 border border-slate-100 flex flex-col justify-between h-[64px]">
              <span className="text-[10px] font-bold text-slate-600 truncate">{item.title}</span>
              <div className="h-3.5 w-14 bg-slate-200 rounded" />
              <span className="text-[9px] text-slate-400 truncate">{item.desc}</span>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Banking reconciliation queue</span>
          <span className="font-medium text-slate-500">Auto matched</span>
        </div>
      </div>

      {/* 3. Recent Financial Transactions */}
      <div className="bg-white rounded-lg p-3.5 border border-slate-200/80 shadow-2xs flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <DollarSign size={14} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800">Recent Transactions</h2>
              <p className="text-[10px] text-slate-400">Invoices & receipts</p>
            </div>
          </div>
          <span className="text-[10px] font-medium text-slate-400">Real-time ledger</span>
        </div>

        {/* Static Transaction Rows */}
        <div className="flex-1 py-1 divide-y divide-slate-100 min-h-0 flex flex-col justify-around">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="py-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-6 h-6 rounded bg-slate-100 shrink-0" />
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="h-2.5 w-3/4 bg-slate-200 rounded" />
                  <div className="h-2 w-1/3 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-3 w-10 bg-slate-200 rounded" />
                <div className="h-4 w-12 bg-slate-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Invoices, credits & receipts</span>
          <span className="font-medium text-slate-500">Live journal</span>
        </div>
      </div>
    </div>
  );
}
