'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import {
  Search,
  RefreshCw,
  Activity,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Calendar,
  Filter,
  X,
  FileCheck,
  Loader2,
  Circle,
  Hourglass,
  RotateCcw,
  ExternalLink,
  Building2,
  Archive,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PostDispatchInvoiceSummary } from '@/components/dispatch/post-dispatch/InvoiceCard';
import InvoiceDetailModal from '@/components/dispatch/post-dispatch/InvoiceDetailModal';
import SyncApiUsageModal from '@/components/dispatch/post-dispatch/SyncApiUsageModal';
import MobileImagePreview from '@/components/mobile/MobileImagePreview';

export type PrimaryTabKey =
  | 'all_pending'
  | 'verification_pending'
  | 'receiving_pending'
  | 'check_pending'
  | 'inventory_pending'
  | 'einvoice_pending'
  | 'archived';

type SortKey =
  | 'created_at'
  | 'index'
  | 'invoice'
  | 'customer'
  | 'warehouse'
  | 'amount'
  | 'status'
  | 'eInvoice'
  | 'timer';

type DatePreset = 'all' | 'today' | 'yesterday' | 'last_7' | 'last_30' | 'custom';

function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

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

function LivePostDispatchTimer({ baseTs }: { baseTs: string }) {
  const [elapsedSec, setElapsedSec] = useState(() => {
    return Math.max(0, Math.floor((Date.now() - new Date(baseTs).getTime()) / 1000));
  });

  useEffect(() => {
    const update = () => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - new Date(baseTs).getTime()) / 1000)));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [baseTs]);

  return (
    <div>
      <div className="font-semibold text-gray-800 tabular-nums text-xs font-mono">
        {formatElapsed(elapsedSec)}
      </div>
      <div className="text-[10px] text-gray-400 mt-0.5">
        {format(new Date(baseTs), 'dd MMM · hh:mm a')}
      </div>
    </div>
  );
}

function FrozenPostDispatchTimer({
  baseTs,
  stoppedAt,
  elapsedSeconds,
}: {
  baseTs: string;
  stoppedAt?: string | null;
  elapsedSeconds: number;
}) {
  return (
    <div>
      <div className="inline-flex items-center gap-1 text-emerald-700 font-semibold tabular-nums text-xs font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
        <CheckCircle2 size={12} className="text-emerald-600" />
        {formatElapsed(elapsedSeconds)}
      </div>
      <div className="text-[10px] text-gray-400 mt-0.5">
        {stoppedAt ? format(new Date(stoppedAt), 'dd MMM · hh:mm a') : 'Duration'}
      </div>
    </div>
  );
}

/**
 * Visual semantic status pill for Zoho Status
 */
function ZohoStatusPill({ status, isVoid }: { status: string; isVoid?: boolean }) {
  const lower = (status || '').toLowerCase().trim();

  let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';

  if (isVoid || lower === 'void') {
    badgeClass = 'bg-red-50 text-red-700 border-red-200';
  } else if (lower === 'paid') {
    badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  } else if (lower === 'partially paid' || lower === 'partially_paid') {
    badgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (lower === 'unpaid') {
    badgeClass = 'bg-orange-50 text-orange-800 border-orange-200';
  } else if (lower === 'overdue') {
    badgeClass = 'bg-rose-50 text-rose-800 border-rose-200';
  } else if (lower === 'sent') {
    badgeClass = 'bg-blue-50 text-blue-800 border-blue-200';
  } else if (lower === 'viewed') {
    badgeClass = 'bg-indigo-50 text-indigo-800 border-indigo-200';
  } else if (lower === 'draft') {
    badgeClass = 'bg-gray-100 text-gray-700 border-gray-300';
  }

  return (
    <span
      className={`inline-flex items-center justify-center h-6 px-2.5 rounded-full text-[10px] font-bold uppercase tracking-wide border shrink-0 leading-none whitespace-nowrap select-none ${badgeClass}`}
    >
      {status}
    </span>
  );
}

/**
 * Visual state icon for individual workflows (Receiving, Checked, Inventory)
 */
function WorkflowStatusCell({
  status,
  workflowType,
}: {
  status: string;
  workflowType: 'RECEIVING' | 'CHECKED' | 'INVENTORY';
}) {
  if (workflowType === 'INVENTORY') {
    return (
      <span
        className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200 shrink-0 leading-none whitespace-nowrap"
        title="Inventory Deduction (Phase 2 Coming Soon)"
      >
        <Circle size={10} className="text-slate-400 shrink-0" />
        <span>Pending (TBD)</span>
      </span>
    );
  }

  const isCompleted = status === 'COMPLETED';
  const isAwaiting = status === 'AWAITING_VERIFICATION';
  const isRework = status === 'REWORK_REQUIRED';

  if (isCompleted) {
    return (
      <span
        className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 shrink-0 leading-none whitespace-nowrap"
        title={`${workflowType === 'RECEIVING' ? 'Receiving' : 'Checked'} Verified & Completed`}
        aria-label={`${workflowType === 'RECEIVING' ? 'Receiving' : 'Checked'} Verified`}
      >
        <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
        <span>Verified</span>
      </span>
    );
  }

  if (isAwaiting) {
    return (
      <span
        className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 shrink-0 leading-none whitespace-nowrap"
        title="Evidence submitted, awaiting verification"
        aria-label="Verification Pending"
      >
        <Hourglass size={12} className="text-blue-600 animate-pulse shrink-0" />
        <span>Verification Pending</span>
      </span>
    );
  }

  if (isRework) {
    return (
      <span
        className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 shrink-0 leading-none whitespace-nowrap"
        title="Rejected and marked for rework"
        aria-label="Rework Required"
      >
        <RotateCcw size={12} className="text-amber-600 shrink-0" />
        <span>Rework</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md text-[11px] font-medium text-gray-500 bg-gray-50 border border-gray-200 shrink-0 leading-none whitespace-nowrap"
      title="Upload not yet submitted"
      aria-label="Pending Upload"
    >
      <Clock size={11} className="text-gray-400 shrink-0" />
      <span>Pending</span>
    </span>
  );
}

/**
 * E-Invoice Status Cell
 */
function EInvoiceCell({
  eInvoice,
  isConsumer = false,
  isVoid = false,
  isDraft = false,
}: {
  eInvoice: {
    generated: boolean;
    irn?: string | null;
    ackNo?: string | null;
    ackDate?: string | null;
    status?: string | null;
  };
  isConsumer?: boolean;
  isVoid?: boolean;
  isDraft?: boolean;
}) {
  if (eInvoice.generated) {
    return (
      <span
        className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 font-medium text-[10px] leading-none"
        title={`Status: ${eInvoice.status || 'Generated'}${eInvoice.irn ? ` | IRN: ${eInvoice.irn}` : ''}${eInvoice.ackNo ? ` | Ack: ${eInvoice.ackNo}` : ''}`}
      >
        <CheckCircle2 size={11} className="text-teal-600 shrink-0" />
        <span>{eInvoice.status === 'Pushed' ? 'Pushed' : 'Generated'}</span>
      </span>
    );
  }

  if (isConsumer) {
    return (
      <span
        className="text-slate-400 text-[11px] italic"
        title="Consumer customer invoices are not eligible for E-Invoicing"
      >
        Ineligible (B2C)
      </span>
    );
  }

  return (
    <span className="text-gray-400 text-[11px]">
      Not Generated
    </span>
  );
}

const VALID_TABS: PrimaryTabKey[] = [
  'all_pending',
  'verification_pending',
  'receiving_pending',
  'check_pending',
  'inventory_pending',
  'einvoice_pending',
  'archived',
];

function SortableHeader({
  label,
  sortKey,
  sortConfig,
  onSort,
  align = 'left',
  className = '',
}: {
  label: string;
  sortKey: SortKey;
  sortConfig: { key: SortKey; direction: 'asc' | 'desc' };
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  const isActive = sortConfig.key === sortKey;
  return (
    <th
      className={`px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 cursor-pointer hover:bg-gray-100/50 transition-colors select-none group ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      } ${className}`}
      onClick={() => onSort(sortKey)}
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
}

export default function DesktopPostDispatchView({
  initialTab = 'all_pending',
  canForceArchive = false,
  canReview = true,
}: {
  initialTab?: PrimaryTabKey;
  canForceArchive?: boolean;
  canReview?: boolean;
} = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL state synchronization
  const urlTab = searchParams.get('tab') as PrimaryTabKey | null;
  const initialActiveTab: PrimaryTabKey =
    urlTab && VALID_TABS.includes(urlTab) ? urlTab : initialTab;

  const [activeTab, setActiveTab] = useState<PrimaryTabKey>(initialActiveTab);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'ALL');
  const [warehouseFilter, setWarehouseFilter] = useState<string>(searchParams.get('warehouse') || 'ALL');
  const [datePreset, setDatePreset] = useState<DatePreset>(
    (searchParams.get('date') as DatePreset) || 'all'
  );
  const [customStartDate, setCustomStartDate] = useState(searchParams.get('from') || '');
  const [customEndDate, setCustomEndDate] = useState(searchParams.get('to') || '');

  const [invoices, setInvoices] = useState<PostDispatchInvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingEInvoiceId, setCheckingEInvoiceId] = useState<string | null>(null);
  const [refreshingDraftId, setRefreshingDraftId] = useState<string | null>(null);
  const [forceArchiveInvoice, setForceArchiveInvoice] = useState<PostDispatchInvoiceSummary | null>(null);
  const [submittingArchive, setSubmittingArchive] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [unauthorizedMessage, setUnauthorizedMessage] = useState<string | null>(null);

  // Modals
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<{ isOpen: boolean; url: string | null; title?: string }>({
    isOpen: false,
    url: null,
  });

  // Sorting: DEFAULT IS created_at DESC (newest first)
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'created_at',
    direction: 'desc',
  });
  const [currentPage, setCurrentPage] = useState(
    Number(searchParams.get('page')) > 0 ? Number(searchParams.get('page')) : 1
  );
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Sync state to URL search params cleanly without page reload
  const updateUrlParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      // Ensure dispatch=post is preserved
      params.set('dispatch', 'post');

      Object.entries(updates).forEach(([key, val]) => {
        if (!val || val === 'all' || val === 'ALL' || (key === 'page' && val === '1')) {
          params.delete(key);
        } else {
          params.set(key, val);
        }
      });

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // Compute date range for querying based on preset
  const computedDateRange = useMemo(() => {
    const now = new Date();
    if (datePreset === 'today') {
      return {
        startDate: startOfDay(now).toISOString(),
        endDate: endOfDay(now).toISOString(),
      };
    }
    if (datePreset === 'yesterday') {
      const y = subDays(now, 1);
      return {
        startDate: startOfDay(y).toISOString(),
        endDate: endOfDay(y).toISOString(),
      };
    }
    if (datePreset === 'last_7') {
      return {
        startDate: startOfDay(subDays(now, 7)).toISOString(),
        endDate: endOfDay(now).toISOString(),
      };
    }
    if (datePreset === 'last_30') {
      return {
        startDate: startOfDay(subDays(now, 30)).toISOString(),
        endDate: endOfDay(now).toISOString(),
      };
    }
    if (datePreset === 'custom' && customStartDate) {
      return {
        startDate: startOfDay(new Date(customStartDate)).toISOString(),
        endDate: customEndDate ? endOfDay(new Date(customEndDate)).toISOString() : endOfDay(now).toISOString(),
      };
    }
    return { startDate: null, endDate: null };
  }, [datePreset, customStartDate, customEndDate]);

  // Fetch invoices from local database
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('tab', 'all'); // Fetch all local active/archived for robust client-side active filter count calculation
      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim());
      }
      if (statusFilter && statusFilter !== 'ALL') {
        params.set('status', statusFilter);
      }
      if (computedDateRange.startDate) {
        params.set('startDate', computedDateRange.startDate);
      }
      if (computedDateRange.endDate) {
        params.set('endDate', computedDateRange.endDate);
      }

      const res = await fetch(`/api/mobile/post-dispatch/invoices?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
        setUnauthorizedMessage(null);
      } else if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        setUnauthorizedMessage(data.error || 'Forbidden. Post-Dispatch access required.');
      }
    } catch (err) {
      console.error('[Desktop PostDispatch Fetch Error]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch, statusFilter, computedDateRange]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchInvoices();
    if (!unauthorizedMessage) {
      toast.success('Post-dispatch queue refreshed');
    }
  };

  // Reset page when tab or filters change
  const handleTabChange = (newTab: PrimaryTabKey) => {
    setActiveTab(newTab);
    setCurrentPage(1);
    updateUrlParams({ tab: newTab, page: null });
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setStatusFilter('ALL');
    setWarehouseFilter('ALL');
    setDatePreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setCurrentPage(1);
    updateUrlParams({ q: null, status: null, warehouse: null, date: null, from: null, to: null, page: null });
  };

  // Check Individual E-Invoice
  const handleCheckIndividualEInvoice = async (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckingEInvoiceId(invoiceId);
    try {
      const res = await fetch(`/api/mobile/post-dispatch/invoices/${invoiceId}/check-einvoice`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to check E-Invoice');
      }

      toast.success(data.message || 'E-Invoice check completed');
      // Update local invoice state immediately
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId
            ? {
                ...inv,
                eInvoice: {
                  ...inv.eInvoice,
                  generated: data.eInvoice.generated,
                  irn: data.eInvoice.irn,
                  ackNo: data.eInvoice.ackNo,
                  ackDate: data.eInvoice.ackDate,
                  status: data.eInvoice.status,
                },
              }
            : inv
        )
      );
    } catch (err: any) {
      toast.error(err.message || 'E-Invoice check failed');
    } finally {
      setCheckingEInvoiceId(null);
    }
  };

  // Targeted Individual Draft/Status Refresh
  const handleRefreshDraftStatus = async (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (refreshingDraftId === invoiceId) return;
    setRefreshingDraftId(invoiceId);
    try {
      const res = await fetch(`/api/mobile/post-dispatch/invoices/${invoiceId}/refresh-status`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to refresh invoice status');
      }

      toast.success(data.message || 'Invoice status updated');
      if (data.invoice) {
        setInvoices((prev) =>
          prev.map((inv) => (inv.id === invoiceId ? { ...inv, ...data.invoice } : inv))
        );
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to refresh status');
    } finally {
      setRefreshingDraftId(null);
    }
  };

  // Confirm and execute Force Archive override
  const handleConfirmForceArchive = async () => {
    if (!forceArchiveInvoice) return;
    setSubmittingArchive(true);
    try {
      const res = await fetch(
        `/api/mobile/post-dispatch/invoices/${forceArchiveInvoice.id}/force-archive`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: archiveReason.trim() }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to force archive invoice');
      }

      toast.success(data.message || 'Invoice force-archived successfully');
      if (data.invoice) {
        setInvoices((prev) =>
          prev.map((inv) =>
            inv.id === forceArchiveInvoice.id ? { ...inv, ...data.invoice } : inv
          )
        );
      }
      setForceArchiveInvoice(null);
      setArchiveReason('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to force archive invoice');
    } finally {
      setSubmittingArchive(false);
    }
  };

  // ── Tab Predicates & Definitions ──────────────────────────────────────────
  // Evaluated against active filters so counts accurately reflect the current filtered dataset.
  const isArchived = (inv: PostDispatchInvoiceSummary) =>
    inv.erpStatus === 'Archived' || inv.zohoStatus.toLowerCase() === 'void';

  const isVerificationPending = (inv: PostDispatchInvoiceSummary) =>
    !isArchived(inv) &&
    (inv.workflowSummary.receivingStatus === 'AWAITING_VERIFICATION' ||
      inv.workflowSummary.checkedStatus === 'AWAITING_VERIFICATION');

  const isReceivingPending = (inv: PostDispatchInvoiceSummary) =>
    !isArchived(inv) && inv.workflowSummary.receivingStatus !== 'COMPLETED';

  const isCheckPending = (inv: PostDispatchInvoiceSummary) =>
    !isArchived(inv) && inv.workflowSummary.checkedStatus !== 'COMPLETED';

  const isInventoryPending = (inv: PostDispatchInvoiceSummary) =>
    !isArchived(inv) && inv.workflowSummary.inventoryStatus !== 'COMPLETED';

  const isEInvoicePending = (inv: PostDispatchInvoiceSummary) =>
    !isArchived(inv) &&
    !inv.isConsumer &&
    !inv.eInvoice.generated &&
    inv.zohoStatus.toLowerCase() !== 'draft';

  const isAllPending = (inv: PostDispatchInvoiceSummary) =>
    !isArchived(inv) &&
    (isReceivingPending(inv) ||
      isCheckPending(inv) ||
      isInventoryPending(inv) ||
      isEInvoicePending(inv));

  // Unique warehouse names available in full invoice set (so user can always switch warehouses)
  const availableWarehouses = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.warehouseName) set.add(inv.warehouseName);
    });
    return Array.from(set).sort();
  }, [invoices]);

  // Base filtered dataset matching all active non-tab filters:
  // - Search query (server-filtered)
  // - Zoho Status (server-filtered)
  // - Date range (server-filtered)
  // - Source Warehouse (client/ERP-level filtered)
  const filteredInvoices = useMemo(() => {
    if (!warehouseFilter || warehouseFilter === 'ALL') {
      return invoices;
    }
    return invoices.filter((inv) => (inv.warehouseName || 'Not Assigned') === warehouseFilter);
  }, [invoices, warehouseFilter]);

  // Dynamic Tab Counts computed strictly from local ERP data matching ALL active filters
  // Note: Verification Pending counts UNIQUE invoices (COUNT(DISTINCT invoice_id))
  const tabCounts = useMemo(() => {
    let allPending = 0;
    let verification = 0;
    let receiving = 0;
    let check = 0;
    let inventory = 0;
    let einvoice = 0;
    let archived = 0;

    for (const inv of filteredInvoices) {
      if (isArchived(inv)) {
        archived++;
      } else {
        if (isAllPending(inv)) allPending++;
        if (isVerificationPending(inv)) verification++;
        if (isReceivingPending(inv)) receiving++;
        if (isCheckPending(inv)) check++;
        if (isInventoryPending(inv)) inventory++;
        if (isEInvoicePending(inv)) einvoice++;
      }
    }

    return {
      all_pending: allPending,
      verification_pending: verification,
      receiving_pending: receiving,
      check_pending: check,
      inventory_pending: inventory,
      einvoice_pending: einvoice,
      archived: archived,
    };
  }, [filteredInvoices]);

  const tabs: { key: PrimaryTabKey; label: string; count: number }[] = useMemo(
    () => [
      { key: 'all_pending', label: 'All Pending', count: tabCounts.all_pending },
      { key: 'verification_pending', label: 'Verification Pending', count: tabCounts.verification_pending },
      { key: 'receiving_pending', label: 'Receiving Pending', count: tabCounts.receiving_pending },
      { key: 'check_pending', label: 'Check Pending', count: tabCounts.check_pending },
      { key: 'inventory_pending', label: 'Inventory Pending', count: tabCounts.inventory_pending },
      { key: 'einvoice_pending', label: 'E-Invoice Pending', count: tabCounts.einvoice_pending },
      { key: 'archived', label: 'Archived', count: tabCounts.archived },
    ],
    [tabCounts]
  );

  // Filter list by selected primary tab from the active-filtered dataset
  const tabFilteredInvoices = useMemo(() => {
    switch (activeTab) {
      case 'all_pending':
        return filteredInvoices.filter(isAllPending);
      case 'verification_pending':
        return filteredInvoices.filter(isVerificationPending);
      case 'receiving_pending':
        return filteredInvoices.filter(isReceivingPending);
      case 'check_pending':
        return filteredInvoices.filter(isCheckPending);
      case 'inventory_pending':
        return filteredInvoices.filter(isInventoryPending);
      case 'einvoice_pending':
        return filteredInvoices.filter(isEInvoicePending);
      case 'archived':
        return filteredInvoices.filter(isArchived);
      default:
        return filteredInvoices;
    }
  }, [filteredInvoices, activeTab]);

  // Sorting
  const sortedInvoices = useMemo(() => {
    const list = [...tabFilteredInvoices];
    list.sort((a, b) => {
      let valA: any = null;
      let valB: any = null;

      switch (sortConfig.key) {
        case 'created_at':
          valA = new Date(a.timer.startedAt).getTime();
          valB = new Date(b.timer.startedAt).getTime();
          break;
        case 'index':
          return sortConfig.direction === 'asc' ? 1 : -1;
        case 'invoice':
          valA = a.invoiceNumber.toLowerCase();
          valB = b.invoiceNumber.toLowerCase();
          break;
        case 'customer':
          valA = (a.customerName || '').toLowerCase();
          valB = (b.customerName || '').toLowerCase();
          break;
        case 'warehouse':
          valA = (a.warehouseName || '').toLowerCase();
          valB = (b.warehouseName || '').toLowerCase();
          break;
        case 'amount':
          valA = a.total ?? 0;
          valB = b.total ?? 0;
          break;
        case 'status':
          valA = a.zohoStatus.toLowerCase();
          valB = b.zohoStatus.toLowerCase();
          break;
        case 'eInvoice':
          valA = a.eInvoice.generated ? 1 : 0;
          valB = b.eInvoice.generated ? 1 : 0;
          break;
        case 'timer':
          valA = a.timer.elapsedSeconds;
          valB = b.timer.elapsedSeconds;
          break;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [tabFilteredInvoices, sortConfig]);

  // Pagination
  const totalPages = pageSize === 'all' ? 1 : Math.ceil(sortedInvoices.length / (pageSize as number)) || 1;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [totalPages, currentPage]);

  const paginatedInvoices = useMemo(() => {
    if (pageSize === 'all') return sortedInvoices;
    const start = (currentPage - 1) * pageSize;
    return sortedInvoices.slice(start, start + pageSize);
  }, [sortedInvoices, currentPage, pageSize]);

  const hasActiveFilters =
    debouncedSearch.trim() !== '' ||
    statusFilter !== 'ALL' ||
    warehouseFilter !== 'ALL' ||
    datePreset !== 'all' ||
    Boolean(customStartDate);

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 1. Primary Workflow Tabs */}
      <div className="px-6 border-b border-gray-100 bg-white overflow-x-auto">
        <div className="flex gap-4 -mb-px min-w-max">
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={`py-3 px-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                  active
                    ? 'border-[#1A2766] text-[#1A2766]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    active
                      ? 'bg-blue-100 text-[#1A2766]'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Desktop Filters Bar */}
      <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/40">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          {/* Search Input */}
          <div className="relative w-full sm:w-72 flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search Invoice #, Customer, or SO..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
                updateUrlParams({ q: e.target.value.trim() || null, page: null });
              }}
              className="w-full pl-8 pr-4 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setDebouncedSearch('');
                  updateUrlParams({ q: null });
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Date Filter Preset */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs">
            <Calendar size={13} className="text-gray-400 shrink-0" />
            <span className="text-gray-400 font-medium">Date:</span>
            <select
              value={datePreset}
              onChange={(e) => {
                const val = e.target.value as DatePreset;
                setDatePreset(val);
                setCurrentPage(1);
                updateUrlParams({ date: val === 'all' ? null : val, page: null });
              }}
              className="bg-transparent text-gray-700 font-medium focus:outline-none cursor-pointer pr-1"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_7">Last 7 Days</option>
              <option value="last_30">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Custom Date Pickers when preset is custom */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setCurrentPage(1);
                  updateUrlParams({ from: e.target.value || null, page: null });
                }}
                className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 focus:outline-none"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setCurrentPage(1);
                  updateUrlParams({ to: e.target.value || null, page: null });
                }}
                className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 focus:outline-none"
              />
            </div>
          )}

          {/* Zoho Status Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs">
            <Filter size={13} className="text-gray-400 shrink-0" />
            <span className="text-gray-400 font-medium">Zoho Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                const val = e.target.value;
                setStatusFilter(val);
                setCurrentPage(1);
                updateUrlParams({ status: val === 'ALL' ? null : val, page: null });
              }}
              className="bg-transparent text-gray-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Viewed">Viewed</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
              <option value="Void">Void</option>
            </select>
          </div>

          {/* Source Warehouse Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs">
            <Building2 size={13} className="text-gray-400 shrink-0" />
            <span className="text-gray-400 font-medium">Warehouse:</span>
            <select
              value={warehouseFilter}
              onChange={(e) => {
                const val = e.target.value;
                setWarehouseFilter(val);
                setCurrentPage(1);
                updateUrlParams({ warehouse: val === 'ALL' ? null : val, page: null });
              }}
              className="bg-transparent text-gray-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Warehouses</option>
              {availableWarehouses.map((wh) => (
                <option key={wh} value={wh}>
                  {wh}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-2.5 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1"
            >
              <X size={12} />
              <span>Clear Filters</span>
            </button>
          )}
        </div>

        {/* Global Modal & Sync Triggers */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSyncModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#1A2766] rounded-lg text-xs font-semibold transition-colors"
            title="Zoho Books Sync & API Usage"
          >
            <Activity size={13} className="text-blue-600" />
            <span>Zoho Sync & Usage</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 transition-colors disabled:opacity-50"
            title="Refresh Post-Dispatch List"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Access Restriction Notice */}
      {unauthorizedMessage && (
        <div className="m-6 p-6 rounded-xl border border-amber-200 bg-amber-50/50 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm text-gray-900">Post-Dispatch Access Restricted</h4>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">{unauthorizedMessage}</p>
            <p className="text-[11px] text-gray-400 mt-2">
              Requires <code>dispatch_view</code> and <code>dispatch_post_dispatch</code> permission. Please contact your system administrator.
            </p>
          </div>
        </div>
      )}

      {/* 3. Desktop Table View with Separate Receiving, Checked, Inventory Columns */}
      {!unauthorizedMessage && (
        <div className="flex-1 overflow-auto bg-gray-50/30 relative">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-gray-50 sticky top-0 z-20 shadow-xs">
              <tr>
                {/* STICKY LEFT: Col 0 (# Index) */}
                <SortableHeader
                  label="#"
                  sortKey="index"
                  align="center"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  className="sticky left-0 z-30 bg-gray-50 min-w-[48px] w-[48px] shadow-[1px_0_0_0_#e5e7eb]"
                />

                {/* STICKY LEFT: Col 1 (Invoice Number) */}
                <SortableHeader
                  label="Invoice Number"
                  sortKey="invoice"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  className="sticky left-[48px] z-30 bg-gray-50 min-w-[150px] w-[150px] shadow-[1px_0_0_0_#e5e7eb]"
                />

                {/* STICKY LEFT: Col 2 (Customer) */}
                <SortableHeader
                  label="Customer"
                  sortKey="customer"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  className="sticky left-[198px] z-30 bg-gray-50 min-w-[200px] max-w-[260px] shadow-[3px_0_5px_-2px_rgba(0,0,0,0.08)]"
                />

                {/* HORIZONTALLY SCROLLING MIDDLE COLUMNS */}
                <SortableHeader label="Source Warehouse" sortKey="warehouse" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Amount" sortKey="amount" align="right" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Zoho Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="E-Invoice" sortKey="eInvoice" sortConfig={sortConfig} onSort={handleSort} />
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200">
                  Receiving
                </th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200">
                  Checked
                </th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200">
                  Inventory
                </th>

                {/* STICKY RIGHT: Col n-1 (Timer) */}
                <SortableHeader
                  label="Timer"
                  sortKey="timer"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  className="sticky right-[130px] z-30 bg-gray-50 min-w-[120px] w-[120px] shadow-[-1px_0_0_0_#e5e7eb]"
                />

                {/* STICKY RIGHT: Col n (Action) */}
                <th className="px-4 py-3 border-b border-gray-200 min-w-[130px] w-[130px] text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider sticky right-0 z-30 bg-gray-50 shadow-[-3px_0_5px_-2px_rgba(0,0,0,0.08)]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={15} className="animate-spin text-gray-300" />
                      <span className="text-sm">Loading post-dispatch invoices…</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center max-w-xs mx-auto">
                      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3 border border-gray-100">
                        <FileText size={24} className="text-gray-300" />
                      </div>
                      <p className="text-sm font-medium text-gray-700">No invoices found</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {hasActiveFilters
                          ? 'No invoices match your active filters or search keyword.'
                          : activeTab === 'einvoice_pending'
                          ? 'No eligible B2B invoices awaiting E-Invoicing.'
                          : activeTab === 'archived'
                          ? 'No archived or void invoices recorded.'
                          : 'All actionable invoices have completed their workflows.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((inv, idx) => {
                  const globalIndex =
                    pageSize === 'all' ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
                  const isVoidInvoice =
                    inv.erpSubStatus === 'Void' || inv.zohoStatus.toLowerCase() === 'void';
                  const isDraft = inv.zohoStatus.toLowerCase() === 'draft';

                  const canCheckEInvoice =
                    !inv.isConsumer &&
                    !inv.eInvoice.generated &&
                    !isVoidInvoice &&
                    !isDraft;

                  return (
                    <tr
                      key={inv.id}
                      className={`group hover:bg-gray-50 transition-colors ${
                        isVoidInvoice
                          ? 'bg-red-50/20'
                          : inv.workflowSummary.receivingStatus === 'REWORK_REQUIRED' ||
                            inv.workflowSummary.checkedStatus === 'REWORK_REQUIRED'
                          ? 'bg-amber-50/20'
                          : ''
                      }`}
                    >
                      {/* # Index: STICKY LEFT Col 0 */}
                      <td className="px-4 py-3 text-center text-xs font-mono text-gray-400 min-w-[48px] w-[48px] sticky left-0 z-10 bg-white group-hover:bg-gray-50 shadow-[1px_0_0_0_#e5e7eb]">
                        {globalIndex}
                      </td>

                      {/* Invoice Number: STICKY LEFT Col 1 - Keep on one line */}
                      <td className="px-4 py-3 whitespace-nowrap min-w-[150px] w-[150px] sticky left-[48px] z-10 bg-white group-hover:bg-gray-50 shadow-[1px_0_0_0_#e5e7eb]">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          {inv.zohoInvoiceId ? (
                            <a
                              href={`https://books.zoho.in/app#/invoices/${inv.zohoInvoiceId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-[#1A2766] hover:underline text-sm inline-flex items-center gap-1 group whitespace-nowrap"
                              title={`Open ${inv.invoiceNumber} in Zoho Books`}
                            >
                              <span className="whitespace-nowrap">{inv.invoiceNumber}</span>
                              <ExternalLink size={11} className="text-gray-400 group-hover:text-[#1A2766] transition-colors shrink-0" />
                            </a>
                          ) : (
                            <span className="font-bold text-[#1A2766] text-sm whitespace-nowrap">
                              {inv.invoiceNumber}
                            </span>
                          )}
                        </div>
                        {inv.salesOrderNumber && (
                          <div className="text-[10px] text-gray-400 mt-0.5 whitespace-nowrap">
                            SO: <span className="font-mono text-gray-600">{inv.salesOrderNumber}</span>
                          </div>
                        )}
                      </td>

                      {/* Customer & GSTIN: STICKY LEFT Col 2 */}
                      <td className="px-4 py-3 min-w-[200px] max-w-[260px] sticky left-[198px] z-10 bg-white group-hover:bg-gray-50 shadow-[3px_0_5px_-2px_rgba(0,0,0,0.08)]">
                        <div className="truncate">
                          {inv.customerId ? (
                            <a
                              href={`https://books.zoho.in/app#/contacts/${inv.customerId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-gray-900 hover:text-[#1A2766] hover:underline text-sm truncate inline-flex items-center gap-1 group max-w-full"
                              title={`Open ${inv.customerName || 'Customer'} in Zoho Books`}
                            >
                              <span className="truncate">{inv.customerName || 'Unknown'}</span>
                              <ExternalLink size={10} className="text-gray-400 group-hover:text-[#1A2766] transition-colors shrink-0" />
                            </a>
                          ) : (
                            <div className="font-medium text-gray-900 text-sm truncate" title={inv.customerName}>
                              {inv.customerName || 'Unknown'}
                            </div>
                          )}
                        </div>
                        {/* Customer GSTIN Subtitle */}
                        <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                          GSTIN: {inv.gstin ? inv.gstin : 'Null'}
                        </div>
                        {inv.isConsumer && (
                          <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded font-medium inline-block mt-0.5">
                            B2C (Consumer)
                          </span>
                        )}
                      </td>

                      {/* Source Warehouse */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${
                            inv.warehouseName
                              ? 'bg-slate-50 text-slate-700 border-slate-200'
                              : 'bg-gray-50 text-gray-400 border-gray-200 italic'
                          }`}
                        >
                          <Building2 size={11} className={inv.warehouseName ? 'text-slate-500' : 'text-gray-300'} />
                          <span>{inv.warehouseName || 'Not Assigned'}</span>
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right">
                        <div className="font-semibold text-gray-900 text-sm tabular-nums">
                          {formatCurrency(inv.total, inv.currencyCode || 'INR')}
                        </div>
                      </td>

                      {/* Zoho Status with distinct semantic pill styles */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <ZohoStatusPill status={inv.zohoStatus} isVoid={isVoidInvoice} />
                          {isDraft && (
                            <span className="text-[10px] text-gray-400 font-medium">
                              Pending Books approval
                            </span>
                          )}
                          {inv.erpSubStatus === 'Force Archived' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                              Force Archived
                            </span>
                          )}
                        </div>
                      </td>

                      {/* E-Invoice Status */}
                      <td className="px-4 py-3">
                        <EInvoiceCell
                          eInvoice={inv.eInvoice}
                          isConsumer={inv.isConsumer}
                          isVoid={isVoidInvoice}
                          isDraft={isDraft}
                        />
                      </td>

                      {/* Workflows: 1. RECEIVING */}
                      <td className="px-4 py-3">
                        <WorkflowStatusCell
                          status={inv.workflowSummary.receivingStatus}
                          workflowType="RECEIVING"
                        />
                      </td>

                      {/* Workflows: 2. CHECKED */}
                      <td className="px-4 py-3">
                        <WorkflowStatusCell
                          status={inv.workflowSummary.checkedStatus}
                          workflowType="CHECKED"
                        />
                      </td>

                      {/* Workflows: 3. INVENTORY */}
                      <td className="px-4 py-3">
                        <WorkflowStatusCell
                          status={inv.workflowSummary.inventoryStatus}
                          workflowType="INVENTORY"
                        />
                      </td>

                      {/* Timer: STICKY RIGHT Col n-1 */}
                      <td className="px-4 py-3 whitespace-nowrap min-w-[120px] w-[120px] sticky right-[130px] z-10 bg-white group-hover:bg-gray-50 shadow-[-1px_0_0_0_#e5e7eb]">
                        {inv.timer.isStopped ? (
                          <FrozenPostDispatchTimer
                            baseTs={inv.timer.startedAt}
                            stoppedAt={inv.timer.stoppedAt}
                            elapsedSeconds={inv.timer.elapsedSeconds}
                          />
                        ) : (
                          <LivePostDispatchTimer baseTs={inv.timer.startedAt} />
                        )}
                      </td>

                      {/* Actions: STICKY RIGHT Col n */}
                      <td className="px-4 py-3 text-right min-w-[130px] w-[130px] sticky right-0 z-10 bg-white group-hover:bg-gray-50 shadow-[-3px_0_5px_-2px_rgba(0,0,0,0.08)]">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* DRAFT STATE: Replace Review with single targeted refresh button */}
                          {isDraft ? (
                            <button
                              type="button"
                              onClick={(e) => handleRefreshDraftStatus(inv.id, e)}
                              disabled={refreshingDraftId === inv.id}
                              title="Fetch Latest Status from Zoho Books"
                              aria-label="Fetch Latest Status"
                              className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-[#1A2766] transition-colors disabled:opacity-50 shadow-xs"
                            >
                              <RefreshCw
                                size={14}
                                className={refreshingDraftId === inv.id ? 'animate-spin text-blue-600' : 'text-[#1A2766]'}
                              />
                            </button>
                          ) : (
                            <>
                              {/* Individual E-Invoice Check Action (Non-draft, non-void, B2B only) */}
                              {canCheckEInvoice && (
                                <button
                                  type="button"
                                  onClick={(e) => handleCheckIndividualEInvoice(inv.id, e)}
                                  disabled={checkingEInvoiceId === inv.id}
                                  title="Check E-Invoice Status from Zoho Books"
                                  aria-label="Check E-Invoice Status"
                                  className="p-1.5 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-700 transition-colors disabled:opacity-50"
                                >
                                  {checkingEInvoiceId === inv.id ? (
                                    <Loader2 size={13} className="animate-spin text-teal-600" />
                                  ) : (
                                    <FileCheck size={13} />
                                  )}
                                </button>
                              )}

                              {/* Primary Review Action: OPENS NEW BROWSER TAB (Only when not void and not force-archived) */}
                              {!isVoidInvoice && inv.erpSubStatus !== 'Force Archived' && canReview && (
                                <a
                                  href={`/staff/dashboard/dispatch/post-dispatch/${inv.id}/review`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1 text-xs font-bold text-white bg-[#1A2766] hover:bg-blue-900 rounded transition-colors inline-flex items-center gap-1 shadow-2xs"
                                  title="Open Review Workspace in new tab"
                                >
                                  <span>Review</span>
                                  <ExternalLink size={10} className="opacity-70" />
                                </a>
                              )}
                            </>
                          )}

                          {/* Force Archive Action: Visible only to users with dedicated permission, for active non-archived orders */}
                          {canForceArchive && !isVoidInvoice && inv.erpStatus !== 'Archived' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setForceArchiveInvoice(inv);
                              }}
                              title="Force Archive Invoice (Administrative Override)"
                              aria-label="Force Archive Invoice"
                              className="p-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 transition-colors shadow-xs"
                            >
                              <Archive size={13} className="text-amber-700" />
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
      )}

      {/* 4. Desktop Pagination Footer */}
      {!unauthorizedMessage && (
        <div className="px-6 py-3 border-t border-gray-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value;
                setPageSize(val === 'all' ? 'all' : Number(val));
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
            <span className="text-gray-400 ml-2">
              Showing <strong>{paginatedInvoices.length}</strong> of{' '}
              <strong>{sortedInvoices.length}</strong> invoices
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="tabular-nums">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const newPage = Math.max(1, currentPage - 1);
                  setCurrentPage(newPage);
                  updateUrlParams({ page: newPage > 1 ? String(newPage) : null });
                }}
                disabled={currentPage <= 1}
                className="p-1 rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 transition-opacity"
                aria-label="Previous Page"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  const newPage = Math.min(totalPages, currentPage + 1);
                  setCurrentPage(newPage);
                  updateUrlParams({ page: newPage > 1 ? String(newPage) : null });
                }}
                disabled={currentPage >= totalPages}
                className="p-1 rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 transition-opacity"
                aria-label="Next Page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Full Overlay Modals */}
      {selectedInvoiceId && (
        <InvoiceDetailModal
          isOpen={!!selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
          invoiceId={selectedInvoiceId}
          onPhotoClick={(url, title) => setPreviewPhoto({ isOpen: true, url, title })}
          onUpdated={() => {
            fetchInvoices();
          }}
        />
      )}

      {/* Fullscreen Photo Preview Modal */}
      <MobileImagePreview
        isOpen={previewPhoto.isOpen}
        onClose={() => setPreviewPhoto({ isOpen: false, url: null })}
        imageUrl={previewPhoto.url}
        title={previewPhoto.title || 'Evidence Preview'}
      />

      {/* Sync & API Usage Modal */}
      <SyncApiUsageModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        onSyncComplete={() => {
          fetchInvoices();
        }}
      />

      {/* Force Archive Confirmation Modal */}
      {forceArchiveInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-gray-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
                <Archive size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Force Archive Invoice?</h3>
              <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                This will move Invoice <strong className="text-gray-900 font-mono">{forceArchiveInvoice.invoiceNumber}</strong> directly into the Archived queue without completing the remaining workflows.
              </p>
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200/80 mb-4 text-xs text-amber-900 leading-relaxed">
                <p className="font-semibold mb-1">Administrative Override Notice:</p>
                <p>Real workflow states are preserved. This action will be permanently recorded in the audit history.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reason for Force Archive (Optional)
                </label>
                <input
                  type="text"
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  placeholder="e.g. Cancelled by customer before dispatch"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setForceArchiveInvoice(null);
                  setArchiveReason('');
                }}
                disabled={submittingArchive}
                className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmForceArchive}
                disabled={submittingArchive}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {submittingArchive && <Loader2 size={13} className="animate-spin" />}
                <span>Force Archive</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
