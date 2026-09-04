'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Search,
  RefreshCw,
  Inbox,
  AlertTriangle,
  Undo2,
  X,
  Loader2,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Truck,
  CheckCircle2,
  FileCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PreDispatchWorkflow {
  id: string;
  dispatchOrderId: string;
  currentStep: number;
  overallStatus: string;
  rateReviewStatus: string;
  paymentStatus: string;
  truckDetailsStatus: string;
  truckPhotoUrl?: string | null;
  readyForInvoiceStatus: string;
  billingVerified?: boolean;
  shippingVerified?: boolean;
  warehouseVerified?: boolean;
  readyCompletedAt?: string | null;
  invoiceConfirmStatus: string;
  mappedInvoiceNumber?: string | null;
  mappedInvoiceId?: string | null;
  mappingMethod?: string | null;
  invoiceConfirmAt?: string | null;
  updatedAt: string;
}

interface DispatchTruckUpload {
  id: string;
  salesOrderId: string;
  salesOrderNumber?: string | null;
  imagePath: string;
  imageFilename: string;
  uploadedAt: string;
  uploadedByUserName?: string | null;
}

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
  updatedAt: string;
  preDispatchWorkflow?: PreDispatchWorkflow | null;
  truckUpload?: DispatchTruckUpload | null;
}

type DispatchSection = 'pre' | 'post';

type QueueFilter =
  | 'active'
  | 'rate_review'
  | 'payment_verification'
  | 'truck_details'
  | 'ready_for_invoice'
  | 'invoice_confirmation'
  | 'sent_back'
  | 'archived'
  | 'all';

type SortKey = 'index' | 'salesOrder' | 'customer' | 'amount' | 'items' | 'waiting' | 'status';

type WorkflowStage =
  | 'rate_review'
  | 'payment_verification'
  | 'truck_details'
  | 'ready_for_invoice'
  | 'invoice_confirmation'
  | 'archived'
  | 'sent_back';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getOrderStage(order: DispatchIncomingOrder): WorkflowStage {
  if (order.status === 'SENT_BACK_TO_OPS') return 'sent_back';
  if (
    order.status === 'ARCHIVED' ||
    order.preDispatchWorkflow?.overallStatus === 'PRE_DISPATCH_COMPLETED' ||
    order.preDispatchWorkflow?.invoiceConfirmStatus === 'COMPLETED'
  ) {
    return 'archived';
  }

  const wf = order.preDispatchWorkflow;
  if (!wf || wf.rateReviewStatus !== 'COMPLETED') return 'rate_review';
  if (wf.paymentStatus !== 'COMPLETED') return 'payment_verification';
  const isTruckRequired = (order.total ?? 0) > 50000;
  if (isTruckRequired && wf.truckDetailsStatus !== 'COMPLETED') return 'truck_details';
  if (wf.readyForInvoiceStatus !== 'COMPLETED') return 'ready_for_invoice';
  return 'invoice_confirmation';
}

function getStageBadge(order: DispatchIncomingOrder) {
  const stage = getOrderStage(order);
  switch (stage) {
    case 'sent_back':
      return { label: 'Sent Back to Ops', className: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'archived':
      return { label: 'Archived', className: 'bg-slate-100 text-slate-700 border-slate-300' };
    case 'invoice_confirmation':
      return { label: 'Invoice Confirmation', className: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'ready_for_invoice':
      return { label: 'Ready for Invoice', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 'truck_details':
      return { label: 'Truck Details', className: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'payment_verification':
      return { label: 'Payment Verification', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
    case 'rate_review':
    default:
      return { label: 'Rate Review', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
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
  const [section, setSection] = useState<DispatchSection>('pre');
  const [orders, setOrders] = useState<DispatchIncomingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('active');
  const [sseConnected, setSseConnected] = useState(false);
  const [highlightedRow, setHighlightedRow] = useState<string | null>(null);
  const [fetchingIds, setFetchingIds] = useState<Set<string>>(new Set());

  // Pagination & Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'waiting', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  // Send Back modal state
  const [sendBackModalOrder, setSendBackModalOrder] = useState<DispatchIncomingOrder | null>(null);
  const [sendBackComment, setSendBackComment] = useState('');
  const [sendBackStep, setSendBackStep] = useState<1 | 2>(1);
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

  // Reset pagination on search or tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, queueFilter]);

  // Handle Escape Key for Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sendBackModalOrder && !submittingSendBack) {
        setSendBackModalOrder(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sendBackModalOrder, submittingSendBack]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleOpenSendBackModal = (order: DispatchIncomingOrder) => {
    setSendBackModalOrder(order);
    setSendBackComment('');
    setSendBackError(null);
    setSendBackStep(1);
  };

  const handleCloseSendBackModal = () => {
    if (submittingSendBack) return;
    setSendBackModalOrder(null);
  };

  const handleSendBack = async () => {
    if (!sendBackModalOrder) return;

    if (!sendBackComment.trim()) {
      setSendBackError('Reason / Comments are required.');
      setSendBackStep(1);
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
        setSendBackError(data.message || data.error || 'Failed to send the Sales Order back. Please try again.');
        if (data.details) console.error('Send Back Details:', data.details);
      } else {
        toast.success('Sales Order sent back to Operations Team successfully.');
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
              setQueueFilter('active');
              setHighlightedRow(order.id);
              setTimeout(() => setHighlightedRow(null), 3000);
            }
          } else if (data.type === 'update_order') {
            const updated: DispatchIncomingOrder = data.order;
            setOrders(prev =>
              prev.map(o => (o.id === updated.id ? { ...o, ...updated } : o))
            );
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

  // ── Derived data pipeline ────────────────────────────────────────────────

  // Tab dynamic counts
  const counts = useMemo(() => {
    return {
      active: orders.filter(o => o.status === 'NEW' && getOrderStage(o) !== 'archived').length,
      rate_review: orders.filter(o => o.status === 'NEW' && getOrderStage(o) === 'rate_review').length,
      payment_verification: orders.filter(o => o.status === 'NEW' && getOrderStage(o) === 'payment_verification').length,
      truck_details: orders.filter(o => o.status === 'NEW' && getOrderStage(o) === 'truck_details').length,
      ready_for_invoice: orders.filter(o => o.status === 'NEW' && getOrderStage(o) === 'ready_for_invoice').length,
      invoice_confirmation: orders.filter(o => o.status === 'NEW' && getOrderStage(o) === 'invoice_confirmation').length,
      sent_back: orders.filter(o => o.status === 'SENT_BACK_TO_OPS').length,
      archived: orders.filter(o => getOrderStage(o) === 'archived').length,
      all: orders.length,
    };
  }, [orders]);

  // Tab definitions
  const tabs = useMemo<{ key: QueueFilter; label: string; count?: number; badgeClass?: string }[]>(() => [
    { key: 'active', label: 'Active', count: counts.active, badgeClass: 'bg-emerald-100 text-emerald-700' },
    { key: 'rate_review', label: 'Rate Review', count: counts.rate_review, badgeClass: 'bg-emerald-100 text-emerald-800' },
    { key: 'payment_verification', label: 'Payment Verification', count: counts.payment_verification, badgeClass: 'bg-cyan-100 text-cyan-800' },
    { key: 'truck_details', label: 'Truck Details', count: counts.truck_details, badgeClass: 'bg-purple-100 text-purple-800' },
    { key: 'ready_for_invoice', label: 'Ready for Invoice', count: counts.ready_for_invoice, badgeClass: 'bg-indigo-100 text-indigo-800' },
    { key: 'invoice_confirmation', label: 'Invoice Confirmation', count: counts.invoice_confirmation, badgeClass: 'bg-blue-100 text-blue-800' },
    { key: 'sent_back', label: 'Sent Back to Ops', count: counts.sent_back, badgeClass: 'bg-amber-100 text-amber-800' },
    { key: 'archived', label: 'Archived', count: counts.archived, badgeClass: 'bg-slate-200 text-slate-700' },
    { key: 'all', label: 'All', count: counts.all, badgeClass: 'bg-gray-100 text-gray-700' },
  ], [counts]);

  // Filter
  const filteredOrders = useMemo(() => {
    let base = orders;

    switch (queueFilter) {
      case 'active':
        base = orders.filter(o => o.status === 'NEW' && getOrderStage(o) !== 'archived');
        break;
      case 'rate_review':
        base = orders.filter(o => o.status === 'NEW' && getOrderStage(o) === 'rate_review');
        break;
      case 'payment_verification':
        base = orders.filter(o => o.status === 'NEW' && getOrderStage(o) === 'payment_verification');
        break;
      case 'truck_details':
        base = orders.filter(o => o.status === 'NEW' && getOrderStage(o) === 'truck_details');
        break;
      case 'ready_for_invoice':
        base = orders.filter(o => o.status === 'NEW' && getOrderStage(o) === 'ready_for_invoice');
        break;
      case 'invoice_confirmation':
        base = orders.filter(o => o.status === 'NEW' && getOrderStage(o) === 'invoice_confirmation');
        break;
      case 'sent_back':
        base = orders.filter(o => o.status === 'SENT_BACK_TO_OPS');
        break;
      case 'archived':
        base = orders.filter(o => getOrderStage(o) === 'archived');
        break;
      case 'all':
      default:
        base = orders;
        break;
    }

    if (!searchQuery) return base;
    const lq = searchQuery.toLowerCase();
    return base.filter(
      o =>
        (o.salesorderNumber?.toLowerCase() || '').includes(lq) ||
        (o.customerName?.toLowerCase() || '').includes(lq) ||
        o.zohoSalesorderId.toLowerCase().includes(lq) ||
        (o.preDispatchWorkflow?.mappedInvoiceNumber?.toLowerCase() || '').includes(lq)
    );
  }, [orders, queueFilter, searchQuery]);

  // Sort
  const sortedOrders = useMemo(() => {
    const sorted = [...filteredOrders];
    sorted.sort((a, b) => {
      let valA: any = null;
      let valB: any = null;

      switch (sortConfig.key) {
        case 'index':
        case 'waiting': {
          const isArchivedA = getOrderStage(a) === 'archived';
          const isArchivedB = getOrderStage(b) === 'archived';

          const baseA = new Date(a.activatedAt ?? a.receivedAt).getTime();
          const baseB = new Date(b.activatedAt ?? b.receivedAt).getTime();

          const finishA = isArchivedA
            ? new Date(a.preDispatchWorkflow?.invoiceConfirmAt || a.preDispatchWorkflow?.readyCompletedAt || a.updatedAt).getTime()
            : now;
          const finishB = isArchivedB
            ? new Date(b.preDispatchWorkflow?.invoiceConfirmAt || b.preDispatchWorkflow?.readyCompletedAt || b.updatedAt).getTime()
            : now;

          const diffA = Math.max(0, finishA - baseA);
          const diffB = Math.max(0, finishB - baseB);

          return sortConfig.direction === 'asc' ? diffA - diffB : diffB - diffA;
        }
        case 'salesOrder':
          valA = (a.salesorderNumber || a.zohoSalesorderId).toLowerCase();
          valB = (b.salesorderNumber || b.zohoSalesorderId).toLowerCase();
          break;
        case 'customer':
          valA = (a.customerName || 'unknown').toLowerCase();
          valB = (b.customerName || 'unknown').toLowerCase();
          break;
        case 'amount':
          valA = a.total ?? 0;
          valB = b.total ?? 0;
          break;
        case 'items':
          valA = a.totalItems ?? 0;
          valB = b.totalItems ?? 0;
          break;
        case 'status':
          valA = getStageBadge(a).label.toLowerCase();
          valB = getStageBadge(b).label.toLowerCase();
          break;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredOrders, sortConfig, now]);

  // Pagination
  const totalPages = pageSize === 'all' ? 1 : Math.ceil(sortedOrders.length / (pageSize as number)) || 1;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [totalPages, currentPage]);

  const paginatedOrders = useMemo(() => {
    if (pageSize === 'all') return sortedOrders;
    const start = (currentPage - 1) * pageSize;
    return sortedOrders.slice(start, start + pageSize);
  }, [sortedOrders, currentPage, pageSize]);

  // ── UI Components ────────────────────────────────────────────────────────

  const SortableHeader = ({
    label,
    sortKey,
    align = 'left',
  }: {
    label: string;
    sortKey: SortKey;
    align?: 'left' | 'right' | 'center';
  }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th
        className={`px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 cursor-pointer hover:bg-gray-100/50 transition-colors select-none group ${
          align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
        }`}
        onClick={() => {
          setSortConfig(prev => ({
            key: sortKey,
            direction: prev.key === sortKey && prev.direction === 'asc' ? 'desc' : 'asc',
          }));
        }}
      >
        <div
          className={`flex items-center gap-1.5 ${
            align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''
          }`}
        >
          {label}
          <div className="flex-shrink-0 w-3">
            {isActive ? (
              sortConfig.direction === 'asc' ? (
                <ChevronUp size={12} className="text-[#1A2766]" />
              ) : (
                <ChevronDown size={12} className="text-[#1A2766]" />
              )
            ) : (
              <ArrowUpDown size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        </div>
      </th>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Top Header with Segmented Pre/Post Dispatch */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              Dispatch Orders
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
          </div>
          <p className="text-xs text-gray-500 mt-1">Live queue of Sales Orders and dispatch operations.</p>
        </div>

        {/* Segmented Control: Pre-Dispatch vs Post-Dispatch */}
        <div className="flex items-center bg-gray-200/80 p-1 rounded-lg self-start md:self-auto">
          <button
            onClick={() => setSection('pre')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
              section === 'pre'
                ? 'bg-white text-[#1A2766] shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Pre-Dispatch
          </button>
          <button
            onClick={() => setSection('post')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              section === 'post'
                ? 'bg-white text-[#1A2766] shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>Post-Dispatch</span>
            <span className="text-[9px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.2 rounded">TBD</span>
          </button>
        </div>
      </div>

      {section === 'post' ? (
        /* Post-Dispatch Empty State Card */
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-gray-50/40">
          <div className="w-16 h-16 bg-blue-50 text-[#1A2766] rounded-2xl flex items-center justify-center mb-4 border border-blue-100 shadow-sm">
            <Truck size={32} />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 mb-2">
            Coming Soon / TBD
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Post-Dispatch Operations</h2>
          <p className="text-sm text-gray-500 max-w-md">
            Vehicle departure tracking, gate-pass manifest, and e-way bill reconciliation modules are scheduled for the next release.
          </p>
          <button
            onClick={() => setSection('pre')}
            className="mt-6 px-4 py-2 bg-[#1A2766] text-white text-xs font-bold rounded-lg hover:bg-blue-900 transition-colors shadow-sm"
          >
            Return to Pre-Dispatch Queue
          </button>
        </div>
      ) : (
        /* Pre-Dispatch Operational View */
        <>
          {/* Status navigation tabs with dynamic counts */}
          <div className="px-6 border-b border-gray-100 bg-white overflow-x-auto">
            <div className="flex gap-2 sm:gap-4 -mb-px min-w-max">
              {tabs.map(tab => {
                const active = queueFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setQueueFilter(tab.key)}
                    className={`py-3 px-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                      active
                        ? 'border-[#1A2766] text-[#1A2766]'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.count !== undefined && tab.count > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab.badgeClass}`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search + Refresh */}
          <div className="px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/30">
            <div className="relative w-full sm:w-80 flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Search SO No., Invoice, or Customer…"
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
                  <SortableHeader label="#" sortKey="index" align="center" />
                  <SortableHeader label="Sales Order" sortKey="salesOrder" />
                  <SortableHeader label="Customer" sortKey="customer" />
                  <SortableHeader label="Amount" sortKey="amount" align="right" />
                  <SortableHeader label="Items" sortKey="items" align="right" />
                  <SortableHeader label="Waiting" sortKey="waiting" />
                  <SortableHeader label="Workflow Status" sortKey="status" />
                  <th className="px-4 py-3 border-b border-gray-200 w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
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
                          <p className="text-xs text-gray-400 mt-1">
                            Sales Orders pushed from Zoho Books will appear here automatically.
                          </p>
                        </div>
                      ) : (
                        <span className="text-sm">No orders match this status or search filter.</span>
                      )}
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order, idx) => {
                    const globalIndex = pageSize === 'all' ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
                    const isArchived = getOrderStage(order) === 'archived';
                    const baseTs = order.activatedAt ?? order.receivedAt;

                    let elapsedSec = 0;
                    if (isArchived) {
                      const finishTs =
                        order.preDispatchWorkflow?.invoiceConfirmAt ||
                        order.preDispatchWorkflow?.readyCompletedAt ||
                        order.updatedAt;
                      elapsedSec = Math.max(0, Math.floor((new Date(finishTs).getTime() - new Date(baseTs).getTime()) / 1000));
                    } else {
                      elapsedSec = Math.max(0, Math.floor((now - new Date(baseTs).getTime()) / 1000));
                    }

                    const needsDetailsFetch =
                      !order.detailsStatus || order.detailsStatus === 'PENDING' || order.detailsStatus === 'FAILED';
                    const badge = getStageBadge(order);

                    return (
                      <tr
                        key={order.id}
                        className={`hover:bg-gray-50/60 transition-colors duration-500 ${
                          highlightedRow === order.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        {/* # Index */}
                        <td className="px-4 py-3 text-center text-xs font-mono text-gray-400 w-12">
                          {globalIndex}
                        </td>

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

                        {/* Live Elapsed / Frozen Final Timer */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {isArchived ? (
                            <div>
                              <div className="inline-flex items-center gap-1 text-emerald-700 font-semibold tabular-nums text-xs font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <CheckCircle2 size={12} className="text-emerald-600" />
                                {formatElapsed(elapsedSec)}
                              </div>
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                Final Duration
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-semibold text-gray-800 tabular-nums text-sm font-mono">
                                {formatElapsed(elapsedSec)}
                              </div>
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                {format(new Date(baseTs), 'dd MMM · hh:mm a')}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Status + Invoice Number badge */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap border ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                            {isArchived && order.preDispatchWorkflow?.mappedInvoiceNumber && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                                <FileCheck size={11} className="text-gray-500" />
                                {order.preDispatchWorkflow.mappedInvoiceNumber}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
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

                            {isArchived ? (
                              <a
                                href={`/staff/dashboard/dispatch/incoming/${order.id}/review`}
                                className="px-2.5 py-1 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded border border-gray-200 transition-colors"
                              >
                                View
                              </a>
                            ) : order.status === 'NEW' ? (
                              <>
                                <a
                                  href={`/staff/dashboard/dispatch/incoming/${order.id}/review`}
                                  className="px-2.5 py-1 text-xs font-bold text-white bg-[#1A2766] rounded hover:bg-blue-900 transition-colors"
                                >
                                  Review
                                </a>
                                <button
                                  onClick={() => handleOpenSendBackModal(order)}
                                  title="Send Back to Operations Team"
                                  aria-label="Send Back to Operations Team"
                                  className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                                >
                                  <Undo2 size={12} />
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="px-6 py-3 border-t border-gray-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label htmlFor="pageSize" className="font-medium">Rows per page:</label>
                <select
                  id="pageSize"
                  value={pageSize}
                  onChange={e => {
                    const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                    setPageSize(val);
                    setCurrentPage(1);
                  }}
                  className="bg-gray-50 border border-gray-200 text-gray-700 rounded py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#1A2766]"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value="all">All</option>
                </select>
              </div>
              {sortedOrders.length > 0 && (
                <span className="hidden sm:inline">
                  Showing {pageSize === 'all' ? 1 : (currentPage - 1) * pageSize + 1}-
                  {pageSize === 'all' ? sortedOrders.length : Math.min(currentPage * pageSize, sortedOrders.length)} of{' '}
                  {sortedOrders.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors flex items-center justify-center"
                title="Previous Page"
                aria-label="Previous Page"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="px-3 text-xs font-medium tabular-nums">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 1}
                className="p-1.5 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors flex items-center justify-center"
                title="Next Page"
                aria-label="Next Page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Send Back Double Confirmation Modal */}
      {sendBackModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-red-50/30">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Undo2 size={18} className="text-red-600" />
                {sendBackStep === 1 ? 'Send Back to Operations?' : 'Confirm Send Back'}
              </h3>
              <button
                onClick={handleCloseSendBackModal}
                disabled={submittingSendBack}
                className="text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6">
              {sendBackStep === 1 ? (
                <>
                  <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg flex flex-col gap-1">
                    <div className="text-sm font-semibold text-gray-900">
                      Order: {sendBackModalOrder.salesorderNumber || sendBackModalOrder.zohoSalesorderId}
                    </div>
                    <div className="text-sm text-gray-600">
                      Customer: {sendBackModalOrder.customerName || 'Unknown'}
                    </div>
                  </div>

                  <p className="text-sm font-medium text-gray-800 mb-2">This action will return the order to the Operations Team:</p>
                  <ul className="list-disc pl-5 text-sm text-gray-600 mb-4 space-y-1">
                    <li>The Sales Order will be moved back to the 'Edit Required' status in Zoho Books.</li>
                    <li>The cf_is_locked field will be updated to false.</li>
                    <li>The order will no longer remain active in the current billing workflow.</li>
                    <li>ERP users may need to process the order again after it is pushed back.</li>
                  </ul>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      Reason / Comments <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 min-h-[80px]"
                      placeholder="Explain why this order is being sent back..."
                      value={sendBackComment}
                      onChange={e => setSendBackComment(e.target.value)}
                      disabled={submittingSendBack}
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 text-center">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle size={32} />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">Are you sure?</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Are you sure you want to send Sales Order{' '}
                    <span className="font-bold">
                      {sendBackModalOrder.salesorderNumber || sendBackModalOrder.zohoSalesorderId}
                    </span>{' '}
                    back to the Operations Team?
                  </p>
                  <p className="text-xs text-red-500 font-medium">This action will interrupt the current billing workflow.</p>
                </div>
              )}

              {sendBackError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
                  <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
                  <div>{sendBackError}</div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              {sendBackStep === 1 ? (
                <>
                  <button
                    onClick={handleCloseSendBackModal}
                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setSendBackStep(2)}
                    disabled={!sendBackComment.trim()}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    Continue
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setSendBackStep(1)}
                    disabled={submittingSendBack}
                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Go Back
                  </button>
                  <button
                    onClick={handleSendBack}
                    disabled={submittingSendBack}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {submittingSendBack ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        Sending Back...
                      </>
                    ) : (
                      <>
                        <Undo2 size={15} />
                        Yes, Send Back
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
