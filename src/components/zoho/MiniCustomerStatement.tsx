'use client';

import React from 'react';
import { FileText, Loader2, ExternalLink, AlertCircle } from 'lucide-react';

interface MiniCustomerStatementProps {
  customerId: string;
  statementData: any | null;
  statementLoading: boolean;
}

// Helpers
function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
}

function fmtBalance(n: number) {
  if (n === 0) return '₹0.00';
  const val = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  return n > 0 ? val : `-${val}`;
}

function getOpeningBalancePresentation(n: number) {
  if (n < 0) {
    return {
      label: 'Advance Balance',
      amount: fmt(n),
      isCredit: true,
    };
  }
  return {
    label: 'Opening Balance',
    amount: fmtBalance(n),
    isCredit: false,
  };
}

function cleanDescription(desc: string, type: string): string {
  if (!desc) return desc;
  if (type === 'payment') {
    return desc.replace(/^payment\s*[-–]\s*/i, '').trim();
  }
  if (type === 'invoice' || type === 'bill') {
    return desc.replace(/^(invoice|bill)\s+/i, '').trim();
  }
  return desc;
}

function parseRawDate(iso: string) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, mStr, d] = match;
    const mNum = parseInt(mStr, 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return { y, m: months[mNum - 1], d };
  }
  return null;
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  const raw = parseRawDate(iso);
  if (raw) return `${raw.d} ${raw.m} ${raw.y}`;
  
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MiniCustomerStatement({ customerId, statementData, statementLoading }: MiniCustomerStatementProps) {
  return (
    <div className="flex flex-col bg-gray-50 h-full">
      <div className="p-5 border-b border-gray-200 bg-white flex justify-between items-center flex-shrink-0">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <FileText className="text-gray-400" size={20} />
          Customer Statement Snapshot
        </h3>
        <a href={`/staff/dashboard/accounts?customerId=${customerId}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#1A2766] flex items-center gap-1 hover:underline">
          Full Statement <ExternalLink size={12} />
        </a>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {statementLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#1A2766]" />
            <p className="text-sm font-medium">Fetching live statement from Zoho...</p>
          </div>
        ) : statementData ? (() => {
          const visibleTxs = statementData.transactions.slice(-10);
          const openingBal = visibleTxs.length > 0
            ? visibleTxs[0].balanceAfter - visibleTxs[0].netEffect
            : statementData.closingBalance;
          const openingPres = getOpeningBalancePresentation(openingBal);
          const totalInvoiced = visibleTxs.filter((t: any) => t.type === 'invoice').reduce((a: number, t: any) => a + Math.abs(t.netEffect), 0);
          const totalPaid = visibleTxs.filter((t: any) => t.type === 'payment').reduce((a: number, t: any) => a + Math.abs(t.netEffect), 0);
          
          return (
            <div className="space-y-6">
              {/* Snapshot KPIs */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1">Current Outstanding</p>
                  <p className={`text-2xl font-black ${statementData.closingBalance > 0 ? 'text-red-600' : statementData.closingBalance < 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                    {fmtBalance(statementData.closingBalance)}
                  </p>
                  {statementData.closingBalance > 0 && statementData.unpaidInvoices?.length > 0 && (
                    <p className="text-xs text-red-500 font-medium mt-1">Across {statementData.unpaidInvoices.length} unpaid invoices</p>
                  )}
                </div>
                <div className="flex flex-col justify-between">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 font-medium">Recent Invoiced:</span>
                    <span className="font-bold text-gray-900">{fmt(totalInvoiced)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 font-medium">Recent Paid:</span>
                    <span className="font-bold text-emerald-600">{fmt(totalPaid)}</span>
                  </div>
                </div>
              </div>

              {/* Transactions List */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-100 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Last 10 Transactions</h4>
                  <span className="text-[10px] text-gray-400 font-medium">Zoho Books Live Data</span>
                </div>
                <div className="divide-y divide-gray-100">
                  <div className="px-4 py-3 flex items-center justify-between bg-blue-50/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600 font-bold text-xs">OB</div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{openingPres.label}</p>
                        <p className="text-xs text-gray-500">Before last 10 transactions</p>
                      </div>
                    </div>
                    <p className={`text-sm font-bold ${openingPres.isCredit ? 'text-emerald-600' : 'text-gray-900'}`}>
                      {openingPres.amount}
                    </p>
                  </div>
                  
                  {visibleTxs.map((tx: any) => (
                    <div key={tx.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-[10px] ${
                          tx.type === 'invoice' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 
                          tx.type === 'payment' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {tx.type === 'invoice' ? 'INV' : tx.type === 'payment' ? 'PAY' : 'TXN'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            {tx.zohoUrl ? (
                              <a href={tx.zohoUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#1A2766] hover:underline flex items-center gap-1">
                                {cleanDescription(tx.description, tx.type)}
                              </a>
                            ) : (
                              <p className="text-sm font-semibold text-gray-900">{cleanDescription(tx.description, tx.type)}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-gray-500 font-medium">{fmtDate(tx.date)}</p>
                            <span className="text-gray-300">•</span>
                            <p className={`text-xs font-bold ${tx.balanceAfter > 0 ? 'text-red-500' : tx.balanceAfter < 0 ? 'text-emerald-500' : 'text-gray-400'}`}>
                              Bal: {fmtBalance(tx.balanceAfter)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${tx.netEffect > 0 ? 'text-gray-900' : 'text-emerald-600'}`}>
                          {tx.netEffect > 0 ? '+' : ''}{fmt(tx.amount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })() : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <AlertCircle size={32} className="mb-2 opacity-50" />
            <p className="text-sm font-medium">No statement data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
