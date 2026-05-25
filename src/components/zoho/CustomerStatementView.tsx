'use client';

import { useState } from 'react';
import {
  Search, RefreshCw, ChevronDown, ChevronRight,
  FileJson, Copy, AlertCircle, User, MapPin, Phone,
  FileText, TrendingUp, Info, Activity, Lock, Printer, Check
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { qzManager } from '@/lib/print/qz-tray';
import { renderStatementSlip } from '@/lib/print/slip-renderer';

// ─── Types ───────────────────────────────────────────────────────────────────

type Customer = {
  contactId: string;
  contactName: string;
  companyName?: string;
  gstNo?: string;
  mobile?: string;
  email?: string;
  outstandingReceivable?: number;
  outstandingReceivableFormatted?: string;
  associatedVendorId?: string;
  outstandingPayable?: number;
  unusedCreditsPayable?: number;
  unusedCreditsReceivable?: number;
  billingAddress?: string;
};

type Transaction = {
  id: string;
  type: 'invoice' | 'payment' | 'bill';
  date: string;
  datetime?: string;
  description: string;
  amount: number;
  netEffect: number;
  balanceAfter: number;
  isVerified?: boolean;
  zohoUrl?: string;
};

type Telemetry = {
  customerApiCalls: number;
  invoiceApiCalls: number;
  paymentApiCalls: number;
  billApiCalls: number;
  totalApiCalls: number;
  rawInvoicesFetched: number;
  validInvoicesAfterFilter: number;
  rawBillsFetched: number;
  validBillsAfterFilter: number;
  debugReceivable: number;
  debugPayable: number;
  debugNetClosingBalance: number;
  debugIsHybrid: boolean;
};

type Statement = {
  customer: Customer;
  openingBalance: number;
  closingBalance: number;
  outstandingReceivable: number;
  outstandingPayable: number;
  isHybrid: boolean;
  transactions: Transaction[];
  transactionCount: number;
  unpaidInvoices: any[];
  isTruncated: boolean;
  telemetry: Telemetry;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format as Indian rupee with comma grouping */
function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
}

/**
 * Render a balance in accounting style:
 *   positive -> positive
 *   negative -> negative
 */
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


/** Extract YYYY-MM-DD explicitly to avoid timezone shift */
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

/** Format date as "18 May 2026" */
function fmtDate(iso: string) {
  if (!iso) return '—';
  const raw = parseRawDate(iso);
  if (raw) return `${raw.d} ${raw.m} ${raw.y}`;
  
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Format datetime as "8 May 2026 1:23 PM" */
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CustomerStatementView() {
  const searchParams = useSearchParams();
  const initialCustomerId = searchParams?.get('customerId') || '';
  const isLocked = !!initialCustomerId;

  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [loading, setLoading] = useState(false);
  const [statement, setStatement] = useState<{
    success: boolean;
    data?: Statement;
    raw?: any;
    error?: string;
  } | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(null);

  const handleThermalPrint = async () => {
    const s = statement?.data;
    if (!s) return;
    setPrinting(true);
    try {
      const payload = {
        customerName: s.customer.contactName || s.customer.companyName || '',
        mobile: s.customer.mobile || '',
        gst: s.customer.gstNo || '',
        openingBalance: s.openingBalance,
        closingBalance: s.closingBalance,
        totalInvoices: s.transactions.filter((t: any) => t.type === 'invoice').reduce((sum: number, t: any) => sum + Math.abs(t.netEffect), 0),
        totalPayments: s.transactions.filter((t: any) => t.type === 'payment').reduce((sum: number, t: any) => sum + Math.abs(t.netEffect), 0),
        totalBills: s.transactions.filter((t: any) => t.type === 'bill').reduce((sum: number, t: any) => sum + Math.abs(t.netEffect), 0),
        transactions: s.transactions.map((t: any) => ({
          date: t.date,
          type: t.type,
          description: t.referenceNumber || t.description || '',
          amount: Math.abs(t.netEffect),
          balance: t.balanceAfter
        }))
      };

      const bytes = renderStatementSlip(payload);
      await qzManager.printRaw(bytes);
      toast.success('Statement sent to printer successfully');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Printing Failed';
      console.error('Print error:', err);
      toast.error(msg);
    } finally {
      setPrinting(false);
    }
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const handleFetch = async (overrideId?: string, force = false) => {
    const idToFetch = (overrideId || customerId).trim();
    if (!idToFetch || !/^\d+$/.test(idToFetch) || idToFetch.length < 15) {
      toast.error('Please enter a valid Zoho Customer ID.');
      return;
    }

    const cacheKey = `customer-statement-${idToFetch}`;
    
    if (!force) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setStatement({ success: true, data: parsed.data });
          setCachedAt(parsed.cachedAt);
          // Optional: toast.success('Loaded from cache');
          return;
        } catch (e) {
          console.error('Failed to parse cache', e);
        }
      }
    }

    setLoading(true);
    setStatement(null);
    setCachedAt(null);
    try {
      const res = await fetch(
        `/api/admin/customer-statement/statement?customerId=${encodeURIComponent(idToFetch)}`
      );
      const data = await res.json();
      setStatement(data);
      if (data.success && data.data) {
        const now = Date.now();
        setCachedAt(now);
        sessionStorage.setItem(cacheKey, JSON.stringify({ data: data.data, cachedAt: now }));
        toast.success(force ? 'Statement refreshed.' : 'Statement loaded.');
      } else {
        toast.error(data.error || 'Failed to load statement.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCustomerId) {
      handleFetch(initialCustomerId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCustomerId]);

  const copyRaw = async () => {
    if (!statement) return;
    const textToCopy = JSON.stringify(statement.raw ?? statement, null, 2);

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        toast.success('Raw JSON copied!');
      } else {
        // Fallback for environments where clipboard API is unavailable
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        textArea.remove();
        
        if (successful) {
          toast.success('Raw JSON copied!');
        } else {
          toast.error('Failed to copy to clipboard.');
          console.error('Fallback clipboard copy failed.');
        }
      }
    } catch (err) {
      console.error('Clipboard copy error:', err);
      toast.error('Failed to copy to clipboard.');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const s = statement?.data;

  if (s) {
    console.debug('[Statement Ledger Render]', {
      transactionCount: s.transactionCount,
      closingBalance: s.closingBalance,
      isHybrid: s.isHybrid
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Customer Statement Preview</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Prototype · Reverse-calculated opening balance · Latest 10 invoices · Payments excluded
        </p>
      </div>

      {/* ── Search bar ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row items-end gap-3">
        <div className="flex-1 w-full">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-600 mb-1">
            Zoho Customer / Contact ID
            {isLocked && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                <Lock size={10} /> Prefilled from Zoho Books
              </span>
            )}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              id="customer-id-input"
              type="text"
              placeholder="e.g. 1759923000018618057"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              onKeyDown={(e) => !isLocked && e.key === 'Enter' && handleFetch(undefined, true)}
              disabled={isLocked}
              className={`w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A2766] focus:border-transparent ${
                isLocked ? 'bg-gray-50 text-gray-500 border-gray-200 cursor-not-allowed' : 'border-gray-200'
              }`}
            />
          </div>
          {cachedAt && (
            <div className="absolute -bottom-5 left-0 flex items-center gap-1.5 text-[10px] text-gray-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
              Cached {Math.floor((Date.now() - cachedAt) / 60000) === 0 ? 'just now' : `${Math.floor((Date.now() - cachedAt) / 60000)}m ago`}
            </div>
          )}
        </div>
        <button
          id="fetch-statement-btn"
          onClick={() => handleFetch(undefined, true)}
          disabled={loading}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-[#1A2766] text-white rounded-lg text-sm font-bold hover:bg-[#25368a] transition-colors disabled:opacity-50 h-[38px]"
        >
          {loading ? <RefreshCw size={15} className="animate-spin" /> : 'Load Statement'}
        </button>
        {s && (
          <button
            onClick={handleThermalPrint}
            disabled={printing}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-black transition-colors disabled:opacity-50 h-[38px] print:hidden"
          >
            {printing ? <RefreshCw size={15} className="animate-spin" /> : <Printer size={15} />}
            {printing ? 'Printing...' : 'Print Statement'}
          </button>
        )}
      </div>

      {/* ── Error state ────────────────────────────────────────────────── */}
      {statement && !statement.success && (
        <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm">
          <AlertCircle size={18} className="shrink-0" />
          <span>{statement.error || 'Unknown error'}</span>
        </div>
      )}

      {s && (() => {
        const visibleTransactions = isExpanded ? s.transactions : s.transactions.slice(-12);
        const dynamicOpeningBalance = visibleTransactions.length > 0 ? (visibleTransactions[0].balanceAfter + visibleTransactions[0].netEffect) : s.closingBalance;
        const totalInvoiceAmount = visibleTransactions.filter(t => t.type === 'invoice').reduce((sum, t) => sum + Math.abs(t.netEffect), 0);
        const totalPaymentAmount = visibleTransactions.filter(t => t.type === 'payment').reduce((sum, t) => sum + Math.abs(t.netEffect), 0);
        
        // Payment breakdown
        const payments = visibleTransactions.filter(t => t.type === 'payment');
        const paymentBreakdown = payments.reduce((acc: any, p: any) => {
          const mode = p.description.includes('-') ? p.description.split('-')[1].trim() : 'Other/Unknown';
          acc[mode] = (acc[mode] || 0) + Math.abs(p.netEffect);
          return acc;
        }, {});

        return (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left Column: Ledger and Customer Info */}
            <div className="xl:col-span-8 space-y-4">
              {/* ── Section 1: Customer card ──────────────────────────────── */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
                  <User size={14} className="text-[#1A2766]" />
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                    {s.customer.associatedVendorId ? 'Hybrid Account' : 'Customer'}
                  </span>
                </div>
                <div className="px-4 py-2.5 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="col-span-2 sm:col-span-1">
                    <div className="text-[10px] uppercase text-gray-500 font-bold mb-0.5">Name</div>
                    <a 
                      href={`https://books.zoho.in/app/60027595766#/contacts/${s.customer.contactId}`}
                      target="_blank" rel="noreferrer"
                      className="text-sm font-extrabold text-blue-700 hover:text-blue-900 hover:underline leading-tight flex items-center gap-1 w-fit"
                    >
                      {s.customer.contactName} ↗
                    </a>
                    {s.customer.companyName && (
                      <div className="text-[11px] font-medium text-gray-500 leading-tight mt-0.5">{s.customer.companyName}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-gray-500 font-bold mb-0.5">GST No</div>
                    <div className="font-mono text-[13px] font-semibold text-gray-800">{s.customer.gstNo || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-gray-500 font-bold mb-0.5">Mobile</div>
                    <div className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-800">
                      <Phone size={12} className="text-gray-400" />
                      {s.customer.mobile || '—'}
                    </div>
                  </div>
                  {s.customer.billingAddress && (
                    <div className="col-span-2 sm:col-span-3">
                      <div className="text-[10px] uppercase text-gray-500 font-bold mb-0.5">Billing Address</div>
                      <div className="flex items-start gap-1.5 text-xs text-gray-600 leading-tight font-medium">
                        <MapPin size={12} className="text-gray-400 mt-0.5 shrink-0" />
                        {s.customer.billingAddress}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Section 1b: Net Account Position summary (hybrid only) ── */}
              {s.isHybrid && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
                    <TrendingUp size={14} className="text-[#1A2766]" />
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Net Account Position</span>
                  </div>
                  <div className="px-5 py-4 grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-[10px] uppercase text-gray-400 font-bold mb-1">Outstanding Receivables</div>
                      <div className="text-base font-extrabold text-rose-600">{fmt(s.outstandingReceivable)}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">Customer owes us</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-gray-400 font-bold mb-1">Outstanding Payables</div>
                      <div className="text-base font-extrabold text-amber-600">{fmt(s.outstandingPayable)}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">We owe vendor</div>
                    </div>
                    <div className="border-l border-gray-100 pl-4">
                      <div className="text-[10px] uppercase text-gray-400 font-bold mb-1">Net Position</div>
                      <div className={`text-base font-extrabold ${
                        s.closingBalance > 0 ? 'text-[#1A2766]' : s.closingBalance < 0 ? 'text-amber-600' : 'text-gray-400'
                      }`}>
                        {fmtBalance(s.closingBalance)}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">Receivables − Payables</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Section 2: Statement table ────────────────────────────── */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Table header bar */}
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-[#1A2766]" />
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                      Statement Preview
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">
                      ({s.transactionCount} transaction{s.transactionCount !== 1 ? 's' : ''})
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm relative">
                    <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase text-gray-500 font-bold border-b border-gray-200 z-10 shadow-sm">
                      <tr>
                        <th className="px-3 py-2 text-left w-24">Date</th>
                        <th className="px-3 py-2 text-left min-w-[140px] whitespace-nowrap">Transaction Type</th>
                        <th className="px-3 py-2 text-left">Transaction Details</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Invoice Amount</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Payment Amount</th>
                        <th className="px-3 py-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {/* Opening balance row */}
                      <tr className="bg-blue-50/20">
                        <td className="px-3 py-1.5 text-[11px] text-gray-400 whitespace-nowrap">—</td>
                        <td className="px-3 py-1.5 text-[11px] text-gray-400 whitespace-nowrap">—</td>
                        <td className="px-3 py-1.5 font-bold text-gray-800 text-[11px]">Opening Balance {isExpanded ? '' : '(Visible Period)'}</td>
                        <td className="px-3 py-1.5 text-right text-[11px] text-gray-400">—</td>
                        <td className="px-3 py-1.5 text-right text-[11px] text-gray-400">—</td>
                        <td className="px-3 py-1.5 text-right font-bold text-gray-900 text-xs tabular-nums">
                          {fmtBalance(dynamicOpeningBalance)}
                        </td>
                      </tr>

                      {/* Transaction rows */}
                      {visibleTransactions.map((tx) => {
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
                              {tx.type === 'invoice' ? 'Invoice' : tx.type === 'payment' ? 'Payment Received' : 'Purchase Bill'}
                            </td>
                            <td className="px-3 py-1.5 text-[11px] font-medium text-blue-700 group-hover:text-blue-900 group-hover:underline underline-offset-2 align-middle">
                              <div className="flex items-center gap-1.5">
                                <span>{tx.description}</span>
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
                            <td className="px-3 py-1.5 text-right text-[11px] font-semibold text-gray-700 whitespace-nowrap align-middle tabular-nums">
                              {tx.netEffect <= 0 ? fmt(tx.amount) : '—'}
                            </td>
                            <td className="px-3 py-1.5 text-right whitespace-nowrap align-middle">
                              {(() => {
                                const b = tx.balanceAfter;
                                const isZero = b === 0;
                                const isNearSettled = !isZero && Math.abs(b) <= 100;
                                
                                if (isZero) {
                                  return (
                                    <div className="flex flex-col items-end justify-center">
                                      <span className="text-[11px] font-extrabold text-emerald-600 tabular-nums">
                                        {fmtBalance(b)}
                                      </span>
                                    </div>
                                  );
                                }
                                
                                if (isNearSettled) {
                                  return (
                                    <div className="flex flex-col items-end justify-center bg-emerald-50/50 -my-1 -mx-2 px-2 py-1 rounded border border-emerald-100/60">
                                      <span className="text-[11px] tabular-nums font-extrabold text-emerald-700">
                                        {fmtBalance(b)}
                                      </span>
                                      <span className="text-[7px] font-bold text-emerald-600/80 tracking-widest uppercase leading-none mt-0.5">Settled</span>
                                    </div>
                                  );
                                }
                                
                                return (
                                  <div className="flex flex-col items-end justify-center">
                                    <span className={`text-[11px] tabular-nums ${
                                      b > 0 ? 'font-semibold text-rose-600' :
                                      b < 0 ? 'font-semibold text-emerald-600' : 'font-medium text-gray-900'
                                    }`}>
                                      {fmtBalance(b)}
                                    </span>
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                        );
                      })}

                      {visibleTransactions.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-xs text-gray-400 font-medium">
                            No transactions in window.
                          </td>
                        </tr>
                      )}

                      {/* Net Position / Closing row */}
                      <tr className="border-t-2 border-gray-200 bg-gray-50/80">
                        <td className="px-3 py-2.5 text-[11px] text-gray-400">—</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-400">—</td>
                        <td className="px-3 py-2.5">
                          <div className="font-extrabold text-gray-900 text-xs uppercase tracking-wide">
                            Closing Balance
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right text-[11px] text-gray-400">—</td>
                        <td className="px-3 py-2.5 text-right text-[11px] text-gray-400">—</td>
                        <td className="px-3 py-2.5 text-right">
                          <div className={`font-extrabold text-sm tabular-nums ${s.closingBalance > 0 ? 'text-rose-600' : s.closingBalance < 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                            {fmtBalance(s.closingBalance)}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {/* View All Toggle */}
                {s.transactions.length > 12 && (
                  <div className="border-t border-gray-100 bg-gray-50 p-2 text-center">
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="text-xs font-bold text-[#1A2766] hover:text-[#25368a] px-4 py-1.5 rounded-md hover:bg-blue-50 transition-colors"
                    >
                      {isExpanded ? 'Show Less' : `View All Transactions (${s.transactions.length})`}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Financial Summary and Telemetry */}
            <div className="xl:col-span-4 space-y-4">
              
              {/* Financial Summary Card */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
                  <Activity size={14} className="text-[#1A2766]" />
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                    Period Summary {isExpanded ? '(Since Mar 26)' : '(Visible Period)'}
                  </span>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-medium">Opening Balance</span>
                    <span className="font-semibold text-gray-900">{fmtBalance(dynamicOpeningBalance)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-medium">Total Invoiced</span>
                    <span className="font-semibold text-gray-900">{fmt(totalInvoiceAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-medium">Total Paid</span>
                    <span className="font-semibold text-emerald-600">− {fmt(totalPaymentAmount)}</span>
                  </div>
                  <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-gray-900 font-bold uppercase text-xs tracking-wider">Closing Balance</span>
                    <span className={`text-lg font-extrabold ${s.closingBalance > 0 ? 'text-rose-600' : s.closingBalance < 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                      {fmtBalance(s.closingBalance)}
                    </span>
                  </div>
                  
                  {Object.keys(paymentBreakdown).length > 0 && (
                    <div className="pt-4 border-t border-gray-100">
                      <div className="text-[10px] uppercase text-gray-400 font-bold mb-2">Payment Breakdown</div>
                      <div className="space-y-1.5">
                        {Object.entries(paymentBreakdown).map(([mode, amt]) => (
                          <div key={mode} className="flex justify-between items-center text-xs">
                            <span className="text-gray-500">{mode}</span>
                            <span className="font-medium text-gray-700">{fmt(amt as number)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Unpaid Invoices */}
              {s.unpaidInvoices && s.unpaidInvoices.length > 0 ? (
                <div className="bg-white rounded-xl border border-rose-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-rose-100 bg-rose-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={14} className="text-rose-600" />
                      <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                        Outstanding Invoices
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.unpaidInvoices.length > 0 && (
                        <span className="text-[10px] font-bold text-rose-600 border border-rose-200 px-2 py-0.5 rounded-md bg-white">
                          Oldest Due: {Math.max(...s.unpaidInvoices.map((inv: any) => Math.floor((Date.now() - new Date(inv.invoiceDate).getTime()) / (1000 * 60 * 60 * 24))))}d
                        </span>
                      )}
                      <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {s.unpaidInvoices.length} Due
                      </span>
                    </div>
                  </div>
                  
                  {/* Card Table Header */}
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    <div className="col-span-4">Invoice</div>
                    <div className="col-span-3 text-right">Value</div>
                    <div className="col-span-3 text-right">Pending</div>
                    <div className="col-span-2 text-right">Age</div>
                  </div>

                  <div className="divide-y divide-gray-50">
                    {s.unpaidInvoices.slice(0, 8).map((inv: any) => {
                      const pendingDays = Math.floor((Date.now() - new Date(inv.invoiceDate).getTime()) / (1000 * 60 * 60 * 24));
                      
                      let pillClass = "bg-gray-100 text-gray-600";
                      if (pendingDays > 60) pillClass = "bg-orange-100 text-orange-700 border border-orange-200/60";
                      else if (pendingDays > 30) pillClass = "bg-amber-50 text-amber-700 border border-amber-200/60";

                      return (
                        <div key={inv.invoiceId} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-gray-50/80 transition-colors">
                          <div className="col-span-4">
                            <a 
                              href={`https://books.zoho.in/app/60027595766#/invoices/${inv.invoiceId}`}
                              target="_blank" 
                              rel="noreferrer"
                              className="text-[11px] font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
                            >
                              {inv.invoiceNumber}
                            </a>
                            <div className="text-[9px] text-gray-400 mt-0.5">{fmtDate(inv.invoiceDate)}</div>
                          </div>
                          <div className="col-span-3 text-right text-[11px] text-gray-500 tabular-nums">
                            {fmt(inv.total)}
                          </div>
                          <div className="col-span-3 text-right text-[11px] font-bold text-rose-600 tabular-nums">
                            {fmt(inv.balance)}
                          </div>
                          <div className="col-span-2 flex justify-end">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pillClass}`}>
                              {pendingDays}d
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {s.unpaidInvoices.length > 8 && (
                      <div className="px-4 py-2 bg-gray-50 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        + {s.unpaidInvoices.length - 8} more
                      </div>
                    )}
                    <div className="px-4 py-3 bg-rose-50/10 border-t border-rose-100 flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Pending</span>
                        <span className="text-xs font-bold text-rose-600 tabular-nums">
                          {fmt(s.unpaidInvoices.reduce((sum, i) => sum + i.balance, 0))}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Unused Credits</span>
                        <span className="text-xs font-bold text-emerald-600 tabular-nums">
                          − {fmt(s.customer.unusedCreditsReceivable || 0)}
                        </span>
                      </div>
                      <div className="pt-2 mt-1 border-t border-gray-100 flex justify-between items-center">
                        <span className="text-[11px] font-bold text-gray-900 uppercase tracking-wider">Net Receivable</span>
                        <span className="text-sm font-extrabold text-gray-900 tabular-nums">
                          {fmt((s.unpaidInvoices.reduce((sum, i) => sum + i.balance, 0)) - (s.customer.unusedCreditsReceivable || 0))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden p-6 flex flex-col items-center justify-center gap-2">
                  <Check size={20} className="text-emerald-500" />
                  <span className="text-sm font-bold text-gray-600">No outstanding invoices</span>
                </div>
              )}

              {/* ── Section 4: Debug accordion ────────────────────────────── */}
              <div className="rounded-xl border border-gray-200 overflow-hidden text-xs print:hidden">
                <button
                  onClick={() => setDebugOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-gray-500 font-medium"
                >
                  <span className="flex items-center gap-2">
                    <FileJson size={14} />
                    Debug Info & API Telemetry
                  </span>
                  {debugOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {debugOpen && (
                  <div className="bg-gray-900 border-t border-gray-200">
                    <div className="p-4 bg-white grid grid-cols-2 gap-4 border-b border-gray-200">
                      <div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">API Calls</div>
                        <div className="text-gray-700 font-bold">Total: {s.telemetry.totalApiCalls}</div>
                        <div className="text-gray-500 mt-1">Invoices: {s.telemetry.invoiceApiCalls}, Payments: {s.telemetry.paymentApiCalls}</div>
                        {s.isHybrid && <div className="text-gray-500">Bills: {s.telemetry.billApiCalls}</div>}
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Items Fetched</div>
                        <div className="text-gray-700 font-bold">Invoices: {s.telemetry.rawInvoicesFetched}</div>
                        <div className="text-gray-500 mt-1">Valid: {s.telemetry.validInvoicesAfterFilter}</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center px-4 py-2 border-b border-gray-800">
                      <span className="text-gray-400 font-bold text-[10px] uppercase">Raw JSON Payload</span>
                      <button
                        onClick={copyRaw}
                        className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
                      >
                        <Copy size={12} /> Copy
                      </button>
                    </div>
                    <pre className="p-4 text-[11px] text-emerald-400 font-mono overflow-auto max-h-[400px]">
                      {JSON.stringify(statement?.raw ?? statement, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
