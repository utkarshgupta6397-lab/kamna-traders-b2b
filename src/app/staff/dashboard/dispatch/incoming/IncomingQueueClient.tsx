'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { Search, RefreshCw, Inbox, AlertTriangle, ArrowLeftCircle, X, Loader2, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DispatchIncomingOrder {
  id: string;
  zohoSalesorderId: string;
  salesorderNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  customerGst: string | null;
  total: number | null;
  currencyCode: string | null;
  totalItems: number | null;
  totalUniqueRows: number | null;
  totalTax: number | null;
  status: string;
  receivedAt: string;
  activatedAt: string;
  detailsStatus?: string;
  detailsFetchError?: string | null;
}

type QueueFilter = 'new' | 'sent_back' | 'all';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  SENT_BACK_TO_OPS: 'Sent Back to Ops',
};

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format elapsed seconds into compact operational notation.
 * Examples: 32s | 15m 32s | 3h 15m | 1d 23h
 */
function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, seconds)}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ${seconds % 60}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs < 24) return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs > 0 ? `${days}d ${remHrs}h` : `${days}d`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IncomingQueueClient() {
  const [orders, setOrders] = useState<DispatchIncomingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('new');
  const [sseConnected, setSseConnected] = useState(false);
  const [highlightedRow, setHighlightedRow] = useState<string | null>(null);
  const [fetchingIds, setFetchingIds] = useState<Set<string>>(new Set());

  // Send Back modal state
  const [sendBackModalOrder, setSendBackModalOrder] = useState<DispatchIncomingOrder | null>(null);
  const [sendBackComment, setSendBackComment] = useState('');
  const [submittingSendBack, setSubmittingSendBack] = useState(false);
  const [sendBackError, setSendBackError] = useState<string | null>(null);

  // Live clock — single shared ticker; all rows derive elapsed time from this
  const [now, setNow] = useState(() => Date.now());

  // Deduplication ref for SSE
  const knownIdsRef = useRef<Set<string>>(new Set());

  // ── Single shared ticker ──────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleOpenSendBackModal = (order: DispatchIncomingOrder) => {
    setSendBackModalOrder(order);
    setSendBackComment('');
    setSendBackError(null);
  };

  const handleSendBack = async () => {
    if (!sendBackModalOrder) return;
    if (!sendBackComment.trim()) {
      setSendBackError('Reason / Comments are required.');
      return;
    }
    setSubmittingSendBack(true);
    setSendBackError(null);
    try {
      const res = await fetch(`/api/dispatch/incoming-orders/${sendBackModalOrder.id}/send-back`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: sendBackComment }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSendBackError(data.message || data.error || 'Failed to send back to Operations.');
        if (data.details) console.error('Send Back Details:', data.details);
      } else {
        setSendBackModalOrder(null);
        // Optimistically update local status so the row moves to Sent Back tab immediately
        setOrders(prev =>
          prev.map(o =>
            o.id === sendBackModalOrder.id ? { ...o, status: 'SENT_BACK_TO_OPS' } : o
          )
        );
      }
    } catch (err: any) {
      setSendBackError(err.message || 'Network error.');
    } finally {
      setSubmittingSendBack(false);
    }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dispatch/incoming-queue');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setOrders(json.data);
          const idSet = new Set<string>();
          json.data.forEach((o: DispatchIncomingOrder) => idSet.add(o.zohoSalesorderId));
          knownIdsRef.current = idSet;
        }
      } else {
        toast.error('Failed to load incoming queue.');
      }
    } catch {
      toast.error('Network error while loading queue.');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchDetails = async (id: string) => {
    setFetchingIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/dispatch/incoming-queue/${id}/fetch`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch details');
      toast.success('Sales Order details fetched successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Unable to fetch Sales Order details from Zoho Books.');
    } finally {
      setFetchingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // ── Initial load + SSE ───────────────────────────────────────────────────

  useEffect(() => {
    fetchInitialData();

    let eventSource: EventSource;
    let reconnectTimeout: NodeJS.Timeout;
    let isUnmounted = false;

    const connectSSE = () => {
      eventSource = new EventSource('/api/dispatch/incoming-queue/events');

      eventSource.onopen = () => setSseConnected(true);

      eventSource.onerror = () => {
        setSseConnected(false);
        eventSource.close();
        if (!isUnmounted) reconnectTimeout = setTimeout(connectSSE, 5000);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_order') {
            const order: DispatchIncomingOrder = data.order;
            const dedupeKey = (order as any)._isRePush
              ? `${order.zohoSalesorderId}_${(order as any)._rePushTimestamp}`
              : order.zohoSalesorderId;

            if (!knownIdsRef.current.has(dedupeKey)) {
              knownIdsRef.current.add(dedupeKey);
              setOrders(prev => [order, ...prev.filter(o => o.id !== order.id)]);
              // Switch to active tab so user sees it immediately
              setQueueFilter('new');
              setHighlightedRow(order.id);
              setTimeout(() => setHighlightedRow(null), 3000);
            }
          }
        } catch (err) {
          console.error('[SSE] Message parse error:', err);
        }
      };
    };

    connectSSE();

    return () => {
      isUnmounted = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) eventSource.close();
    };
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────

  const newCount = useMemo(() => orders.filter(o => o.status === 'NEW').length, [orders]);
  const sentBackCount = useMemo(() => orders.filter(o => o.status === 'SENT_BACK_TO_OPS').length, [orders]);

  const filteredOrders = useMemo(() => {
    let base = orders;
    if (queueFilter === 'new') base = orders.filter(o => o.status === 'NEW');
    else if (queueFilter === 'sent_back') base = orders.filter(o => o.status === 'SENT_BACK_TO_OPS');

    if (!searchQuery) return base;
    const lq = searchQuery.toLowerCase();
    return base.filter(
      o =>
        (o.salesorderNumber?.toLowerCase() || '').includes(lq) ||
        (o.customerName?.toLowerCase() || '').includes(lq) ||
        o.zohoSalesorderId.toLowerCase().includes(lq)
    );
  }, [orders, queueFilter, searchQuery]);

  // ── Tab helper ───────────────────────────────────────────────────────────

  const tabClass = (active: boolean) =>
    `py-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
      active
        ? 'border-[#1A2766] text-[#1A2766]'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Incoming Orders
            {sseConnected ? (
              <span className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Reconnecting
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Live queue of Sales Orders pushed from Zoho Books.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 px-6 py-4 border-b border-gray-100 bg-white">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Received</span>
            <Inbox size={14} />
          </div>
          <span className="text-2xl font-black text-blue-900">{orders.length}</span>
          <p className="text-[10px] text-blue-500 mt-0.5">Cumulative · all cycles</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Awaiting Action</span>
            <AlertTriangle size={14} />
          </div>
          <span className="text-2xl font-black text-emerald-900">{newCount}</span>
          <p className="text-[10px] text-emerald-600 mt-0.5">Active · requires processing</p>
        </div>
      </div>

      {/* Queue filter tabs */}
      <div className="px-6 border-b border-gray-100">
        <div className="flex gap-6 -mb-px">
          <button onClick={() => setQueueFilter('new')} className={tabClass(queueFilter === 'new')}>
            Active
            {newCount > 0 && (
              <span className="ml-1.5 text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full">
                {newCount}
              </span>
            )}
          </button>
          <button onClick={() => setQueueFilter('sent_back')} className={tabClass(queueFilter === 'sent_back')}>
            Sent Back to Ops
            {sentBackCount > 0 && (
              <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">
                {sentBackCount}
              </span>
            )}
          </button>
          <button onClick={() => setQueueFilter('all')} className={tabClass(queueFilter === 'all')}>
            All
          </button>
        </div>
      </div>

      {/* Search + Refresh */}
      <div className="px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/30">
        <div className="relative w-full sm:w-80 flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            placeholder="Search SO No. or Customer…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-4 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766]"
          />
        </div>
        <button
          onClick={fetchInitialData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-gray-50/30 relative">
        <table className="w-full text-left border-collapse text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200">Sales Order</th>
              <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200">Customer</th>
              <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 text-right">Amount</th>
              <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 text-right">Items</th>
              <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200">Waiting</th>
              <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={15} className="animate-spin text-gray-300" />
                      <span className="text-sm">Loading queue…</span>
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="flex flex-col items-center max-w-xs mx-auto">
                      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3 border border-gray-100">
                        <Inbox size={24} className="text-gray-300" />
                      </div>
                      <p className="text-sm font-medium text-gray-500">Queue is empty</p>
                      <p className="text-xs text-gray-400 mt-1">Sales Orders pushed from Zoho Books will appear here automatically.</p>
                    </div>
                  ) : (
                    <span className="text-sm">No results match your search.</span>
                  )}
                </td>
              </tr>
            ) : (
              filteredOrders.map(order => {
                // Derive elapsed from activatedAt (current billing cycle start).
                // Falls back to receivedAt for any legacy rows that pre-date this field.
                const baseTs = order.activatedAt ?? order.receivedAt;
                const elapsedSec = Math.floor((now - new Date(baseTs).getTime()) / 1000);
                const needsDetailsFetch =
                  !order.detailsStatus || order.detailsStatus === 'PENDING' || order.detailsStatus === 'FAILED';

                return (
                  <tr
                    key={order.id}
                    className={`hover:bg-gray-50/60 transition-colors duration-500 ${
                      highlightedRow === order.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    {/* Sales Order */}
                    <td className="px-4 py-3">
                      {order.salesorderNumber ? (
                        <a
                          href={`https://books.zoho.in/app#/salesorders/${order.zohoSalesorderId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-[#1A2766] hover:underline text-sm"
                        >
                          {order.salesorderNumber}
                        </a>
                      ) : (
                        <span className="font-bold text-gray-700 text-sm">{order.zohoSalesorderId}</span>
                      )}
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">{order.zohoSalesorderId}</div>
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3 max-w-[200px]">
                      {order.customerName ? (
                        <a
                          href={`https://books.zoho.in/app#/contacts/${order.customerId || ''}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-gray-900 hover:text-[#1A2766] hover:underline text-sm truncate block"
                        >
                          {order.customerName}
                        </a>
                      ) : (
                        <span className="text-gray-400 italic text-sm">Unknown</span>
                      )}
                      {order.customerGst && (
                        <div className="text-[10px] text-gray-400 mt-0.5 truncate">{order.customerGst}</div>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 text-right">
                      <div className="font-semibold text-gray-900 text-sm tabular-nums">
                        {order.total !== null ? formatCurrency(order.total, order.currencyCode || 'INR') : '—'}
                      </div>
                      {order.totalTax !== null && (
                        <div className="text-[10px] text-gray-400 mt-0.5 tabular-nums">
                          Tax {formatCurrency(order.totalTax, order.currencyCode || 'INR')}
                        </div>
                      )}
                    </td>

                    {/* Items */}
                    <td className="px-4 py-3 text-right">
                      <div className="font-medium text-gray-900 text-sm tabular-nums">
                        {order.totalItems !== null ? order.totalItems : '—'}
                      </div>
                      {order.totalUniqueRows !== null && (
                        <div className="text-[10px] text-gray-400 mt-0.5 tabular-nums">
                          {order.totalUniqueRows} rows
                        </div>
                      )}
                    </td>

                    {/* Live Elapsed Timer */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-semibold text-gray-800 tabular-nums text-sm font-mono">
                        {formatElapsed(elapsedSec)}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {format(new Date(baseTs), 'dd MMM · hh:mm a')}
                      </div>
                    </td>

                    {/* Status + compact action icons */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${
                            order.status === 'NEW'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : order.status === 'SENT_BACK_TO_OPS'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}
                        >
                          {getStatusLabel(order.status)}
                        </span>

                        {/* Compact icon-only action buttons */}
                        {needsDetailsFetch && (
                          <button
                            onClick={() => handleFetchDetails(order.id)}
                            disabled={fetchingIds.has(order.id)}
                            title="Fetch SO details from Zoho Books"
                            aria-label="Fetch SO details from Zoho Books"
                            className="p-1 rounded text-gray-400 hover:text-[#1A2766] hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-colors disabled:opacity-40"
                          >
                            <RefreshCw size={12} className={fetchingIds.has(order.id) ? 'animate-spin text-blue-500' : ''} />
                          </button>
                        )}

                        {order.status === 'NEW' && (
                          <button
                            onClick={() => handleOpenSendBackModal(order)}
                            title="Send Back to Operations Team"
                            aria-label="Send Back to Operations Team"
                            className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Send Back Modal — behavior unchanged */}
      {sendBackModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-red-50/30">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ArrowLeftCircle size={18} className="text-red-600" />
                Send Sales Order Back for Editing?
              </h3>
              <button
                onClick={() => !submittingSendBack && setSendBackModalOrder(null)}
                disabled={submittingSendBack}
                className="text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                This will release the Sales Order{' '}
                <span className="font-bold text-gray-900">
                  {sendBackModalOrder.salesorderNumber || sendBackModalOrder.zohoSalesorderId}
                </span>{' '}
                for correction and send it back to the Operations team.
              </p>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Reason / Comments <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 min-h-[100px]"
                  placeholder="Explain why this order is being sent back…"
                  value={sendBackComment}
                  onChange={e => setSendBackComment(e.target.value)}
                  disabled={submittingSendBack}
                />
              </div>
              {sendBackError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
                  <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
                  <div>{sendBackError}</div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setSendBackModalOrder(null)}
                disabled={submittingSendBack}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendBack}
                disabled={submittingSendBack || !sendBackComment.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {submittingSendBack ? <Loader2 size={15} className="animate-spin" /> : <ArrowLeftCircle size={15} />}
                Send Back to Operations Team
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
