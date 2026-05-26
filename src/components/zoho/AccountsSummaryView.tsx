'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  RefreshCw,
  Search,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  TrendingDown,
  AlertTriangle,
  Users,
  Banknote,
  FileText,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InvoiceRow {
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
}

interface ExtendedRow extends InvoiceRow {
  isOverdue: boolean;
  isOperationallySettled: boolean;
  /** Resolved GST — invoice-level first, then customer-level */
  resolvedGst: string;
}

interface CustomerEnrichment {
  unusedCredits: number;
  creditLimit: number;
  gstNumber: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  billingCountry: string;
  displayName: string;
  companyName: string;
  tallyReady: boolean;
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
  dailyCreditsUsed?: number;
  dailyCreditsDate?: string;
  dailyInvoiceRefreshes?: number;
  dailyCustomerRefreshes?: number;
  dailyEnrichmentCalls?: number;
  dailyGlobalRefreshes?: number;
  customerCooldowns?: Record<string, string>;
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

type LookbackPeriod = 'today' | 'yesterday' | '3days' | '7days' | '15days';
type FilterKey = 'all' | 'paid' | 'open' | 'void';

interface CustomerGroup {
  customerId: string;
  customerName: string;
  resolvedGst: string;
  invoices: ExtendedRow[];
  totalValue: number;
  totalCollected: number;
  totalPending: number;
  overdueExposure: number;
  overdueCount: number;
  openCount: number;
  latestInvoiceDate: string;
  unusedCredits: number | null;
}

// ─── Business Rule ────────────────────────────────────────────────────────────

/**
 * Hard reconciliation threshold:
 * 1) Any invoice with |pending| ≤ ₹10 is operationally settled.
 * 2) Invoices > ₹1,00,000 with |pending| ≤ ₹100 are operationally settled.
 * Excludes from Open filter, overdue calculations, and all pending KPIs.
 */
function isOperationallyOpen(row: InvoiceRow): boolean {
  if (row.paymentStatus === 'paid' || row.paymentStatus === 'void') return false;
  if (row.amountPending <= 0) return false;
  
  const absPending = Math.abs(row.amountPending);
  
  // Rule 1: <= ₹10 variance is always ignored
  if (absPending <= 10) return false;
  
  // Rule 2: Large invoices can have <= ₹100 variance
  if (row.invoiceValue > 100000 && absPending <= 100) return false;

  return true;
}

/**
 * Full GST resolution hierarchy:
 * invoice GST → invoice tax fields → customer enrichment GST → ''
 */
function resolveGst(row: InvoiceRow, enrichment: CustomerEnrichment | undefined): string {
  return (
    (row.customerGst && row.customerGst !== 'N/A' ? row.customerGst : '') ||
    enrichment?.gstNumber ||
    ''
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  }).format(val);
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

function timeAgo(isoStr: string): string {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function buildStatementUrl(customerId: string): string {
  return `/staff/dashboard/accounts?tab=statement&customerId=${encodeURIComponent(customerId)}`;
}

// ─── SVG Collection Gauge ─────────────────────────────────────────────────────

function CollectionGauge({ pct }: { pct: number }) {
  const r = 42, cx = 54, cy = 54;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width="108" height="108" viewBox="0 0 108 108">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E2E8F0" strokeWidth="10" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#059669" strokeWidth="10"
        strokeLinecap="round" strokeDasharray={`${dash} ${circ - dash}`}
        transform="rotate(-90 54 54)" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x={cx} y={cy - 5} textAnchor="middle" dominantBaseline="middle"
        fontSize="16" fontWeight="700" fill="#059669" fontFamily="Inter, sans-serif">{pct}%</text>
      <text x={cx} y={cy + 13} textAnchor="middle" dominantBaseline="middle"
        fontSize="8" fontWeight="500" fill="#94A3B8" fontFamily="Inter, sans-serif" letterSpacing="0.05em">
        COLLECTED
      </text>
    </svg>
  );
}

// ─── Top Open Exposure Panel ──────────────────────────────────────────────────

function TopOpenExposure({ openRows }: { openRows: ExtendedRow[] }) {
  const pendingByCustomer = new Map<string, { name: string; amount: number; hasOverdue: boolean }>();
  for (const r of openRows) {
    const ex = pendingByCustomer.get(r.customerId);
    if (ex) { ex.amount += r.amountPending; if (r.isOverdue) ex.hasOverdue = true; }
    else pendingByCustomer.set(r.customerId, { name: r.customerName, amount: r.amountPending, hasOverdue: r.isOverdue });
  }
  const topCustomer = [...pendingByCustomer.values()].sort((a, b) => b.amount - a.amount)[0] ?? null;
  const overdueRows = openRows.filter((r) => r.isOverdue);
  const largestOverdue = [...overdueRows].sort((a, b) => b.amountPending - a.amountPending)[0] ?? null;
  const largestOpen = [...openRows].sort((a, b) => b.amountPending - a.amountPending)[0] ?? null;
  const totalOverdueExposure = overdueRows.reduce((s, r) => s + r.amountPending, 0);

  const stats = [
    {
      icon: <Users size={13} style={{ color: '#D97706' }} />,
      label: 'Highest Exposure',
      value: topCustomer ? formatINR(topCustomer.amount) : '—',
      sub: topCustomer ? `${topCustomer.name}${topCustomer.hasOverdue ? ' · overdue' : ''}` : 'No open invoices',
      accent: '#D97706', bg: '#FFFBEB',
    },
    {
      icon: <AlertTriangle size={13} style={{ color: '#DC2626' }} />,
      label: 'Overdue Exposure',
      value: totalOverdueExposure > 0 ? formatINR(totalOverdueExposure) : '₹0',
      sub: `${overdueRows.length} invoice${overdueRows.length !== 1 ? 's' : ''} past due`,
      accent: '#DC2626', bg: '#FEF2F2',
    },
    {
      icon: <Banknote size={13} style={{ color: '#7C3AED' }} />,
      label: 'Largest Open Invoice',
      value: largestOpen ? formatINR(largestOpen.amountPending) : '—',
      sub: largestOpen ? largestOpen.invoiceNumber : 'No open invoices',
      accent: '#7C3AED', bg: '#F5F3FF',
    },
    {
      icon: <TrendingDown size={13} style={{ color: '#0F172A' }} />,
      label: 'Largest Overdue',
      value: largestOverdue ? formatINR(largestOverdue.amountPending) : '—',
      sub: largestOverdue ? `${largestOverdue.customerName} · ${largestOverdue.invoiceNumber}` : 'None',
      accent: '#0F172A', bg: '#F8FAFC',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 mt-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl p-3 flex flex-col gap-1"
          style={{ background: s.bg, border: `1px solid ${s.bg === '#F8FAFC' ? '#E2E8F0' : s.bg}` }}>
          <div className="flex items-center gap-1.5">{s.icon}
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>{s.label}</span>
          </div>
          <p className="text-[15px] font-bold tabular-nums leading-none" style={{ color: s.accent, fontVariantNumeric: 'tabular-nums' }}>
            {s.value}
          </p>
          <p className="text-[9.5px] truncate" style={{ color: '#64748B' }}>{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Customer Hover Card ──────────────────────────────────────────────────────

function CustomerCell({
  row,
  enrichment,
  statusFilter,
}: {
  row: ExtendedRow;
  enrichment: CustomerEnrichment | undefined;
  statusFilter: string;
}) {
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMock = row.invoiceId.startsWith('mock-');
  const customerUrl = isMock ? '#' : `https://books.zoho.in/app#/contacts/${row.customerId}`;
  const statementUrl = buildStatementUrl(row.customerId);

  const gst = row.resolvedGst;
  const city = enrichment?.billingCity || '';
  const state = enrichment?.billingState || '';
  const addr = enrichment?.billingAddress || '';
  const hasLocation = city || state;
  const hasEnrichment = !!enrichment;

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => setShow(true), 350);
  };
  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShow(false);
  };

  return (
    <div ref={containerRef} className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {/* Customer name */}
      <div className="flex items-center gap-1.5 min-w-0">
        {isMock ? (
          <span className="text-[12px] font-semibold truncate" style={{ color: '#0F172A' }}>
            {row.customerName}
          </span>
        ) : (
          <a
            href={customerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group min-w-0 flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className="text-[12px] font-semibold truncate block group-hover:underline"
              style={{ color: '#0F172A' }}
            >
              {row.customerName}
            </span>
            {statusFilter === 'open' && enrichment?.tallyReady && (
              <span title="Tally Ready" className="flex shrink-0">
                <Check size={11} color="#059669" />
              </span>
            )}
          </a>
        )}
      </div>

      {/* GST sub-line */}
      {gst ? (
        <p className="text-[10px] font-mono mt-0.5 truncate" style={{ color: '#94A3B8' }}>{gst}</p>
      ) : (
        <p className="text-[10px] italic mt-0.5" style={{ color: '#CBD5E1' }}>GST missing</p>
      )}

      {/* Hover card */}
      {show && hasEnrichment && (
        <div
          className="absolute left-0 top-full mt-1.5 z-50 rounded-xl overflow-hidden"
          style={{
            minWidth: '220px',
            maxWidth: '280px',
            background: '#fff',
            border: '1px solid #E2E8F0',
            boxShadow: '0 8px 24px rgba(15,23,42,0.10), 0 2px 8px rgba(15,23,42,0.06)',
            animation: 'fadeSlideIn 0.12s ease',
          }}
          onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); setShow(true); }}
          onMouseLeave={handleMouseLeave}
        >
          {/* Card header */}
          <div className="px-3 pt-3 pb-2" style={{ borderBottom: '1px solid #F1F5F9' }}>
            <p className="text-[11px] font-bold truncate" style={{ color: '#0F172A' }}>{row.customerName}</p>
            {enrichment?.companyName && enrichment.companyName !== row.customerName && (
              <p className="text-[10px] truncate mt-0.5" style={{ color: '#64748B' }}>{enrichment.companyName}</p>
            )}
          </div>

          {/* Card body */}
          <div className="px-3 py-2.5 space-y-2">
            {gst && (
              <div className="flex items-start gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wider mt-[1px] shrink-0" style={{ color: '#94A3B8' }}>GST</span>
                <span className="text-[10px] font-mono font-semibold" style={{ color: '#0F172A' }}>{gst}</span>
              </div>
            )}

            {(addr || hasLocation) && (
              <div className="flex items-start gap-1.5">
                <MapPin size={10} className="shrink-0 mt-[1px]" style={{ color: '#94A3B8' }} />
                <div>
                  {addr && <p className="text-[10px]" style={{ color: '#475569' }}>{addr}</p>}
                  {hasLocation && (
                    <p className="text-[10px]" style={{ color: '#475569' }}>
                      {[city, state].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {!gst && !addr && !hasLocation && (
              <p className="text-[10px] italic" style={{ color: '#CBD5E1' }}>No address data available</p>
            )}
          </div>

          {/* View Statement CTA */}
          <div className="px-3 pb-3">
            <a
              href={statementUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-[10px] font-semibold transition-colors"
              style={{ background: '#F1F5F9', color: '#0F172A' }}
              onClick={(e) => e.stopPropagation()}
            >
              <FileText size={10} />
              View Statement
            </a>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes infiniteLoading {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(-30%); }
          100% { transform: translateX(100%); }
        }
        .animate-infinite-loading {
          animation: infiniteLoading 1.5s infinite linear;
          width: 50%;
        }
      `}</style>
    </div>
  );
}

// ─── Status Pill ──────────────────────────────────────────────────────────────

function StatusPill({ row }: { row: ExtendedRow }) {
  if (row.paymentStatus === 'void') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-500">Void</span>;
  }
  if (row.paymentStatus === 'paid' || row.isOperationallySettled) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700">Paid</span>;
  }
  if (row.isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold"
        style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block animate-pulse" />
        Overdue
      </span>
    );
  }
  if (row.paymentStatus === 'partially_paid') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700">Partial</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-50 text-red-600">Unpaid</span>;
}

// ─── Row Actions Popover ──────────────────────────────────────────────────────

function RowActions({ row }: { row: ExtendedRow }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const isMock = row.invoiceId.startsWith('mock-');
  const invoiceUrl = isMock ? '#' : `https://books.zoho.in/app#/invoices/${row.invoiceId}`;
  const statementUrl = buildStatementUrl(row.customerId);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-50 w-44 bg-white border border-slate-200 rounded-lg shadow-lg py-1 text-[11px]">
          <a href={invoiceUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700"
            onClick={() => setOpen(false)}>
            <ExternalLink size={11} /> Open in Zoho
          </a>
          <a href={statementUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700"
            onClick={() => setOpen(false)}>
            <FileText size={11} /> View Statement
          </a>
          <button className="flex w-full items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700"
            onClick={() => {
              navigator.clipboard?.writeText(row.invoiceNumber);
              toast.success('Copied!');
              setOpen(false);
            }}>
            <Copy size={11} /> Copy Invoice #
          </button>
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen w-full px-6 py-6 space-y-5" style={{ background: '#F8FAFC', fontFamily: "'Inter', sans-serif" }}>
      {/* Header Skeleton */}
      <div className="flex items-start justify-between">
        <div>
          <div className="h-7 w-52 bg-slate-200 rounded-md animate-pulse" />
          <div className="h-4 w-80 bg-slate-200 rounded-md mt-2 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-28 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-8 w-44 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-8 w-24 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-8 w-24 bg-slate-200 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Bento Grid Skeleton */}
      <div className="grid grid-cols-5 gap-4">
        {/* Card 1 */}
        <div className="col-span-3 rounded-2xl p-6 bg-white border border-slate-200 space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
              <div className="h-10 w-48 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-36 bg-slate-200 rounded animate-pulse" />
            </div>
            <div className="space-y-2 text-right">
              <div className="h-3 w-20 bg-slate-200 rounded ml-auto animate-pulse" />
              <div className="h-6 w-32 bg-slate-200 rounded ml-auto animate-pulse" />
            </div>
          </div>
          {/* Exposure items */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl p-3 border border-slate-100 bg-slate-50 space-y-2">
                <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
                <div className="h-5 w-24 bg-slate-200 rounded animate-pulse" />
                <div className="h-3.5 w-32 bg-slate-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Card 2 */}
        <div className="col-span-2 rounded-2xl p-6 bg-white border border-slate-200 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="h-3 w-32 bg-slate-200 rounded animate-pulse" />
            <div className="flex items-center gap-5">
              <div className="h-24 w-24 rounded-full bg-slate-200 animate-pulse shrink-0" />
              <div className="space-y-3 flex-1">
                <div className="space-y-1">
                  <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
                  <div className="h-5 w-28 bg-slate-200 rounded animate-pulse" />
                </div>
                <div className="space-y-1">
                  <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
                  <div className="h-5 w-28 bg-slate-200 rounded animate-pulse" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-4 border-t border-slate-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-1 text-center bg-slate-50 rounded-lg py-2 space-y-1">
                <div className="h-5 w-8 bg-slate-200 rounded mx-auto animate-pulse" />
                <div className="h-2.5 w-12 bg-slate-200 rounded mx-auto animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <div className="flex justify-between items-center px-5 py-3.5 border-b border-slate-200">
          <div className="flex gap-2">
            <div className="h-8 w-16 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-8 w-16 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-8 w-16 bg-slate-200 rounded-lg animate-pulse" />
          </div>
          <div className="h-8 w-60 bg-slate-200 rounded-lg animate-pulse" />
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0">
              <div className="h-4 w-8 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-44 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AccountsSummaryView() {
  const [data, setData] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoFetching, setAutoFetching] = useState(false);
  
  // View states
  const [lookback, setLookback] = useState<LookbackPeriod>('today');
  const [statusFilter, setStatusFilter] = useState<FilterKey>('open'); // Default to Open
  const [viewMode, setViewMode] = useState<'invoice' | 'customer'>('invoice'); // Toggle between invoice/customer view
  const [searchTerm, setSearchTerm] = useState('');
  
  const [sortField, setSortField] = useState<keyof ExtendedRow | 'unusedCredits' | 'pendingPercent'>('invoiceDate');
  const [sortDesc, setSortDesc] = useState(true);
  
  const [devOpen, setDevOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());

  // Customer enrichment state — keyed by customerId
  const [enrichMap, setEnrichMap] = useState<Record<string, CustomerEnrichment>>({});
  const [enriching, setEnriching] = useState(false);
  const fetchedCustomerIds = useRef<Set<string>>(new Set());
  const redundantFetchesAvoided = useRef(0);

  // New Operational States & Ticking Clock
  const [nowTick, setNowTick] = useState(Date.now());
  const [refreshingInvoiceId, setRefreshingInvoiceId] = useState<string | null>(null);
  const [refreshingCustomerId, setRefreshingCustomerId] = useState<string | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);

  // Ticks the clock every second to drive cooldown countdowns reactively
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Click outside to close download dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) {
        setDownloadOpen(false);
      }
    };
    if (downloadOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [downloadOpen]);

  // Derived Cooldowns (Declarative relative to nowTick)
  const cooldownRemaining = useMemo(() => {
    if (!data) return 0;
    const lastGlobalStr = data.summary?.globalRefreshedAt || data.generatedAt;
    const diff = nowTick - new Date(lastGlobalStr).getTime();
    return Math.max(0, Math.ceil((60000 - diff) / 1000));
  }, [data, nowTick]);

  const isAnyRefreshing = refreshing || autoFetching || refreshingInvoiceId !== null || refreshingCustomerId !== null;

  const getInvoiceCooldown = useCallback((row: InvoiceRow) => {
    if (!row.lastRefreshedAt) return 0;
    const diff = nowTick - new Date(row.lastRefreshedAt).getTime();
    return Math.max(0, Math.ceil((60000 - diff) / 1000));
  }, [nowTick]);

  const getCustomerCooldown = useCallback((customerId: string) => {
    const lastCustRefresh = data?.summary?.customerCooldowns?.[customerId];
    if (!lastCustRefresh) return 0;
    const diff = nowTick - new Date(lastCustRefresh).getTime();
    return Math.max(0, Math.ceil((60000 - diff) / 1000));
  }, [data, nowTick]);

  // ─── Smart cache check ──────────────────────────────────────────────────────
  const cacheCovers = useCallback(
    (period: LookbackPeriod, snapshot: SnapshotData | null): boolean => {
      if (!snapshot?.summary?.fetchedStartDate) return false;
      const required = getRequiredStart(period);
      const today = getISTDate(0);
      return snapshot.summary.fetchedStartDate <= required && snapshot.summary.fetchedEndDate >= today;
    },
    []
  );

  // ─── API: snapshot ──────────────────────────────────────────────────────────
  const loadCache = useCallback(async (): Promise<SnapshotData | null> => {
    const res = await fetch('/api/accounts/summary');
    const result = await res.json();
    return result.success && result.data ? (result.data as SnapshotData) : null;
  }, []);

  const fetchForRange = useCallback(async (period: LookbackPeriod, silent = false): Promise<void> => {
    if (cooldownRemaining > 0 && !silent) {
      toast.error(`Refresh available in ${cooldownRemaining}s`);
      return;
    }
    setRefreshing(true);
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
      if (res.status === 409) { toast.error(result.error || 'Refresh already in progress.'); return; }
      if (result.success && result.data) {
        setData(result.data as SnapshotData);
        if (!silent) toast.success('Dashboard refreshed!', { duration: 2000 });
      } else {
        toast.error(result.error || 'Refresh failed.');
      }
    } catch {
      toast.error('Network error. Please retry.');
    } finally {
      setRefreshing(false);
    }
  }, [cooldownRemaining]);

  const handleInvoiceRefresh = async (invoiceId: string) => {
    const row = data?.rows.find((r) => r.invoiceId === invoiceId);
    if (!row) return;
    const invCooldown = getInvoiceCooldown(row as any);
    if (invCooldown > 0) {
      toast.error(`Invoice refresh available in ${invCooldown}s`);
      return;
    }
    
    setRefreshingInvoiceId(invoiceId);
    try {
      const res = await fetch('/api/accounts/summary/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      });
      const result = await res.json();
      if (res.status === 429) {
        toast.error(result.error || 'Refresh budget or rate limit exceeded.');
        return;
      }
      if (result.success && result.data) {
        setData(result.data as SnapshotData);
        const invNum = result.data.rows.find((r: any) => r.invoiceId === invoiceId)?.invoiceNumber || '';
        toast.success(`Invoice ${invNum} refreshed!`);
      } else {
        toast.error(result.error || 'Refresh failed.');
      }
    } catch {
      toast.error('Network error. Please retry.');
    } finally {
      setRefreshingInvoiceId(null);
    }
  };

  const handleCustomerRefresh = async (customerId: string) => {
    const custCooldown = getCustomerCooldown(customerId);
    if (custCooldown > 0) {
      toast.error(`Customer refresh available in ${custCooldown}s`);
      return;
    }

    setRefreshingCustomerId(customerId);
    try {
      const res = await fetch('/api/accounts/summary/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      });
      const result = await res.json();
      if (res.status === 429) {
        toast.error(result.error || 'Refresh budget or rate limit exceeded.');
        return;
      }
      if (result.success && result.data) {
        setData(result.data as SnapshotData);
        if (result.enrichment) {
          setEnrichMap((prev) => ({ ...prev, [customerId]: result.enrichment }));
        }
        toast.success('Customer data refreshed!');
      } else {
        toast.error(result.error || 'Refresh failed.');
      }
    } catch {
      toast.error('Network error. Please retry.');
    } finally {
      setRefreshingCustomerId(null);
    }
  };

  const exportToCSV = () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    const filename = `accounts-summary-${viewMode}-${new Date().toISOString().slice(0, 10)}.csv`;

    if (viewMode === 'invoice') {
      headers = ['Invoice Number', 'Invoice Date', 'Due Date', 'Customer Name', 'GST Number', 'Invoice Value', 'Amount Paid', 'Amount Pending', 'Pending %', 'Status'];
      rows = processedRows.map(r => {
        const pct = r.isOperationallySettled || r.paymentStatus === 'paid' || r.paymentStatus === 'void'
          ? 0
          : Math.round((r.amountPending / r.invoiceValue) * 100);
        return [
          r.invoiceNumber,
          r.invoiceDate,
          r.dueDate || '',
          r.customerName,
          r.resolvedGst,
          r.invoiceValue.toString(),
          r.amountPaid.toString(),
          r.amountPending.toString(),
          `${pct}%`,
          r.paymentStatus + (r.isOperationallySettled ? ' (settled)' : '')
        ];
      });
    } else {
      headers = ['Customer Name', 'GST Number', 'Billed Amount', 'Pending Amount', 'Pending %', 'Overdue Amount', 'Unused Credits', 'Open Invoices', 'Risk Status'];
      rows = customerGroups.map(g => {
        const pct = g.totalValue > 0 ? Math.round((g.totalPending / g.totalValue) * 100) : 0;
        return [
          g.customerName,
          g.resolvedGst || 'N/A',
          g.totalValue.toString(),
          g.totalPending.toString(),
          `${pct}%`,
          g.overdueExposure.toString(),
          (g.unusedCredits ?? 0).toString(),
          `${g.openCount}/${g.invoices.length}`,
          g.overdueCount > 0 ? 'Overdue' : g.openCount > 0 ? 'Open' : 'Settled'
        ];
      });
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV Downloaded!');
  };

  const exportToPDF = async () => {
    try {
      toast.loading('Generating PDF...', { id: 'pdf-generation' });
      
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const cPrimary: [number, number, number] = [15, 23, 42]; // Slate 900
      const cSecondary: [number, number, number] = [100, 116, 139]; // Slate 500
      const cSuccess: [number, number, number] = [5, 150, 105]; // Emerald 600
      const cWarning: [number, number, number] = [217, 119, 6]; // Amber 600
      const cDanger: [number, number, number] = [220, 38, 38]; // Red 600
      const cLightBg: [number, number, number] = [248, 250, 252]; // Slate 50

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Custom helpers inside PDF context to avoid Unicode ₹ encoding bugs
      const formatPDFINR = (val: number): string => {
        const isNegative = val < 0;
        const absVal = Math.abs(val);
        const formatted = new Intl.NumberFormat('en-IN', {
          maximumFractionDigits: 0,
        }).format(absVal);
        return isNegative ? `-Rs. ${formatted}` : `Rs. ${formatted}`;
      };

      const formatPDFStatus = (row: ExtendedRow): string => {
        if (row.paymentStatus === 'void') return 'VOID';
        if (row.paymentStatus === 'paid' || row.isOperationallySettled) return 'PAID';
        if (row.isOverdue) return 'OVERDUE';
        if (row.paymentStatus === 'partially_paid') return 'PARTIAL';
        return 'UNPAID';
      };

      // Header block
      doc.setFillColor(cPrimary[0], cPrimary[1], cPrimary[2]);
      doc.rect(0, 0, pageWidth, 28, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('Accounts Summary', 12, 11);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(190, 200, 210);
      const generatedTimestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      doc.text(`Generated: ${generatedTimestamp}  |  Refreshed By: ${data?.refreshedBy || 'Admin'}`, 12, 18);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(`${viewMode === 'invoice' ? 'INVOICE VIEW' : 'CUSTOMER VIEW'}`, pageWidth - 12, 11, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(190, 200, 210);
      const activeRangeLabel = PERIOD_OPTIONS.find(p => p.id === lookback)?.label || lookback.toUpperCase();
      const activeFiltersLabel = `Status: ${statusFilter.toUpperCase()}${searchTerm ? ` | Search: "${searchTerm}"` : ''}`;
      doc.text(`Range: ${activeRangeLabel}  |  ${activeFiltersLabel}`, pageWidth - 12, 18, { align: 'right' });

      // KPI Grid
      let startY = 33;
      const cardWidth = (pageWidth - 24 - 12) / 5;
      const cardHeight = 16;
      
      const kpis = [
        { label: 'TOTAL OUTSTANDING', val: formatPDFINR(metrics.totalPending), color: cDanger },
        { label: 'TOTAL BILLED', val: formatPDFINR(metrics.totalValue), color: cPrimary },
        { label: 'COLLECTED', val: formatPDFINR(metrics.totalCollected), color: cSuccess },
        { label: 'COLLECTION EFFICIENCY', val: `${metrics.collectionPct}%`, color: cSuccess },
        { label: 'OPEN INVOICES', val: `${metrics.openCount} / ${metrics.totalInvoices}`, color: cWarning }
      ];

      kpis.forEach((k, idx) => {
        const x = 12 + idx * (cardWidth + 3);
        doc.setFillColor(cLightBg[0], cLightBg[1], cLightBg[2]);
        doc.rect(x, startY, cardWidth, cardHeight, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(x, startY, cardWidth, cardHeight, 'S');

        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(cSecondary[0], cSecondary[1], cSecondary[2]);
        doc.text(k.label, x + 3, startY + 5);

        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(k.color[0], k.color[1], k.color[2]);
        doc.text(k.val, x + 3, startY + 12);
      });

      startY += 21;

      // Table Render
      if (viewMode === 'invoice') {
        const tableHeaders = [['#', 'Invoice Number', 'Date', 'Due Date', 'Customer Name', 'GST Number', 'Total Value', 'Amount Paid', 'Amount Pending', 'Pending %', 'Status']];
        const tableBody = processedRows.map((r, idx) => {
          const pct = r.isOperationallySettled || r.paymentStatus === 'paid' || r.paymentStatus === 'void'
            ? 0
            : Math.round((r.amountPending / r.invoiceValue) * 100);
          return [
            (idx + 1).toString(),
            r.invoiceNumber,
            r.invoiceDate,
            r.dueDate || '—',
            r.customerName,
            r.resolvedGst || '—',
            formatPDFINR(r.invoiceValue),
            formatPDFINR(r.amountPaid),
            formatPDFINR(r.amountPending),
            `${pct}%`,
            formatPDFStatus(r)
          ];
        });

        autoTable(doc, {
          startY: startY,
          head: tableHeaders,
          body: tableBody,
          theme: 'striped',
          headStyles: {
            fillColor: cPrimary,
            textColor: [255, 255, 255],
            fontSize: 7.5,
            fontStyle: 'bold',
          },
          bodyStyles: {
            fontSize: 7,
            textColor: [51, 65, 85],
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 8 },
            1: { fontStyle: 'bold', cellWidth: 28 },
            2: { cellWidth: 18 },
            3: { cellWidth: 18 },
            4: { cellWidth: 'auto' }, // Support long customer names gracefully
            5: { fontStyle: 'normal', cellWidth: 30 },
            6: { halign: 'right', cellWidth: 24 },
            7: { halign: 'right', cellWidth: 24 },
            8: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
            9: { halign: 'right', cellWidth: 18 },
            10: { halign: 'center', cellWidth: 18 },
          },
          styles: {
            cellPadding: 1.8,
            font: 'helvetica',
            overflow: 'linebreak',
          },
          didParseCell: (cellData) => {
            if (cellData.section === 'body') {
              if (cellData.column.index === 10) {
                const text = String(cellData.cell.raw);
                if (text === 'PAID') {
                  cellData.cell.styles.textColor = cSuccess;
                } else if (text === 'VOID') {
                  cellData.cell.styles.textColor = [156, 163, 175];
                } else if (text === 'OVERDUE') {
                  cellData.cell.styles.textColor = cDanger;
                } else {
                  cellData.cell.styles.textColor = cWarning;
                }
              }
              if (cellData.column.index === 8) {
                const pendingAmount = processedRows[cellData.row.index].amountPending;
                const isOverdue = processedRows[cellData.row.index].isOverdue;
                if (isOverdue) {
                  cellData.cell.styles.textColor = cDanger;
                } else if (pendingAmount > 0) {
                  cellData.cell.styles.textColor = cWarning;
                }
              }
              if (cellData.column.index === 9) {
                const r = processedRows[cellData.row.index];
                const pct = r.isOperationallySettled || r.paymentStatus === 'paid' || r.paymentStatus === 'void'
                  ? 0
                  : Math.round((r.amountPending / r.invoiceValue) * 100);
                if (pct === 0) {
                  cellData.cell.styles.textColor = [203, 213, 225];
                } else if (pct < 10) {
                  cellData.cell.styles.textColor = [148, 163, 184];
                } else if (pct < 50) {
                  cellData.cell.styles.textColor = cWarning;
                } else {
                  cellData.cell.styles.textColor = cDanger;
                }
              }
            }
          },
          margin: { left: 12, right: 12 },
        });
      } else {
        const tableHeaders = [['#', 'Customer Name', 'GST Number', 'Total Value', 'Pending Amount', 'Pending %', 'Overdue Amount', 'Unused Credits', 'Open Invoices', 'Risk Status']];
        const tableBody = customerGroups.map((g, idx) => {
          const pct = g.totalValue > 0 ? Math.round((g.totalPending / g.totalValue) * 100) : 0;
          return [
            (idx + 1).toString(),
            g.customerName,
            g.resolvedGst || '—',
            formatPDFINR(g.totalValue),
            formatPDFINR(g.totalPending),
            `${pct}%`,
            formatPDFINR(g.overdueExposure),
            g.unusedCredits !== null ? formatPDFINR(g.unusedCredits) : '—',
            `${g.openCount} / ${g.invoices.length}`,
            g.overdueCount > 0 ? 'OVERDUE' : g.openCount > 0 ? 'OPEN' : 'SETTLED'
          ];
        });

        autoTable(doc, {
          startY: startY,
          head: tableHeaders,
          body: tableBody,
          theme: 'striped',
          headStyles: {
            fillColor: cPrimary,
            textColor: [255, 255, 255],
            fontSize: 7.5,
            fontStyle: 'bold',
          },
          bodyStyles: {
            fontSize: 7,
            textColor: [51, 65, 85],
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 8 },
            1: { fontStyle: 'bold', cellWidth: 'auto' }, // Support long customer names gracefully
            2: { fontStyle: 'normal', cellWidth: 35 },
            3: { halign: 'right', cellWidth: 26 },
            4: { halign: 'right', fontStyle: 'bold', cellWidth: 26 },
            5: { halign: 'right', cellWidth: 18 },
            6: { halign: 'right', cellWidth: 26 },
            7: { halign: 'right', cellWidth: 26 },
            8: { halign: 'center', cellWidth: 20 },
            9: { halign: 'center', cellWidth: 24 },
          },
          styles: {
            cellPadding: 1.8,
            font: 'helvetica',
            overflow: 'linebreak',
          },
          didParseCell: (cellData) => {
            if (cellData.section === 'body') {
              if (cellData.column.index === 9) {
                const text = String(cellData.cell.raw);
                if (text === 'OVERDUE') {
                  cellData.cell.styles.textColor = cDanger;
                } else if (text === 'OPEN') {
                  cellData.cell.styles.textColor = cWarning;
                } else {
                  cellData.cell.styles.textColor = cSuccess;
                }
              }
              if (cellData.column.index === 4) {
                const pending = customerGroups[cellData.row.index].totalPending;
                if (pending > 0) {
                  cellData.cell.styles.textColor = cDanger;
                }
              }
              if (cellData.column.index === 5) {
                const g = customerGroups[cellData.row.index];
                const pct = g.totalValue > 0 ? Math.round((g.totalPending / g.totalValue) * 100) : 0;
                if (pct === 0) {
                  cellData.cell.styles.textColor = [203, 213, 225];
                } else if (pct < 10) {
                  cellData.cell.styles.textColor = [148, 163, 184];
                } else if (pct < 50) {
                  cellData.cell.styles.textColor = cWarning;
                } else {
                  cellData.cell.styles.textColor = cDanger;
                }
              }
              if (cellData.column.index === 7) {
                const credits = customerGroups[cellData.row.index].unusedCredits;
                if (credits !== null && credits > 0) {
                  cellData.cell.styles.textColor = cSuccess;
                }
              }
            }
          },
          margin: { left: 12, right: 12 },
        });
      }

      // Page numbers footer
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(cSecondary[0], cSecondary[1], cSecondary[2]);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - 12, pageHeight - 6, { align: 'right' });
        doc.text('Kamna Traders B2B Receivables Command Center', 12, pageHeight - 6);
      }

      const filename = `accounts-summary-${viewMode}-${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);
      toast.success('PDF Downloaded!', { id: 'pdf-generation' });
    } catch (err) {
      console.error('[PDF Export Error]', err);
      toast.error('Failed to generate PDF.', { id: 'pdf-generation' });
    }
  };

  // ─── API: enrichment ────────────────────────────────────────────────────────
  const enrichCustomers = useCallback(async (customerIds: string[]): Promise<void> => {
    let duplicateCount = 0;
    const missing = customerIds.filter((id) => {
      if (fetchedCustomerIds.current.has(id)) {
        duplicateCount++;
        return false;
      }
      return true;
    });
    
    redundantFetchesAvoided.current += duplicateCount;
    
    if (missing.length === 0) return;
    setEnriching(true);
    try {
      const res = await fetch('/api/accounts/summary/enrich-customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerIds: missing }),
      });
      const result = await res.json();
      if (result.success && result.data) {
        missing.forEach((id) => fetchedCustomerIds.current.add(id));
        setEnrichMap((prev) => ({ ...prev, ...result.data }));
      }
    } catch {
      // Non-fatal
    } finally {
      setEnriching(false);
    }
  }, []);

  // ─── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const cached = await loadCache();
        if (cached) setData(cached);
        else await fetchForRange('today', true);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!data || loading) return;
    if (!cacheCovers(lookback, data)) {
      setAutoFetching(true);
      fetchForRange(lookback, false).finally(() => setAutoFetching(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookback]);

  // ─── Derived rows ───────────────────────────────────────────────────────────
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
        const enrichment = enrichMap[r.customerId];
        return {
          ...r,
          isOperationallySettled: settled,
          isOverdue:
            opOpen &&
            r.paymentStatus !== 'void' &&
            !!r.dueDate &&
            r.dueDate < today,
          resolvedGst: resolveGst(r, enrichment),
        };
      });
  }, [data, lookback, enrichMap]);

  // ─── Status filter ──────────────────────────────────────────────────────────
  const statusRows: ExtendedRow[] = useMemo(() => {
    switch (statusFilter) {
      case 'paid': return lookbackRows.filter((r) => r.paymentStatus === 'paid' || r.isOperationallySettled);
      case 'void': return lookbackRows.filter((r) => r.paymentStatus === 'void');
      case 'open': return lookbackRows.filter(
        (r) => r.paymentStatus !== 'paid' && r.paymentStatus !== 'void' && !r.isOperationallySettled
      );
      default: return lookbackRows;
    }
  }, [lookbackRows, statusFilter]);

  // ─── Trigger enrichment strictly on Open tab or visible rows ─────────────
  useEffect(() => {
    if (statusFilter !== 'open' && viewMode === 'invoice') return; // Enriched lazily for open only, or customer view
    const openRows = lookbackRows.filter(
      (r) => r.paymentStatus !== 'paid' && r.paymentStatus !== 'void' && !r.isOperationallySettled
    );
    const uniqueIds = [...new Set(openRows.map((r) => r.customerId).filter(Boolean))];
    if (uniqueIds.length > 0) enrichCustomers(uniqueIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, lookbackRows, viewMode]);

  // ─── Search + Sort (Invoice View) ───────────────────────────────────────────
  const processedRows = useMemo(() => {
    let rows = [...statusRows];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.invoiceNumber.toLowerCase().includes(term) ||
          r.customerName.toLowerCase().includes(term) ||
          (r.resolvedGst && r.resolvedGst.toLowerCase().includes(term))
      );
    }

    rows.sort((a, b) => {
      if (sortField === 'pendingPercent') {
        const getPct = (r: ExtendedRow) =>
          r.isOperationallySettled || r.paymentStatus === 'paid' || r.paymentStatus === 'void'
            ? 0
            : r.amountPending / r.invoiceValue;
        const aPct = getPct(a);
        const bPct = getPct(b);
        return sortDesc ? bPct - aPct : aPct - bPct;
      }
      if (sortField === 'unusedCredits') {
        const aC = enrichMap[a.customerId]?.unusedCredits ?? 0;
        const bC = enrichMap[b.customerId]?.unusedCredits ?? 0;
        return sortDesc ? bC - aC : aC - bC;
      }
      const sf = sortField as keyof ExtendedRow;
      const aVal = a[sf];
      const bVal = b[sf];
      if (aVal == null) return sortDesc ? 1 : -1;
      if (bVal == null) return sortDesc ? -1 : 1;
      if (typeof aVal === 'string')
        return sortDesc ? (bVal as string).localeCompare(aVal) : aVal.localeCompare(bVal as string);
      if (typeof aVal === 'boolean')
        return sortDesc ? (bVal ? 1 : -1) : aVal ? 1 : -1;
      return sortDesc ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });

    return rows;
  }, [statusRows, searchTerm, sortField, sortDesc, enrichMap]);

  // ─── Customer Grouping (Customer View) ───────────────────────────────────────
  const customerGroups: CustomerGroup[] = useMemo(() => {
    const groups = new Map<string, CustomerGroup>();
    
    for (const row of processedRows) {
      const enrichment = enrichMap[row.customerId];
      let group = groups.get(row.customerId);
      if (!group) {
        group = {
          customerId: row.customerId,
          customerName: row.customerName,
          resolvedGst: row.resolvedGst,
          invoices: [],
          totalValue: 0,
          totalCollected: 0,
          totalPending: 0,
          overdueExposure: 0,
          overdueCount: 0,
          openCount: 0,
          latestInvoiceDate: '1970-01-01',
          unusedCredits: enrichment?.unusedCredits ?? null,
        };
        groups.set(row.customerId, group);
      }

      group.invoices.push(row);
      if (row.paymentStatus !== 'void') {
        group.totalValue += row.invoiceValue;
        group.totalCollected += row.amountPaid;
      }
      
      const isEffOpen = row.paymentStatus !== 'paid' && row.paymentStatus !== 'void' && !row.isOperationallySettled;
      if (isEffOpen) {
        group.totalPending += row.amountPending;
        group.openCount += 1;
        if (row.isOverdue) {
          group.overdueExposure += row.amountPending;
          group.overdueCount += 1;
        }
      }

      if (row.invoiceDate > group.latestInvoiceDate) {
        group.latestInvoiceDate = row.invoiceDate;
      }
    }

    const arr = Array.from(groups.values());
    
    // Sort customer groups dynamically based on active sortField and sortDesc
    arr.sort((a, b) => {
      let aVal: any = 0;
      let bVal: any = 0;
      if (sortField === 'customerName') {
        aVal = a.customerName;
        bVal = b.customerName;
      } else if (sortField === 'amountPending' || sortField === 'invoiceDate') {
        aVal = a.totalPending;
        bVal = b.totalPending;
      } else if (sortField === 'unusedCredits') {
        aVal = a.unusedCredits ?? 0;
        bVal = b.unusedCredits ?? 0;
      } else if (sortField === 'pendingPercent') {
        const aPct = a.totalValue > 0 ? (a.totalPending / a.totalValue) : 0;
        const bPct = b.totalValue > 0 ? (b.totalPending / b.totalValue) : 0;
        return sortDesc ? bPct - aPct : aPct - bPct;
      } else {
        aVal = a.totalPending;
        bVal = b.totalPending;
      }
      
      if (typeof aVal === 'string') {
        return sortDesc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }
      return sortDesc ? bVal - aVal : aVal - bVal;
    });
    
    return arr;
  }, [processedRows, enrichMap, sortField, sortDesc]);

  // ─── Metrics ────────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const nonVoid = lookbackRows.filter((r) => r.paymentStatus !== 'void');
    const effectiveOpen = lookbackRows.filter(
      (r) => r.paymentStatus !== 'paid' && r.paymentStatus !== 'void' && !r.isOperationallySettled
    );
    const effectivePaid = lookbackRows.filter((r) => r.paymentStatus === 'paid' || r.isOperationallySettled);
    const totalValue     = nonVoid.reduce((s, r) => s + r.invoiceValue, 0);
    const totalCollected = nonVoid.reduce((s, r) => s + r.amountPaid, 0);
    const totalPending   = effectiveOpen.reduce((s, r) => s + r.amountPending, 0);
    const totalInvoices  = nonVoid.length;
    const fullyPaid      = effectivePaid.length;
    const openCount      = effectiveOpen.length;
    const voidCount      = lookbackRows.filter((r) => r.paymentStatus === 'void').length;
    const overdue        = effectiveOpen.filter((r) => r.isOverdue).length;
    const customersBilled = new Set(nonVoid.map((r) => r.customerName)).size;
    const collectionPct  = totalValue > 0 ? Math.round((totalCollected / totalValue) * 100) : 0;
    return {
      totalValue, totalCollected, totalPending, totalInvoices,
      fullyPaid, openCount, voidCount, overdue, customersBilled, collectionPct,
      effectiveOpen,
    };
  }, [lookbackRows]);

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleSort = (field: keyof ExtendedRow | 'unusedCredits' | 'pendingPercent') => {
    if (sortField === field) setSortDesc((d) => !d);
    else { setSortField(field); setSortDesc(true); }
  };

  const toggleCustomerExpanded = (customerId: string) => {
    setExpandedCustomers(prev => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  };

  const handleCopy = () => {
    const json = JSON.stringify(data, null, 2);
    const doSet = () => { setCopied(true); toast.success('Copied!'); setTimeout(() => setCopied(false), 2000); };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(json).then(doSet).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = json; ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta); doSet();
      });
    }
  };

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  // ─── UI derivations ──────────────────────────────────────────────────────────
  const usingMock = data?.summary?.usingMock;
  const { totalValue, totalCollected, totalPending, totalInvoices, fullyPaid, openCount, voidCount, overdue, collectionPct, effectiveOpen } = metrics;

  const PERIOD_OPTIONS: { id: LookbackPeriod; label: string }[] = [
    { id: 'today',     label: 'Today'     },
    { id: 'yesterday', label: 'Yesterday' },
    { id: '3days',     label: '3D'        },
    { id: '7days',     label: '7D'        },
    { id: '15days',    label: '15D'       },
  ];

  const FILTER_TABS: { id: FilterKey; label: string; count: number }[] = [
    { id: 'all',  label: 'All',  count: totalInvoices },
    { id: 'paid', label: 'Paid', count: fullyPaid     },
    { id: 'open', label: 'Open', count: openCount     },
    { id: 'void', label: 'Void', count: voidCount     },
  ];

  const showCreditsCol = statusFilter === 'open' || viewMode === 'customer';

  // ─── Column definitions (Invoice View) ───────────────────────────────────────
  const columns = [
    { label: '#',        field: null,              cls: 'w-10 text-center'    },
    { label: 'Invoice',  field: 'invoiceNumber',   cls: 'w-[140px] text-left' },
    { label: 'Date',     field: 'invoiceDate',     cls: 'w-[120px] text-left' },
    { label: 'Customer', field: 'customerName',    cls: 'text-left'           },
    { label: 'Value',    field: 'invoiceValue',    cls: 'w-[110px] text-right'},
    { label: 'Paid',     field: 'amountPaid',      cls: 'w-[115px] text-right'},
    { label: 'Pending',  field: 'amountPending',   cls: 'w-[115px] text-right'},
    { label: 'Pending %', field: 'pendingPercent', cls: 'w-[110px] text-right'},
    ...(showCreditsCol
      ? [{ label: 'Unused Credits', field: 'unusedCredits', cls: 'w-[110px] text-right' }]
      : []),
    { label: 'Status',   field: 'paymentStatus',   cls: 'w-[110px] text-center'},
    { label: '',         field: null,              cls: 'w-10 text-center'    },
  ];

  const dailyCredits = data?.summary?.dailyCreditsUsed ?? 0;
  const creditsLimit = 1000;
  const remainingCredits = Math.max(0, creditsLimit - dailyCredits);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full px-6 py-6 space-y-5" style={{ background: '#F8FAFC', fontFamily: "'Inter', sans-serif" }}>

      {/* Soft Refresh Loading Bar */}
      {isAnyRefreshing && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-slate-100 z-50 overflow-hidden">
          <div className="h-full bg-slate-600 animate-infinite-loading" />
        </div>
      )}

      {/* DEV BANNER */}
      {usingMock && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-700 font-medium">
          <AlertCircle size={13} className="shrink-0" />
          <span><strong>Dev Mode:</strong> Displaying simulated data. Connect Zoho credentials to see live records.</span>
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold leading-tight" style={{ color: '#0F172A', letterSpacing: '-0.01em' }}>
            Accounts Summary
          </h1>
          <p className="text-xs mt-1" style={{ color: '#64748B' }}>
            Operational Receivables Workspace
            {data && (
              <>
                {' • Updated '}
                <span className="font-medium" style={{ color: '#475569' }}>{timeAgo(data.generatedAt)}</span>
                {' • '}
                <span>1 invoice sync • {Object.keys(enrichMap).length} customer enrichments</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* VIEW MODE TOGGLE */}
          <div className="flex items-center rounded-lg overflow-hidden border mr-2" style={{ borderColor: '#E2E8F0', background: '#fff' }}>
            <button onClick={() => setViewMode('invoice')}
              className="last:border-r-0 hover:bg-slate-50 transition-colors"
              style={{
                borderRight: '1px solid #E2E8F0',
                background: viewMode === 'invoice' ? '#0F172A' : 'transparent',
                color: viewMode === 'invoice' ? '#fff' : '#64748B',
                padding: '6px 14px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              }}>
              Invoice View
            </button>
            <button onClick={() => setViewMode('customer')}
              className="hover:bg-slate-50 transition-colors"
              style={{
                background: viewMode === 'customer' ? '#0F172A' : 'transparent',
                color: viewMode === 'customer' ? '#fff' : '#64748B',
                padding: '6px 14px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              }}>
              Customer View
            </button>
          </div>

          <div className="flex items-center rounded-lg overflow-hidden border" style={{ borderColor: '#E2E8F0', background: '#fff' }}>
            {PERIOD_OPTIONS.map((p) => (
              <button key={p.id} onClick={() => setLookback(p.id)} disabled={refreshing || autoFetching}
                className="last:border-r-0 disabled:opacity-50 hover:bg-slate-50"
                style={{
                  borderRight: '1px solid #E2E8F0',
                  background: lookback === p.id ? '#0F172A' : 'transparent',
                  color: lookback === p.id ? '#fff' : '#64748B',
                  padding: '6px 14px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  {p.label}
              </button>
            ))}
          </div>

          {/* Download Dropdown */}
          <div className="relative" ref={downloadRef}>
            <button onClick={() => setDownloadOpen(v => !v)}
              className="flex items-center gap-1.5 rounded-lg text-[11px] font-semibold transition-colors border hover:bg-slate-50"
              style={{ borderColor: '#E2E8F0', background: '#fff', color: '#475569', padding: '7px 14.5px', cursor: 'pointer' }}>
              <span>Download</span>
              <ChevronDown size={11} />
            </button>
            {downloadOpen && (
              <div className="absolute right-0 top-8 z-50 w-32 bg-white border border-slate-200 rounded-lg shadow-lg py-1 text-[11px] font-semibold">
                <button onClick={() => { setDownloadOpen(false); exportToPDF(); }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 hover:bg-slate-50 text-slate-700 text-left cursor-pointer">
                  Download PDF
                </button>
                <button onClick={() => { setDownloadOpen(false); exportToCSV(); }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 hover:bg-slate-50 text-slate-700 text-left cursor-pointer">
                  Download CSV
                </button>
              </div>
            )}
          </div>

          <button 
            onClick={() => fetchForRange(lookback, false)} 
            disabled={isAnyRefreshing || cooldownRemaining > 0}
            className="flex items-center gap-2 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50"
            style={{ background: '#475569', color: '#fff', padding: '7px 14px', cursor: 'pointer' }}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : autoFetching ? 'Loading…' : cooldownRemaining > 0 ? `Refresh in ${cooldownRemaining}s` : 'Refresh'}
          </button>
        </div>
      </div>

      {/* BENTO GRID */}
      {data && (
        <div className="grid grid-cols-5 gap-4">
          {/* Card 1 — Outstanding Health */}
          <div className="col-span-3 rounded-2xl p-6" style={{ background: '#fff', border: '1px solid #E2E8F0' }}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#94A3B8' }}>Total Outstanding</p>
                <p className="text-4xl font-bold tabular-nums leading-none"
                  style={{ color: '#DC2626', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                  {formatINR(totalPending)}
                </p>
                <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>
                  Across {openCount} open invoice{openCount !== 1 ? 's' : ''}
                  {overdue > 0 && <span className="ml-2 text-red-600 font-semibold">· {overdue} overdue</span>}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#94A3B8' }}>Total Billed</p>
                <p className="text-xl font-bold tabular-nums" style={{ color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                  {formatINR(totalValue)}
                </p>
              </div>
            </div>
            <TopOpenExposure openRows={effectiveOpen} />
          </div>

          {/* Card 2 — Collection Efficiency */}
          <div className="col-span-2 rounded-2xl p-6 flex flex-col justify-between" style={{ background: '#fff', border: '1px solid #E2E8F0' }}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>Collection Efficiency</p>
                {data && (
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                    remainingCredits < 100
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : remainingCredits < 400
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                  title={`${dailyCredits} / 1000 API credits used today`}>
                    <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse" style={{
                      backgroundColor: remainingCredits < 100 ? '#DC2626' : remainingCredits < 400 ? '#D97706' : '#059669'
                    }} />
                    <span>{remainingCredits} API credits left</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-5">
                <CollectionGauge pct={collectionPct} />
                <div className="space-y-3 flex-1">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Collected</p>
                    <p className="text-xl font-bold tabular-nums mt-0.5" style={{ color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                      {formatINR(totalCollected)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Pending</p>
                    <p className="text-xl font-bold tabular-nums mt-0.5" style={{ color: '#DC2626', fontVariantNumeric: 'tabular-nums' }}>
                      {formatINR(totalPending)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4 pt-4" style={{ borderTop: '1px solid #F1F5F9' }}>
              {[
                { label: 'Invoices',  value: totalInvoices,             color: '#0F172A' },
                { label: 'Customers', value: metrics.customersBilled,   color: '#0F172A' },
                { label: 'Paid',      value: fullyPaid,                 color: '#059669' },
                { label: 'Open',      value: openCount,                 color: '#D97706' },
              ].map((s) => (
                <div key={s.label} className="flex-1 text-center rounded-lg py-2" style={{ background: '#F8FAFC' }}>
                  <p className="text-[15px] font-bold tabular-nums" style={{ color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
                  <p className="text-[9px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: '#94A3B8' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TABLE SECTION */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E2E8F0' }}>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-0.5">
            {FILTER_TABS.map((tab) => {
              const isActive = statusFilter === tab.id;
              return (
                <button key={tab.id} onClick={() => setStatusFilter(tab.id)}
                  className="relative px-3.5 py-2 text-[11px] font-semibold rounded-lg transition-all"
                  style={{ color: isActive ? '#0F172A' : '#94A3B8', background: isActive ? '#F1F5F9' : 'transparent' }}>
                  {tab.label}
                  <span className="ml-1.5 text-[10px] font-bold tabular-nums"
                    style={{ color: isActive ? '#475569' : '#CBD5E1', fontVariantNumeric: 'tabular-nums' }}>
                    ({tab.count})
                  </span>
                  {isActive && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full" style={{ background: '#0F172A' }} />
                  )}
                </button>
              );
            })}
            {enriching && (
              <span className="ml-3 text-[10px] text-slate-400 flex items-center gap-1">
                <RefreshCw size={9} className="animate-spin" /> Fetching customer data…
              </span>
            )}
          </div>

          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
            <input type="text" placeholder="Search invoice, customer, or GST…"
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 text-[11px] rounded-lg focus:outline-none w-64 placeholder:text-slate-400"
              style={{ border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#0F172A' }}
              onFocus={(e) => { e.target.style.borderColor = '#94A3B8'; }}
              onBlur={(e) => { e.target.style.borderColor = '#E2E8F0'; }}
            />
          </div>
        </div>

        {/* Table View Toggle Container */}
        <div className="overflow-x-auto" style={{ maxHeight: '520px' }}>
          
          {viewMode === 'invoice' ? (
            /* INVOICE VIEW */
            <table className="w-full border-collapse" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <thead className="sticky top-0 z-10" style={{ background: '#F8FAFC' }}>
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  {columns.map((col, ci) => (
                    <th key={`${col.label}-${ci}`}
                      className={`py-3 px-4 text-[10px] font-bold uppercase tracking-wider select-none ${col.cls} ${col.field ? 'cursor-pointer hover:text-slate-700' : ''}`}
                      style={{ color: '#94A3B8' }}
                      onClick={col.field ? () => handleSort(col.field as keyof ExtendedRow | 'unusedCredits' | 'pendingPercent') : undefined}>
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {col.field && (
                          <ArrowUpDown size={10}
                            style={{ opacity: sortField === col.field ? 1 : 0.35, color: sortField === col.field ? '#0F172A' : undefined }} />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {processedRows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="py-16 text-center">
                      <p className="text-sm font-medium" style={{ color: '#94A3B8' }}>No invoices match this filter</p>
                      <p className="text-xs mt-1" style={{ color: '#CBD5E1' }}>Try adjusting the date range or status filter</p>
                    </td>
                  </tr>
                ) : (
                  processedRows.map((row, idx) => {
                    const isHovered = hoveredRow === row.invoiceId;
                    const isMock = row.invoiceId.startsWith('mock-');
                    const invoiceUrl = isMock ? '#' : `https://books.zoho.in/app#/invoices/${row.invoiceId}`;
                    const { date: displayDate, time: displayTime } = formatDateDisplay(row.invoiceDate, row.createdTime);
                    const enrichment = enrichMap[row.customerId];
                    const unusedCredits = enrichment?.unusedCredits ?? null;
                    const hasCredits = unusedCredits !== null && unusedCredits > 0;

                    return (
                      <tr key={row.invoiceId}
                        onMouseEnter={() => setHoveredRow(row.invoiceId)}
                        onMouseLeave={() => setHoveredRow(null)}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          background: isHovered ? '#F1F5F9' : idx % 2 === 1 ? '#FAFBFC' : '#fff',
                          transition: 'background 0.1s ease',
                          opacity: row.paymentStatus === 'void' ? 0.5 : 1,
                          ...(row.isOverdue ? { borderLeft: '3px solid #EF4444' } : { borderLeft: '3px solid transparent' }),
                        }}>

                        {/* # */}
                        <td className="py-3 px-4 text-center" style={{ color: '#CBD5E1', fontSize: '10px', fontWeight: 500 }}>{idx + 1}</td>

                        {/* Invoice */}
                        <td className="py-3 px-4">
                          {isMock ? (
                            <span className="text-[12px] font-bold" style={{ color: '#1E3A8A' }}>{row.invoiceNumber}</span>
                          ) : (
                            <a href={invoiceUrl} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 group"
                              style={{ color: '#1E3A8A', fontSize: '12px', fontWeight: 700 }}>
                              {row.invoiceNumber}
                              <ExternalLink size={10} style={{ opacity: 0, transition: 'opacity 0.1s' }} className="group-hover:opacity-60" />
                            </a>
                          )}
                        </td>

                        {/* Date */}
                        <td className="py-3 px-4">
                          <p className="text-[11px] font-medium" style={{ color: '#334155' }}>{displayDate}</p>
                          {displayTime && <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>{displayTime}</p>}
                        </td>

                        {/* Customer — with hover card */}
                        <td className="py-3 px-4" style={{ maxWidth: '220px' }}>
                          <CustomerCell row={row} enrichment={enrichment} statusFilter={statusFilter} />
                        </td>

                        {/* Value */}
                        <td className="py-3 px-4 text-right">
                          <p className="text-[12px] font-bold tabular-nums" style={{ color: '#0F172A' }}>
                            {formatINR(row.invoiceValue)}
                          </p>
                        </td>

                        {/* Paid */}
                        <td className="py-3 px-4 text-right">
                          <p className="text-[12px] font-semibold tabular-nums" style={{ color: '#059669' }}>
                            {formatINR(row.amountPaid)}
                          </p>
                          {row.paymentProgress > 0 && row.paymentStatus !== 'void' && (
                            <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>{row.paymentProgress}% paid</p>
                          )}
                        </td>

                        {/* Pending */}
                        <td className="py-3 px-4 text-right">
                          <p className="text-[12px] font-semibold tabular-nums"
                            style={{
                              color: row.isOverdue ? '#DC2626' : row.amountPending > 0 && !row.isOperationallySettled ? '#D97706' : '#94A3B8',
                              fontWeight: row.isOverdue ? 700 : 600,
                            }}>
                            {formatINR(row.amountPending)}
                          </p>
                          {row.dueDate && row.paymentStatus !== 'paid' && row.paymentStatus !== 'void' && !row.isOperationallySettled && (
                            <p className="text-[10px] mt-0.5" style={{ color: row.isOverdue ? '#FCA5A5' : '#CBD5E1' }}>
                              Due {new Date(row.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </p>
                          )}
                        </td>

                        {/* Pending % */}
                        <td className="py-3 px-4 text-right">
                          {(() => {
                            const pct = row.isOperationallySettled || row.paymentStatus === 'paid' || row.paymentStatus === 'void'
                              ? 0
                              : Math.round((row.amountPending / row.invoiceValue) * 100);
                            
                            const colorClass = pct === 0 ? 'text-slate-300'
                              : pct < 10 ? 'text-slate-400 font-medium'
                              : pct < 50 ? 'text-amber-600 font-semibold'
                              : 'text-red-600 font-bold';

                            return (
                              <div className="flex flex-col items-end">
                                <span className={`text-[12px] tabular-nums ${colorClass}`}>{pct}%</span>
                                {pct > 0 && (
                                  <div className="w-12 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden shrink-0">
                                    <div className={`h-full rounded-full ${
                                      pct < 10 ? 'bg-slate-400' : pct < 50 ? 'bg-amber-500' : 'bg-red-500'
                                    }`} style={{ width: `${pct}%` }} />
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        {/* Unused Credits — Open view only */}
                        {showCreditsCol && (
                          <td className="py-3 px-4 text-right">
                            {unusedCredits === null ? (
                              <span className="text-[10px]" style={{ color: '#CBD5E1' }}>—</span>
                            ) : hasCredits ? (
                              <div>
                                <p className="text-[12px] font-semibold tabular-nums"
                                  style={{ color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                                  {formatINR(unusedCredits)}
                                </p>
                                <p className="text-[9px] mt-0.5 font-semibold" style={{ color: '#34D399' }}>Available</p>
                              </div>
                            ) : (
                              <p className="text-[11px] tabular-nums" style={{ color: '#CBD5E1', fontVariantNumeric: 'tabular-nums' }}>₹0</p>
                            )}
                          </td>
                        )}

                        {/* Status */}
                        <td className="py-3 px-4 text-center"><StatusPill row={row} /></td>

                        {/* Actions */}
                        <td className="py-3 px-2 text-center">
                          {(() => {
                            const invCooldown = getInvoiceCooldown(row);
                            return (
                              <div className="flex items-center justify-center gap-1" style={{ opacity: isHovered || invCooldown > 0 ? 1 : 0, transition: 'opacity 0.15s' }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleInvoiceRefresh(row.invoiceId); }}
                                  disabled={isAnyRefreshing || invCooldown > 0}
                                  className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                                  title={invCooldown > 0 ? `Available in ${invCooldown}s` : 'Refresh Invoice'}
                                >
                                  {invCooldown > 0 ? (
                                    <span className="text-[9px] font-bold tabular-nums text-slate-500">{invCooldown}s</span>
                                  ) : (
                                    <RefreshCw size={12} className={refreshingInvoiceId === row.invoiceId ? 'animate-spin' : ''} />
                                  )}
                                </button>
                                <RowActions row={row} />
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* CUSTOMER VIEW */
            <div className="w-full">
              <div className="grid grid-cols-12 gap-4 px-5 py-3 sticky top-0 z-10" style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <div className="col-span-3 text-[10px] font-bold uppercase tracking-wider select-none cursor-pointer flex items-center gap-1"
                  style={{ color: '#94A3B8' }}
                  onClick={() => handleSort('customerName')}>
                  Customer / GST
                  <ArrowUpDown size={10} style={{ opacity: sortField === 'customerName' ? 1 : 0.35, color: sortField === 'customerName' ? '#0F172A' : undefined }} />
                </div>
                <div className="col-span-2 text-[10px] font-bold uppercase tracking-wider select-none cursor-pointer flex items-center justify-end gap-1"
                  style={{ color: '#94A3B8' }}
                  onClick={() => handleSort('amountPending')}>
                  Outstanding
                  <ArrowUpDown size={10} style={{ opacity: sortField === 'amountPending' ? 1 : 0.35, color: sortField === 'amountPending' ? '#0F172A' : undefined }} />
                </div>
                <div className="col-span-2 text-[10px] font-bold uppercase tracking-wider select-none cursor-pointer flex items-center justify-end gap-1"
                  style={{ color: '#94A3B8' }}
                  onClick={() => handleSort('pendingPercent')}>
                  Pending %
                  <ArrowUpDown size={10} style={{ opacity: sortField === 'pendingPercent' ? 1 : 0.35, color: sortField === 'pendingPercent' ? '#0F172A' : undefined }} />
                </div>
                <div className="col-span-2 text-[10px] font-bold uppercase tracking-wider select-none cursor-pointer flex items-center justify-end gap-1"
                  style={{ color: '#94A3B8' }}
                  onClick={() => handleSort('unusedCredits')}>
                  Unused Credits
                  <ArrowUpDown size={10} style={{ opacity: sortField === 'unusedCredits' ? 1 : 0.35, color: sortField === 'unusedCredits' ? '#0F172A' : undefined }} />
                </div>
                <div className="col-span-1 text-[10px] font-bold uppercase tracking-wider text-center" style={{ color: '#94A3B8' }}>Invoices</div>
                <div className="col-span-2 text-[10px] font-bold uppercase tracking-wider text-center" style={{ color: '#94A3B8' }}>Risk Status</div>
              </div>

              {customerGroups.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm font-medium" style={{ color: '#94A3B8' }}>No customers match this filter</p>
                  <p className="text-xs mt-1" style={{ color: '#CBD5E1' }}>Try adjusting the date range or status filter</p>
                </div>
              ) : (
                customerGroups.map((group, idx) => {
                  const isExpanded = expandedCustomers.has(group.customerId);
                  const hasCredits = group.unusedCredits !== null && group.unusedCredits > 0;
                  const statementUrl = buildStatementUrl(group.customerId);

                  return (
                    <div key={group.customerId} className="group transition-colors border-b last:border-0"
                      style={{ borderColor: '#F1F5F9', background: idx % 2 === 1 ? '#FAFBFC' : '#fff' }}>
                      
                      {/* Customer Parent Row */}
                      <div 
                        className="grid grid-cols-12 gap-4 px-5 py-4 items-center cursor-pointer hover:bg-slate-50 relative group"
                        onClick={() => toggleCustomerExpanded(group.customerId)}
                      >
                        <div className="col-span-3 flex items-center gap-3">
                          <button className="p-1 rounded-md bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600 transition-colors">
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-[13px] font-bold" style={{ color: '#0F172A' }}>{group.customerName}</p>
                              {statusFilter === 'open' && enrichMap[group.customerId]?.tallyReady && (
                                <span title="Tally Ready" className="flex shrink-0">
                                  <Check size={11} color="#059669" />
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-mono mt-0.5" style={{ color: '#94A3B8' }}>
                              {(() => {
                                const city = enrichMap[group.customerId]?.billingCity;
                                return [group.resolvedGst, city].filter(Boolean).join(' · ') || 'No GST available';
                              })()}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-1 font-mono">
                              {(() => {
                                const sortedInvs = [...group.invoices].sort((a,b) => b.invoiceDate.localeCompare(a.invoiceDate));
                                const preview = sortedInvs.slice(0, 3).map(inv => inv.invoiceNumber.split('/').pop() || inv.invoiceNumber).join(', ') + (group.invoices.length > 3 ? '...' : '');
                                return `${group.invoices.length} invoice${group.invoices.length !== 1 ? 's' : ''}: ${preview}`;
                              })()}
                            </p>
                          </div>
                        </div>

                        <div className="col-span-2 text-right">
                          <p className="text-[13px] font-bold tabular-nums" style={{ color: group.totalPending > 0 ? '#DC2626' : '#0F172A' }}>
                            {formatINR(group.totalPending)}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                            Billed: {formatINR(group.totalValue)}
                          </p>
                          {group.overdueExposure > 0 && (
                            <p className="text-[9.5px] font-semibold mt-0.5" style={{ color: '#B91C1C' }}>
                              {formatINR(group.overdueExposure)} Overdue
                            </p>
                          )}
                        </div>

                        {/* Pending % */}
                        <div className="col-span-2 text-right">
                          {(() => {
                            const pct = group.totalValue > 0 ? Math.round((group.totalPending / group.totalValue) * 100) : 0;
                            const colorClass = pct === 0 ? 'text-slate-300'
                              : pct < 10 ? 'text-slate-400 font-medium'
                              : pct < 50 ? 'text-amber-600 font-semibold'
                              : 'text-red-600 font-bold';

                            return (
                              <div className="flex flex-col items-end">
                                <span className={`text-[13px] tabular-nums ${colorClass}`}>{pct}%</span>
                                {pct > 0 && (
                                  <div className="w-12 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden shrink-0">
                                    <div className={`h-full rounded-full ${
                                      pct < 10 ? 'bg-slate-400' : pct < 50 ? 'bg-amber-500' : 'bg-red-500'
                                    }`} style={{ width: `${pct}%` }} />
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        <div className="col-span-2 text-right">
                          {group.unusedCredits === null ? (
                            <span className="text-[11px] tabular-nums" style={{ color: '#CBD5E1' }}>—</span>
                          ) : hasCredits ? (
                            <div>
                              <p className="text-[13px] font-bold tabular-nums" style={{ color: '#059669' }}>{formatINR(group.unusedCredits)}</p>
                              <p className="text-[9px] font-semibold mt-0.5" style={{ color: '#34D399' }}>Available</p>
                            </div>
                          ) : (
                            <p className="text-[11px] tabular-nums" style={{ color: '#CBD5E1' }}>₹0</p>
                          )}
                        </div>

                        <div className="col-span-1 text-center">
                          <p className="text-[13px] font-bold tabular-nums" style={{ color: '#0F172A' }}>
                            {group.openCount} <span className="text-[11px] font-normal text-slate-400">/ {group.invoices.length}</span>
                          </p>
                          {(() => {
                            const sortedInvs = [...group.invoices].sort((a,b) => b.invoiceDate.localeCompare(a.invoiceDate));
                            const latest = sortedInvs[0];
                            if (!latest) return null;
                            const { date } = formatDateDisplay(latest.invoiceDate, latest.createdTime);
                            return (
                              <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                                Last: {date}
                              </p>
                            );
                          })()}
                        </div>

                        <div className="col-span-2 flex justify-center items-center gap-1.5">
                          {group.overdueCount > 0 ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-red-50 text-red-700 border border-red-100">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                              {group.overdueCount} Overdue
                            </span>
                          ) : group.openCount > 0 ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700">
                              Open Balance
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                              Settled
                            </span>
                          )}
                          {(() => {
                            const custCooldown = getCustomerCooldown(group.customerId);
                            return (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCustomerRefresh(group.customerId); }}
                                disabled={isAnyRefreshing || custCooldown > 0}
                                className={`p-1.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-50 ${custCooldown > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                title={custCooldown > 0 ? `Available in ${custCooldown}s` : 'Refresh Customer'}
                              >
                                {custCooldown > 0 ? (
                                  <span className="text-[9px] font-bold tabular-nums text-slate-500">{custCooldown}s</span>
                                ) : (
                                  <RefreshCw size={12} className={refreshingCustomerId === group.customerId ? 'animate-spin' : ''} />
                                )}
                              </button>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Expanded Invoices Sub-table */}
                      {isExpanded && (
                        <div className="px-12 py-4 bg-slate-50 border-t border-slate-100 shadow-inner">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#64748B' }}>Invoice Ledger</h4>
                            <a href={statementUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-md text-[10px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
                              <FileText size={11} /> View Full Statement
                            </a>
                          </div>
                          
                          <table className="w-full text-left" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            <thead>
                              <tr className="border-b border-slate-200">
                                <th className="py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-[120px]">Invoice</th>
                                <th className="py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-[100px]">Date</th>
                                <th className="py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right w-[100px]">Total</th>
                                <th className="py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right w-[100px]">Pending</th>
                                <th className="py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right w-[80px]">Pending %</th>
                                <th className="py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center w-[100px]">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.invoices.sort((a,b) => b.invoiceDate.localeCompare(a.invoiceDate)).map(inv => {
                                const { date } = formatDateDisplay(inv.invoiceDate, inv.createdTime);
                                return (
                                  <tr key={inv.invoiceId} className="border-b border-slate-100 last:border-0 hover:bg-white transition-colors">
                                    <td className="py-2.5 text-[11px] font-bold text-slate-700">
                                      <a href={inv.invoiceId.startsWith('mock-') ? '#' : `https://books.zoho.in/app#/invoices/${inv.invoiceId}`} 
                                        target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                                        {inv.invoiceNumber} <ExternalLink size={9} className="opacity-50" />
                                      </a>
                                    </td>
                                    <td className="py-2.5 text-[11px] text-slate-500">{date}</td>
                                    <td className="py-2.5 text-[11px] font-bold text-slate-700 text-right">{formatINR(inv.invoiceValue)}</td>
                                    <td className="py-2.5 text-[11px] font-bold text-right" style={{ color: inv.isOverdue ? '#DC2626' : inv.amountPending > 0 ? '#D97706' : '#94A3B8' }}>
                                      {formatINR(inv.amountPending)}
                                    </td>
                                    <td className="py-2.5 text-[11px] text-right font-medium tabular-nums">
                                      {(() => {
                                        const pct = inv.isOperationallySettled || inv.paymentStatus === 'paid' || inv.paymentStatus === 'void'
                                          ? 0
                                          : Math.round((inv.amountPending / inv.invoiceValue) * 100);
                                        
                                        const colorClass = pct === 0 ? 'text-slate-300'
                                          : pct < 10 ? 'text-slate-400 font-medium'
                                          : pct < 50 ? 'text-amber-600 font-semibold'
                                          : 'text-red-600 font-bold';

                                        return (
                                          <span className={colorClass}>
                                            {pct}%
                                          </span>
                                        );
                                      })()}
                                    </td>
                                    <td className="py-2.5 text-center"><StatusPill row={inv} /></td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid #E2E8F0', background: '#F8FAFC' }}>
          <p className="text-[10px]" style={{ color: '#94A3B8' }}>
            Showing <strong style={{ color: '#475569' }}>
              {viewMode === 'invoice' ? processedRows.length : customerGroups.length}
            </strong> 
            {viewMode === 'invoice' ? ' invoices' : ' customers'}
            {statusFilter === 'open' && overdue > 0 && (
              <span className="ml-2 font-semibold" style={{ color: '#DC2626' }}>· {overdue} overdue</span>
            )}
          </p>
          <p className="text-[10px]" style={{ color: '#CBD5E1' }}>
            {data?.summary?.fetchedStartDate && `${data.summary.fetchedStartDate} → ${data.summary.fetchedEndDate}`}
          </p>
        </div>
      </div>

      {/* DEBUG DRAWER */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0', background: '#fff' }}>
        <button onClick={() => setDevOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors">
          <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
            API Usage & Diagnostics
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#F1F5F9', color: '#64748B' }}>DEBUG</span>
          </span>
          {devOpen ? <ChevronUp size={12} color="#94A3B8" /> : <ChevronDown size={12} color="#94A3B8" />}
        </button>
        {devOpen && (
          <div style={{ borderTop: '1px solid #E2E8F0' }} className="p-4">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
              <div className="grid grid-cols-4 gap-6 text-[10px] w-full" style={{ color: '#64748B' }}>
                <div className="flex flex-col gap-1.5">
                  <span className="uppercase tracking-wider font-bold opacity-60">API Budget (Today)</span>
                  <span>Limit: <strong style={{ color: '#0F172A' }}>1000</strong></span>
                  <span>Used Today: <strong style={{ color: '#0F172A' }}>{data?.summary?.dailyCreditsUsed ?? 0}</strong></span>
                  <span>Remaining: <strong style={{ color: remainingCredits < 100 ? '#DC2626' : remainingCredits < 400 ? '#D97706' : '#059669' }}>{remainingCredits}</strong></span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="uppercase tracking-wider font-bold opacity-60">Operations Breakup</span>
                  <span>Global Refreshes: <strong style={{ color: '#0F172A' }}>{data?.summary?.dailyGlobalRefreshes ?? 0}</strong></span>
                  <span>Invoice Refreshes: <strong style={{ color: '#0F172A' }}>{data?.summary?.dailyInvoiceRefreshes ?? 0}</strong></span>
                  <span>Customer Refreshes: <strong style={{ color: '#0F172A' }}>{data?.summary?.dailyCustomerRefreshes ?? 0}</strong></span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="uppercase tracking-wider font-bold opacity-60">Optimization</span>
                  <span>Customer Enrichments: <strong style={{ color: '#0F172A' }}>{data?.summary?.dailyEnrichmentCalls ?? 0}</strong></span>
                  <span>Duplicates Avoided: <strong style={{ color: '#059669' }}>{redundantFetchesAvoided.current}</strong></span>
                  <span>Cache Hits (Filter/Sort): <strong style={{ color: '#059669' }}>Active</strong></span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="uppercase tracking-wider font-bold opacity-60">Cache Range</span>
                  <span className="truncate">Range: <strong style={{ color: '#0F172A' }}>{data?.summary?.fetchedStartDate} → {data?.summary?.fetchedEndDate}</strong></span>
                  <span>Total Invoices: <strong style={{ color: '#0F172A' }}>{data?.rows?.length ?? 0}</strong></span>
                  <span>Total Sync Cost: <strong style={{ color: '#0F172A' }}>{data?.apiCallsUsed ?? 0} credits</strong></span>
                </div>
              </div>
              <button onClick={handleCopy}
                className="flex items-center gap-1.5 text-[10px] px-3 py-2 rounded-lg transition-all self-start ml-4 shrink-0"
                style={{ border: '1px solid #E2E8F0', color: '#64748B', background: '#F8FAFC' }}>
                {copied ? <Check size={11} color="#059669" /> : <Copy size={11} />}
                {copied ? 'Copied!' : 'Copy JSON'}
              </button>
            </div>
            <div className="rounded-lg p-4 overflow-y-auto" style={{ background: '#0F172A', maxHeight: '220px' }}>
              <pre className="text-[10px] font-mono leading-relaxed" style={{ color: '#34D399' }}>
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
