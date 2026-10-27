'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search,
  RefreshCw,
  Download,
  Filter,
  X,
  Calendar,
  AlertCircle,
  FileText,
  Clock,
  User,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  TrendingDown,
  Layers,
  History,
  FileSpreadsheet,
  Building,
  Tag,
  AlertTriangle,
  Loader2,
  Edit3,
  ExternalLink,
  Flag,
  CheckCheck,
  SlidersHorizontal,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import CustomerStatementView from '@/components/zoho/CustomerStatementView';
import DualRangeSlider from './DualRangeSlider';
import {
  generateRecoveryReportPdf,
  BatchPdfProgress,
  BatchRecoveryCustomerInput,
} from '@/lib/recovery/recovery-report-generator';
import {
  RECOVERY_STATUSES,
  RecoveryStatusId,
  AgingBucketKey,
  formatINR,
  getZohoContactUrl,
} from '@/lib/recovery/recovery-calculator';

interface InvoiceSummaryItem {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  invoiceValue: number;
  amountPaid: number;
  amountPending: number;
  paymentStatus: string;
  isOverdue: boolean;
  overdueDays: number;
  agingBucket: AgingBucketKey;
  salespersonName?: string | null;
  activeTaskId?: string | null;
  isPendingRecovery?: boolean;
  flaggedByName?: string | null;
  flaggedAt?: string | null;
}

interface RecoveryCustomerRow {
  customerId: string;
  customerName: string;
  customerGst: string;
  totalOutstanding: number;
  netBalance?: number;
  netPayableBalance?: number;
  isAdvance?: boolean;
  overdueAmount: number;
  invoiceCount: number;
  oldestOverdueDays: number;
  oldestDueDate: string | null;
  overallAgingBucket: AgingBucketKey;
  salesperson: string | null;
  allSalespersons: string[];
  recoveryStatus: string;
  nextFollowUpDate: string | null;
  lastActivityAt: string | null;
  internalNotes: string | null;
  assignedStaffName: string | null;
  hasActiveTask?: boolean;
  activeTaskCount?: number;
  invoices: InvoiceSummaryItem[];
  openInvoices?: InvoiceSummaryItem[];
}

interface RecoveryKPIs {
  totalOutstanding: number;
  totalOverdue: number;
  totalCustomers: number;
  totalInvoices: number;
  agingSummary: Record<AgingBucketKey, { amount: number; count: number }>;
  advanceInvoices?: {
    amount: number;
    count: number;
  };
  maxOutstanding?: number;
  reconciliation?: {
    activeNetReceivables: number;
    activeAgingInvoiceBalances: number;
    activeAdvanceInvoices: number;
    allAccountsNetReceivables: number;
    allAccountsInvoicePending: number;
    allAccountsDifference: number;
  };
  oldestOverdue: {
    customerId: string;
    customerName: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string | null;
    overdueDays: number;
    amountPending: number;
  } | null;
  lastRefreshedAt: string | null;
}

interface ActivityItem {
  id: string;
  activityType: string;
  description: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  notes: string | null;
  performedByName: string;
  createdAt: string;
}

const STATUS_STYLE_MAP: Record<string, { bg: string; text: string; border: string }> = {
  PENDING_FOLLOW_UP: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  CONTACTED: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  PROMISE_TO_PAY: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  PAYMENT_DISPUTED: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  PARTIALLY_RECOVERED: { bg: 'bg-cyan-50', text: 'text-cyan-800', border: 'border-cyan-200' },
  FULLY_RECOVERED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  ON_HOLD: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  CUSTOMER_UNREACHABLE: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200' },
};

const AGING_BADGE_MAP: Record<AgingBucketKey, { bg: string; text: string; border: string }> = {
  '0-30': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  '31-60': { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200' },
  '61-90': { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200' },
  '90+': { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' },
};

export default function RecoveryQueueWorkspace() {
  // Data States
  const [customers, setCustomers] = useState<RecoveryCustomerRow[]>([]);
  const [kpis, setKpis] = useState<RecoveryKPIs | null>(null);
  const [salespersons, setSalespersons] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [releaseAllowed, setReleaseAllowed] = useState(false);
  const [actionLoadingInvoiceId, setActionLoadingInvoiceId] = useState<string | null>(null);
  const [releasedTaskIds, setReleasedTaskIds] = useState<Set<string>>(new Set());
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<BatchPdfProgress | null>(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedSalesperson, setSelectedSalesperson] = useState('');
  const [selectedAging, setSelectedAging] = useState<AgingBucketKey | ''>('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');

  // Outstanding Amount Range Slider Popover State
  const [rangePopoverOpen, setRangePopoverOpen] = useState(false);
  const rangePopoverRef = useRef<HTMLDivElement>(null);

  // Derive dynamic upper bound from actual active data
  const dataMaxAmount = useMemo(() => {
    const highest = Math.max(
      kpis?.maxOutstanding || 0,
      ...customers.map((c) => c.totalOutstanding || 0),
      100000
    );
    return Math.ceil(highest / 50000) * 50000;
  }, [kpis?.maxOutstanding, customers]);

  const [sliderValue, setSliderValue] = useState<[number, number]>([0, 100000]);

  // Keep sliderValue in sync with bounds and min/max inputs
  useEffect(() => {
    const curMin = minAmount ? Number(minAmount) : 0;
    const curMax = maxAmount ? Number(maxAmount) : dataMaxAmount;
    setSliderValue([Math.max(0, curMin), Math.min(dataMaxAmount, Math.max(curMin, curMax))]);
  }, [minAmount, maxAmount, dataMaxAmount]);

  // Close range popover on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rangePopoverRef.current && !rangePopoverRef.current.contains(event.target as Node)) {
        setRangePopoverOpen(false);
      }
    }
    if (rangePopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [rangePopoverOpen]);

  const isRangeFiltered = Boolean(minAmount || maxAmount);

  const handleApplyRange = (val: [number, number]) => {
    const nextMin = val[0] > 0 ? String(val[0]) : '';
    const nextMax = val[1] < dataMaxAmount ? String(val[1]) : '';
    setMinAmount(nextMin);
    setMaxAmount(nextMax);
    setPage(1);
  };

  const handleClearRange = () => {
    setMinAmount('');
    setMaxAmount('');
    setSliderValue([0, dataMaxAmount]);
    setPage(1);
  };

  // Sorting & Pagination
  const [sortBy, setSortBy] = useState('outstanding');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Statement Modal State
  const [activeStatementCustomerId, setActiveStatementCustomerId] = useState<string | null>(null);

  // Status & Notes Modal State
  const [statusModalCustomer, setStatusModalCustomer] = useState<RecoveryCustomerRow | null>(null);
  const [modalStatus, setModalStatus] = useState<string>('PENDING_FOLLOW_UP');
  const [modalFollowUpDate, setModalFollowUpDate] = useState<string>('');
  const [modalNotes, setModalNotes] = useState<string>('');
  const [modalActivities, setModalActivities] = useState<ActivityItem[]>([]);
  const [modalSaving, setModalSaving] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Invoices Expand Map
  const [expandedInvoicesCustomerId, setExpandedInvoicesCustomerId] = useState<string | null>(null);

  // Invoice Selection Modal (for explicit selection when customer has multiple invoices)
  const [invoiceSelectionCustomer, setInvoiceSelectionCustomer] = useState<RecoveryCustomerRow | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Main data fetch function
  const fetchQueueData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortOrder,
      });

      if (debouncedSearch) params.set('q', debouncedSearch);
      if (selectedSalesperson) params.set('salesperson', selectedSalesperson);
      if (selectedAging) params.set('aging', selectedAging);
      if (minAmount) params.set('minAmount', minAmount);
      if (maxAmount) params.set('maxAmount', maxAmount);
      if (dueFrom) params.set('dueFrom', dueFrom);
      if (dueTo) params.set('dueTo', dueTo);

      const res = await fetch(`/api/accounts/recovery/queue?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load recovery queue');
      }

      // Filter out any locally released tasks from incoming payload
      const cleanedCustomers = (json.data.customers || []).map((c: RecoveryCustomerRow) => {
        const nextActiveInvoices = (c.invoices || []).filter(
          (inv) => !inv.activeTaskId || !releasedTaskIds.has(inv.activeTaskId)
        );
        const nextOpenInvoices = (c.openInvoices || []).map((inv) => {
          if (inv.activeTaskId && releasedTaskIds.has(inv.activeTaskId)) {
            return {
              ...inv,
              activeTaskId: null,
              isPendingRecovery: false,
              flaggedByName: null,
              flaggedAt: null,
            };
          }
          return inv;
        });

        return {
          ...c,
          invoices: nextActiveInvoices,
          openInvoices: nextOpenInvoices,
          activeTaskCount: nextActiveInvoices.length,
          hasActiveTask: nextActiveInvoices.length > 0,
        };
      });

      setCustomers(cleanedCustomers);
      setKpis(json.data.kpis || null);
      setSalespersons(json.data.salespersons || []);
      setReleaseAllowed(Boolean(json.data.releaseAllowed));
      setTotalCount(json.data.pagination.totalCount || 0);
      setTotalPages(json.data.pagination.totalPages || 1);

      if (isRefresh) {
        toast.success('Recovery queue refreshed');
      }
    } catch (err: any) {
      console.error('[RecoveryQueue Error]', err);
      setError(err.message || 'Error communicating with recovery service');
      toast.error(err.message || 'Error loading recovery queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    page,
    pageSize,
    sortBy,
    sortOrder,
    debouncedSearch,
    selectedSalesperson,
    selectedAging,
    minAmount,
    maxAmount,
    dueFrom,
    dueTo,
    releasedTaskIds,
  ]);

  useEffect(() => {
    fetchQueueData();
  }, [fetchQueueData]);

  // Keyboard navigation for statement drawer dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeStatementCustomerId) {
          setActiveStatementCustomerId(null);
        } else if (statusModalCustomer) {
          setStatusModalCustomer(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeStatementCustomerId, statusModalCustomer]);

  // Dedicated Recovery Queue Sync handler
  const handleSync = async () => {
    setRefreshing(true);
    try {
      const activeInvoiceIds = customers.flatMap((c) =>
        (c.invoices || []).map((i) => i.invoiceId)
      );

      const res = await fetch('/api/accounts/recovery/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'queue',
          invoiceIds: activeInvoiceIds.slice(0, 200),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Sync failed');
      }
      toast.success(json.message || 'Recovery queue synced with live Zoho data');
      await fetchQueueData(false);
    } catch (err: any) {
      console.error('[RecoveryQueue Sync Error]', err);
      toast.error(err.message || 'Failed to sync recovery queue');
    } finally {
      setRefreshing(false);
    }
  };

  // Release an invoice task from recovery
  const handleReleaseInvoice = async (taskId: string, invoiceNumber: string) => {
    setActionLoadingInvoiceId(taskId);
    setReleasedTaskIds((prev) => new Set(prev).add(taskId));

    // Optimistic UI state update: immediately remove released task line item & customer if no active tasks remain
    setCustomers((prevCustomers) =>
      prevCustomers
        .map((cust) => {
          const hasTask =
            cust.invoices?.some((i) => i.activeTaskId === taskId) ||
            cust.openInvoices?.some((i) => i.activeTaskId === taskId);
          if (!hasTask) return cust;

          const nextActiveInvoices = (cust.invoices || []).filter((i) => i.activeTaskId !== taskId);
          const nextOpenInvoices = (cust.openInvoices || []).map((i) => {
            if (i.activeTaskId === taskId) {
              return {
                ...i,
                activeTaskId: null,
                isPendingRecovery: false,
                flaggedByName: null,
                flaggedAt: null,
              };
            }
            return i;
          });
          const nextActiveCount = nextActiveInvoices.length;

          return {
            ...cust,
            invoices: nextActiveInvoices,
            openInvoices: nextOpenInvoices,
            activeTaskCount: nextActiveCount,
            hasActiveTask: nextActiveCount > 0,
          };
        })
        .filter((cust) => cust.hasActiveTask && (cust.activeTaskCount ?? 0) > 0)
    );

    // Also optimistically update invoiceSelectionCustomer modal state if open
    setInvoiceSelectionCustomer((prev) => {
      if (!prev) return null;
      const nextActiveInvoices = (prev.invoices || []).filter((i) => i.activeTaskId !== taskId);
      const nextOpenInvoices = (prev.openInvoices || []).map((i) => {
        if (i.activeTaskId === taskId) {
          return {
            ...i,
            activeTaskId: null,
            isPendingRecovery: false,
            flaggedByName: null,
            flaggedAt: null,
          };
        }
        return i;
      });
      const nextActiveCount = nextActiveInvoices.length;
      return {
        ...prev,
        invoices: nextActiveInvoices,
        openInvoices: nextOpenInvoices,
        activeTaskCount: nextActiveCount,
        hasActiveTask: nextActiveCount > 0,
      };
    });

    try {
      const res = await fetch('/api/accounts/recovery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, action: 'release' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to release invoice');
      }
      toast.success(`Released invoice ${invoiceNumber} from recovery`);
      fetchQueueData(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to release invoice');
      fetchQueueData(false);
    } finally {
      setActionLoadingInvoiceId(null);
    }
  };

  // Flag / Mark an invoice as Pending Recovery
  const handlePendingInvoice = async (inv: InvoiceSummaryItem, cust: RecoveryCustomerRow) => {
    setActionLoadingInvoiceId(inv.invoiceId);
    try {
      const res = await fetch('/api/accounts/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: inv.invoiceId,
          invoiceNumber: inv.invoiceNumber,
          customerId: cust.customerId,
          customerName: cust.customerName,
          lastKnownPendingAmount: inv.amountPending,
          lastKnownInvoiceStatus: inv.paymentStatus,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to flag invoice');
      }
      toast.success(`Flagged invoice ${inv.invoiceNumber} as pending recovery`);
      fetchQueueData(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to flag invoice');
    } finally {
      setActionLoadingInvoiceId(null);
    }
  };

  // Download Report handler (reusing authoritative batch PDF generator)
  const handleDownloadReport = async () => {
    if (downloadingReport) return;
    setDownloadingReport(true);
    setDownloadProgress(null);

    try {
      // 1. Fetch complete filtered dataset matching current active filters and sorting across all pages
      const params = new URLSearchParams({
        all: 'true',
        sortBy,
        sortOrder,
      });

      if (debouncedSearch) params.set('q', debouncedSearch);
      if (selectedSalesperson) params.set('salesperson', selectedSalesperson);
      if (selectedAging) params.set('aging', selectedAging);
      if (minAmount) params.set('minAmount', minAmount);
      if (maxAmount) params.set('maxAmount', maxAmount);
      if (dueFrom) params.set('dueFrom', dueFrom);
      if (dueTo) params.set('dueTo', dueTo);

      const res = await fetch(`/api/accounts/recovery/queue?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to fetch filtered recovery records');
      }

      // Filter out any locally released tasks
      const allFiltered: RecoveryCustomerRow[] = (json.data?.customers || [])
        .map((c: RecoveryCustomerRow) => {
          const nextActiveInvoices = (c.invoices || []).filter(
            (inv) => !inv.activeTaskId || !releasedTaskIds.has(inv.activeTaskId)
          );
          return {
            ...c,
            invoices: nextActiveInvoices,
            activeTaskCount: nextActiveInvoices.length,
            hasActiveTask: nextActiveInvoices.length > 0,
          };
        })
        .filter((c: RecoveryCustomerRow) => c.hasActiveTask && (c.activeTaskCount ?? 0) > 0);

      if (allFiltered.length === 0) {
        toast.error('No customers match the current filter criteria to export');
        return;
      }

      const batchInputs: BatchRecoveryCustomerInput[] = allFiltered.map((c) => ({
        customerId: c.customerId,
        customerName: c.customerName,
        totalOutstanding: c.totalOutstanding,
        invoiceCount: c.invoices.length,
        oldestDue: c.oldestOverdueDays,
        invoices: (c.invoices || []).map((inv) => ({
          task: {
            invoiceId: inv.invoiceId,
            invoiceNumber: inv.invoiceNumber,
            flaggedByName: inv.flaggedByName,
            flaggedAt: inv.flaggedAt,
            lastKnownPendingAmount: inv.amountPending,
          },
          inv: {
            invoiceId: inv.invoiceId,
            invoiceNumber: inv.invoiceNumber,
            invoiceValue: inv.invoiceValue,
            amountPaid: inv.amountPaid,
            amountPending: inv.amountPending,
            paymentStatus: inv.paymentStatus,
            isOverdue: inv.isOverdue,
            overdueDays: inv.overdueDays,
          },
          pending: inv.amountPending,
          ageDays: inv.overdueDays,
          invoiceDate: inv.invoiceDate,
        })),
      }));

      setDownloadProgress({ current: 0, total: batchInputs.length, failures: [] });

      await generateRecoveryReportPdf(batchInputs, {
        refreshedBy: 'Admin',
        onProgress: setDownloadProgress,
      });
    } catch (err: any) {
      console.error('[Download Report Error]', err);
      toast.error(err.message || 'Failed to generate report');
    } finally {
      setDownloadingReport(false);
      setTimeout(() => setDownloadProgress(null), 4000);
    }
  };

  // Backward compatibility alias for tests and external callers
  const handleExport = handleDownloadReport;

  // Open status modal
  const handleOpenStatusModal = async (cust: RecoveryCustomerRow) => {
    setStatusModalCustomer(cust);
    setModalStatus(cust.recoveryStatus || 'PENDING_FOLLOW_UP');
    setModalFollowUpDate(cust.nextFollowUpDate ? cust.nextFollowUpDate.split('T')[0] : '');
    setModalNotes(cust.internalNotes || '');
    setModalActivities([]);
    setLoadingActivities(true);

    try {
      const res = await fetch(`/api/accounts/recovery/record?customerId=${cust.customerId}`);
      const json = await res.json();
      if (json.success && json.data?.activities) {
        setModalActivities(json.data.activities);
      }
    } catch (e) {
      console.warn('Failed to load activity history', e);
    } finally {
      setLoadingActivities(false);
    }
  };

  // Save status & notes
  const handleSaveStatusModal = async () => {
    if (!statusModalCustomer) return;
    setModalSaving(true);

    try {
      const res = await fetch('/api/accounts/recovery/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: statusModalCustomer.customerId,
          customerName: statusModalCustomer.customerName,
          status: modalStatus,
          nextFollowUpDate: modalFollowUpDate ? new Date(modalFollowUpDate).toISOString() : null,
          internalNotes: modalNotes.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to save recovery update');
      }

      toast.success('Recovery record updated');
      setStatusModalCustomer(null);
      // Refresh current table view to reflect update
      fetchQueueData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save changes');
    } finally {
      setModalSaving(false);
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setSelectedSalesperson('');
    setSelectedAging('');
    handleClearRange();
    setDueFrom('');
    setDueTo('');
    setPage(1);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (debouncedSearch) count++;
    if (selectedSalesperson) count++;
    if (selectedAging) count++;
    if (minAmount || maxAmount) count++;
    if (dueFrom || dueTo) count++;
    return count;
  }, [debouncedSearch, selectedSalesperson, selectedAging, minAmount, maxAmount, dueFrom, dueTo]);

  const activeInvoiceCustomer = useMemo(() => {
    if (!invoiceSelectionCustomer) return null;
    return customers.find((c) => c.customerId === invoiceSelectionCustomer.customerId) || invoiceSelectionCustomer;
  }, [invoiceSelectionCustomer, customers]);

  return (
    <div className="w-full flex flex-col gap-6 font-sans">
      {/* ── 1. Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-[#1A2766] tracking-tight">Recovery Queue</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
              Receivables Workspace
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative outstanding recovery tracking, aging analysis, and persistent follow-up management
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {kpis?.lastRefreshedAt && (
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
              Last Synced:{' '}
              {new Date(kpis.lastRefreshedAt).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          )}

          <button
            onClick={handleSync}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            title="Sync recovery queue customer balances from Zoho Books"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-[#1A2766]' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
          </button>

          <button
            onClick={handleDownloadReport}
            disabled={loading || downloadingReport || totalCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#1A2766] hover:bg-[#25368a] text-white transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            title="Download full filtered recovery report (PDF)"
          >
            {downloadingReport ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            <span>
              {downloadingReport && downloadProgress
                ? `Generating (${downloadProgress.current}/${downloadProgress.total})...`
                : 'Download Report'}
            </span>
          </button>
        </div>
      </div>

      {/* Batch PDF Progress UI */}
      {downloadProgress && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-col gap-1.5 animate-in fade-in duration-200">
          <div className="flex justify-between items-center text-xs font-semibold text-blue-900">
            <span>
              {downloadingReport
                ? 'Generating Portfolio Recovery Report PDF...'
                : 'Report Download Ready'}
            </span>
            <span className="text-blue-700 font-bold">
              {downloadProgress.current} / {downloadProgress.total} Customers
            </span>
          </div>
          <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-[#1A2766] h-2 transition-all duration-300"
              style={{
                width: `${Math.round(
                  (downloadProgress.current / Math.max(1, downloadProgress.total)) * 100
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* ── 2. Executive KPI Dashboard ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Outstanding */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Total Outstanding</span>
              <div
                className="cursor-pointer text-slate-400 hover:text-slate-600"
                title="Net Customer Receivables based on authoritative Customer Statement closing balances across active recovery accounts."
              >
                <Info size={12} />
              </div>
            </div>
            <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <TrendingDown size={15} />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-700 tracking-tight">
            {formatINR(kpis?.totalOutstanding || 0)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Net Customer Receivables</span>
            <span className="font-semibold text-slate-700">{kpis?.totalCustomers || 0} active accounts</span>
          </div>
          <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
        </div>

        {/* Total Overdue */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Total Overdue</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock size={15} />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700 tracking-tight">
            {formatINR(kpis?.totalOverdue || 0)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {kpis && kpis.totalOutstanding > 0 && kpis.totalOverdue > 0
              ? `${Math.round((kpis.totalOverdue / kpis.totalOutstanding) * 100)}% of active outstanding`
              : 'Past invoice due dates'}
          </div>
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
        </div>

        {/* Outstanding Invoices */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Active Invoices</span>
            <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600">
              <FileSpreadsheet size={15} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {kpis?.totalInvoices || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Eligible invoices flagged for recovery
          </div>
          <div className="absolute top-0 left-0 w-1 h-full bg-[#1A2766]" />
        </div>

        {/* Oldest Overdue Invoice */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">Oldest Overdue</span>
            <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
              <AlertTriangle size={15} />
            </div>
          </div>
          {kpis?.oldestOverdue ? (
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-red-700">{kpis.oldestOverdue.overdueDays}d</span>
                <span className="text-xs text-slate-500 font-semibold truncate max-w-[150px]">
                  {kpis.oldestOverdue.invoiceNumber}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 truncate mt-1" title={kpis.oldestOverdue.customerName}>
                {kpis.oldestOverdue.customerName} • {formatINR(kpis.oldestOverdue.amountPending)}
              </div>
            </div>
          ) : (
            <div className="text-sm font-semibold text-slate-400 mt-2">No overdue invoices</div>
          )}
          <div className="absolute top-0 left-0 w-1 h-full bg-[#AE1B1E]" />
        </div>
      </div>

      {/* ── 3. Aging Summary Breakdown ── */}
      {kpis?.agingSummary && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-[#1A2766]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Receivables Aging Buckets — Outstanding Invoice Balances
              </h3>
              <div
                className="cursor-pointer text-slate-400 hover:text-slate-600"
                title="Aging buckets reflect gross outstanding amounts of active flagged invoices. Net Customer Receivables reflects customer-level statement closing balances."
              >
                <Info size={13} />
              </div>
            </div>
            <span className="text-[11px] text-slate-400">
              Due date aging across active recovery invoices ({formatINR(Object.values(kpis.agingSummary).reduce((s, b) => s + b.amount, 0))} across {Object.values(kpis.agingSummary).reduce((s, b) => s + b.count, 0)} inv{kpis.advanceInvoices && kpis.advanceInvoices.count > 0 ? ` · ${kpis.advanceInvoices.count} advance account inv excluded` : ''})
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['0-30', '31-60', '61-90', '90+'] as AgingBucketKey[]).map((bucket) => {
              const item = kpis.agingSummary[bucket] || { amount: 0, count: 0 };
              const percent = kpis.totalOutstanding > 0 ? (item.amount / kpis.totalOutstanding) * 100 : 0;
              const isSelected = selectedAging === bucket;

              return (
                <div
                  key={bucket}
                  onClick={() => {
                    setSelectedAging(isSelected ? '' : bucket);
                    setPage(1);
                  }}
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#1A2766] bg-blue-50/50 shadow-xs'
                      : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-700">{bucket} Days</span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {item.count} inv
                    </span>
                  </div>
                  <div className="text-base font-black text-slate-900">{formatINR(item.amount)}</div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full rounded-full ${
                        bucket === '0-30'
                          ? 'bg-emerald-500'
                          : bucket === '31-60'
                          ? 'bg-yellow-500'
                          : bucket === '61-90'
                          ? 'bg-orange-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 text-right">{percent.toFixed(1)}% of total</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 4. Filter Toolbar & Sorting ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Field */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search customer name, GST, or invoice number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1A2766] focus:bg-white transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick Filter Dropdowns */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Salesperson */}
            <select
              value={selectedSalesperson}
              onChange={(e) => {
                setSelectedSalesperson(e.target.value);
                setPage(1);
              }}
              className="text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-[#1A2766] cursor-pointer"
            >
              <option value="">All Salespersons</option>
              {salespersons.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {/* Aging Bucket */}
            <select
              value={selectedAging}
              onChange={(e) => {
                setSelectedAging(e.target.value as AgingBucketKey | '');
                setPage(1);
              }}
              className="text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-[#1A2766] cursor-pointer"
            >
              <option value="">All Aging Buckets</option>
              <option value="0-30">0–30 Days</option>
              <option value="31-60">31–60 Days</option>
              <option value="61-90">61–90 Days</option>
              <option value="90+">90+ Days</option>
            </select>

            {/* Outstanding Amount Dual-Thumb Range Slider Popover */}
            <div className="relative" ref={rangePopoverRef}>
              <button
                type="button"
                onClick={() => setRangePopoverOpen(!rangePopoverOpen)}
                className={`text-xs px-2.5 py-2 border rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors ${
                  isRangeFiltered
                    ? 'bg-blue-50 border-[#1A2766] text-[#1A2766] font-bold shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                title="Filter by net outstanding amount range"
              >
                <SlidersHorizontal size={13} className={isRangeFiltered ? 'text-[#1A2766]' : 'text-slate-500'} />
                <span>
                  {isRangeFiltered
                    ? `${formatINR(sliderValue[0])} – ${formatINR(sliderValue[1])}`
                    : 'Outstanding Amount'}
                </span>
                <ChevronDown
                  size={11}
                  className={`text-slate-400 transition-transform ${rangePopoverOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {rangePopoverOpen && (
                <div className="absolute left-0 top-full mt-1.5 z-40 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <SlidersHorizontal size={13} className="text-[#1A2766]" />
                      <span>Outstanding Range Filter</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setRangePopoverOpen(false)}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <DualRangeSlider
                    min={0}
                    max={dataMaxAmount}
                    step={1000}
                    value={sliderValue}
                    onChange={setSliderValue}
                    onChangeCommit={handleApplyRange}
                    formatValue={formatINR}
                  />

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400">
                      Drag thumbs or pick preset
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        handleApplyRange(sliderValue);
                        setRangePopoverOpen(false);
                      }}
                      className="px-3 py-1 bg-[#1A2766] hover:bg-[#25368a] text-white rounded text-xs font-semibold cursor-pointer shadow-xs"
                    >
                      Apply Range
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sort Control */}
            <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="text-xs px-2.5 py-2 bg-transparent text-slate-700 focus:outline-none cursor-pointer border-r border-slate-200"
              >
                <option value="outstanding">Outstanding Amount</option>
                <option value="overdueAmount">Overdue Amount</option>
                <option value="overdueDays">Overdue Days</option>
                <option value="oldestDue">Oldest Due Date</option>
                <option value="customerName">Customer Name</option>
                <option value="invoiceCount">Invoice Count</option>
                <option value="nextFollowUp">Follow-up Date</option>
                <option value="lastActivity">Last Activity</option>
              </select>

              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-2 py-2 text-slate-600 hover:text-slate-900 bg-white"
                title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
              >
                <ArrowUpDown size={13} className={sortOrder === 'asc' ? 'rotate-180' : ''} />
              </button>
            </div>
          </div>
        </div>

        {/* Active Filter Badges */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Filters:</span>

            {debouncedSearch && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                Search: {debouncedSearch}
                <X size={12} className="cursor-pointer" onClick={() => setSearchTerm('')} />
              </span>
            )}

            {selectedSalesperson && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                Salesperson: {selectedSalesperson}
                <X size={12} className="cursor-pointer" onClick={() => setSelectedSalesperson('')} />
              </span>
            )}

            {selectedAging && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                Aging: {selectedAging}d
                <X size={12} className="cursor-pointer" onClick={() => setSelectedAging('')} />
              </span>
            )}

            {(minAmount || maxAmount) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                Net Outstanding:{' '}
                {minAmount ? `≥ ₹${Number(minAmount).toLocaleString('en-IN')}` : ''}
                {minAmount && maxAmount ? ' & ' : ''}
                {maxAmount ? `≤ ₹${Number(maxAmount).toLocaleString('en-IN')}` : ''}
                <X
                  size={12}
                  className="cursor-pointer"
                  onClick={() => {
                    handleClearRange();
                    setPage(1);
                  }}
                />
              </span>
            )}

            <button
              onClick={handleResetFilters}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-800 ml-auto cursor-pointer"
            >
              Clear All ({activeFilterCount})
            </button>
          </div>
        )}
      </div>

      {/* ── 5. Main Customer Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <Loader2 size={28} className="animate-spin text-[#1A2766]" />
            <p className="text-xs font-semibold text-slate-500">Loading recovery queue...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <AlertCircle size={28} className="text-rose-600" />
            <p className="text-sm font-bold text-slate-800">{error}</p>
            <button
              onClick={() => fetchQueueData()}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#1A2766] text-white hover:bg-[#25368a]"
            >
              Retry Loading
            </button>
          </div>
        ) : customers.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <CheckCircle2 size={24} />
            </div>
            <h4 className="text-sm font-bold text-slate-800">No customers found</h4>
            <p className="text-xs text-slate-500 max-w-sm">
              {activeFilterCount > 0
                ? 'No customers match the current filter criteria. Try adjusting or clearing filters.'
                : 'There are currently no eligible customers with open recovery balances.'}
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="mt-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-2.5 text-center w-10">#</th>
                  <th className="py-2.5 px-3 min-w-[170px]">Customer Name</th>
                  <th className="py-2.5 px-3 min-w-[130px]">GSTIN</th>
                  <th className="py-2.5 px-3 text-right">Total Outstanding</th>
                  <th className="py-2.5 px-3 text-right">Overdue Amount</th>
                  <th className="py-2.5 px-2.5 text-center">Invoices</th>
                  <th className="py-2.5 px-2.5 text-center">Oldest Due</th>
                  <th className="py-2.5 px-2.5 text-center">Aging</th>
                  <th className="py-2.5 px-3">Salesperson</th>
                  <th className="py-2.5 px-3 text-right min-w-[140px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((cust, idx) => {
                  const agingStyle =
                    AGING_BADGE_MAP[cust.overallAgingBucket] || AGING_BADGE_MAP['0-30'];
                  const isExpanded = expandedInvoicesCustomerId === cust.customerId;
                  const rowIndex = (page - 1) * pageSize + idx + 1;

                  return (
                    <React.Fragment key={cust.customerId}>
                      <tr className="hover:bg-slate-50/70 transition-colors group">
                        {/* Row Index */}
                        <td className="py-2.5 px-2.5 text-center font-mono text-[11px] text-slate-400 font-semibold">
                          {rowIndex}
                        </td>

                        {/* Customer Name */}
                        <td className="py-2.5 px-3">
                          {cust.customerId ? (
                            <a
                              href={getZohoContactUrl(cust.customerId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-slate-900 leading-tight hover:text-blue-600 hover:underline inline-flex items-center gap-1 group/link"
                              title="Open customer in Zoho Books"
                            >
                              <span>{cust.customerName}</span>
                              <ExternalLink size={10} className="opacity-0 group-hover/link:opacity-100 text-blue-600 transition-opacity" />
                            </a>
                          ) : (
                            <span className="font-bold text-slate-900 leading-tight">
                              {cust.customerName}
                            </span>
                          )}
                        </td>

                        {/* GSTIN */}
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {cust.customerGst ? (
                            <span title={cust.customerGst}>{cust.customerGst}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Total Outstanding */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {cust.isAdvance ? (
                            <div className="flex flex-col items-end">
                              <span className="font-black text-slate-700 text-xs">₹0.00</span>
                              <span
                                className="text-[9.5px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-medium mt-0.5 border border-emerald-200"
                                title="Customer has a net advance / credit balance"
                              >
                                Advance: {formatINR(cust.netPayableBalance || 0)}
                              </span>
                            </div>
                          ) : (
                            <span className="font-black text-rose-700 text-xs font-mono">
                              {formatINR(cust.totalOutstanding)}
                            </span>
                          )}
                        </td>

                        {/* Overdue Amount */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-xs">
                          {cust.overdueAmount > 0 ? (
                            <span className="font-black text-amber-700">
                              {formatINR(cust.overdueAmount)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">₹0.00</span>
                          )}
                        </td>

                        {/* Invoice Count */}
                        <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                          <button
                            onClick={() =>
                              setExpandedInvoicesCustomerId(isExpanded ? null : cust.customerId)
                            }
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[11px] transition-colors cursor-pointer ${
                              isExpanded
                                ? 'bg-[#1A2766] text-white'
                                : cust.hasActiveTask
                                ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                            title={isExpanded ? 'Hide invoice details' : 'Click to view & manage invoice recovery tasks'}
                          >
                            {cust.hasActiveTask && <Flag size={8} className="fill-amber-700 text-amber-700" />}
                            <span>{cust.invoiceCount}</span>
                          </button>
                        </td>

                        {/* Oldest Due Days */}
                        <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                          {cust.oldestOverdueDays > 0 ? (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              {cust.oldestOverdueDays}d
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium text-[10.5px]">Current</span>
                          )}
                        </td>

                        {/* Aging Badge */}
                        <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.2 rounded-md text-[10px] font-bold border ${agingStyle.bg} ${agingStyle.text} ${agingStyle.border}`}
                          >
                            {cust.overallAgingBucket}d
                          </span>
                        </td>

                        {/* Salesperson */}
                        <td className="py-2.5 px-3 text-slate-700 text-xs truncate max-w-[120px]" title={cust.salesperson || 'Unassigned'}>
                          {cust.salesperson || <span className="text-slate-400 italic">Unassigned</span>}
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Invoice-scoped Action: Explicit single-invoice or selector */}
                            {(() => {
                              const allInvs = (cust.openInvoices && cust.openInvoices.length > 0) ? cust.openInvoices : cust.invoices;
                              if (allInvs.length === 1) {
                                const inv = allInvs[0];
                                const isPending = inv.isPendingRecovery || cust.hasActiveTask;
                                const taskId = inv.activeTaskId || cust.invoices[0]?.activeTaskId;

                                if (isPending) {
                                  return (
                                    <div className="flex items-center gap-1">
                                      <span
                                        title={`Flagged for recovery`}
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9.5px] font-bold rounded border border-amber-200"
                                      >
                                        <Flag size={8} className="fill-amber-600 text-amber-600" />
                                        <span>Pending Release</span>
                                      </span>
                                      {releaseAllowed && taskId && (
                                        <button
                                          onClick={() => handleReleaseInvoice(taskId, inv.invoiceNumber)}
                                          disabled={actionLoadingInvoiceId !== null}
                                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                                          title={`Release invoice ${inv.invoiceNumber} from recovery queue`}
                                        >
                                          {actionLoadingInvoiceId === taskId ? (
                                            <Loader2 size={10} className="animate-spin" />
                                          ) : (
                                            <CheckCheck size={11} />
                                          )}
                                          <span>Release</span>
                                        </button>
                                      )}
                                    </div>
                                  );
                                } else {
                                  return (
                                    <button
                                      onClick={() => handlePendingInvoice(inv, cust)}
                                      disabled={actionLoadingInvoiceId !== null}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10.5px] font-semibold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                                      title={`Flag invoice ${inv.invoiceNumber} as pending recovery`}
                                    >
                                      {actionLoadingInvoiceId === inv.invoiceId ? (
                                        <Loader2 size={10} className="animate-spin" />
                                      ) : (
                                        <Flag size={10} />
                                      )}
                                      <span>Flag Invoice</span>
                                    </button>
                                  );
                                }
                              } else if (allInvs.length > 1) {
                                return (
                                  <div className="flex items-center gap-1">
                                    {cust.hasActiveTask && (
                                      <span
                                        title={`${cust.activeTaskCount} invoice(s) currently pending release`}
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9.5px] font-bold rounded border border-amber-200"
                                      >
                                        <Flag size={8} className="fill-amber-600 text-amber-600" />
                                        <span>{cust.activeTaskCount} Pending</span>
                                      </span>
                                    )}
                                    <button
                                      onClick={() => setInvoiceSelectionCustomer(cust)}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10.5px] font-semibold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
                                      title={`Select an open invoice for ${cust.customerName} to flag or release`}
                                    >
                                      <Flag size={10} />
                                      <span>Flag Invoice</span>
                                      <ChevronDown size={10} className="text-slate-400" />
                                    </button>
                                  </div>
                                );
                              }
                              return null;
                            })()}

                            {/* Customer Statement Button */}
                            <button
                              onClick={() => setActiveStatementCustomerId(cust.customerId)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-[#1A2766] text-white hover:bg-[#25368a] transition-colors shadow-2xs cursor-pointer"
                              title="Open Customer Statement"
                            >
                              <FileText size={11} />
                              <span>Statement</span>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Invoices List */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-y border-slate-200">
                          <td colSpan={10} className="p-3">
                            <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-xs">
                              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                    Active Recovery Tasks for {cust.customerName} ({cust.invoices.length})
                                  </span>
                                  {cust.hasActiveTask && (
                                    <span className="text-[9.5px] font-bold px-1.5 py-0.2 bg-amber-50 text-amber-800 border border-amber-200 rounded">
                                      {cust.activeTaskCount} Pending Release
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-[11px] text-slate-500">
                                    Total Statement Balance: <strong className="text-slate-800">{formatINR(cust.netBalance ?? cust.totalOutstanding)}</strong>
                                  </span>
                                  <button
                                    onClick={() => setInvoiceSelectionCustomer(cust)}
                                    className="px-2 py-0.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-[10.5px] font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
                                    title="Add more open invoices to recovery"
                                  >
                                    <Flag size={9} />
                                    <span>+ Flag Invoices</span>
                                  </button>
                                </div>
                              </div>

                              {cust.invoices.length === 0 ? (
                                <div className="py-6 text-center text-slate-400 flex flex-col items-center justify-center gap-1.5 text-xs">
                                  <CheckCircle2 size={20} className="text-emerald-500" />
                                  <span className="font-semibold text-slate-700">No active recovery tasks for this customer</span>
                                  <span className="text-[11px] text-slate-400">All flagged invoices have been released, or none have been flagged yet.</span>
                                  <button
                                    onClick={() => setInvoiceSelectionCustomer(cust)}
                                    className="mt-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold cursor-pointer"
                                  >
                                    Flag an Open Invoice
                                  </button>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {cust.invoices.map((inv) => (
                                    <div
                                      key={inv.invoiceId}
                                      className="p-2.5 rounded border border-amber-300 bg-amber-50/40 transition-colors flex flex-col justify-between gap-1.5 text-[11px]"
                                    >
                                      <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold text-slate-900">{inv.invoiceNumber}</span>
                                          <span
                                            title={`Flagged by ${inv.flaggedByName || 'Staff'} on ${inv.flaggedAt ? new Date(inv.flaggedAt).toLocaleDateString('en-IN') : 'N/A'}`}
                                            className="inline-flex items-center gap-0.5 px-1 py-0.2 bg-amber-100 text-amber-800 text-[8.5px] font-bold rounded border border-amber-200"
                                          >
                                            <Flag size={8} className="fill-amber-600 text-amber-600" />
                                            Pending Release
                                          </span>
                                        </div>
                                        <span className="font-black text-rose-700 font-mono">{formatINR(inv.amountPending)}</span>
                                      </div>

                                      <div className="flex justify-between text-slate-400 text-[10px]">
                                        <span>Date: {inv.invoiceDate}</span>
                                        <span>Due: {inv.dueDate || 'N/A'}</span>
                                      </div>

                                      <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded font-bold bg-slate-200 text-slate-700">
                                            {inv.paymentStatus}
                                          </span>
                                          {inv.overdueDays > 0 && (
                                            <span className="text-[10px] text-amber-700 font-bold">
                                              {inv.overdueDays}d overdue
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-1">
                                          {releaseAllowed && inv.activeTaskId && (
                                            <button
                                              onClick={() => handleReleaseInvoice(inv.activeTaskId!, inv.invoiceNumber)}
                                              disabled={actionLoadingInvoiceId === inv.activeTaskId}
                                              className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded text-[9.5px] font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                              title="Release invoice from recovery queue"
                                            >
                                              {actionLoadingInvoiceId === inv.activeTaskId ? (
                                                <Loader2 size={10} className="animate-spin" />
                                              ) : (
                                                <CheckCheck size={10} />
                                              )}
                                              <span>Release</span>
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 6. Pagination Footer ── */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setPage(1);
              }}
              className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <span className="ml-2 font-medium">
              Showing {totalCount === 0 ? 0 : (page - 1) * pageSize + 1} to{' '}
              {Math.min(page * pageSize, totalCount)} of {totalCount} customers
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="p-1 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="px-3 py-1 font-bold text-slate-700">
              Page {page} of {totalPages || 1}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              title="Next Page"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              className="p-1 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── 7. Right-Side Customer Statement Modal Drawer ── */}
      {activeStatementCustomerId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setActiveStatementCustomerId(null)}
          />

          {/* Drawer Body */}
          <div className="relative w-full max-w-4xl h-full bg-white shadow-2xl flex flex-col z-10 border-l border-slate-200 animate-in slide-in-from-right duration-300 overflow-y-auto p-4 sm:p-6">
            <CustomerStatementView
              initialCustomerId={activeStatementCustomerId}
              isModal={true}
              onClose={() => setActiveStatementCustomerId(null)}
            />
          </div>
        </div>
      )}

      {/* ── 8. Status & Notes Update Modal ── */}
      {statusModalCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setStatusModalCustomer(null)}
          />

          {/* Modal Container */}
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 z-10 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-[#1A2766] text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Update Recovery Details</h3>
                <p className="text-xs text-white/70 truncate max-w-xs">
                  {statusModalCustomer.customerName}
                </p>
              </div>
              <button
                onClick={() => setStatusModalCustomer(null)}
                className="text-white/70 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Financial Snapshot */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Outstanding</span>
                  <span className="text-sm font-black text-rose-700">
                    {formatINR(statusModalCustomer.totalOutstanding)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Open Invoices</span>
                  <span className="text-sm font-bold text-slate-800">
                    {statusModalCustomer.invoiceCount}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Oldest Due</span>
                  <span className="text-sm font-bold text-amber-700">
                    {statusModalCustomer.oldestOverdueDays}d
                  </span>
                </div>
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Recovery Status</label>
                <select
                  value={modalStatus}
                  onChange={(e) => setModalStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1A2766] cursor-pointer"
                >
                  {RECOVERY_STATUSES.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Next Follow-up Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Next Follow-up Date (Optional)
                </label>
                <input
                  type="date"
                  value={modalFollowUpDate}
                  onChange={(e) => setModalFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1A2766]"
                />
              </div>

              {/* Internal Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Internal Recovery Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Record customer commitments, dispute notes, call summaries, etc..."
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#1A2766]"
                />
              </div>

              {/* Activity History Timeline */}
              <div className="pt-2 border-t border-slate-200">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Activity History
                </span>
                {loadingActivities ? (
                  <div className="py-4 text-center text-slate-400">Loading history...</div>
                ) : modalActivities.length === 0 ? (
                  <p className="text-slate-400 italic">No previous recovery activity recorded.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {modalActivities.map((act) => (
                      <div key={act.id} className="p-2 rounded bg-slate-50 border border-slate-100 text-[11px]">
                        <div className="flex justify-between items-center text-slate-500">
                          <span className="font-bold text-slate-700">{act.performedByName}</span>
                          <span className="text-[10px]">
                            {new Date(act.createdAt).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                        <p className="text-slate-800 mt-0.5">{act.description}</p>
                        {act.notes && (
                          <p className="text-slate-500 italic mt-0.5 bg-white p-1 rounded border border-slate-100">
                            &ldquo;{act.notes}&rdquo;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setStatusModalCustomer(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStatusModal}
                disabled={modalSaving}
                className="px-4 py-1.5 rounded-lg bg-[#1A2766] hover:bg-[#25368a] text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {modalSaving && <Loader2 size={13} className="animate-spin" />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 9. Invoice Selection Modal (Select Specific Invoice to Flag / Release) ── */}
      {activeInvoiceCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setInvoiceSelectionCustomer(null)}
          />
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 z-10 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-5 py-3.5 bg-[#1A2766] text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <Flag size={14} className="text-amber-400 fill-amber-400" />
                  <span>Flag Invoices for Recovery</span>
                </h3>
                <p className="text-xs text-white/70 truncate max-w-md">
                  {activeInvoiceCustomer.customerName} • {((activeInvoiceCustomer.openInvoices && activeInvoiceCustomer.openInvoices.length > 0) ? activeInvoiceCustomer.openInvoices : activeInvoiceCustomer.invoices).length} open invoice{((activeInvoiceCustomer.openInvoices && activeInvoiceCustomer.openInvoices.length > 0) ? activeInvoiceCustomer.openInvoices : activeInvoiceCustomer.invoices).length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setInvoiceSelectionCustomer(null)}
                className="text-white/70 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Invoices List / Table */}
            <div className="p-4 overflow-y-auto space-y-2 text-xs">
              <p className="text-slate-500 text-[11px] mb-2">
                Select an invoice below to flag it as pending recovery or release it from the queue:
              </p>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2 px-3">Invoice #</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Due Date</th>
                      <th className="py-2 px-3 text-right">Pending Amount</th>
                      <th className="py-2 px-3 text-center">Status</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {((activeInvoiceCustomer.openInvoices && activeInvoiceCustomer.openInvoices.length > 0)
                      ? activeInvoiceCustomer.openInvoices
                      : activeInvoiceCustomer.invoices
                    ).map((inv) => {
                      const isPending = inv.isPendingRecovery;
                      const isLoading = actionLoadingInvoiceId === (isPending ? inv.activeTaskId : inv.invoiceId);

                      return (
                        <tr key={inv.invoiceId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {inv.invoiceId.startsWith('mock-') ? (
                              inv.invoiceNumber
                            ) : (
                              <a
                                href={`https://books.zoho.in/app/60027595766#/invoices/${inv.invoiceId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-blue-600 hover:underline inline-flex items-center gap-1 font-mono"
                              >
                                {inv.invoiceNumber}
                                <ExternalLink size={10} className="text-slate-400" />
                              </a>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                            {inv.invoiceDate}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                            {inv.dueDate || '-'}
                            {inv.overdueDays > 0 && (
                              <span className="ml-1 text-[10px] font-bold text-amber-700">
                                ({inv.overdueDays}d)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-rose-700 font-mono">
                            {formatINR(inv.amountPending)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isPending ? (
                              <span
                                title={`Flagged by ${inv.flaggedByName || 'Staff'} on ${inv.flaggedAt ? new Date(inv.flaggedAt).toLocaleDateString('en-IN') : 'N/A'}`}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9.5px] font-bold rounded border border-amber-200"
                              >
                                <Flag size={8} className="fill-amber-600 text-amber-600" />
                                <span>Pending Release</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-400 uppercase">
                                Open
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {isPending && inv.activeTaskId && releaseAllowed ? (
                              <button
                                onClick={() => handleReleaseInvoice(inv.activeTaskId!, inv.invoiceNumber)}
                                disabled={actionLoadingInvoiceId !== null}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer disabled:opacity-50"
                                title={`Release invoice ${inv.invoiceNumber} from recovery queue`}
                              >
                                {isLoading ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : (
                                  <CheckCheck size={11} />
                                )}
                                <span>Release</span>
                              </button>
                            ) : !isPending ? (
                              <button
                                onClick={() => handlePendingInvoice(inv, activeInvoiceCustomer)}
                                disabled={actionLoadingInvoiceId !== null}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                                title={`Flag invoice ${inv.invoiceNumber} as pending recovery`}
                              >
                                {isLoading ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : (
                                  <Flag size={11} />
                                )}
                                <span>Flag Invoice</span>
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Total Statement Balance: <strong className="text-slate-800">{formatINR(activeInvoiceCustomer.netBalance ?? activeInvoiceCustomer.totalOutstanding)}</strong>
              </span>
              <button
                onClick={() => setInvoiceSelectionCustomer(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
