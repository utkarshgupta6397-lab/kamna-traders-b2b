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
  Filter,
  Flag,
  X,
  Clock3,
  Receipt,
  UserRound,
  Loader2,
  MessageSquare,
  CheckCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { renderStatementToPdf, getCachedAssets } from '@/lib/zoho/pdf-statement-renderer';
import { Download } from 'lucide-react';// ─── Types ────────────────────────────────────────────────────────────────────

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
  salespersonName?: string | null;
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
  accountManager: string;
}

export interface CustomerStatementTask {
  id: string;
  customerId: string;
  customerName: string;
  status: 'OPEN' | 'RELEASED';
  flaggedByName: string;
  flaggedAt: string;
}

export interface RecoveryInvoiceTask {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  status: 'ACTIVE' | 'RELEASED' | 'RESOLVED';
  requiresReminder: boolean;
  reminderSent: boolean;
  reminderCount: number;
  reminderSentAt: string | null;
  reminderSentById: string | null;
  reminderSentByName: string | null;
  flagCount: number;
  flaggedByUserId: string;
  flaggedByName: string;
  flaggedAt: string;
  releasedByUserId: string | null;
  releasedByName: string | null;
  releasedAt: string | null;
  resolvedByUserId: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  resolvedReason: string | null;
  lastKnownPendingAmount: number | null;
  lastKnownInvoiceStatus: string | null;
  lastSyncedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
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
  task,
  taskLoading,
  onFlag,
  historicalCount = 0,
}: {
  row: ExtendedRow;
  enrichment: CustomerEnrichment | undefined;
  statusFilter: string;
  task?: RecoveryInvoiceTask;
  taskLoading?: boolean;
  onFlag?: (row: ExtendedRow) => void;
  historicalCount?: number;
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

  const isOpen = statusFilter === 'open';
  const isFlagged = task && task.status === 'ACTIVE';

  return (
    <div ref={containerRef} className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {/* Customer name and inline actions */}
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
            className="group min-w-0 flex items-center gap-1.5 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className="text-[12px] font-semibold truncate block group-hover:underline"
              style={{ color: '#0F172A' }}
            >
              {row.customerName}
            </span>
            {isOpen && enrichment?.tallyReady && (
              <span title="Tally Ready" className="flex shrink-0">
                <Check size={11} color="#059669" />
              </span>
            )}
          </a>
        )}
 
        {/* Inline Flag chip — same line as customer name */}
        {isOpen && (
          <div className="flex shrink-0 items-center gap-1 ml-1">
            {!isFlagged ? (
              <button
                disabled={taskLoading}
                onClick={(e) => { e.stopPropagation(); onFlag?.(row); }}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors disabled:opacity-50"
                style={{ border: '1px solid #E2E8F0', color: '#64748B', background: '#F8FAFC', cursor: 'pointer' }}
              >
                <Flag size={8} />
                Flag
              </button>
            ) : null}
 
            {/* Historical Counter */}
            {historicalCount > 0 && (
              <span 
                title={`Flagged ${historicalCount} time${historicalCount > 1 ? 's' : ''} historically`}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold"
                style={{ background: '#FEF3C7', border: '1px solid #FDE68A', color: '#D97706' }}
              >
                <Flag size={8} fill="#D97706" style={{ color: '#D97706' }} />
                {historicalCount}
              </span>
            )}
          </div>
        )}
      </div>
 
      {/* GST & Status sub-line */}
      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
        {gst ? (
          <span className="text-[10px] font-mono text-slate-400 truncate block">{gst}</span>
        ) : (
          <span className="text-[10px] italic text-slate-350 block">GST missing</span>
        )}
        {isOpen && isFlagged && (
          <span 
            title={`FLAGGED • ${task.flaggedByName} • ${new Date(task.flaggedAt).toLocaleDateString()}`}
            className="inline-flex items-center gap-0.5 px-1 py-0.2 bg-amber-50 text-amber-700 text-[8.5px] font-extrabold uppercase rounded border border-amber-200 shrink-0"
          >
            <Flag size={7} className="fill-amber-600 text-amber-600" />
            <span>Pending Release</span>
          </span>
        )}
      </div>

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
            
            {enrichment?.accountManager && (
              <div className="flex items-start gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wider mt-[1px] shrink-0" style={{ color: '#94A3B8' }}>Manager</span>
                <span className="text-[10px]" style={{ color: '#0F172A' }}>{enrichment.accountManager}</span>
              </div>
            )}

            {!gst && !addr && !hasLocation && !enrichment?.accountManager && (
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

  // Statement Follow-up Tasks (RecoveryInvoiceTasks)
  const [tasks, setTasks] = useState<RecoveryInvoiceTask[]>([]);
  const [historicalCounts, setHistoricalCounts] = useState<Record<string, number>>({});
  const [historicalCustomerCounts, setHistoricalCustomerCounts] = useState<Record<string, number>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expandedCustomerIds, setExpandedCustomerIds] = useState<Set<string>>(new Set());
  const [taskLoadingId, setTaskLoadingId] = useState<string | null>(null);
  const [releaseAllowed, setReleaseAllowed] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);
  const [recoverySort, setRecoverySort] = useState<'highest-outstanding' | 'oldest-invoice' | 'most-invoices' | 'alphabetical'>('highest-outstanding');
  const [recoverySearch, setRecoverySearch] = useState('');
  const [recoveryPage, setRecoveryPage] = useState(0);
  const [batchPdfGenerating, setBatchPdfGenerating] = useState(false);
  const [batchPdfProgress, setBatchPdfProgress] = useState<{ current: number, total: number, failures: string[] } | null>(null);
  const RECOVERY_PAGE_SIZE = 15;
  const [syncingInvoiceIds, setSyncingInvoiceIds] = useState<Set<string>>(new Set());
  const [successSyncedIds, setSuccessSyncedIds] = useState<Set<string>>(new Set());
  const [syncPreviewOpen, setSyncPreviewOpen] = useState(false);
  const [proposedRemovals, setProposedRemovals] = useState<any[]>([]);
  const [customerCredits, setCustomerCredits] = useState<any[]>([]);
  const [syncStats, setSyncStats] = useState<any>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncingInvoices, setSyncingInvoices] = useState<string[]>([]);

  const totalCreditsValue = useMemo(() => {
    return customerCredits.reduce((sum, c) => sum + c.availableCredit, 0);
  }, [customerCredits]);

  // New Operational States & Ticking Clock
  const [nowTick, setNowTick] = useState(Date.now());
  const [refreshingInvoiceId, setRefreshingInvoiceId] = useState<string | null>(null);
  const [refreshingCustomerId, setRefreshingCustomerId] = useState<string | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);

  // Ticks the clock every second to drive cooldown countdowns reactively
  const router = useRouter();
  const [flaggedDrawerOpen, setFlaggedDrawerOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFlaggedDrawerOpen(false);
      }
    };
    if (flaggedDrawerOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flaggedDrawerOpen]);

  const [apiUsage, setApiUsage] = useState<any>(null);

  const fetchApiUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/debug/zoho-api-usage');
      const json = await res.json();
      if (json.success) {
        setApiUsage(json.today);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (flaggedDrawerOpen) {
      fetchApiUsage();
    }
  }, [flaggedDrawerOpen, fetchApiUsage]);

  const activeTasksList = useMemo(() => {
    return tasks.filter(t => t.status === 'ACTIVE');
  }, [tasks]);

  const getTaskOverdue = useCallback((task: RecoveryInvoiceTask) => {
    const inv = data?.rows?.find(r => r.invoiceId === task.invoiceId);
    if (inv) {
      return !!(inv as any).isOverdue;
    }
    const ageDays = (Date.now() - new Date(task.flaggedAt).getTime()) / (24 * 60 * 60 * 1000);
    return ageDays > 7;
  }, [data]);

  const groupedCustomers = useMemo(() => {
    const active = tasks.filter(t => t.status === 'ACTIVE');

    // Group invoices by customerId
    const map = new Map<string, {
      customerId: string;
      customerName: string;
      invoices: Array<{
        task: RecoveryInvoiceTask;
        inv: typeof data extends null ? null : NonNullable<typeof data>['rows'][number] | undefined;
        pending: number;
        ageDays: number;
        invoiceDate: string;
      }>;
    }>();

    for (const task of active) {
      const inv = data?.rows?.find(r => r.invoiceId === task.invoiceId);
      const pending = inv ? inv.amountPending : (task.lastKnownPendingAmount || 0);
      const dueDateVal = inv?.dueDate ? new Date(inv.dueDate) : null;
      const ageDays = dueDateVal
        ? Math.max(0, Math.ceil((Date.now() - dueDateVal.getTime()) / 86400000))
        : Math.max(0, Math.ceil((Date.now() - new Date(task.flaggedAt).getTime()) / 86400000));
      const invoiceDate = inv ? inv.invoiceDate : task.flaggedAt;

      const entry = map.get(task.customerId) ?? {
        customerId: task.customerId,
        customerName: task.customerName,
        invoices: [],
      };
      entry.invoices.push({ task, inv, pending, ageDays, invoiceDate });
      map.set(task.customerId, entry);
    }

    // Build flat list with aggregates
    let customers = Array.from(map.values()).map(c => ({
      ...c,
      totalOutstanding: c.invoices.reduce((s, i) => s + i.pending, 0),
      invoiceCount: c.invoices.length,
      oldestDue: c.invoices.length > 0 ? Math.max(...c.invoices.map(i => i.ageDays)) : 0,
    }));

    // Search filter
    if (recoverySearch.trim()) {
      const q = recoverySearch.trim().toLowerCase();
      customers = customers.filter(c =>
        c.customerName.toLowerCase().includes(q) ||
        c.invoices.some(i => i.task.invoiceNumber.toLowerCase().includes(q))
      );
    }

    // Sort
    switch (recoverySort) {
      case 'highest-outstanding':
        customers.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
        break;
      case 'oldest-invoice':
        customers.sort((a, b) => b.oldestDue - a.oldestDue);
        break;
      case 'most-invoices':
        customers.sort((a, b) => b.invoiceCount - a.invoiceCount);
        break;
      case 'alphabetical':
        customers.sort((a, b) => a.customerName.localeCompare(b.customerName));
        break;
    }

    return customers;
  }, [tasks, data, recoverySearch, recoverySort]);

  const handleBatchDownloadPdf = async () => {
    if (groupedCustomers.length === 0) return;
    setBatchPdfGenerating(true);
    setBatchPdfProgress({ current: 0, total: groupedCustomers.length, failures: [] });

    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      
      // 1. Load assets
      const { fontRegular, fontBold, logo } = await getCachedAssets();

      const applyFonts = (d: any) => {
        const isValidBase64Font = (b64: string | null) => {
          if (!b64 || b64.length < 1000) return false;
          try {
            const decoded = typeof window !== 'undefined' ? atob(b64.slice(0, 1000)) : Buffer.from(b64.slice(0, 1000), 'base64').toString('ascii');
            return !decoded.toLowerCase().includes('<!doctype') && !decoded.toLowerCase().includes('<html');
          } catch {
            return true;
          }
        };

        if (isValidBase64Font(fontRegular)) {
          try {
            d.addFileToVFS('NotoSans-Regular.ttf', fontRegular!);
            d.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
          } catch (e) {
            console.warn('Failed to register NotoSans-Regular.ttf in batch generator', e);
          }
        }
        if (isValidBase64Font(fontBold)) {
          try {
            d.addFileToVFS('NotoSans-Bold.ttf', fontBold!);
            d.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
          } catch (e) {
            console.warn('Failed to register NotoSans-Bold.ttf in batch generator', e);
          }
        }
        return d.getFontList()['NotoSans'] ? 'NotoSans' : 'helvetica';
      };

      const cDark: [number, number, number] = [15, 23, 42];
      const cGreen: [number, number, number] = [5, 150, 105];
      const cRed: [number, number, number] = [220, 38, 38];
      const cBlue: [number, number, number] = [37, 99, 235];
      
      const fmtCurrency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

      // Calculate how many pages the Index will take using a temporary document
      const tempDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfFontTemp = applyFonts(tempDoc);
      
      const indexBody = groupedCustomers.map((c, i) => [
        (i + 1).toString(),
        c.customerName,
        c.invoiceCount.toString(),
        fmtCurrency(c.totalOutstanding),
        c.oldestDue ? `${c.oldestDue} Days` : '—',
        '...' // Placeholder
      ]);
      
      const margin = 14;
      autoTable(tempDoc, {
        head: [['Sr No', 'Customer Name', 'Invoices', 'Outstanding', 'Oldest Due', 'Statement Page']],
        body: indexBody,
        startY: 30,
        theme: 'grid',
        headStyles: { fillColor: [241, 245, 249], textColor: cDark, fontSize: 8, font: pdfFontTemp },
        bodyStyles: { fontSize: 8, font: pdfFontTemp },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: {
          0: { cellWidth: 12 },
          2: { halign: 'center', cellWidth: 18 },
          3: { halign: 'right' },
          5: { halign: 'center', cellWidth: 25 }
        },
        margin: { top: 25, right: margin, bottom: 25, left: margin }
      });
      const indexPagesCount = (tempDoc as any).internal.getNumberOfPages() || (tempDoc as any).getNumberOfPages();
      const totalCoverPages = 1 + indexPagesCount; // Page 1 + Index Pages
      
      // Now initialize the real document
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfFont = applyFonts(doc);
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // --- COVER PAGE 1: Portfolio KPI Summary ---
      const headerH = 30;
      
      // Logo & Title
      const logoH = 18;
      const logoW = logoH * (599 / 579);
      if (logo) {
        doc.addImage(logo, 'PNG', margin, 12, logoW, logoH);
      }
      
      doc.setTextColor(...cDark);
      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(18);
      const titleX = logo ? margin + logoW + 6 : margin;
      doc.text('Portfolio Recovery Report', titleX, 22);
      
      doc.setFontSize(8);
      doc.setFont(pdfFont, 'normal');
      doc.setTextColor(100, 116, 139);
      const generatedTimestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
      doc.text(`Generated: ${generatedTimestamp} | By: ${data?.refreshedBy || 'Admin'}`, titleX, 27);
      
      // Thin blue divider
      doc.setDrawColor(...cBlue);
      doc.setLineWidth(0.5);
      doc.line(margin, headerH + 5, pageWidth - margin, headerH + 5);
      
      // Highest exposure customer logic
      let highestExposureCustomer = groupedCustomers[0];
      groupedCustomers.forEach(c => {
        if (c.totalOutstanding > highestExposureCustomer.totalOutstanding) highestExposureCustomer = c;
      });
      const oldestDue = groupedCustomers.reduce((oldest, c) => (!oldest || (c.oldestDue && c.oldestDue > oldest) ? c.oldestDue : oldest), 0);
      
      let startY = headerH + 15;
      doc.setTextColor(...cDark);
      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(12);
      doc.text('Key Performance Indicators', margin, startY);
      
      startY += 8;
      
      const drawKpiCard = (x: number, y: number, w: number, h: number, label: string, value: string, valColor: [number, number, number]) => {
        doc.setFillColor(252, 252, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, w, h, 1, 1, 'FD');
        
        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.text(label.toUpperCase(), x + 3, y + 5);
        
        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...valColor);
        doc.text(value, x + 3, y + 12);
      };
      
      const cardW = (pageWidth - margin * 2 - 8 * 2) / 3;
      const cardH = 16;
      
      // Row 1
      drawKpiCard(margin, startY, cardW, cardH, 'Total Customers', groupedCustomers.length.toString(), cDark);
      drawKpiCard(margin + cardW + 8, startY, cardW, cardH, 'Total Invoices', metrics.totalInvoices.toString(), cDark);
      drawKpiCard(margin + (cardW + 8) * 2, startY, cardW, cardH, 'Total Outstanding', fmtCurrency(metrics.totalPending), cRed);
      
      // Row 2
      startY += cardH + 4;
      drawKpiCard(margin, startY, cardW, cardH, 'Total Invoiced', fmtCurrency(metrics.totalValue), cDark);
      drawKpiCard(margin + cardW + 8, startY, cardW, cardH, 'Total Paid', fmtCurrency(metrics.totalCollected), cGreen);
      drawKpiCard(margin + (cardW + 8) * 2, startY, cardW, cardH, 'Collection Efficiency', `${metrics.collectionPct}%`, cBlue);
      
      // Row 3
      startY += cardH + 4;
      drawKpiCard(margin, startY, cardW, cardH, 'Average Outstanding', fmtCurrency(metrics.totalPending / (groupedCustomers.length || 1)), cDark);
      drawKpiCard(margin + cardW + 8, startY, cardW, cardH, 'Highest Exposure Customer', highestExposureCustomer?.customerName || 'None', cDark);
      drawKpiCard(margin + (cardW + 8) * 2, startY, cardW, cardH, 'Highest Exposure Amount', fmtCurrency(highestExposureCustomer?.totalOutstanding || 0), cRed);
      
      // Row 4
      startY += cardH + 4;
      drawKpiCard(margin, startY, cardW, cardH, 'Oldest Due Date', oldestDue ? `${oldestDue} Days` : '—', cRed);
      
      startY += cardH + 15;
      
      // Portfolio Statistics Table
      doc.setTextColor(...cDark);
      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(12);
      doc.text('Portfolio Health Summary', margin, startY);
      
      autoTable(doc, {
        startY: startY + 5,
        head: [['Metric', 'Value', 'Status']],
        body: [
          ['Fully Paid Customers', metrics.fullyPaid.toString(), 'Healthy'],
          ['Open Customers', metrics.openCount.toString(), 'Requires Follow-up'],
          ['Overdue Invoices', metrics.overdue.toString(), 'Critical'],
          ['Voided Invoices', metrics.voidCount.toString(), '—']
        ],
        theme: 'grid',
        headStyles: { fillColor: [241, 245, 249], textColor: cDark, fontSize: 8, font: pdfFont },
        bodyStyles: { fontSize: 8, font: pdfFont },
        margin: { left: margin, right: margin }
      });
      
      // --- COVER PAGE 2: Customer Summary (Index) ---
      doc.addPage();
      
      doc.setTextColor(...cDark);
      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(14);
      doc.text('Customer Summary Index', margin, 20);
      
      // Calculate real statement pages
      let currentStatementPage = totalCoverPages + 1;
      const realIndexBody = groupedCustomers.map((c, i) => {
        const row = [
          (i + 1).toString(),
          c.customerName,
          c.invoiceCount.toString(),
          fmtCurrency(c.totalOutstanding),
          c.oldestDue ? `${c.oldestDue} Days` : '—',
          currentStatementPage.toString()
        ];
        currentStatementPage++; // Since each statement fits exactly on 1 page as per requirements
        return row;
      });
      
      autoTable(doc, {
        head: [['Sr No', 'Customer Name', 'Invoices', 'Outstanding', 'Oldest Due', 'Statement Page']],
        body: realIndexBody,
        startY: 25,
        theme: 'grid',
        headStyles: { fillColor: [241, 245, 249], textColor: cDark, fontSize: 8, font: pdfFont },
        bodyStyles: { fontSize: 8, font: pdfFont },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: {
          0: { cellWidth: 12 },
          2: { halign: 'center', cellWidth: 18 },
          3: { halign: 'right' },
          5: { halign: 'center', cellWidth: 25 }
        },
        margin: { top: 25, right: margin, bottom: 25, left: margin }
      });
      
      // Render the actual statements
      let failures: string[] = [];
      for (let i = 0; i < groupedCustomers.length; i++) {
        const customer = groupedCustomers[i];
        setBatchPdfProgress({ current: i + 1, total: groupedCustomers.length, failures });
        
        try {
          const res = await fetch(`/api/admin/customer-statement/statement?customerId=${customer.customerId}`);
          const json = await res.json();
          if (!json.success || !json.data) throw new Error('Failed to fetch statement');
          
          doc.addPage();
          
          await renderStatementToPdf(doc, autoTable, json.data, {
            isExpanded: true,
            clipFromIndex: null,
            isBatchRecovery: true
          });
        } catch (e) {
          console.error(`Batch PDF failed for ${customer.customerName}`, e);
          failures.push(customer.customerName);
          setBatchPdfProgress({ current: i + 1, total: groupedCustomers.length, failures });
        }
      }
      
      // Global Print Optimizations: Borders and Page Numbers
      const totalPages = (doc as any).internal.getNumberOfPages() || (doc as any).getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        
        // 10mm border
        doc.setDrawColor(200, 200, 200); // Light Grey
        doc.setLineWidth(0.15); // ~0.5 pt
        doc.rect(10, 10, pageWidth - 20, pageHeight - 20, 'S');
        
        // Page X of Y footer
        doc.setFont(pdfFont, 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 12, { align: 'center' });
      }
      
      const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, ' ');
      doc.save(`Recovery Statements - ${dateStr}.pdf`);
      
      fetchApiUsage();
      toast.success(`Recovery Statements Generated. ${groupedCustomers.length - failures.length} successful, ${failures.length} failed.`, { id: 'batch-pdf' });
    } catch (e) {
      console.error('[Batch PDF Export Error]', e);
      toast.error('Failed to generate batch PDF.', { id: 'batch-pdf' });
    } finally {
      setBatchPdfGenerating(false);
      setTimeout(() => setBatchPdfProgress(null), 3000);
    }
  };

  const getWhatsAppUrl = useCallback((task: RecoveryInvoiceTask, amountPending: number) => {
    const statementLink = `${window.location.origin}/staff/dashboard/accounts?tab=statement&customerId=${encodeURIComponent(task.customerId)}`;
    const msg = `Dear ${task.customerName},\n\nThis is a gentle reminder regarding your outstanding invoice.\n\nInvoice: ${task.invoiceNumber}\nPending Amount: ₹${amountPending.toLocaleString('en-IN')}\n\nYou can view your complete account statement here:\n${statementLink}\n\nPlease contact us at your earliest convenience to arrange payment.\n\nThank you,\nKamna Traders`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  }, []);

  const locateInvoice = useCallback((customerId: string, invoiceId: string | null) => {
    if (viewMode === 'customer') {
      setExpandedCustomers(prev => {
        const next = new Set(prev);
        next.add(customerId);
        return next;
      });
    }
    setTimeout(() => {
      const targetId = viewMode === 'invoice' && invoiceId ? `invoice-${invoiceId}` : `customer-${customerId}`;
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('bg-amber-100/60');
        setTimeout(() => {
          el.classList.remove('bg-amber-100/60');
        }, 2000);
      } else {
        toast.error('Row not found on current page');
      }
    }, 100);
  }, [viewMode]);
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

  // ─── Recovery Tasks API ───────────────────────────────────────────────────
  const [refreshingInvoices, setRefreshingInvoices] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts/recovery');
      const json = await res.json();
      if (json.success) {
        setTasks(json.data);
        setHistoricalCounts(json.historicalCounts || {});
        setHistoricalCustomerCounts(json.historicalCustomerCounts || {});
        setCurrentUserId(json.currentUserId || null);
        setReleaseAllowed(!!json.releaseAllowed);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleFlagStatement = async (row: InvoiceRow | ExtendedRow) => {
    setTaskLoadingId(row.invoiceId);
    try {
      const res = await fetch('/api/accounts/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: row.invoiceId,
          invoiceNumber: row.invoiceNumber,
          customerId: row.customerId,
          customerName: row.customerName,
          lastKnownPendingAmount: row.amountPending,
          lastKnownInvoiceStatus: row.paymentStatus
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Flagged invoice ${row.invoiceNumber} for recovery`);
        fetchTasks();
      } else {
        toast.error(json.error || 'Failed to flag invoice');
      }
    } catch {
      toast.error('Network error. Please retry.');
    } finally {
      setTaskLoadingId(null);
    }
  };

  const handleReleaseStatement = async (taskId: string, invoiceId: string) => {
    setTaskLoadingId(invoiceId);
    try {
      const res = await fetch('/api/accounts/recovery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, action: 'release' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Released invoice recovery task`);
        fetchTasks();
      } else {
        toast.error(json.error || 'Failed to release task');
      }
    } catch {
      toast.error('Network error. Please retry.');
    } finally {
      setTaskLoadingId(null);
    }
  };

  const handleToggleReminder = async (taskId: string, invoiceId: string, current: boolean) => {
    setTaskLoadingId(invoiceId);
    try {
      const res = await fetch('/api/accounts/recovery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, action: 'remind', requiresReminder: !current }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.data.requiresReminder ? 'Marked as needing reminder' : 'Unmarked reminder requirement');
        fetchTasks();
      } else {
        toast.error(json.error || 'Failed to update reminder status');
      }
    } catch {
      toast.error('Network error. Please retry.');
    } finally {
      setTaskLoadingId(null);
    }
  };

  const handleMarkReminderSent = async (taskId: string, invoiceId: string) => {
    setTaskLoadingId(invoiceId);
    try {
      const res = await fetch('/api/accounts/recovery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, action: 'reminder_sent' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Marked reminder as sent');
        fetchTasks();
      } else {
        toast.error(json.error || 'Failed to record reminder');
      }
    } catch {
      toast.error('Network error. Please retry.');
    } finally {
      setTaskLoadingId(null);
    }
  };

  const startSyncPrecheck = async (invoiceIds: string[]) => {
    if (invoiceIds.length === 0) return;
    setSyncingInvoices(invoiceIds);
    setRefreshingInvoices(true);
    setSyncLoading(true);

    try {
      const res = await fetch('/api/accounts/recovery/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceIds, dryRun: true }),
      });
      const json = await res.json();
      if (json.success) {
        setProposedRemovals(json.proposedRemovals || []);
        setCustomerCredits(json.customerCredits || []);
        setSyncStats(json.stats || null);
        setSyncPreviewOpen(true);
        fetchApiUsage();
      } else {
        toast.error(json.error || 'Precheck failed');
      }
    } catch {
      toast.error('Network error. Please retry.');
    } finally {
      setRefreshingInvoices(false);
      setSyncLoading(false);
    }
  };

  const applySyncChanges = async () => {
    if (syncingInvoices.length === 0) return;
    setSyncLoading(true);
    setRefreshingInvoices(true);

    try {
      setSyncingInvoiceIds(prev => {
        const next = new Set(prev);
        syncingInvoices.forEach(id => next.add(id));
        return next;
      });

      const res = await fetch('/api/accounts/recovery/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceIds: syncingInvoices, dryRun: false }),
      });
      const json = await res.json();
      if (json.success) {
        setTasks(json.data);
        const stats = json.stats;
        toast.success(
          `Sync Summary:\nProcessed: ${stats.processed}\nRemoved: ${stats.removed}\nReleased: ${stats.released}\nRemaining: ${stats.remaining}`,
          { duration: 6000 }
        );
        setSyncPreviewOpen(false);
        setLastSyncTime(Date.now());
        fetchTasks();

        setSuccessSyncedIds(prev => {
          const next = new Set(prev);
          syncingInvoices.forEach(id => next.add(id));
          return next;
        });
        setTimeout(() => {
          setSuccessSyncedIds(prev => {
            const next = new Set(prev);
            syncingInvoices.forEach(id => next.delete(id));
            return next;
          });
        }, 1000);
      } else {
        toast.error(json.error || 'Failed to apply changes');
      }
    } catch {
      toast.error('Network error. Please retry.');
    } finally {
      setSyncLoading(false);
      setRefreshingInvoices(false);
      setSyncingInvoiceIds(new Set());
    }
  };

  const sidebarKPIs = useMemo(() => {
    const active = tasks.filter(t => t.status === 'ACTIVE');
    const totalOutstandingAmount = active.reduce((sum, t) => {
      const inv = data?.rows?.find(r => r.invoiceId === t.invoiceId);
      return sum + (inv ? inv.amountPending : (t.lastKnownPendingAmount || 0));
    }, 0);
    const pendingInvoicesCount = active.length;
    const uniqueCustomers = new Set(active.map(t => t.customerId)).size;

    let oldestDueDays = 0;
    for (const t of active) {
      const inv = data?.rows?.find(r => r.invoiceId === t.invoiceId);
      const dueDateVal = inv?.dueDate ? new Date(inv.dueDate) : null;
      const ageDays = dueDateVal
        ? Math.max(0, Math.ceil((Date.now() - dueDateVal.getTime()) / 86400000))
        : Math.max(0, Math.ceil((Date.now() - new Date(t.flaggedAt).getTime()) / 86400000));
      if (ageDays > oldestDueDays) oldestDueDays = ageDays;
    }

    return {
      totalOutstandingAmount,
      pendingInvoicesCount,
      uniqueCustomers,
      oldestDueDays,
    };
  }, [tasks, data]);

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
        
        // Dual refresh: also force-refresh customer enrichment data
        if (row.customerId) {
          fetchedCustomerIds.current.delete(row.customerId); // clear cache so re-fetch happens
          enrichCustomers([row.customerId]);
        }
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
      headers = ['Invoice Number', 'Invoice Date', 'Due Date', 'Customer Name', 'GST Number', 'Salesman', 'Invoice Value', 'Amount Paid', 'Amount Pending', 'Pending %', 'Status'];
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
          r.salespersonName || '—',
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
        const tableHeaders = [['#', 'Invoice Number', 'Date', 'Due Date', 'Customer Name', 'GST Number', 'Salesman', 'Total Value', 'Amount Paid', 'Amount Pending', 'Pending %', 'Status']];
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
            r.salespersonName || '—',
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
        await fetchTasks();
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
    { label: 'Salesman', field: 'salespersonName', cls: 'w-[110px] text-left' },
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
              <button key={p.id} onClick={() => setLookback(p.id)} disabled={isAnyRefreshing || cooldownRemaining > 0}
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
                        id={`invoice-${row.invoiceId}`}
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
                          <CustomerCell
                            row={row}
                            enrichment={enrichment}
                            statusFilter={statusFilter}
                            task={tasks.find(t => t.invoiceId === row.invoiceId && t.status === 'ACTIVE')}
                            taskLoading={taskLoadingId === row.invoiceId}
                            onFlag={handleFlagStatement}
                            historicalCount={historicalCounts[row.invoiceId] || 0}
                          />
                        </td>

                        {/* Salesman */}
                        <td className="py-3 px-4 text-left">
                          <p className="text-[11px] font-medium" style={{ color: '#475569' }}>
                            {row.salespersonName || '—'}
                          </p>
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
                    <div key={group.customerId} id={`customer-${group.customerId}`} className="group transition-colors border-b last:border-0"
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
                              {statusFilter === 'open' && (
                                <div className="flex items-center gap-1 shrink-0">
                                  {enrichMap[group.customerId]?.tallyReady && (
                                    <span title="Tally Ready" className="flex shrink-0">
                                      <Check size={11} color="#059669" />
                                    </span>
                                  )}
                                  {(() => {
                                    const activeTasks = tasks.filter(t => t.customerId === group.customerId && t.status === 'ACTIVE');
                                    const isFlagged = activeTasks.length > 0;
                                    const oldestTask = activeTasks.sort((a,b) => new Date(a.flaggedAt).getTime() - new Date(b.flaggedAt).getTime())[0];
                                    if (isFlagged && oldestTask) {
                                      return (
                                        <span title={`FLAGGED • ${oldestTask.flaggedByName} • ${new Date(oldestTask.flaggedAt).toLocaleDateString()}`} className="flex shrink-0 items-center gap-0.5">
                                          <Flag size={10} color="#D97706" />
                                          <span className="text-[9px] font-medium" style={{ color: '#D97706' }}>Statement Pending</span>
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              )}

                              {/* Inline Flag / Release button on the same line */}
                              {statusFilter === 'open' && (() => {
                                const openInvoices = group.invoices.filter(isOperationallyOpen);
                                const oldestOpenInvoice = openInvoices.sort((a,b) => a.invoiceDate.localeCompare(b.invoiceDate))[0];
                                const activeTasks = tasks.filter(t => t.customerId === group.customerId && t.status === 'ACTIVE');
                                const isFlagged = activeTasks.length > 0;
                                const loading = taskLoadingId ? group.invoices.some(inv => inv.invoiceId === taskLoadingId) : false;
                                const historicalCount = historicalCustomerCounts[group.customerId] || 0;
                                return (
                                  <div className="flex items-center gap-1">
                                    {!isFlagged && oldestOpenInvoice ? (
                                      <button
                                        disabled={loading}
                                        onClick={(e) => { e.stopPropagation(); handleFlagStatement(oldestOpenInvoice); }}
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors disabled:opacity-50 ml-1"
                                        style={{ border: '1px solid #E2E8F0', color: '#64748B', background: '#F8FAFC', cursor: 'pointer' }}
                                      >
                                        <Flag size={8} />
                                        Flag
                                      </button>
                                    ) : null}

                                    {/* Historical Counter */}
                                    {historicalCount > 0 && (
                                      <span 
                                        title={`Flagged ${historicalCount} time${historicalCount > 1 ? 's' : ''} historically`}
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold"
                                        style={{ background: '#FEF3C7', border: '1px solid #FDE68A', color: '#D97706' }}
                                      >
                                        <Flag size={8} fill="#D97706" style={{ color: '#D97706' }} />
                                        {historicalCount}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
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

      {/* Floating Trigger Button */}
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40">
        <button
          onClick={() => setFlaggedDrawerOpen(true)}
          className="w-8 flex flex-col items-center justify-center py-4 bg-[#1A2766] hover:bg-[#AE1B1E] text-white rounded-l-md shadow-lg transition-all active:scale-95 group relative border-l border-y border-white/10"
        >
          <div className="relative mb-2">
            <Flag size={12} className="text-white group-hover:rotate-12 transition-transform" />
            {activeTasksList.length > 0 && (
              <span className="absolute -top-2.5 -right-2 bg-[#AE1B1E] text-white text-[7.5px] font-bold px-0.5 rounded-full border border-white flex items-center justify-center min-w-[12px] h-[12px] leading-none">
                {activeTasksList.length}
              </span>
            )}
          </div>
          <span className="text-[8.5px] font-extrabold tracking-widest uppercase [writing-mode:vertical-lr] rotate-180">
            Recovery Queue
          </span>
        </button>
      </div>

      {/* Sliding Drawer Panel */}
      {flaggedDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setFlaggedDrawerOpen(false)}
          />
          <div className="relative w-full max-w-[520px] h-full bg-slate-50 shadow-2xl flex flex-col z-10 border-l border-slate-200 animate-in slide-in-from-right duration-200">

            {/* ── STICKY HEADER ── */}
            <div className="shrink-0 bg-white border-b border-slate-200">
              {/* Top bar */}
              <div className="p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Flag size={13} className="text-amber-500 fill-amber-500 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold leading-none" style={{ color: '#1A2766' }}>Recovery Queue</h3>
                    <p className="text-[9px] text-slate-400 mt-0.5 leading-none">Outstanding invoices by customer</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Sort dropdown */}
                  <select
                    value={recoverySort}
                    onChange={(e) => {
                      setRecoverySort(e.target.value as typeof recoverySort);
                      setRecoveryPage(0);
                    }}
                    className="text-[9px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 focus:outline-none cursor-pointer"
                  >
                    <option value="highest-outstanding">↓ Highest Outstanding</option>
                    <option value="oldest-invoice">↓ Oldest Invoice</option>
                    <option value="most-invoices">↓ Most Invoices</option>
                    <option value="alphabetical">A–Z Alphabetical</option>
                  </select>

                  {/* Sync button */}
                  {(() => {
                    const elapsed = nowTick - lastSyncTime;
                    const cooldownSec = Math.max(0, Math.ceil((60000 - elapsed) / 1000));
                    const allInvoiceIds = groupedCustomers.flatMap(c => c.invoices.map(i => i.task.invoiceId));
                    const isSyncDisabled = refreshingInvoices || allInvoiceIds.length === 0 || cooldownSec > 0;
                    return (
                      <button
                        onClick={() => startSyncPrecheck(allInvoiceIds.slice(0, 100))}
                        disabled={isSyncDisabled}
                        className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50 flex items-center gap-1 text-[9px] font-bold leading-none"
                        title={cooldownSec > 0 ? `Next sync in ${cooldownSec}s` : 'Sync outstanding from Zoho'}
                      >
                        <RefreshCw size={10} className={refreshingInvoices ? 'animate-spin' : ''} />
                        {cooldownSec > 0 ? `${cooldownSec}s` : 'Sync'}
                      </button>
                    );
                  })()}

                  {/* Batch Download PDF Button */}
                  <button
                    onClick={handleBatchDownloadPdf}
                    disabled={batchPdfGenerating || groupedCustomers.length === 0}
                    className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50 flex items-center gap-1 text-[9px] font-bold leading-none"
                    title="Download PDFs for all listed customers"
                  >
                    {batchPdfGenerating ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Download size={10} />
                    )}
                    Batch PDF
                  </button>

                  <button
                    onClick={() => setFlaggedDrawerOpen(false)}
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Batch PDF Progress UI */}
              {batchPdfProgress && (
                <div className="px-3 pb-2">
                  <div className="bg-blue-50 border border-blue-100 rounded-md p-2 flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-semibold text-blue-800">
                        {batchPdfGenerating ? 'Generating PDFs...' : 'Generation Complete'}
                      </span>
                      <span className="text-[9px] font-bold text-blue-600">
                        {batchPdfProgress.current} / {batchPdfProgress.total}
                      </span>
                    </div>
                    <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-blue-500 h-1.5 transition-all duration-300" 
                        style={{ width: `${(batchPdfProgress.current / batchPdfProgress.total) * 100}%` }}
                      />
                    </div>
                    {batchPdfProgress.failures.length > 0 && (
                      <span className="text-[9px] text-red-600 font-semibold">
                        {batchPdfProgress.failures.length} failed
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Search */}
              <div className="px-3 pb-2 flex gap-2">
                <input
                  type="text"
                  placeholder="Search customer or invoice number…"
                  value={recoverySearch}
                  onChange={(e) => { setRecoverySearch(e.target.value); setRecoveryPage(0); }}
                  className="flex-1 text-[10px] px-2.5 py-1.5 border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:border-slate-400 placeholder-slate-400"
                />
              </div>

              {/* API Usage Counter */}
              <div className="px-3 pb-3">
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-mono">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-600">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    ZOHO API USAGE TODAY
                  </div>
                  <div className="flex gap-4 text-slate-500 items-center">
                    <span>Total Calls</span>
                    <strong className="text-slate-800 text-[10px]">{apiUsage ? apiUsage.total : '...'}</strong>
                  </div>
                </div>
              </div>

              {/* KPI Cards — 4 cards 2×2 */}
              <div className="px-3 pb-3 grid grid-cols-4 gap-1.5">
                <div className="bg-rose-50 border border-rose-100 rounded-lg p-2 text-center">
                  <span className="text-[7px] font-bold text-rose-400 uppercase tracking-wide block leading-none mb-1">Outstanding</span>
                  <span className="text-[10px] font-black text-rose-700 leading-none">{formatINR(sidebarKPIs.totalOutstandingAmount)}</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-2 text-center">
                  <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wide block leading-none mb-1">Customers</span>
                  <span className="text-[10px] font-black text-slate-800 leading-none">{sidebarKPIs.uniqueCustomers}</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-2 text-center">
                  <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wide block leading-none mb-1">Invoices</span>
                  <span className="text-[10px] font-black text-slate-800 leading-none">{sidebarKPIs.pendingInvoicesCount}</span>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 text-center">
                  <span className="text-[7px] font-bold text-amber-500 uppercase tracking-wide block leading-none mb-1">Oldest Due</span>
                  <span className="text-[10px] font-black text-amber-700 leading-none">{sidebarKPIs.oldestDueDays}d</span>
                </div>
              </div>
            </div>

            {/* ── CUSTOMER LIST ── */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {groupedCustomers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-1.5">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                    <Check size={14} className="stroke-[3] text-slate-400" />
                  </div>
                  <div>
                    <p className="text-slate-800 font-bold text-[10px]">No customers in queue</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">Flag invoices from the summary table to get started</p>
                  </div>
                </div>
              ) : (
                <>
                  {groupedCustomers
                    .slice(recoveryPage * RECOVERY_PAGE_SIZE, (recoveryPage + 1) * RECOVERY_PAGE_SIZE)
                    .map((customer) => {
                      const isExpanded = expandedCustomerIds.has(customer.customerId);
                      const totalOut = customer.totalOutstanding;

                      // Priority color coding
                      const borderColor =
                        totalOut > 500000 ? 'border-l-rose-500' :
                        totalOut > 200000 ? 'border-l-orange-400' :
                        totalOut > 50000  ? 'border-l-amber-400' :
                                            'border-l-emerald-400';
                      const amountColor =
                        totalOut > 500000 ? 'text-rose-700' :
                        totalOut > 200000 ? 'text-orange-600' :
                        totalOut > 50000  ? 'text-amber-600' :
                                            'text-emerald-700';

                      return (
                        <div
                          key={customer.customerId}
                          className={`bg-white border rounded-md shadow-sm border-l-4 ${borderColor} ${isExpanded ? 'border-slate-300 shadow-md' : 'border-slate-200 hover:border-slate-300'} transition-all`}
                        >
                          {/* Collapsed card header */}
                          <div
                            className="p-2.5 cursor-pointer select-none"
                            onClick={() => {
                              setExpandedCustomerIds(prev => {
                                const next = new Set(prev);
                                if (next.has(customer.customerId)) {
                                  next.delete(customer.customerId);
                                } else {
                                  next.add(customer.customerId);
                                }
                                return next;
                              });
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isExpanded
                                  ? <ChevronDown size={11} className="text-slate-400 shrink-0 mt-0.5" />
                                  : <ChevronRight size={11} className="text-slate-400 shrink-0 mt-0.5" />}
                                <span className="text-[10.5px] font-bold text-slate-800 uppercase truncate" title={customer.customerName}>
                                  {customer.customerName}
                                </span>
                              </div>
                              <span className={`text-[11px] font-extrabold shrink-0 ${amountColor}`}>
                                {formatINR(totalOut)}
                              </span>
                            </div>
                            <div className="pl-5 mt-0.5 flex items-center gap-3 text-[8.5px] text-slate-400 font-medium">
                              <span>{customer.invoiceCount} invoice{customer.invoiceCount !== 1 ? 's' : ''}</span>
                              <span className="text-slate-300">·</span>
                              <span>Oldest: <span className="font-bold text-slate-600">{customer.oldestDue}d</span></span>
                            </div>
                          </div>

                          {/* View Statement — always visible */}
                          <div className="px-2.5 pb-2 flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(buildStatementUrl(customer.customerId), '_blank');
                              }}
                              className="flex items-center gap-1 px-2 py-1 border border-slate-200 rounded text-[8.5px] font-bold text-slate-600 hover:bg-slate-50 bg-white transition-colors"
                            >
                              <FileText size={9} />
                              View Statement
                            </button>
                          </div>

                          {/* Expanded: invoice table */}
                          {isExpanded && (
                            <div className="border-t border-slate-100 animate-in fade-in duration-100">
                              <table className="w-full text-[9px] border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-2.5 py-1.5 text-left font-bold text-slate-500 uppercase tracking-wide text-[7.5px]">Invoice</th>
                                    <th className="px-2 py-1.5 text-left font-bold text-slate-500 uppercase tracking-wide text-[7.5px]">Date</th>
                                    <th className="px-2 py-1.5 text-right font-bold text-slate-500 uppercase tracking-wide text-[7.5px]">Age</th>
                                    <th className="px-2.5 py-1.5 text-right font-bold text-slate-500 uppercase tracking-wide text-[7.5px]">Outstanding</th>
                                    {releaseAllowed && <th className="px-2 py-1.5 text-center font-bold text-slate-500 uppercase tracking-wide text-[7.5px]">Action</th>}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {customer.invoices.map(({ task, inv, pending, ageDays, invoiceDate }) => {
                                    const loading = taskLoadingId === task.invoiceId;
                                    const ageColor =
                                      ageDays <= 3  ? 'text-emerald-600' :
                                      ageDays <= 7  ? 'text-amber-600' :
                                                      'text-rose-600';
                                    const displayDate = inv
                                      ? formatDateDisplay(inv.invoiceDate, inv.createdTime || null).date
                                      : (invoiceDate ? new Date(invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—');
                                    return (
                                      <tr key={task.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-2.5 py-1.5 font-mono text-slate-700 font-medium text-[9px]">{task.invoiceNumber}</td>
                                        <td className="px-2 py-1.5 text-slate-500">{displayDate}</td>
                                        <td className={`px-2 py-1.5 text-right font-bold ${ageColor}`}>{ageDays}d</td>
                                        <td className="px-2.5 py-1.5 text-right font-extrabold text-slate-800">{formatINR(pending)}</td>
                                        {releaseAllowed && (
                                          <td className="px-2 py-1.5 text-center">
                                            <button
                                              disabled={loading}
                                              onClick={() => handleReleaseStatement(task.id, task.invoiceId)}
                                              className="px-1.5 py-0.5 border border-emerald-200 rounded text-[8px] font-bold text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50 flex items-center gap-0.5 mx-auto"
                                            >
                                              {loading ? <Loader2 size={8} className="animate-spin" /> : <CheckCheck size={8} />}
                                              Release
                                            </button>
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {/* Pagination */}
                  {groupedCustomers.length > RECOVERY_PAGE_SIZE && (
                    <div className="flex items-center justify-center gap-3 pt-2 pb-1">
                      <button
                        disabled={recoveryPage === 0}
                        onClick={() => setRecoveryPage(p => p - 1)}
                        className="px-2.5 py-1 border border-slate-200 rounded text-[9px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                      >
                        ← Prev
                      </button>
                      <span className="text-[9px] text-slate-500 font-medium">
                        Page {recoveryPage + 1} of {Math.ceil(groupedCustomers.length / RECOVERY_PAGE_SIZE)}
                      </span>
                      <button
                        disabled={(recoveryPage + 1) * RECOVERY_PAGE_SIZE >= groupedCustomers.length}
                        onClick={() => setRecoveryPage(p => p + 1)}
                        className="px-2.5 py-1 border border-slate-200 rounded text-[9px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sync Preview Modal */}
      {syncPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Recovery Queue Update</h3>
              <button 
                onClick={() => setSyncPreviewOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto max-h-[60vh] space-y-3">
              <p className="text-xs text-slate-500 font-medium">
                The sync has completed checking outstanding balances. The following active invoices will be removed or released from the queue:
              </p>

              {proposedRemovals.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-lg bg-slate-50">
                  <p className="text-xs text-slate-600 font-bold">No active removals or releases proposed</p>
                  <p className="text-[10px] text-slate-400 mt-1">All processed invoices will remain active in the queue.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-[10px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                        <th className="p-2">Invoice</th>
                        <th className="p-2">Customer</th>
                        <th className="p-2 text-right">Prev</th>
                        <th className="p-2 text-right">New</th>
                        <th className="p-2 text-center">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {proposedRemovals.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="p-2 font-mono font-medium text-slate-700">{r.invoiceNumber}</td>
                          <td className="p-2 text-slate-600 truncate max-w-[100px]">{r.customerName}</td>
                          <td className="p-2 text-right text-slate-500">{formatINR(r.previousBalance)}</td>
                          <td className="p-2 text-right text-slate-700 font-medium">{formatINR(r.newBalance)}</td>
                          <td className="p-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                              r.removalReason === 'FULLY_PAID' 
                                ? 'bg-emerald-50 text-emerald-700' 
                                : r.removalReason === 'AUTO_RELEASED'
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-slate-100 text-slate-600'
                            }`}>
                              {r.reasonLabel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Customers With Available Credits Section */}
              <div className="pt-2 border-t border-slate-105">
                <div className="flex justify-between items-center mb-1.5">
                  <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                    Customers With Available Credits ({customerCredits.length})
                  </h4>
                  <span className="text-[10px] font-extrabold text-emerald-700">
                    Total: {formatINR(totalCreditsValue)}
                  </span>
                </div>

                {customerCredits.length === 0 ? (
                  <p className="text-[9.5px] italic text-slate-400">No customers with available credits (≥ ₹200) found in Zoho for this sync.</p>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[160px] overflow-y-auto">
                    <table className="w-full text-left text-[10px] border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0">
                          <th className="p-2">Customer Name</th>
                          <th className="p-2 text-right">Available Credit</th>
                          <th className="p-2 text-center">Last Activity Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {customerCredits.map((c, i) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="p-2 font-medium text-slate-700">{c.customerName}</td>
                            <td className="p-2 text-right text-emerald-600 font-extrabold">{formatINR(c.availableCredit)}</td>
                            <td className="p-2 text-center text-slate-500 font-mono">{c.lastActivityDate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="text-[8.5px] text-slate-400 mt-1 italic leading-none">
                  * Note: Credits are informational only and will not auto-adjust invoices.
                </p>
              </div>

              {syncStats && (
                <div className="grid grid-cols-4 gap-2 text-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-[7.5px] font-bold text-slate-400 uppercase block">Processed</span>
                    <span className="text-xs font-black text-slate-800">{syncStats.processed}</span>
                  </div>
                  <div>
                    <span className="text-[7.5px] font-bold text-slate-400 uppercase block">Removed</span>
                    <span className="text-xs font-black text-rose-700">{syncStats.removed}</span>
                  </div>
                  <div>
                    <span className="text-[7.5px] font-bold text-slate-400 uppercase block">Released</span>
                    <span className="text-xs font-black text-blue-700">{syncStats.released}</span>
                  </div>
                  <div>
                    <span className="text-[7.5px] font-bold text-slate-400 uppercase block">Remaining</span>
                    <span className="text-xs font-black text-slate-800">{syncStats.remaining}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button 
                type="button" 
                onClick={() => setSyncPreviewOpen(false)}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={applySyncChanges}
                disabled={syncLoading}
                className="px-3 py-1.5 bg-[#1A2766] hover:bg-[#1A2766]/90 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {syncLoading ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Applying...
                  </>
                ) : (
                  'Apply Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
