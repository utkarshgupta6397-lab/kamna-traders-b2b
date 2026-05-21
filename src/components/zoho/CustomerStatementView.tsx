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
  billingAddress?: string;
};

type Transaction = {
  id: string;
  type: 'invoice' | 'payment' | 'bill';
  date: string;
  datetime?: string;
  description: string;
  amount: number;
  /** Signed net effect: +invoice, -payment, -bill */
  netEffect: number;
  balanceAfter: number;
  isVerified?: boolean;
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


/** Format date as "18 May 2026" */
function fmtDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Format datetime as "8 May 2026 1:23 PM" */
function fmtDateTime(iso: string) {
  if (!iso) return '—';
  if (iso.length === 10 || (!iso.includes('T') && !iso.includes(':'))) return fmtDate(iso);
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const datePart = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const timePart = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: 'numeric', hour12: true });
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
  const handleFetch = async (overrideId?: string) => {
    const idToFetch = (overrideId || customerId).trim();
    if (!idToFetch || !/^\d+$/.test(idToFetch) || idToFetch.length < 15) {
      toast.error('Please enter a valid Zoho Customer ID.');
      return;
    }

    setLoading(true);
    setStatement(null);
    try {
      const res = await fetch(
        `/api/admin/customer-statement/statement?customerId=${encodeURIComponent(idToFetch)}`
      );
      const data = await res.json();
      setStatement(data);
      if (data.success) {
        toast.success('Statement loaded.');
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
              onKeyDown={(e) => !isLocked && e.key === 'Enter' && handleFetch()}
              disabled={isLocked}
              className={`w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A2766] focus:border-transparent ${
                isLocked ? 'bg-gray-50 text-gray-500 border-gray-200 cursor-not-allowed' : 'border-gray-200'
              }`}
            />
          </div>
        </div>
        <button
          id="fetch-statement-btn"
          onClick={() => handleFetch()}
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

      {s && (
        <>
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
                <div className="text-[10px] uppercase text-gray-400 font-bold mb-0.5">Name</div>
                <div className="font-semibold text-gray-900 leading-tight">{s.customer.contactName}</div>
                {s.customer.companyName && (
                  <div className="text-[11px] text-gray-500 leading-tight">{s.customer.companyName}</div>
                )}
              </div>
              <div>
                <div className="text-[10px] uppercase text-gray-400 font-bold mb-0.5">GST No</div>
                <div className="font-mono text-[11px] text-gray-700">{s.customer.gstNo || '—'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-gray-400 font-bold mb-0.5">Mobile</div>
                <div className="flex items-center gap-1 text-[11px] text-gray-700">
                  <Phone size={11} className="text-gray-400" />
                  {s.customer.mobile || '—'}
                </div>
              </div>
              {s.customer.billingAddress && (
                <div className="col-span-2 sm:col-span-3">
                  <div className="text-[10px] uppercase text-gray-400 font-bold mb-0.5">Billing Address</div>
                  <div className="flex items-start gap-1 text-[11px] text-gray-600 leading-tight">
                    <MapPin size={10} className="text-gray-400 mt-0.5 shrink-0" />
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
                  ({s.transactionCount} transaction{s.transactionCount !== 1 ? 's' : ''}
                  {s.isTruncated ? ', older history not shown' : ''})
                </span>
              </div>
              {s.isTruncated && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                  Truncated
                </span>
              )}
            </div>

            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
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
                    <td className="px-3 py-1.5 font-bold text-gray-800 text-[11px]">Opening Balance</td>
                    <td className="px-3 py-1.5 text-right text-[11px] text-gray-400">—</td>
                    <td className="px-3 py-1.5 text-right text-[11px] text-gray-400">—</td>
                    <td className="px-3 py-1.5 text-right font-bold text-gray-900 text-xs tabular-nums">
                      {fmtBalance(s.openingBalance)}
                    </td>
                  </tr>

                  {/* Transaction rows */}
                  {s.transactions.map((tx) => {
                    const isSettled = Math.abs(tx.balanceAfter) <= 100;
                    return (
                      <tr key={tx.id} className="even:bg-gray-50/40 hover:bg-gray-100/80 transition-colors">
                        <td className="px-3 py-1.5 text-[11px] text-gray-500 whitespace-nowrap align-middle">
                          {fmtDateTime(tx.datetime || tx.date)}
                        </td>
                        <td className="px-3 py-1.5 text-[10px] font-semibold text-gray-600 align-middle uppercase tracking-wider whitespace-nowrap">
                          {tx.type === 'invoice' ? 'Invoice' : tx.type === 'payment' ? 'Payment Received' : 'Purchase Bill'}
                        </td>
                        <td className="px-3 py-1.5 text-[11px] font-medium text-gray-800 align-middle">
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
                          <div className={`flex flex-col items-end justify-center ${isSettled ? 'bg-emerald-50/80 -my-1 -mx-2 px-2 py-1 rounded border border-emerald-200/60' : ''}`}>
                            <span className={`text-[11px] tabular-nums ${
                              isSettled ? 'font-extrabold text-emerald-700' :
                              tx.balanceAfter > 0 ? 'font-semibold text-rose-600' :
                              tx.balanceAfter < 0 ? 'font-semibold text-emerald-600' : 'font-medium text-gray-900'
                            }`}>
                              {fmtBalance(tx.balanceAfter)}
                            </span>
                            {isSettled && <span className="text-[7px] font-bold text-emerald-600 tracking-widest uppercase leading-none mt-0.5">Near Settled</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {s.transactions.length === 0 && (
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

            {/* Notice removed to match cleaner ledger style */}
          </div>

          {/* ── Section 3: API Telemetry card ─────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
              <Activity size={14} className="text-gray-400" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                API Consumption
              </span>
            </div>
            <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Customer API', value: s.telemetry.customerApiCalls },
                { label: 'Invoice API', value: s.telemetry.invoiceApiCalls },
                { label: 'Payment API', value: s.telemetry.paymentApiCalls },
                ...(s.isHybrid ? [{ label: 'Bill API', value: s.telemetry.billApiCalls }] : []),
                { label: 'Total APIs', value: s.telemetry.totalApiCalls },
                { label: 'Raw Invoices/Pmts', value: s.telemetry.rawInvoicesFetched },
                { label: 'Valid Invoices/Pmts', value: s.telemetry.validInvoicesAfterFilter },
                ...(s.isHybrid ? [
                  { label: 'Raw Bills', value: s.telemetry.rawBillsFetched },
                  { label: 'Valid Bills', value: s.telemetry.validBillsAfterFilter },
                ] : []),
              ].map(({ label, value }, idx) => (
                <div key={`${label}-${idx}`} className="text-center">
                  <div className="text-lg font-bold text-gray-700">{value}</div>
                  <div className="text-[10px] text-gray-400 leading-tight">{label}</div>
                </div>
              ))}
            </div>
            {/* Net position debug strip */}
            <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div>
                <div className="text-[10px] text-gray-400">Receivable (Zoho)</div>
                <div className="text-sm font-bold text-rose-600">{fmt(s.telemetry.debugReceivable)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">Payable (Zoho)</div>
                <div className="text-sm font-bold text-amber-600">{fmt(s.telemetry.debugPayable)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">Net Closing Balance</div>
                <div className={`text-sm font-bold ${
                  s.telemetry.debugNetClosingBalance > 0 ? 'text-[#1A2766]' :
                  s.telemetry.debugNetClosingBalance < 0 ? 'text-amber-700' : 'text-gray-400'
                }`}>{fmtBalance(s.telemetry.debugNetClosingBalance)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">Hybrid Account</div>
                <div className={`text-sm font-bold ${s.telemetry.debugIsHybrid ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {s.telemetry.debugIsHybrid ? 'Yes' : 'No'}
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 4: Debug accordion ────────────────────────────── */}
          <div className="rounded-xl border border-gray-200 overflow-hidden text-xs">
            <button
              onClick={() => setDebugOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-gray-500 font-medium"
            >
              <span className="flex items-center gap-2">
                <FileJson size={14} />
                Raw Zoho Response (debug)
              </span>
              {debugOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {debugOpen && (
              <div className="bg-gray-900">
                <div className="flex justify-end px-3 py-1.5 border-b border-gray-800">
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
        </>
      )}
    </div>
  );
}
