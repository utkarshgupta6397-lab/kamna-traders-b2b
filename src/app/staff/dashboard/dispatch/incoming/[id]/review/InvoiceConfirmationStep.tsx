'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  CheckCircle2,
  Star,
  RefreshCw,
  Search,
  FileText,
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Sparkles,
  Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface InvoiceItem {
  invoiceId?: string;
  invoiceNumber: string;
  invoiceDate?: string;
  total: number;
  balance?: number;
  status?: string;
  customerName?: string;
  customerId?: string;
  referenceNumber?: string | null;
  isAttached?: boolean;
  isAlreadyMappedToAnotherOrder?: boolean;
}

const formatINR = (val: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val);

function formatDisplayDate(dateStr?: string | null) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate().toString().padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return dateStr;
  }
}

function getStatusBadge(status?: string) {
  const s = (status || '').toLowerCase();
  if (s === 'paid') {
    return <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-200">Paid</span>;
  }
  if (s === 'overdue') {
    return <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide bg-rose-100 text-rose-800 border border-rose-200">Overdue</span>;
  }
  if (s === 'partially_paid') {
    return <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-200">Partially Paid</span>;
  }
  if (s === 'sent') {
    return <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide bg-blue-100 text-blue-800 border border-blue-200">Sent</span>;
  }
  return <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide bg-gray-100 text-gray-700 border border-gray-200">{status || 'Draft'}</span>;
}

interface OrderProps {
  id: string;
  salesorderNumber?: string | null;
  customerName?: string | null;
  customerId?: string | null;
  zohoSalesorderId?: string;
  zohoDetailsJson?: Record<string, unknown> | null;
}

interface WorkflowProps {
  id?: string;
  invoiceConfirmStatus: string;
  mappedInvoiceNumber?: string | null;
  mappedInvoiceId?: string | null;
  currentStep?: number;
  overallStatus?: string;
}

export default function InvoiceConfirmationStep({
  order,
  workflow,
  onRefresh,
  hasPermission = true,
}: {
  order: OrderProps;
  workflow: WorkflowProps;
  onRefresh: () => void;
  hasPermission?: boolean;
}) {
  // Primary state
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingInvoiceKey, setSubmittingInvoiceKey] = useState<string | null>(null);

  // Fallback state
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [manualInvoiceNumber, setManualInvoiceNumber] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<InvoiceItem[] | null>(null);

  const fetchRecentInvoices = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await fetch(`/api/dispatch/incoming-orders/${order.id}/workflow/invoice-confirmation`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch recent invoices');
      }
      setInvoices(data.invoices || []);
      if (isManualRefresh) {
        toast.success('Invoices refreshed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading invoices';
      setError(msg);
      if (isManualRefresh) {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [order.id]);

  useEffect(() => {
    let ignore = false;

    async function initialLoad() {
      try {
        const res = await fetch(`/api/dispatch/incoming-orders/${order.id}/workflow/invoice-confirmation`);
        const data = await res.json();
        if (!ignore) {
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Failed to fetch recent invoices');
          }
          setInvoices(data.invoices || []);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Error loading invoices';
          setError(msg);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    initialLoad();

    return () => {
      ignore = true;
    };
  }, [order.id]);

  const handleSelectInvoice = async (invoice: InvoiceItem) => {
    const key = invoice.invoiceId || invoice.invoiceNumber;
    setSubmittingInvoiceKey(key);

    try {
      const mappingMethod = invoice.isAttached ? 'ATTACHED_TO_SO' : 'RECENT_SAME_CUSTOMER';
      const res = await fetch(`/api/dispatch/incoming-orders/${order.id}/workflow/invoice-confirmation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber: invoice.invoiceNumber,
          invoiceId: invoice.invoiceId || null,
          mappingMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to confirm invoice');
      }

      toast.success(`Invoice ${invoice.invoiceNumber} mapped successfully!`);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to map invoice';
      toast.error(msg);
    } finally {
      setSubmittingInvoiceKey(null);
    }
  };

  const handleManualComplete = async () => {
    if (!manualInvoiceNumber.trim()) {
      toast.error('Invoice Number is required');
      return;
    }

    setManualSubmitting(true);
    try {
      const res = await fetch(`/api/dispatch/incoming-orders/${order.id}/workflow/invoice-confirmation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber: manualInvoiceNumber.trim(),
          mappingMethod: 'MANUAL',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete Invoice Confirmation');
      }

      toast.success('Invoice Confirmation Completed');
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to complete Invoice Confirmation';
      toast.error(msg);
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleSearchZoho = async () => {
    if (!searchQuery.trim()) {
      toast.error('Enter an invoice number to search');
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(
        `/api/dispatch/incoming-orders/${order.id}/workflow/invoice-confirmation?search=${encodeURIComponent(
          searchQuery.trim()
        )}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Search failed');
      }
      setSearchResults(data.searchResults || []);
      if ((data.searchResults || []).length === 0) {
        toast('No matching invoices found in Zoho Books', { icon: 'ℹ️' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error searching Zoho';
      toast.error(msg);
    } finally {
      setSearching(false);
    }
  };

  if (workflow.invoiceConfirmStatus === 'COMPLETED') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="text-emerald-600" size={24} />
          </div>
          <div>
            <h3 className="font-bold text-base text-emerald-900">Pre-Dispatch Completed!</h3>
            <p className="text-sm text-emerald-700">
              Invoice <span className="font-bold">{workflow.mappedInvoiceNumber}</span> has been confirmed for this Sales Order.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isAnySubmitting = submittingInvoiceKey !== null || manualSubmitting;
  const customerName = order.customerName || (order.zohoDetailsJson as Record<string, unknown> | undefined)?.customer_name as string || 'Customer';

  return (
    <div className="space-y-6 max-w-4xl">
      {!hasPermission && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 font-medium flex items-center gap-3">
          <Lock size={18} className="text-amber-600 shrink-0" />
          <div>
            <span className="font-bold">Read-Only Access:</span> You can view recent and attached invoices, but <strong>Invoice Confirmation permission</strong> is required to select and map an invoice to complete Pre-Dispatch.
          </div>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">
              Invoice Confirmation
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
              Last 7 Days
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Select an unmapped invoice generated for <span className="font-semibold text-gray-800">{customerName}</span> to finalize pre-dispatch.
          </p>
        </div>

        <button
          onClick={() => fetchRecentInvoices(true)}
          disabled={loading || refreshing || isAnySubmitting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors disabled:opacity-50 self-start sm:self-auto cursor-pointer"
          title="Refresh invoices list from Zoho Books"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin text-[#1A2766]' : 'text-gray-500'} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Invoices'}</span>
        </button>
      </div>

      {/* Primary List Section */}
      <div className="space-y-3">
        {loading && (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
            <Loader2 size={32} className="animate-spin text-[#1A2766] mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Loading recent invoices for {customerName}...</p>
            <p className="text-xs text-gray-400 mt-1">Checking Zoho Books for eligible 7-day invoices</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center shadow-sm">
            <AlertCircle size={32} className="text-rose-500 mx-auto mb-2" />
            <h3 className="font-bold text-rose-900 text-sm">Failed to Load Invoices</h3>
            <p className="text-xs text-rose-700 mt-1 max-w-md mx-auto">{error}</p>
            <button
              onClick={() => fetchRecentInvoices(false)}
              className="mt-4 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && invoices.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-3">
              <FileText size={22} className="text-[#1A2766]" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">No Recent Unmapped Invoices Found</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              No eligible unmapped invoices were created for <span className="font-semibold text-gray-700">{customerName}</span> in the last 7 days.
            </p>
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => setFallbackOpen(true)}
                className="px-4 py-2 bg-[#1A2766] hover:bg-blue-900 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <span>Map Another Invoice</span>
                <ArrowRight size={14} />
              </button>
              <button
                onClick={() => fetchRecentInvoices(true)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                <span>Check Again</span>
              </button>
            </div>
          </div>
        )}

        {/* Invoices List */}
        {!loading && !error && invoices.length > 0 && (
          <div className="space-y-3">
            {invoices.map((inv) => {
              const key = inv.invoiceId || inv.invoiceNumber;
              const isSubmittingThis = submittingInvoiceKey === key;
              const isAttached = Boolean(inv.isAttached);

              return (
                <div
                  key={key}
                  className={`border rounded-xl p-4 sm:p-5 transition-all shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isAttached
                      ? 'bg-amber-50/50 border-amber-300 ring-2 ring-amber-400/30'
                      : 'bg-white border-gray-200 hover:border-[#1A2766]/40 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        isAttached
                          ? 'bg-amber-100 text-amber-700 border-amber-300'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {isAttached ? <Star size={20} className="fill-amber-500 text-amber-500" /> : <FileText size={20} />}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-base text-[#1A2766] tracking-tight">
                          {inv.invoiceNumber}
                        </span>

                        {isAttached && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-200/80 text-amber-900 border border-amber-300 shadow-xs">
                            <Sparkles size={11} className="fill-amber-700 text-amber-700" />
                            Attached to this SO
                          </span>
                        )}

                        {getStatusBadge(inv.status)}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar size={13} className="text-gray-400" />
                          <span>Date: <strong className="text-gray-700">{formatDisplayDate(inv.invoiceDate)}</strong></span>
                        </span>

                        <span className="text-gray-300">|</span>

                        <span>
                          Customer: <strong className="text-gray-700 truncate max-w-[200px] inline-block align-bottom">{inv.customerName}</strong>
                        </span>

                        {inv.referenceNumber && (
                          <>
                            <span className="text-gray-300">|</span>
                            <span>Ref: <strong className="text-gray-700">{inv.referenceNumber}</strong></span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side: Amount & Select Button */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                    <div className="text-left sm:text-right">
                      <div className="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Total Amount</div>
                      <div className="text-base font-black text-gray-900 tracking-tight">
                        {formatINR(inv.total)}
                      </div>
                      {inv.balance !== undefined && inv.balance !== null && inv.balance > 0 && inv.balance !== inv.total && (
                        <div className="text-[11px] text-gray-500">
                          Bal: <span className="font-semibold text-gray-700">{formatINR(inv.balance)}</span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectInvoice(inv)}
                      disabled={isAnySubmitting || !hasPermission}
                      title={!hasPermission ? "Invoice Confirmation permission required" : undefined}
                      className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0 ${
                        !hasPermission
                          ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                          : isAttached
                            ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black ring-2 ring-amber-400/50 cursor-pointer'
                            : 'bg-[#1A2766] hover:bg-blue-900 text-white cursor-pointer'
                      } ${isAnySubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isSubmittingThis ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Mapping...</span>
                        </>
                      ) : (
                        <>
                          {isAttached && <Star size={13} className="fill-slate-950 text-slate-950" />}
                          <span>Select & Map</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Secondary Fallback Section ("Can't find the invoice? / Map Another Invoice") */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setFallbackOpen((prev) => !prev)}
          className="w-full px-5 py-4 flex items-center justify-between bg-gray-50/70 hover:bg-gray-100/70 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Search size={16} className="text-gray-500" />
            <div>
              <span className="text-sm font-bold text-gray-800">Can&apos;t find the invoice?</span>
              <span className="text-xs text-gray-500 ml-2">Map another invoice manually or search outside recent 7 days</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#1A2766] hidden sm:inline">
              {fallbackOpen ? 'Hide Fallback' : 'Map Another Invoice'}
            </span>
            {fallbackOpen ? <ChevronUp size={18} className="text-gray-500" /> : <ChevronDown size={18} className="text-gray-500" />}
          </div>
        </button>

        {fallbackOpen && (
          <div className="p-5 border-t border-gray-200 space-y-6 bg-white animate-in fade-in duration-150">
            {/* Direct Manual Entry */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Direct Manual Mapping
              </h4>
              <p className="text-xs text-gray-500 mb-3">
                Enter the exact invoice number created in Zoho Books to map it directly to this Sales Order.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={manualInvoiceNumber}
                  onChange={(e) => setManualInvoiceNumber(e.target.value)}
                  disabled={!hasPermission}
                  placeholder={hasPermission ? "e.g. KT/26-27/2981" : "Invoice Confirmation permission required"}
                  className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2766] outline-none disabled:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-500"
                />
                <button
                  type="button"
                  onClick={handleManualComplete}
                  disabled={!manualInvoiceNumber.trim() || isAnySubmitting || !hasPermission}
                  className="bg-[#1A2766] text-white px-5 py-2 rounded-lg text-xs font-bold hover:bg-blue-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
                >
                  {manualSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
                  Confirm & Complete
                </button>
              </div>
            </div>

            {/* Broader Search in Zoho Books */}
            <div>
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Broader Zoho Books Search
              </h4>
              <p className="text-xs text-gray-500 mb-3">
                Search any invoice by number across Zoho Books (outside the 7-day or same-customer filter).
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchZoho();
                      }
                    }}
                    placeholder="Search by invoice number (e.g. KT/26-27/2981)..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2766] outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearchZoho}
                  disabled={!searchQuery.trim() || searching || isAnySubmitting}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 px-4 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {searching ? <Loader2 size={14} className="animate-spin text-[#1A2766]" /> : <Search size={14} />}
                  <span>Search Zoho</span>
                </button>
              </div>

              {/* Search Results Display */}
              {searchResults !== null && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Search Results ({searchResults.length})
                  </div>

                  {searchResults.length === 0 ? (
                    <div className="text-xs text-gray-500 bg-gray-50 p-4 rounded-lg text-center border border-gray-200">
                      No invoices found in Zoho Books matching &quot;{searchQuery}&quot;.
                    </div>
                  ) : (
                    searchResults.map((res) => {
                      const resKey = res.invoiceId || res.invoiceNumber;
                      const isSubmittingThis = submittingInvoiceKey === resKey;
                      const isMappedToOther = Boolean(res.isAlreadyMappedToAnotherOrder);

                      return (
                        <div
                          key={resKey}
                          className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-[#1A2766]">{res.invoiceNumber}</span>
                              {res.isAttached && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  Attached to this SO
                                </span>
                              )}
                              {getStatusBadge(res.status)}
                              {isMappedToOther && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                                  Mapped to another SO
                                </span>
                              )}
                            </div>
                            <div className="text-gray-500 mt-1 flex flex-wrap gap-x-3">
                              <span>Customer: <strong>{res.customerName}</strong></span>
                              <span>Date: <strong>{formatDisplayDate(res.invoiceDate)}</strong></span>
                              {res.referenceNumber && <span>Ref: <strong>{res.referenceNumber}</strong></span>}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            <div className="text-right">
                              <div className="font-bold text-gray-900">{formatINR(res.total)}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSelectInvoice(res)}
                              disabled={isAnySubmitting || isMappedToOther || !hasPermission}
                              className="px-3 py-1.5 bg-[#1A2766] hover:bg-blue-900 text-white rounded-md text-xs font-bold transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
                            >
                              {isSubmittingThis ? (
                                <>
                                  <Loader2 size={12} className="animate-spin" />
                                  <span>Mapping...</span>
                                </>
                              ) : (
                                <span>Select & Map</span>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
