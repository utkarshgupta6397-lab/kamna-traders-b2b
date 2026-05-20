'use client';

import { useState } from 'react';
import {
  Search, RefreshCw, ChevronDown, ChevronRight,
  FileJson, Copy, AlertCircle, User, MapPin, Phone,
  FileText, TrendingUp, Info, Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';

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
  billingAddress?: string;
};

type Transaction = {
  id: string;
  type: 'invoice' | 'payment';
  date: string;
  datetime?: string;
  description: string;
  amount: number;
  direction: 'dr' | 'cr';
  balanceAfter: number;
};

type Telemetry = {
  customerApiCalls: number;
  invoiceApiCalls: number;
  paymentApiCalls: number;
  totalApiCalls: number;
  rawInvoicesFetched: number;
  validInvoicesAfterFilter: number;
};

type Statement = {
  customer: Customer;
  openingBalance: number;
  closingBalance: number;
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
 *   positive → "₹X DR"  (amount owed by customer)
 *   negative → "₹X CR"  (credit balance)
 *   zero     → "₹0.00"
 */
function fmtBalance(n: number) {
  if (n === 0) return 'Settled';
  return n > 0 ? `${fmt(n)} Due` : `${fmt(Math.abs(n))} Advance`;
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

export default function CustomerStatementPage() {
  const [customerId, setCustomerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [statement, setStatement] = useState<{
    success: boolean;
    data?: Statement;
    raw?: any;
    error?: string;
  } | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const handleFetch = async () => {
    if (!customerId || !/^\d+$/.test(customerId.trim()) || customerId.trim().length < 15) {
      toast.error('Please enter a valid Zoho Customer ID.');
      return;
    }

    setLoading(true);
    setStatement(null);
    try {
      const res = await fetch(
        `/api/admin/customer-statement/statement?customerId=${encodeURIComponent(customerId.trim())}`
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

  const copyRaw = () => {
    if (!statement) return;
    navigator.clipboard.writeText(JSON.stringify(statement.raw ?? statement, null, 2));
    toast.success('Raw JSON copied!');
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const s = statement?.data;

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
          <label className="block text-xs font-bold text-gray-600 mb-1">
            Zoho Customer / Contact ID
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              id="customer-id-input"
              type="text"
              placeholder="e.g. 1759923000018618057"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A2766] focus:border-transparent"
            />
          </div>
        </div>
        <button
          id="fetch-statement-btn"
          onClick={handleFetch}
          disabled={loading}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-[#1A2766] text-white rounded-lg text-sm font-bold hover:bg-[#25368a] transition-colors disabled:opacity-50 h-[38px]"
        >
          {loading ? <RefreshCw size={15} className="animate-spin" /> : 'Load Statement'}
        </button>
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
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Customer</span>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div className="col-span-2 sm:col-span-1">
                <div className="text-[10px] uppercase text-gray-400 font-bold mb-0.5">Name</div>
                <div className="font-semibold text-gray-900">{s.customer.contactName}</div>
                {s.customer.companyName && (
                  <div className="text-xs text-gray-500">{s.customer.companyName}</div>
                )}
              </div>
              <div>
                <div className="text-[10px] uppercase text-gray-400 font-bold mb-0.5">GST No</div>
                <div className="font-mono text-xs text-gray-700">{s.customer.gstNo || '—'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-gray-400 font-bold mb-0.5">Mobile</div>
                <div className="flex items-center gap-1 text-xs text-gray-700">
                  <Phone size={11} className="text-gray-400" />
                  {s.customer.mobile || '—'}
                </div>
              </div>
              {s.customer.billingAddress && (
                <div className="col-span-2 sm:col-span-3">
                  <div className="text-[10px] uppercase text-gray-400 font-bold mb-0.5">Billing Address</div>
                  <div className="flex items-start gap-1 text-xs text-gray-600">
                    <MapPin size={11} className="text-gray-400 mt-0.5 shrink-0" />
                    {s.customer.billingAddress}
                  </div>
                </div>
              )}
            </div>
          </div>

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

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-[11px] uppercase text-gray-400 font-bold">
                    <th className="px-4 py-2 text-center w-10">#</th>
                    <th className="px-4 py-2 text-left w-28">Date</th>
                    <th className="px-4 py-2 text-left w-24">Type</th>
                    <th className="px-4 py-2 text-left">Description</th>
                    <th className="px-4 py-2 text-right whitespace-nowrap">Amount</th>
                    <th className="px-4 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Opening balance row */}
                  <tr className="border-t border-gray-100 bg-blue-50/40">
                    <td className="px-4 py-2.5 text-center text-[11px] text-gray-400">—</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">—</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">—</td>
                    <td className="px-4 py-2.5">
                      <span className="font-bold text-gray-600 text-xs">
                        Approx. Opening Balance
                      </span>
                      <span className="ml-2 text-[10px] text-gray-400">(calculated)</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-gray-400">—</td>
                    <td className="px-4 py-2.5 text-right font-bold text-gray-700 text-sm">
                      {fmtBalance(s.openingBalance)}
                    </td>
                  </tr>

                  {/* Transaction rows */}
                  {s.transactions.map((tx, idx) => (
                    <tr key={tx.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 text-center text-[11px] text-gray-400 font-medium">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                        {fmtDateTime(tx.datetime || tx.date)}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {tx.type === 'invoice' ? (
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-bold text-[10px] uppercase">
                            Invoice
                          </span>
                        ) : (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md font-bold text-[10px] uppercase">
                            Payment
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-medium text-gray-800">
                        {tx.description}
                      </td>
                      <td className={`px-4 py-2.5 text-right text-xs font-semibold whitespace-nowrap ${tx.direction === 'dr' ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {tx.direction === 'dr' ? '+' : '-'} {fmt(tx.amount)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs font-medium text-gray-700 whitespace-nowrap">
                        {fmtBalance(tx.balanceAfter)}
                      </td>
                    </tr>
                  ))}

                  {s.transactions.length === 0 && (
                    <tr className="border-t border-gray-100">
                      <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400">
                        No transactions in window.
                      </td>
                    </tr>
                  )}

                  {/* Net Payable / Closing row */}
                  <tr className="border-t-2 border-[#1A2766]/20 bg-[#1A2766]/5">
                    <td className="px-4 py-3 text-center text-gray-400 text-xs">—</td>
                    <td className="px-4 py-3 text-xs text-gray-400">—</td>
                    <td className="px-4 py-3 text-xs text-gray-400">—</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#1A2766] text-sm">
                        {s.closingBalance > 0 ? 'Balance Due' : s.closingBalance < 0 ? 'Customer Advance' : 'Account Settled'}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        Closing balance
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400">—</td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-base font-extrabold text-[#1A2766]">
                        {fmtBalance(s.closingBalance)}
                      </div>
                      {s.customer.outstandingReceivableFormatted && (
                        <div className="text-[10px] text-gray-400">
                          Zoho: {s.customer.outstandingReceivableFormatted}
                        </div>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Prototype notice */}
            <div className="px-5 py-2 border-t border-gray-100 flex items-center gap-2 text-[10px] text-gray-400 bg-gray-50/40">
              <Info size={11} className="shrink-0" />
              Prototype: Opening balance is reverse-calculated. Includes invoices and payments.
            </div>
          </div>

          {/* ── Section 3: API Telemetry card ─────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
              <Activity size={14} className="text-gray-400" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                API Consumption
              </span>
            </div>
            <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Customer API Calls', value: s.telemetry.customerApiCalls },
                { label: 'Invoice API Calls', value: s.telemetry.invoiceApiCalls },
                { label: 'Payment API Calls', value: s.telemetry.paymentApiCalls },
                { label: 'Total APIs Used', value: s.telemetry.totalApiCalls },
                { label: 'Raw Trx Fetched', value: s.telemetry.rawInvoicesFetched },
                { label: 'Valid After Filter', value: s.telemetry.validInvoicesAfterFilter },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <div className="text-lg font-bold text-gray-700">{value}</div>
                  <div className="text-[10px] text-gray-400 leading-tight">{label}</div>
                </div>
              ))}
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
