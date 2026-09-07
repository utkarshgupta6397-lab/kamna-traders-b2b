'use client';

import React from 'react';
import { FileText, Loader2, ExternalLink, AlertCircle, Check, RefreshCw } from 'lucide-react';

interface MiniCustomerStatementProps {
  customerId: string;
  statementData: any | null;
  statementLoading: boolean;
  orderTotal?: number;
  onRefresh?: () => Promise<void> | void;
  refreshing?: boolean;
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

function fmtDateTime(iso: string) {
  if (!iso) return '—';
  
  let datePart = '';
  const raw = parseRawDate(iso);
  if (raw) {
    datePart = `${raw.d} ${raw.m} ${raw.y}`;
  } else {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    datePart = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  if (iso.length === 10 || (!iso.includes('T') && !iso.includes(':'))) return datePart;
  
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const timePart = d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: 'numeric', hour12: true });
  return `${datePart} ${timePart}`;
}

export default function MiniCustomerStatement({
  customerId,
  statementData,
  statementLoading,
  orderTotal = 0,
  onRefresh,
  refreshing = false,
}: MiniCustomerStatementProps) {
  return (
    <div className="flex flex-col bg-gray-50 h-full">
      <div className="px-5 py-3.5 border-b border-gray-200 bg-white flex justify-between items-center flex-shrink-0">
        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <FileText className="text-[#1A2766]" size={18} />
          <span>Customer Statement Snapshot</span>
          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
            Recent Transactions
          </span>
        </h3>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={() => onRefresh()}
              disabled={refreshing || statementLoading}
              title="Refresh Statement Data"
              className="text-xs font-semibold bg-blue-50 border border-blue-200 text-[#1A2766] hover:bg-blue-100 px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={refreshing || statementLoading ? 'animate-spin' : ''} />
              <span>Refresh Statement</span>
            </button>
          )}
          <a
            href={`/staff/dashboard/accounts?customerId=${customerId}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold bg-gray-100 border border-gray-200 px-3 py-1.5 rounded text-gray-700 flex items-center gap-1.5 hover:bg-gray-200 transition-colors"
          >
            Full Statement <ExternalLink size={12} />
          </a>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden bg-white flex flex-col">
        {statementLoading && !statementData ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4 py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#1A2766]" />
            <p className="text-sm font-medium">Fetching live ledger from Zoho...</p>
          </div>
        ) : statementData ? (() => {
          // Full transactions list used for all balance calculations
          const allTxs = Array.isArray(statementData.transactions) ? statementData.transactions : [];
          
          // Display only the latest / most recent 12 chronological transactions
          const visibleTxs = allTxs.length > 12 ? allTxs.slice(-12) : allTxs;
          
          const openingBal = allTxs.length > 0
            ? allTxs[0].balanceAfter - allTxs[0].netEffect
            : statementData.closingBalance;
          const openingPres = getOpeningBalancePresentation(openingBal);
          const closingPres = getOpeningBalancePresentation(statementData.closingBalance);

          // PV-001: Adjusted Closing Balance = Closing Balance - Current Sales Order Total Amount
          const adjustedClosingBal = (statementData.closingBalance ?? 0) - orderTotal;
          const adjustedPres = getOpeningBalancePresentation(adjustedClosingBal);
          
          return (
            <div className="flex flex-col h-full min-h-0 flex-1 overflow-hidden">
              {/* Ledger Table */}
              <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto">
                <table className="w-full text-sm relative" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase text-gray-500 font-bold border-b border-gray-200 z-10 shadow-sm">
                    <tr>
                      <th className="px-3 py-2 text-left w-24">Date</th>
                      <th className="px-3 py-2 text-left min-w-[120px] whitespace-nowrap">Type</th>
                      <th className="px-3 py-2 text-left">Details</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">Invoice Amt</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">Payment Amt</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {/* Opening balance row */}
                    <tr className="bg-blue-50/20">
                      <td className="px-3 py-1.5 text-[11px] text-gray-400 whitespace-nowrap">—</td>
                      <td className="px-3 py-1.5 text-[11px] text-gray-400 whitespace-nowrap">—</td>
                      <td className="px-3 py-1.5 text-[11px]">
                        {openingPres.isCredit ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="font-bold text-gray-800">Opening Balance</span>
                            <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full tracking-wide uppercase">
                              Advance / Credit
                            </span>
                          </span>
                        ) : (
                          <span className="font-bold text-gray-800">Opening Balance</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right text-[11px] text-gray-400">—</td>
                      <td className="px-3 py-1.5 text-right text-[11px] text-gray-400">—</td>
                      <td className="px-3 py-1.5 text-right text-xs font-bold tabular-nums">
                        {openingPres.isCredit ? (
                          <span className="text-emerald-600">{openingPres.amount}</span>
                        ) : (
                          <span className="text-gray-900">{openingPres.amount}</span>
                        )}
                      </td>
                    </tr>

                    {/* Transaction rows */}
                    {visibleTxs.map((tx: any) => {
                      const displayDesc = cleanDescription(tx.description, tx.type);
                      return (
                        <tr 
                          key={tx.id} 
                          onClick={() => tx.zohoUrl && window.open(tx.zohoUrl, '_blank')}
                          className={`group even:bg-gray-50/40 hover:bg-blue-50/80 transition-all ${tx.zohoUrl ? 'cursor-pointer' : ''}`}
                        >
                          <td className="px-3 py-1.5 text-[11px] text-gray-500 whitespace-nowrap align-middle">
                            {fmtDateTime(tx.datetime || tx.date)}
                          </td>
                          <td className="px-3 py-1.5 text-[10px] font-semibold text-gray-600 align-middle uppercase tracking-wider whitespace-nowrap">
                            {tx.type === 'invoice' ? 'Invoice' : tx.type === 'payment' ? 'Payment' : 'Purchase Bill'}
                          </td>
                          <td className="px-3 py-1.5 text-[11px] font-medium text-blue-700 group-hover:text-blue-900 group-hover:underline underline-offset-2 align-middle">
                            <div className="flex items-center gap-1.5">
                              <span>{displayDesc}</span>
                              {tx.isVerified && (
                                <span className="inline-flex items-center justify-center bg-emerald-500 text-white rounded-full w-[14px] h-[14px] shrink-0 shadow-sm" title="Verified Payment">
                                  <Check size={9} strokeWidth={4} />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-right text-[11px] font-semibold text-gray-700 whitespace-nowrap align-middle tabular-nums">
                            {tx.netEffect > 0 ? fmt(tx.amount) : '—'}
                          </td>
                          <td className="px-3 py-1.5 text-right text-[11px] font-semibold whitespace-nowrap align-middle tabular-nums" style={{ color: tx.netEffect <= 0 ? '#059669' : 'transparent' }}>
                            {tx.netEffect <= 0 ? fmt(tx.amount) : '—'}
                          </td>
                          <td className="px-3 py-1.5 text-right whitespace-nowrap align-middle">
                            {(() => {
                              const b = tx.balanceAfter;
                              const isZero = b === 0;
                              const isNearSettled = !isZero && Math.abs(b) <= 100;
                              
                              if (isZero) {
                                return (
                                  <span className="text-[11px] font-extrabold text-emerald-600 tabular-nums">
                                    {fmtBalance(b)}
                                  </span>
                                );
                              }
                              
                              if (isNearSettled) {
                                return (
                                  <div className="flex flex-col items-end justify-center bg-emerald-50/50 -my-1 -mx-2 px-2 py-1 rounded border border-emerald-100/60">
                                    <span className="text-[11px] tabular-nums font-extrabold text-emerald-700">
                                      {fmtBalance(b)}
                                    </span>
                                    <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">
                                      Near Settled
                                    </span>
                                  </div>
                                );
                              }
                              
                              return (
                                <span className={`text-[11px] font-bold tabular-nums ${b > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                  {fmtBalance(b)}
                                </span>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer Financial Summary: Opening Balance -> Closing Balance -> SO Amount -> Adjusted Closing Balance */}
              <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 shrink-0 mt-auto">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-left">
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Opening Balance</p>
                    <p className={`text-xs font-bold tabular-nums ${openingPres.isCredit ? 'text-emerald-600' : 'text-gray-800'}`}>
                      {openingPres.amount}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4 ml-auto">
                    {/* Current Closing Balance */}
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Closing Balance</p>
                      <p className={`text-sm sm:text-base font-black tabular-nums ${closingPres.isCredit ? 'text-emerald-600' : 'text-red-600'}`}>
                        {closingPres.amount}
                      </p>
                    </div>

                    <span className="text-gray-400 font-bold text-sm">−</span>

                    {/* Current SO Amount */}
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Order Amount</p>
                      <p className="text-sm sm:text-base font-black text-gray-900 tabular-nums">
                        {fmt(orderTotal)}
                      </p>
                    </div>

                    <span className="text-gray-400 font-bold text-sm">=</span>

                    {/* Adjusted Closing Balance */}
                    <div className="text-right pl-1 sm:pl-2 border-l border-gray-300">
                      <p className="text-[10px] uppercase font-bold text-[#1A2766] tracking-wider">Adjusted Balance</p>
                      <div className="flex items-center justify-end gap-1">
                        <p className={`text-base sm:text-lg font-black tabular-nums ${adjustedPres.isCredit ? 'text-emerald-600' : 'text-red-600'}`}>
                          {adjustedPres.amount}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })() : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
            <AlertCircle size={32} className="mb-2 opacity-50" />
            <p className="text-sm font-medium">No statement data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
