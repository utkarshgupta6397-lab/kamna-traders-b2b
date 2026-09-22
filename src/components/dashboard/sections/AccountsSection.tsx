import React from 'react';
import { FileText, CreditCard, DollarSign, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import WipWidget from '../WipWidget';

export default function AccountsSection() {
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

        {/* Large translucent WIP Watermark + subtle icon */}
        <WipWidget size="md" />

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Zoho Books synchronized</span>
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

        {/* Large translucent WIP Watermark + subtle icon */}
        <WipWidget size="md" />

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Banking reconciliation queue</span>
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

        {/* Large translucent WIP Watermark + subtle icon */}
        <WipWidget size="md" />

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>Invoices, credits & receipts</span>
        </div>
      </div>
    </div>
  );
}
