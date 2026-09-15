'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Users,
  Banknote,
  AlertTriangle,
  TrendingDown,
  Clock,
  Flag,
  X,
  ExternalLink,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  Layers,
  MapPin,
  Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import MobileAccountsSummarySkeleton from './MobileAccountsSummarySkeleton';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InvoiceRow {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  createdTime: string | null;
  customerName: string;
  customerId: string;
  customerGst: string;
  invoiceValue: number;
  amountPaid: number;
  amountPending: number;
  paymentStatus: 'paid' | 'partially_paid' | 'unpaid' | 'void';
  paymentProgress: number;
  lastPaymentDate: string | null;
  lastRefreshedAt?: string | null;
  salespersonName?: string | null;
  warehouse?: string | null;
}

export interface ExtendedRow extends InvoiceRow {
  isOverdue: boolean;
  isOperationallySettled: boolean;
  resolvedGst: string;
}

interface SummaryMeta {
  fetchedStartDate: string;
  fetchedEndDate: string;
  fetchedRange?: string;
  totalInvoices: number;
  customersBilled: number;
  totalInvoiceValue: number;
  totalCollected: number;
  collectionPercent: number;
  totalPending: number;
  pendingPercent: number;
  fullyPaidCount: number;
  partialPaidCount: number;
  unpaidCount: number;
  voidCount: number;
  avgInvoiceValue: number;
  usingMock?: boolean;
  globalRefreshedAt?: string;
}

interface SnapshotData {
  generatedAt: string;
  apiCallsUsed: number;
  refreshedBy: string;
  invoiceCount: number;
  summary: SummaryMeta;
  distributions: any;
  rows: InvoiceRow[];
}

export interface RecoveryTask {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  status: 'ACTIVE' | 'RELEASED' | 'RESOLVED';
  flaggedByName: string;
  flaggedAt: string;
}

type LookbackPeriod = 'today' | 'yesterday' | '3days' | '7days' | '15days';

const LOOKBACK_OPTIONS: { id: LookbackPeriod; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '3days', label: '3D' },
  { id: '7days', label: '7D' },
  { id: '15days', label: '15D' },
];

// ─── Business Rules & Helpers ─────────────────────────────────────────────────

function isOperationallyOpen(row: InvoiceRow): boolean {
  if (row.paymentStatus === 'paid' || row.paymentStatus === 'void') return false;
  if (row.amountPending <= 0) return false;
  const absPending = Math.abs(row.amountPending);
  if (absPending <= 10) return false;
  if (row.invoiceValue > 100000 && absPending <= 100) return false;
  return true;
}

function getISTDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function getRequiredStart(period: LookbackPeriod): string {
  switch (period) {
    case 'today':     return getISTDate(0);
    case 'yesterday': return getISTDate(1);
    case '3days':     return getISTDate(2);
    case '7days':     return getISTDate(6);
    case '15days':    return getISTDate(14);
  }
}

function formatINR(val: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val || 0);
}

function formatDateDisplay(dateStr: string, createdTime: string | null) {
  try {
    const d = new Date(createdTime || dateStr);
    const date = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
    const time = createdTime
      ? d.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata',
        })
      : null;
    return { date, time };
  } catch {
    return { date: dateStr, time: null };
  }
}

function formatDueDate(dueStr: string | null) {
  if (!dueStr) return null;
  try {
    const d = new Date(dueStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return dueStr;
  }
}

function timeAgo(isoStr: string): string {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MobileAccountsSummaryClient({ userName }: { userName: string }) {
  const router = useRouter();

  // State
  const [data, setData] = useState<SnapshotData | null>(null);
  const [tasks, setTasks] = useState<RecoveryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [lookback, setLookback] = useState<LookbackPeriod>('today');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'paid' | 'overdue'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Collapsible Sections
  const [isKeyExposureOpen, setIsKeyExposureOpen] = useState(false);
  const [isSummaryCountsOpen, setIsSummaryCountsOpen] = useState(false);
  const [isInvoicesSectionOpen, setIsInvoicesSectionOpen] = useState(true);

  // Invoice Detail Modal State
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<any | null>(null);
  const [loadingInvoiceDetail, setLoadingInvoiceDetail] = useState(false);

  // ─── Smart Cache Check ──────────────────────────────────────────────────────
  const cacheCovers = useCallback(
    (period: LookbackPeriod, snapshot: SnapshotData | null): boolean => {
      if (!snapshot?.summary?.fetchedStartDate) return false;
      const required = getRequiredStart(period);
      const today = getISTDate(0);
      return snapshot.summary.fetchedStartDate <= required && snapshot.summary.fetchedEndDate >= today;
    },
    []
  );

  // ─── Fetch Tasks (Pending Release Flags) ────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts/recovery');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setTasks(json.data);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  // ─── Load Initial Cache ─────────────────────────────────────────────────────
  const loadCache = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts/summary');
      const result = await res.json();
      if (result.success && result.data) {
        return result.data as SnapshotData;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // ─── Range Refresh ──────────────────────────────────────────────────────────
  const fetchForRange = useCallback(async (period: LookbackPeriod, silent = false): Promise<void> => {
    const lastGlobalStr = data?.summary?.globalRefreshedAt || data?.generatedAt;
    const diff = lastGlobalStr ? Date.now() - new Date(lastGlobalStr).getTime() : Infinity;
    const cooldownRemaining = Math.max(0, Math.ceil((60000 - diff) / 1000));

    if (cooldownRemaining > 0 && !silent) {
      toast.error(`Refresh available in ${cooldownRemaining}s`);
      return;
    }

    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/accounts/summary/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: period }),
      });
      const result = await res.json();

      if (res.status === 429) {
        if (!silent) toast.error(result.error || 'Refresh budget or rate limit exceeded.');
        return;
      }
      if (res.status === 409) {
        toast.error(result.error || 'Refresh already in progress.');
        return;
      }

      if (result.success && result.data) {
        setData(result.data as SnapshotData);
        if (!silent) toast.success('Dashboard refreshed!', { duration: 2000 });
      } else {
        if (!silent) toast.error(result.error || 'Refresh failed.');
      }
    } catch {
      if (!silent) toast.error('Network error. Please retry.');
    } finally {
      setRefreshing(false);
    }
  }, [data]);

  // ─── Initial Load Lifecycle ─────────────────────────────────────────────────
  const initData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cachedSnapshot] = await Promise.all([loadCache(), fetchTasks()]);
      if (cachedSnapshot) {
        setData(cachedSnapshot);
        // If cache does not cover default 'today', background fetch
        if (!cacheCovers('today', cachedSnapshot)) {
          fetchForRange('today', true);
        }
      } else {
        // First time initialization
        await fetchForRange('today', true);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load Accounts Summary');
    } finally {
      setLoading(false);
    }
  }, [loadCache, fetchTasks, cacheCovers, fetchForRange]);

  useEffect(() => {
    initData();
  }, [initData]);

  // ─── Lookback Switch Handler ────────────────────────────────────────────────
  const handleLookbackChange = (period: LookbackPeriod) => {
    if (period === lookback) return;
    setLookback(period);
    if (!data || !cacheCovers(period, data)) {
      fetchForRange(period, false);
    }
  };

  // ─── Derived Lookback Rows ──────────────────────────────────────────────────
  const lookbackRows: ExtendedRow[] = useMemo(() => {
    if (!data?.rows) return [];
    const today = getISTDate(0);
    const startStr = getRequiredStart(lookback);
    const endStr = lookback === 'yesterday' ? getISTDate(1) : today;

    return data.rows
      .filter((r) => r.invoiceDate >= startStr && r.invoiceDate <= endStr)
      .map((r) => {
        const opOpen = isOperationallyOpen(r);
        const settled = !opOpen && r.paymentStatus !== 'paid' && r.paymentStatus !== 'void';
        const isOverdue =
          opOpen &&
          r.paymentStatus !== 'void' &&
          !!r.dueDate &&
          r.dueDate < today;

        return {
          ...r,
          isOperationallySettled: settled,
          isOverdue,
          resolvedGst: r.customerGst && r.customerGst !== 'N/A' ? r.customerGst : '',
        };
      });
  }, [data, lookback]);

  // ─── KPI Metrics ────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const nonVoid = lookbackRows.filter((r) => r.paymentStatus !== 'void');
    const effectiveOpen = lookbackRows.filter(
      (r) => r.paymentStatus !== 'paid' && r.paymentStatus !== 'void' && !r.isOperationallySettled
    );
    const effectivePaid = lookbackRows.filter((r) => r.paymentStatus === 'paid' || r.isOperationallySettled);
    const totalValue = nonVoid.reduce((s, r) => s + r.invoiceValue, 0);
    const totalCollected = nonVoid.reduce((s, r) => s + r.amountPaid, 0);
    const totalPending = effectiveOpen.reduce((s, r) => s + r.amountPending, 0);
    const totalInvoices = nonVoid.length;
    const fullyPaid = effectivePaid.length;
    const openCount = effectiveOpen.length;
    const voidCount = lookbackRows.filter((r) => r.paymentStatus === 'void').length;
    const overdue = effectiveOpen.filter((r) => r.isOverdue).length;
    const customersBilled = new Set(nonVoid.map((r) => r.customerName)).size;
    const collectionPct = totalValue > 0 ? Math.round((totalCollected / totalValue) * 100) : 0;

    return {
      totalValue,
      totalCollected,
      totalPending,
      totalInvoices,
      fullyPaid,
      openCount,
      voidCount,
      overdue,
      customersBilled,
      collectionPct,
      effectiveOpen,
    };
  }, [lookbackRows]);

  // ─── Key Exposure Calculations ──────────────────────────────────────────────
  const keyExposure = useMemo(() => {
    const openRows = metrics.effectiveOpen;
    const pendingByCustomer = new Map<string, { name: string; amount: number; hasOverdue: boolean }>();

    for (const r of openRows) {
      const ex = pendingByCustomer.get(r.customerId);
      if (ex) {
        ex.amount += r.amountPending;
        if (r.isOverdue) ex.hasOverdue = true;
      } else {
        pendingByCustomer.set(r.customerId, {
          name: r.customerName,
          amount: r.amountPending,
          hasOverdue: r.isOverdue,
        });
      }
    }

    const topCustomer = [...pendingByCustomer.values()].sort((a, b) => b.amount - a.amount)[0] ?? null;
    const overdueRows = openRows.filter((r) => r.isOverdue);
    const largestOverdue = [...overdueRows].sort((a, b) => b.amountPending - a.amountPending)[0] ?? null;
    const largestOpen = [...openRows].sort((a, b) => b.amountPending - a.amountPending)[0] ?? null;
    const totalOverdueExposure = overdueRows.reduce((s, r) => s + r.amountPending, 0);

    return {
      topCustomer,
      overdueRows,
      largestOverdue,
      largestOpen,
      totalOverdueExposure,
    };
  }, [metrics.effectiveOpen]);

  // ─── Filter & Search Invoices ───────────────────────────────────────────────
  const processedRows = useMemo(() => {
    let rows = [...lookbackRows];

    // Status filter
    if (statusFilter === 'paid') {
      rows = rows.filter((r) => r.paymentStatus === 'paid' || r.isOperationallySettled);
    } else if (statusFilter === 'open') {
      rows = rows.filter((r) => r.paymentStatus !== 'paid' && r.paymentStatus !== 'void' && !r.isOperationallySettled);
    } else if (statusFilter === 'overdue') {
      rows = rows.filter((r) => r.isOverdue);
    }

    // Search query match
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.invoiceNumber.toLowerCase().includes(term) ||
          r.customerName.toLowerCase().includes(term) ||
          (r.resolvedGst && r.resolvedGst.toLowerCase().includes(term))
      );
    }

    // Default sort: newest invoice date first
    rows.sort((a, b) => (b.invoiceDate || '').localeCompare(a.invoiceDate || ''));

    return rows;
  }, [lookbackRows, statusFilter, searchTerm]);

  // ─── Invoice Detail Modal Fetcher ───────────────────────────────────────────
  const openInvoiceDetail = async (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setInvoiceDetail(null);
    setLoadingInvoiceDetail(true);

    try {
      const res = await fetch(`/api/admin/customer-statement/invoice/${encodeURIComponent(invoiceId)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setInvoiceDetail(json.data);
      } else {
        toast.error(json.error || 'Failed to fetch invoice details');
      }
    } catch {
      toast.error('Network error loading invoice');
    } finally {
      setLoadingInvoiceDetail(false);
    }
  };

  const closeInvoiceDetail = () => {
    setSelectedInvoiceId(null);
    setInvoiceDetail(null);
  };

  // ─── Loading State ──────────────────────────────────────────────────────────
  if (loading && !data) {
    return <MobileAccountsSummarySkeleton />;
  }

  // ─── Error State ────────────────────────────────────────────────────────────
  if (error && !data) {
    return (
      <div className="flex-1 flex flex-col font-sans min-h-0 bg-[#F8F9FB]">
        <header className="sticky top-0 z-50 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)]">
          <div className="flex items-center px-2 min-h-[56px] py-1">
            <button
              onClick={() => router.push('/mobile/accounts')}
              className="flex items-center gap-1 px-3 py-2 active:opacity-60 transition-opacity"
            >
              <ChevronLeft size={24} strokeWidth={2.5} />
              <span className="font-bold text-[15px]">Accounts</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 flex flex-col items-center justify-center text-center max-w-[430px] mx-auto w-full">
          <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-3">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-base font-bold text-slate-800 mb-1">Unable to load Accounts Summary</h2>
          <p className="text-xs text-slate-500 mb-5 max-w-xs">{error}</p>
          <button
            onClick={() => initData()}
            className="px-5 py-2.5 bg-[#1A2766] text-white rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all flex items-center gap-2"
          >
            <RefreshCw size={14} />
            <span>Retry</span>
          </button>
        </main>
      </div>
    );
  }

  const lastUpdated = data?.summary?.globalRefreshedAt || data?.generatedAt;

  return (
    <div className="flex-1 flex flex-col font-sans min-h-0 bg-[#F8F9FB] relative">
      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-2 min-h-[56px] py-1">
          <button
            onClick={() => router.push('/mobile/accounts')}
            className="flex items-center gap-1 px-3 py-2 active:opacity-60 transition-opacity"
            aria-label="Back to Accounts"
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="font-bold text-[15px]">Accounts</span>
          </button>

          <span className="font-bold text-[15px] tracking-tight">Accounts Summary</span>

          <button
            onClick={() => fetchForRange(lookback, false)}
            disabled={refreshing}
            className="p-2.5 text-white/90 hover:text-white active:scale-90 transition-all rounded-full disabled:opacity-50"
            aria-label="Refresh Summary"
          >
            <RefreshCw
              size={19}
              strokeWidth={2.2}
              className={refreshing ? 'animate-spin text-amber-400' : ''}
            />
          </button>
        </div>
      </header>

      {/* ─── Main Content ────────────────────────────────────────────────────── */}
      <main className="flex-1 px-4 py-4 max-w-[430px] mx-auto w-full space-y-4 pb-20 overflow-y-auto">
        {/* View Mode Indicator + Timestamp */}
        <div className="flex items-center justify-between px-0.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200/80 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.03)] text-[11px] font-bold text-[#1A2766]">
            <FileText size={13} className="text-blue-600" strokeWidth={2.5} />
            <span>Invoice View</span>
          </div>

          {lastUpdated && (
            <span className="text-[11px] font-medium text-slate-400">
              Synced {timeAgo(lastUpdated)}
            </span>
          )}
        </div>

        {/* Date Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {LOOKBACK_OPTIONS.map((opt) => {
            const isActive = lookback === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => handleLookbackChange(opt.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold shrink-0 transition-all min-w-[56px] text-center ${
                  isActive
                    ? 'bg-[#1A2766] text-white shadow-sm ring-2 ring-[#1A2766]/20'
                    : 'bg-white text-slate-600 border border-slate-200/80 active:bg-slate-100 hover:border-slate-300'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* ─── Primary Metric 1: Total Outstanding ──────────────────────────── */}
        <div className="bg-gradient-to-br from-[#1A2766] to-[#25368a] p-4 rounded-[20px] shadow-[0_4px_16px_rgba(26,39,102,0.12)] text-white relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] font-semibold text-white/80 uppercase tracking-wider">
              Total Outstanding
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white/15 text-[10px] font-bold text-white/90">
              {metrics.openCount} Open
            </span>
          </div>
          <div className="text-[28px] font-extrabold tracking-tight">
            {formatINR(metrics.totalPending)}
          </div>
          <p className="text-[11.5px] text-white/70 mt-1 font-medium">
            Across {metrics.openCount} open invoices in this period
          </p>
        </div>

        {/* ─── Primary Metric 2 & 3: Collected & Pending ────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {/* Collected Card */}
          <div className="bg-white p-3.5 rounded-[18px] shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-slate-100/90 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Collected
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="text-[19px] font-extrabold text-emerald-600 truncate">
              {formatINR(metrics.totalCollected)}
            </div>
            <div className="text-[10.5px] text-slate-400 mt-1 font-medium">
              {metrics.collectionPct}% of billed
            </div>
          </div>

          {/* Pending Card */}
          <div className="bg-white p-3.5 rounded-[18px] shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-slate-100/90 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Pending
              </span>
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            </div>
            <div className="text-[19px] font-extrabold text-amber-600 truncate">
              {formatINR(metrics.totalPending)}
            </div>
            <div className="text-[10.5px] text-slate-400 mt-1 font-medium">
              {100 - metrics.collectionPct}% remaining
            </div>
          </div>
        </div>

        {/* ─── Collection Efficiency & Total Billed ─────────────────────────── */}
        <div className="bg-white p-4 rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-slate-100/90 flex items-center justify-between">
          <div className="flex flex-col gap-0.5 flex-1 pr-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Collection Efficiency
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-[22px] font-black text-slate-800">
                {metrics.collectionPct}%
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                collected
              </span>
            </div>
            <span className="text-[10.5px] text-slate-400 mt-0.5">
              {metrics.fullyPaid} paid of {metrics.totalInvoices} invoices
            </span>
          </div>

          {/* Compact Circular SVG Donut Gauge */}
          <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 48 48">
              <circle
                cx="24"
                cy="24"
                r="19"
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="4.5"
              />
              <circle
                cx="24"
                cy="24"
                r="19"
                fill="none"
                stroke="#16A34A"
                strokeWidth="4.5"
                strokeDasharray={2 * Math.PI * 19}
                strokeDashoffset={2 * Math.PI * 19 * (1 - Math.min(metrics.collectionPct, 100) / 100)}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute text-[11px] font-black text-slate-700">
              {metrics.collectionPct}%
            </span>
          </div>
        </div>

        {/* Total Billed Secondary Metric */}
        <div className="bg-white px-4 py-3 rounded-[16px] shadow-[0_2px_6px_rgba(0,0,0,0.02)] border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Banknote size={15} />
            </div>
            <span className="text-xs font-bold text-slate-600">Total Billed</span>
          </div>
          <span className="text-sm font-extrabold text-slate-800">
            {formatINR(metrics.totalValue)}
          </span>
        </div>

        {/* ─── Collapsible Section: Key Exposure ────────────────────────────── */}
        <div className="bg-white rounded-[18px] shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden transition-all">
          <button
            onClick={() => setIsKeyExposureOpen(!isKeyExposureOpen)}
            className="w-full px-4 py-3.5 flex items-center justify-between active:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                <AlertTriangle size={15} />
              </div>
              <div className="text-left">
                <span className="text-[13px] font-bold text-slate-800 block">
                  Key Exposure
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  Highest exposure & overdue risk
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {keyExposure.totalOverdueExposure > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold">
                  {formatINR(keyExposure.totalOverdueExposure)}
                </span>
              )}
              {isKeyExposureOpen ? (
                <ChevronUp size={18} className="text-slate-400" />
              ) : (
                <ChevronDown size={18} className="text-slate-400" />
              )}
            </div>
          </button>

          {isKeyExposureOpen && (
            <div className="px-4 pb-4 pt-1 space-y-2.5 border-t border-slate-100">
              {/* Highest Exposure */}
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100/60">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-amber-900 flex items-center gap-1.5">
                    <Users size={12} className="text-amber-600" />
                    Highest Exposure
                  </span>
                  <span className="font-extrabold text-amber-800">
                    {keyExposure.topCustomer ? formatINR(keyExposure.topCustomer.amount) : '—'}
                  </span>
                </div>
                <p className="text-[11px] text-amber-700 truncate font-medium">
                  {keyExposure.topCustomer ? keyExposure.topCustomer.name : 'No open invoices'}
                  {keyExposure.topCustomer?.hasOverdue ? ' · past due' : ''}
                </p>
              </div>

              {/* Overdue Exposure */}
              <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100/60">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-rose-900 flex items-center gap-1.5">
                    <AlertTriangle size={12} className="text-rose-600" />
                    Overdue Exposure
                  </span>
                  <span className="font-extrabold text-rose-800">
                    {keyExposure.totalOverdueExposure > 0 ? formatINR(keyExposure.totalOverdueExposure) : '₹0'}
                  </span>
                </div>
                <p className="text-[11px] text-rose-700 font-medium">
                  {keyExposure.overdueRows.length} invoice{keyExposure.overdueRows.length !== 1 ? 's' : ''} past due
                </p>
              </div>

              {/* Largest Open Invoice */}
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100/60">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-purple-900 flex items-center gap-1.5">
                    <Banknote size={12} className="text-purple-600" />
                    Largest Open Invoice
                  </span>
                  <span className="font-extrabold text-purple-800">
                    {keyExposure.largestOpen ? formatINR(keyExposure.largestOpen.amountPending) : '—'}
                  </span>
                </div>
                <p className="text-[11px] text-purple-700 font-mono">
                  {keyExposure.largestOpen ? keyExposure.largestOpen.invoiceNumber : 'No open invoices'}
                </p>
              </div>

              {/* Largest Overdue */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <TrendingDown size={12} className="text-slate-600" />
                    Largest Overdue
                  </span>
                  <span className="font-extrabold text-slate-900">
                    {keyExposure.largestOverdue ? formatINR(keyExposure.largestOverdue.amountPending) : '—'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 truncate font-medium">
                  {keyExposure.largestOverdue
                    ? `${keyExposure.largestOverdue.customerName} · ${keyExposure.largestOverdue.invoiceNumber}`
                    : 'None'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ─── Collapsible Section: Summary Counts ─────────────────────────── */}
        <div className="bg-white rounded-[18px] shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden transition-all">
          <button
            onClick={() => setIsSummaryCountsOpen(!isSummaryCountsOpen)}
            className="w-full px-4 py-3.5 flex items-center justify-between active:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <Layers size={15} />
              </div>
              <div className="text-left">
                <span className="text-[13px] font-bold text-slate-800 block">
                  Summary Counts
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  Operational count breakdown
                </span>
              </div>
            </div>
            {isSummaryCountsOpen ? (
              <ChevronUp size={18} className="text-slate-400" />
            ) : (
              <ChevronDown size={18} className="text-slate-400" />
            )}
          </button>

          {isSummaryCountsOpen && (
            <div className="p-4 pt-1 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex flex-col">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                    Invoices
                  </span>
                  <span className="text-[18px] font-black text-slate-800 mt-0.5">
                    {metrics.totalInvoices}
                  </span>
                  <span className="text-[9.5px] text-slate-400">Total Billed</span>
                </div>

                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex flex-col">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                    Customers
                  </span>
                  <span className="text-[18px] font-black text-slate-800 mt-0.5">
                    {metrics.customersBilled}
                  </span>
                  <span className="text-[9.5px] text-slate-400">Unique billed</span>
                </div>

                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex flex-col">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                    Paid
                  </span>
                  <span className="text-[18px] font-black text-emerald-600 mt-0.5">
                    {metrics.fullyPaid}
                  </span>
                  <span className="text-[9.5px] text-slate-400">Settled invoices</span>
                </div>

                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex flex-col">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                    Open
                  </span>
                  <span className="text-[18px] font-black text-amber-600 mt-0.5">
                    {metrics.openCount}
                  </span>
                  <span className="text-[9.5px] text-slate-400">Unsettled invoices</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── Invoices Section ────────────────────────────────────────────── */}
        <div className="space-y-3 pt-1">
          {/* Section Toggle Header */}
          <div className="flex items-center justify-between px-1">
            <button
              onClick={() => setIsInvoicesSectionOpen(!isInvoicesSectionOpen)}
              className="flex items-center gap-2 text-left"
            >
              <h3 className="text-[14px] font-extrabold text-slate-800">Invoices</h3>
              <span className="px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-600 text-[11px] font-bold">
                {processedRows.length}
              </span>
              {isInvoicesSectionOpen ? (
                <ChevronUp size={16} className="text-slate-400" />
              ) : (
                <ChevronDown size={16} className="text-slate-400" />
              )}
            </button>

            {/* Quick Status Filter Tabs */}
            {isInvoicesSectionOpen && (
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-[10.5px] font-bold">
                {(['all', 'open', 'paid', 'overdue'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2 py-1 rounded-md capitalize transition-all ${
                      statusFilter === st
                        ? 'bg-[#1A2766] text-white'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isInvoicesSectionOpen && (
            <>
              {/* Full-width Search Input */}
              <div className="relative">
                <Search
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search invoice, customer, or GST..."
                  className="w-full bg-white border border-slate-200/90 rounded-xl pl-9 pr-9 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] transition-all shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Invoice Cards List */}
              <div className="space-y-3">
                {processedRows.map((row) => {
                  const isPendingRelease =
                    tasks.some((t) => t.invoiceId === row.invoiceId && t.status === 'ACTIVE') &&
                    !row.isOperationallySettled &&
                    row.paymentStatus !== 'paid' &&
                    row.paymentStatus !== 'void';

                  const { date: dateStr, time: timeStr } = formatDateDisplay(
                    row.invoiceDate,
                    row.createdTime
                  );

                  const dueFormatted = formatDueDate(row.dueDate);

                  // Pending percentage calculation
                  const pendingPct =
                    row.isOperationallySettled || row.paymentStatus === 'paid' || row.paymentStatus === 'void'
                      ? 0
                      : row.invoiceValue > 0
                      ? Math.min(100, Math.round((row.amountPending / row.invoiceValue) * 100))
                      : 0;

                  return (
                    <div
                      key={row.invoiceId}
                      onClick={() => openInvoiceDetail(row.invoiceId)}
                      className="bg-white rounded-[18px] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-slate-100 hover:border-slate-200 active:scale-[0.99] transition-all cursor-pointer space-y-3"
                    >
                      {/* Top Row: Invoice Number + Chevron + Badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-[14px] text-[#1A2766]">
                            {row.invoiceNumber}
                          </span>
                          <ChevronRight size={16} className="text-slate-300" />
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {/* Pending Release Badge */}
                          {isPendingRelease && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9px] font-extrabold uppercase rounded-md border border-amber-200 shrink-0">
                              <Flag size={8} className="fill-amber-600 text-amber-600" />
                              <span>Pending Release</span>
                            </span>
                          )}

                          {/* Status Badge */}
                          {row.isOperationallySettled || row.paymentStatus === 'paid' ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              Paid
                            </span>
                          ) : row.isOverdue ? (
                            <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                              Overdue
                            </span>
                          ) : row.paymentStatus === 'partially_paid' ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                              Partial
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                              Unpaid
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Customer Name & GST */}
                      <div>
                        <h4 className="text-[14px] font-bold text-slate-900 leading-snug truncate">
                          {row.customerName}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          {row.resolvedGst ? (
                            <span className="text-[10px] font-mono text-slate-400">
                              GST: {row.resolvedGst}
                            </span>
                          ) : (
                            <span className="text-[10px] italic text-slate-400">
                              GST: N/A
                            </span>
                          )}
                          <span className="text-[10px] text-slate-300">•</span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Calendar size={10} />
                            {dateStr} {timeStr ? `· ${timeStr}` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Financial Values Grid */}
                      <div className="bg-slate-50/80 rounded-xl p-2.5 grid grid-cols-3 gap-2 text-center">
                        <div className="flex flex-col text-left pl-1">
                          <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                            Invoice Value
                          </span>
                          <span className="text-[13px] font-extrabold text-slate-800 mt-0.5">
                            {formatINR(row.invoiceValue)}
                          </span>
                        </div>

                        <div className="flex flex-col text-center">
                          <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                            Paid
                          </span>
                          <span className="text-[13px] font-bold text-emerald-600 mt-0.5">
                            {formatINR(row.amountPaid)}
                          </span>
                        </div>

                        <div className="flex flex-col text-right pr-1">
                          <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                            Pending
                          </span>
                          <span className={`text-[13px] font-bold mt-0.5 ${
                            row.isOverdue ? 'text-rose-600' : 'text-amber-600'
                          }`}>
                            {formatINR(row.amountPending)}
                          </span>
                        </div>
                      </div>

                      {/* Pending Percentage Bar */}
                      {pendingPct > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10.5px]">
                            <span className="text-slate-400 font-medium">Pending Percentage</span>
                            <span className="font-extrabold text-slate-700">{pendingPct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                row.isOverdue ? 'bg-rose-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${pendingPct}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Metadata Row: Due Date + Salesman + Warehouse */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-2">
                        <div className="flex items-center gap-1">
                          <Clock size={11} className={row.isOverdue ? 'text-rose-500' : 'text-slate-400'} />
                          <span className={row.isOverdue ? 'text-rose-600 font-bold' : 'font-medium'}>
                            {dueFormatted ? `Due ${dueFormatted}` : 'No due date'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 truncate max-w-[120px]" title={row.salespersonName || '—'}>
                          <span className="text-slate-400">Sales:</span>
                          <span className="font-medium text-slate-700 truncate">
                            {row.salespersonName || '—'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1" title={row.warehouse || '—'}>
                          <MapPin size={11} className="text-slate-400" />
                          <span className="text-slate-400">WH:</span>
                          <span className="font-medium text-slate-700">
                            {row.warehouse || '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Empty State: No Invoices Found */}
                {processedRows.length === 0 && (
                  <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center flex flex-col items-center">
                    {searchTerm ? (
                      <>
                        <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mb-3">
                          <Search size={22} />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 mb-1">No matching invoices</h4>
                        <p className="text-xs text-slate-500 max-w-xs mb-4">
                          Try a different invoice number, customer, or GST.
                        </p>
                        <button
                          onClick={() => setSearchTerm('')}
                          className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold active:bg-slate-200 transition-colors"
                        >
                          Clear Search
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mb-3">
                          <FileText size={22} />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 mb-1">No invoices found</h4>
                        <p className="text-xs text-slate-500 max-w-xs">
                          There are no invoices matching the selected period/filter.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* ─── Existing Invoice Detail Flow (Modal) ─────────────────────────── */}
      {selectedInvoiceId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4">
          <div
            className="bg-white w-full max-w-[430px] rounded-t-[24px] sm:rounded-[24px] shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-[#1A2766]" />
                <span className="font-bold text-sm text-[#1A2766]">
                  Invoice Details
                </span>
              </div>
              <button
                onClick={closeInvoiceDetail}
                className="p-1.5 text-slate-400 hover:text-slate-600 active:bg-slate-200 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {loadingInvoiceDetail ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 size={24} className="animate-spin text-[#1A2766]" />
                  <span className="text-xs font-medium">Loading invoice items...</span>
                </div>
              ) : invoiceDetail ? (
                <>
                  {/* Overview Header */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-mono font-bold text-sm text-[#1A2766]">
                          {invoiceDetail.invoice_number}
                        </span>
                        <h4 className="text-xs font-bold text-slate-800 mt-0.5">
                          {invoiceDetail.customer_name}
                        </h4>
                      </div>
                      <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 capitalize">
                        {invoiceDetail.status}
                      </span>
                    </div>

                    <div className="text-[10.5px] text-slate-400 pt-1 flex items-center justify-between">
                      <span>Date: {invoiceDetail.date}</span>
                      <span>Due: {invoiceDetail.due_date || '—'}</span>
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50/60 p-3 rounded-xl border border-slate-100 text-center">
                    <div>
                      <span className="text-[9.5px] font-bold uppercase text-slate-400 block">
                        Total
                      </span>
                      <span className="text-xs font-extrabold text-slate-800">
                        {formatINR(invoiceDetail.total || 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9.5px] font-bold uppercase text-slate-400 block">
                        Paid
                      </span>
                      <span className="text-xs font-bold text-emerald-600">
                        {formatINR(invoiceDetail.payment_made || 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9.5px] font-bold uppercase text-slate-400 block">
                        Balance
                      </span>
                      <span className="text-xs font-bold text-rose-600">
                        {formatINR(invoiceDetail.balance || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Line Items List */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                      <span>Item</span>
                      <span>Total</span>
                    </div>

                    <div className="space-y-2">
                      {(invoiceDetail.line_items || []).map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-white p-3 rounded-xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-start justify-between gap-3"
                        >
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">
                              {item.name}
                            </p>
                            <p className="text-[10.5px] text-slate-400 font-medium">
                              {item.quantity} {item.unit || 'pcs'} × {formatINR(item.rate)}
                              {item.tax_percentage ? ` (@${item.tax_percentage}% GST)` : ''}
                            </p>
                          </div>
                          <span className="text-xs font-extrabold text-slate-800 shrink-0">
                            {formatINR(item.item_total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* External Zoho Books link */}
                  <div className="pt-2">
                    <a
                      href={`https://books.zoho.in/app#/invoices/${selectedInvoiceId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>Open in Zoho Books</span>
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  Unable to display invoice detail.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
