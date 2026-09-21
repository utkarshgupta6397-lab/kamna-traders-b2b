'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, RefreshCw, ChevronDown, ChevronRight,
  FileJson, Copy, AlertCircle, User, Phone,
  TrendingUp, Activity, Lock, Printer, Check, Download,
  Calculator, Plus, Minus, Trash2, X, Users
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import toast from 'react-hot-toast';
import { qzManager } from '@/lib/print/qz-tray';
import { renderStatementSlip } from '@/lib/print/slip-renderer';
import { 
  type Customer, 
  type Transaction, 
  type Telemetry, 
  type Statement, 
  getOpeningBalancePresentation, cleanDescription,
  renderStatementToPdf 
} from '@/lib/zoho/pdf-statement-renderer';
// ─── Types ───────────────────────────────────────────────────────────────────

// Re-using types from pdf-statement-renderer.ts

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format as Indian rupee with comma grouping, always positive display */
function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
}

/**
 * Render a balance in accounting style:
 *   positive -> positive (customer owes us)
 *   negative -> negative (we owe customer / advance)
 */
function fmtBalance(n: number) {
  if (n === 0 || Math.abs(n) < 0.01) return '₹0.00';
  const val = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  return n > 0 ? val : `-${val}`;
}

const BalanceIndicator = ({ balance }: { balance: number }) => {
  if (balance === 0 || Math.abs(balance) < 0.01) return null;
  const isReceivable = balance > 0;
  return (
    <span 
      className={`inline-flex items-center justify-center mr-1 text-[11px] font-bold ${isReceivable ? 'text-emerald-500' : 'text-rose-500'}`} 
      title={isReceivable ? 'Receivable (Owes You)' : 'Payable (You Owe)'}
    >
      {isReceivable ? '↙' : '↗'}
    </span>
  );
};

// Directional indicator for running balance changes:
// current > previous: balance increased (rose / ↗)
// current < previous: balance decreased (emerald / ↙)
// current === previous: no change (null)
const BalanceChangeIndicator = ({ current, previous }: { current: number; previous: number | null }) => {
  if (previous === null || Math.abs(current - previous) < 0.01) return null;
  const isIncrease = current > previous;
  return (
    <span
      className={`inline-flex items-center justify-center mr-1 text-[11px] font-bold ${
        isIncrease ? 'text-rose-500' : 'text-emerald-600'
      }`}
      title={isIncrease ? 'Balance increased (more receivable / owed)' : 'Balance decreased (less receivable / paid down)'}
    >
      {isIncrease ? '↗' : '↙'}
    </span>
  );
};

/** Humanize cached age in ms */
function formatCachedAge(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (hours < 24) {
    return remainingMins > 0 ? `${hours}h ${remainingMins}m ago` : `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Extract YYYY-MM-DD explicitly to avoid timezone shift */
function parseRawDate(iso: string) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, mStr, d] = match;
    const mNum = parseInt(mStr, 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return { y, m: months[mNum - 1], d };
  }
  return null;
}

/** Format date as "18 May 2026" */
function fmtDate(iso: string) {
  if (!iso) return '—';
  const raw = parseRawDate(iso);
  if (raw) return `${raw.d} ${raw.m} ${raw.y}`;
  
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Format datetime as "8 May 2026 1:23 PM" */
function fmtDateTime(iso: string) {
  if (!iso) return '—';
  
  let datePart = '';
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, mStr, d] = match;
    const mNum = parseInt(mStr, 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    datePart = `${d} ${months[mNum - 1]} ${y}`;
  } else {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    datePart = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  if (iso.length === 10 || (!iso.includes('T') && !iso.includes(':'))) return datePart;
  
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const timePart = d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: 'numeric', hour12: true });
  return `${datePart} ${timePart}`;
}

// ─── Date Filter Helpers ──────────────────────────────────────────────────────

export type DateFilterType = 'this-month' | 'last-month' | 'last-2-months' | 'last-3-months' | 'this-quarter' | 'all-time';

export const DATE_FILTER_CHIPS: { id: DateFilterType; label: string }[] = [
  { id: 'this-month', label: 'This Month' },
  { id: 'last-month', label: 'Last Month' },
  { id: 'last-2-months', label: 'Last 2 Months' },
  { id: 'last-3-months', label: 'Last 3 Months' },
  { id: 'this-quarter', label: 'This Quarter' },
  { id: 'all-time', label: 'All Time' },
];

export function getDateFilterRange(type: DateFilterType, refDate = new Date()): { start: string | null; end: string | null } {
  if (type === 'all-time') {
    return { start: null, end: null };
  }

  const year = refDate.getFullYear();
  const month = refDate.getMonth(); // 0 = Jan, 8 = Sep, 11 = Dec

  const toIso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayStr = toIso(refDate);

  switch (type) {
    case 'this-month': {
      // From 1st day of current calendar month through today
      const start = new Date(year, month, 1);
      return { start: toIso(start), end: todayStr };
    }
    case 'last-month': {
      // Entire previous calendar month: e.g. for Sep 2026 => 01 Aug -> 31 Aug
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0); // last day of prev month
      return { start: toIso(start), end: toIso(end) };
    }
    case 'last-2-months': {
      // Current calendar month + previous calendar month: starts 1st day of (month - 1)
      const start = new Date(year, month - 1, 1);
      return { start: toIso(start), end: todayStr };
    }
    case 'last-3-months': {
      // Current calendar month + previous two calendar months: starts 1st day of (month - 2)
      const start = new Date(year, month - 2, 1);
      return { start: toIso(start), end: todayStr };
    }
    case 'this-quarter': {
      // Current calendar quarter through today
      const quarterStartMonth = Math.floor(month / 3) * 3;
      const start = new Date(year, quarterStartMonth, 1);
      return { start: toIso(start), end: todayStr };
    }
    default:
      return { start: null, end: null };
  }
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

  const [groupStatement, setGroupStatement] = useState<{
    success: boolean;
    statements: Statement[];
    error?: string;
  } | null>(null);
  const [groupLoading, setGroupLoading] = useState(false);
  const [visibleFirmIds, setVisibleFirmIds] = useState<string[]>([]);
  const [debugOpen, setDebugOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfMenuOpen, setPdfMenuOpen] = useState(false);
  const [pdfPreviewModal, setPdfPreviewModal] = useState<{
    isOpen: boolean;
    blobUrl: string | null;
    fileName: string;
    doc: any | null;
  }>({
    isOpen: false,
    blobUrl: null,
    fileName: '',
    doc: null,
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [userExpandedMonths, setUserExpandedMonths] = useState<Set<string> | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  // Autocomplete State
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // API Telemetry State
  const [apiUsage, setApiUsage] = useState<any>(null);
  const [usagePeriod, setUsagePeriod] = useState<'today'|'7d'|'month'>('today');
  const [isFetchingUsage, setIsFetchingUsage] = useState(false);

  // Calculator State
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [calcEntries, setCalcEntries] = useState<{ id: string; description: string; type: string; amount: number; netEffect: number }[]>([]);
  const [manualAmount, setManualAmount] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);

  // Clipped Mode State
  const [clipFromIndex, setClipFromIndex] = useState<number | null>(null);

  // Draft Invoices State
  const [draftStatuses, setDraftStatuses] = useState<Record<string, boolean>>({});

  // Group Statement Mode State
  const [statementMode, setStatementMode] = useState<'single' | 'group'>('single');
  const [selectedCustomers, setSelectedCustomers] = useState<{id: string, name: string}[]>([]);
  const [kpiMode, setKpiMode] = useState<'compact' | 'financial'>('compact');

  // Ledger Filter State
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all-time');
  const [filterSales, setFilterSales] = useState(true);
  const [filterCustPmts, setFilterCustPmts] = useState(true);
  const [filterBills, setFilterBills] = useState(true);
  const [filterVendorPmts, setFilterVendorPmts] = useState(true);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [userName, setUserName] = useState('Staff');

  // Memoize visible statement transactions and calculations for export synchronization
  const visibleStatementData = useMemo(() => {
    const s = (statementMode === 'group' ? groupStatement : statement?.data) as any;
    if (!s) return null;

    // For Group Statements: We don't filter/clip in-memory ledger list in the same way, but let's handle single statements.
    if (statementMode === 'group') return s;

    const isValidClip = clipFromIndex !== null && clipFromIndex >= 0 && clipFromIndex < s.transactions.length && !!s.transactions[clipFromIndex];
    const clipIdx = isValidClip ? clipFromIndex : -1;
    const isClipped = clipIdx !== -1;
    const activeTxs = isClipped ? s.transactions.slice(clipIdx) : s.transactions;

    // 1. Date Range Filter
    const { start: dateStart, end: dateEnd } = getDateFilterRange(dateFilter);
    const dateFilteredTxs = (dateStart || dateEnd)
      ? activeTxs.filter((tx: any) => {
          const d = (tx.date || tx.datetime || '').slice(0, 10);
          if (!d) return true;
          if (dateStart && d < dateStart) return false;
          if (dateEnd && d > dateEnd) return false;
          return true;
        })
      : activeTxs;

    // 2. Period Opening Balance (balance immediately before the period starts)
    let periodOpeningBalance: number;
    if (!dateStart && !dateEnd) {
      periodOpeningBalance = isClipped
        ? (activeTxs[0].balanceAfter - activeTxs[0].netEffect)
        : s.openingBalance;
    } else if (dateFilteredTxs.length > 0) {
      periodOpeningBalance = dateFilteredTxs[0].balanceAfter - dateFilteredTxs[0].netEffect;
    } else {
      const priorTxs = dateStart
        ? activeTxs.filter((tx: any) => {
            const d = (tx.date || tx.datetime || '').slice(0, 10);
            return d && d < dateStart;
          })
        : [];
      if (priorTxs.length > 0) {
        periodOpeningBalance = priorTxs[priorTxs.length - 1].balanceAfter;
      } else {
        periodOpeningBalance = (isClipped && activeTxs.length > 0)
          ? (activeTxs[0].balanceAfter - activeTxs[0].netEffect)
          : s.openingBalance;
      }
    }

    // 3. Search & Type Filter
    const filteredTransactions = dateFilteredTxs.filter((tx: any) => {
      if (tx.type === 'invoice' && !filterSales) return false;
      if (tx.type === 'payment' && !filterCustPmts) return false;
      if (tx.type === 'bill' && !filterBills) return false;
      if (tx.type === 'vendor_payment' && !filterVendorPmts) return false;
      
      if (ledgerSearch.trim()) {
        const term = ledgerSearch.toLowerCase();
        const searchable = [
          tx.referenceNumber,
          tx.description,
          tx.type,
          tx.firmName,
          ...(tx.appliedBills || []).map((b: any) => b.billNumber)
        ].filter(Boolean).join(' ').toLowerCase();
        if (!searchable.includes(term)) return false;
      }
      return true;
    });

    const chronologicalVisible = filteredTransactions;
    const dynamicOpeningBalance = chronologicalVisible.length > 0
      ? (chronologicalVisible[0].balanceAfter - chronologicalVisible[0].netEffect)
      : periodOpeningBalance;

    const dynamicClosingBalance = dynamicOpeningBalance + chronologicalVisible.reduce((sum: number, t: any) => sum + t.netEffect, 0);

    const activeUnpaidInvoices = s.unpaidInvoices ? (
      isClipped ? s.unpaidInvoices.filter((inv: any) => {
        const clippedTx = s.transactions[clipIdx];
        if (!clippedTx) return true;
        const clipDate = clippedTx.date || clippedTx.datetime || 0;
        const invDate = inv.invoiceDate || 0;
        return new Date(invDate).getTime() >= new Date(clipDate).getTime();
      }) : s.unpaidInvoices
    ) : [];

    return {
      ...s,
      openingBalance: dynamicOpeningBalance,
      closingBalance: dynamicClosingBalance,
      transactions: chronologicalVisible,
      transactionCount: filteredTransactions.length,
      unpaidInvoices: activeUnpaidInvoices
    };
  }, [statementMode, groupStatement, statement, clipFromIndex, isExpanded, filterSales, filterCustPmts, filterBills, filterVendorPmts, ledgerSearch, dateFilter]);

  // Expanded Transactions State
  const [expandedTx, setExpandedTx] = useState<Record<string, boolean>>({});
  const [txLineItems, setTxLineItems] = useState<Record<string, any[]>>({});
  const [loadingTx, setLoadingTx] = useState<Record<string, boolean>>({});
  const [txErrors, setTxErrors] = useState<Record<string, string>>({});

  const toggleTxExpand = async (txId: string, txType: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isExpanded = !!expandedTx[txId];
    setExpandedTx(prev => ({ ...prev, [txId]: !isExpanded }));

    if (!isExpanded) {
      if (txLineItems[txId]) {
        console.log(`[Tx Expand Cache Hit] Using cached line items for ${txType} ${txId}`);
      } else if (!loadingTx[txId]) {
        console.log(`[Tx Expand Fetch] Fetching details from API for ${txType} ${txId}`);
        setLoadingTx(prev => ({ ...prev, [txId]: true }));
        setTxErrors(prev => ({ ...prev, [txId]: '' }));
        try {
          const endpoint = txType === 'invoice' ? 'invoice' : 'bill';
          const res = await fetch(`/api/admin/customer-statement/${endpoint}/${txId}`);
          const data = await res.json();
          if (data.success && data.data && data.data.line_items) {
            setTxLineItems(prev => ({ ...prev, [txId]: data.data.line_items }));
          } else {
            setTxErrors(prev => ({ ...prev, [txId]: data.error || `Unable to load ${txType} items` }));
          }
        } catch (err: any) {
          setTxErrors(prev => ({ ...prev, [txId]: err.message || `Unable to load ${txType} items` }));
        } finally {
          setLoadingTx(prev => ({ ...prev, [txId]: false }));
        }
      }
    } else {
      console.log(`[Tx Collapse] Collapsing ${txType} ${txId}`);
    }
  };

  const handleModeChange = (mode: 'single' | 'group') => {
    setStatementMode(mode);
    try {
      sessionStorage.setItem('statementMode', mode);
    } catch (e) {}
    if (mode === 'single') {
      setSelectedCustomers([]);
    }
  };

  useEffect(() => {
    try {
      const mode = sessionStorage.getItem('statementMode');
      // Intentionally removed the lookup that set statementMode to 'group' so that it defaults to 'single'

      const stored = sessionStorage.getItem('calc-session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.isCalcOpen !== undefined) setIsCalcOpen(parsed.isCalcOpen);
        if (parsed.calcEntries) setCalcEntries(parsed.calcEntries);
      }
    } catch (e) {}

    // Fetch logged-in user name
    fetch('/api/auth/session')
      .then(res => res.json())
      .catch(() => null)
      .then(data => {
        if (data && data.authenticated && data.session && data.session.name) {
          setUserName(data.session.name);
        }
      });

    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      sessionStorage.setItem('calc-session', JSON.stringify({ isCalcOpen, calcEntries }));
    }
  }, [isCalcOpen, calcEntries, isHydrated]);

  // Update "now" every 30s so cached age stays fresh without being noisy
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

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
          balanceAfter: t.balanceAfter
        })),
        companyState: (s.customer.billingAddress as any)?.state || '',
        telemetryId: (s.telemetry as any)?.id,
        periodString: (statement?.data as any)?.periodString || 'Past 12 Months'
      };

      const res = await fetch('/api/admin/dcr/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Thermal Print Failed');
      toast.success('Thermal Print Job Dispatched');
    } catch (e: any) {
      toast.error(e.message || 'Thermal printing failed');
    } finally {
      setPrinting(false);
    }
  };

  const handlePrint = async (sToPrint: any) => {
    if (!sToPrint) return;
    setPrinting(true);
    try {
      toast.loading('Preparing Print...', { id: 'print-stmt' });
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      await renderStatementToPdf(doc, autoTable, sToPrint, {
        isExpanded,
        clipFromIndex,
        firmColors,
        generatedBy: userName
      });

      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);

      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = blobUrl;

      document.body.appendChild(iframe);
      
      iframe.onload = () => {
        setTimeout(() => {
          if (iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            toast.success('Print dialog opened', { id: 'print-stmt' });
          }
        }, 500);
      };
      
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(blobUrl);
      }, 300000); // cleanup after 5 mins

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Printing Failed';
      console.error('Print error:', err);
      toast.error(msg, { id: 'print-stmt' });
    } finally {
      setPrinting(false);
    }
  };

  // ── PDF Preview & Download Flow ──────────────────────────────────────────
  const handleDownloadPDF = async (sToPrint: any) => {
    if (!sToPrint) return;
    setPdfGenerating(true);
    try {
      toast.loading('Preparing PDF Preview…', { id: 'pdf-stmt' });

      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      await renderStatementToPdf(doc, autoTable, sToPrint, {
        isExpanded,
        clipFromIndex,
        firmColors,
        generatedBy: userName
      });

      let safeName = sToPrint.customer.contactName || 'CUSTOMER';
      if (sToPrint.isGroup) safeName = 'GROUP';
      safeName = safeName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `${safeName}_STATEMENT_${dateStr}.pdf`;

      const blobUrl = doc.output('bloburl');

      setPdfPreviewModal({
        isOpen: true,
        blobUrl: String(blobUrl),
        fileName,
        doc,
      });

      toast.success('PDF preview generated!', { id: 'pdf-stmt' });
    } catch (err) {
      console.error('[PDF Export Error]', err);
      toast.error('Failed to generate PDF preview.', { id: 'pdf-stmt' });
    } finally {
      setPdfGenerating(false);
    }
  };

  const confirmPdfDownload = () => {
    if (!pdfPreviewModal.doc) return;
    try {
      pdfPreviewModal.doc.save(pdfPreviewModal.fileName || 'statement.pdf');
      toast.success('Statement PDF downloaded!');
      closePdfPreviewModal();
    } catch (err) {
      console.error('Failed to save PDF:', err);
      toast.error('Failed to save PDF file.');
    }
  };

  const closePdfPreviewModal = () => {
    if (pdfPreviewModal.blobUrl) {
      try {
        URL.revokeObjectURL(pdfPreviewModal.blobUrl);
      } catch (e) {}
    }
    setPdfPreviewModal({
      isOpen: false,
      blobUrl: null,
      fileName: '',
      doc: null,
    });
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const handleFetch = async (overrideCustomerId?: string, force = false) => {
    const cid = overrideCustomerId || customerId;
    if (!cid) return;
    
    // Check session cache if not forced
    const cacheKey = `customer-statement-${cid}`;
    if (!force) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setStatement({ success: true, data: parsed.data });
          setCachedAt(parsed.cachedAt);
          setUserExpandedMonths(null);
          setExpandedMonths(new Set());
          return;
        } catch (e) {}
      }
    }

    setLoading(true);
    setStatement(null);
    setCachedAt(null);
    setClipFromIndex(null); // Reset clip mode
    setUserExpandedMonths(null);
    setExpandedMonths(new Set());
    try {
      const res = await fetch(`/api/admin/customer-statement/statement?customerId=${cid}`);
      const data = await res.json();

      if (!res.ok) {
          console.error(data);
          throw new Error(data.message || data.error || "Unknown server error");
      }

      if (data.success) {
        setStatement(data);
        const nowTs = Date.now();
        setCachedAt(nowTs);
        setNow(nowTs);
        sessionStorage.setItem(cacheKey, JSON.stringify({ data: data.data, cachedAt: nowTs }));
        toast.success(force ? 'Statement refreshed.' : 'Statement loaded.');
      } else {
        toast.error(data.error || 'Failed to load statement.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchGroup = async (force = false, overrideCustomers?: {id: string, name: string}[]) => {
    const activeCustomers = overrideCustomers || selectedCustomers;
    if (activeCustomers.length === 0) {
      setGroupStatement(null);
      setVisibleFirmIds([]);
      setCachedAt(null);
      return;
    }
    const ids = activeCustomers.map(c => c.id).join(',');
    const cacheKey = `group-statement-${ids}`;
    
    if (!force) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setGroupStatement({ success: true, statements: parsed.data });
          setVisibleFirmIds(activeCustomers.map(c => c.id));
          setCachedAt(parsed.cachedAt);
          return;
        } catch (e) {}
      }
    }

    setGroupLoading(true);
    setGroupStatement(null);
    setCachedAt(null);
    try {
      const res = await fetch(`/api/admin/customer-statement/group?customerIds=${ids}`);
      const data = await res.json();
      if (data.success && data.data) {
        setGroupStatement({ success: true, statements: data.data });
        setVisibleFirmIds(activeCustomers.map(c => c.id));
        const nowTs = Date.now();
        setCachedAt(nowTs);
        setNow(nowTs);
        sessionStorage.setItem(cacheKey, JSON.stringify({ data: data.data, cachedAt: nowTs }));
        toast.success(force ? 'Group Statement refreshed.' : 'Group Statement loaded.');
      } else {
        toast.error(data.error || 'Failed to load group statement.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error');
    } finally {
      setGroupLoading(false);
    }
  };

  useEffect(() => {
    if (initialCustomerId) {
      handleFetch(initialCustomerId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCustomerId]);

  // ── Draft Status Fetcher ───────────────────────────────────────────────────
  useEffect(() => {
    const fetchDraftStatuses = async () => {
      if (!statement?.data?.transactions) return;
      
      // Normalize date to IST for comparison
      const now = new Date();
      const istDate = new Date(now.getTime() + 330 * 60000);
      const todayDate = istDate.toISOString().slice(0, 10);
      
      const todayInvoices = statement.data.transactions.filter(
        t => t.type === 'invoice' && (t.date === todayDate || (t.datetime && t.datetime.startsWith(todayDate)))
      );

      if (todayInvoices.length === 0) return;

      const newDraftStatuses = { ...draftStatuses };
      let updated = false;

      await Promise.all(
        todayInvoices.map(async (inv) => {
          if (draftStatuses[inv.id] !== undefined) return;
          
          try {
            console.log(`[DRAFT CHECK] Fetching status for invoice ID: ${inv.id}`);
            const res = await fetch(`/api/admin/dcr/invoices/${inv.id}`);
            if (res.ok) {
              const data = await res.json();
              const invoice = data.invoice || data.data;
              
              if (invoice) {
                const status = invoice.status || invoice.invoiceStatus;
                console.log(`[DRAFT CHECK] invoiceNumber: ${invoice.invoiceNumber || inv.description}, invoiceDate: ${invoice.invoiceDate || inv.date}, invoiceStatus: ${status}`);
                
                if (status?.toUpperCase() === 'DRAFT') {
                  newDraftStatuses[inv.id] = true;
                  updated = true;
                } else if (status) {
                  newDraftStatuses[inv.id] = false;
                  updated = true;
                }
              }
            }
          } catch (e) {
            console.error('Failed to fetch invoice status', e);
          }
        })
      );

      if (updated) {
        setDraftStatuses(newDraftStatuses);
      }
    };

    fetchDraftStatuses();
  }, [statement?.data?.transactions]);

  // ── API Telemetry ──────────────────────────────────────────────────────────
  const fetchApiUsage = async () => {
    setIsFetchingUsage(true);
    try {
      const res = await fetch(`/api/admin/customer-statement/api-usage?period=${usagePeriod}`);
      if (res.ok) {
        const data = await res.json();
        setApiUsage(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingUsage(false);
    }
  };

  useEffect(() => {
    fetchApiUsage();
  }, [usagePeriod]);

  // ── Autocomplete Search ──────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length >= 3) {
        setIsSearching(true);
        try {
          const res = await fetch(`/api/admin/customer-statement/search?q=${encodeURIComponent(searchQuery)}`);
          if (res.ok) {
            const data = await res.json();
            setSuggestions(data.customers || []);
            setShowSuggestions(true);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Calculator Helpers ───────────────────────────────────────────────────
  const handleManualAdd = (isPositive: boolean) => {
    const amt = parseFloat(manualAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    const type = isPositive ? 'manual-add' : 'manual-deduct';
    const netEffect = isPositive ? amt : -amt;
    const desc = manualDesc.trim() || (isPositive ? 'Manual Add' : 'Manual Deduct');
    
    setCalcEntries(prev => [...prev, {
      id: `manual-${Date.now()}`,
      description: desc,
      type,
      amount: amt,
      netEffect
    }]);
    
    setManualAmount('');
    setManualDesc('');
    toast.success('Added entry', { id: 'calc' });
  };

  const addCalcEntry = (tx: Transaction) => {
    if (!calcEntries.find(e => e.id === tx.id)) {
      setCalcEntries(prev => [...prev, {
        id: tx.id,
        description: cleanDescription(tx.description, tx.type),
        type: tx.type,
        amount: Math.abs(tx.netEffect),
        netEffect: tx.netEffect
      }]);
      setIsCalcOpen(true);
      toast.success('Added to calculator', { id: 'calc' });
    }
  };

  const removeCalcEntry = (id: string) => {
    setCalcEntries(prev => prev.filter(e => e.id !== id));
  };

  const clearCalc = () => {
    setCalcEntries([]);
    toast.success('Calculator cleared');
  };

  const calcRunningTotal = calcEntries.reduce((sum, e) => sum + e.netEffect, 0);

  const getCalcFormulaText = () => {
    let text = 'Balance Calculation:\n\n';
    calcEntries.forEach(e => {
      const sign = e.netEffect > 0 ? '+' : '-';
      text += `${sign} ${e.description} ₹${e.amount.toLocaleString('en-IN')}\n`;
    });
    text += `\nResult: ₹${calcRunningTotal.toLocaleString('en-IN')}`;
    return text;
  };

  const copyCalcFormula = async () => {
    try {
      await navigator.clipboard.writeText(getCalcFormulaText());
      toast.success('Formula copied!');
    } catch (e) {
      toast.error('Copy failed');
    }
  };

  const copyCalcTotal = async () => {
    try {
      await navigator.clipboard.writeText(Math.abs(calcRunningTotal).toString());
      toast.success('Total copied!');
    } catch (e) {
      toast.error('Copy failed');
    }
  };

  const copyRaw = async () => {
    if (!statement) return;
    const textToCopy = JSON.stringify(statement.raw ?? statement, null, 2);

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        toast.success('Raw JSON copied!');
      } else {
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
        }
      }
    } catch (err) {
      console.error('Clipboard copy error:', err);
      toast.error('Failed to copy to clipboard.');
    }
  };

  // ── Render & Orchestration ───────────────────────────────────────────────────
  const firmColors = useMemo(() => {
    if (statementMode !== 'group' || !groupStatement?.statements) return {};
    const palette = [
      { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', bar: 'bg-blue-600', hex: [37, 99, 235] as [number, number, number], bgHex: [239, 246, 255] as [number, number, number] },
      { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', bar: 'bg-emerald-600', hex: [5, 150, 105] as [number, number, number], bgHex: [236, 253, 245] as [number, number, number] },
      { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', bar: 'bg-orange-600', hex: [234, 88, 12] as [number, number, number], bgHex: [255, 237, 213] as [number, number, number] },
      { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', bar: 'bg-purple-600', hex: [147, 51, 234] as [number, number, number], bgHex: [250, 245, 255] as [number, number, number] },
      { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', bar: 'bg-teal-600', hex: [13, 148, 136] as [number, number, number], bgHex: [240, 253, 250] as [number, number, number] },
    ];
    const map: Record<string, typeof palette[0]> = {};
    groupStatement.statements.forEach((stmt, idx) => {
      map[stmt.customer.contactId] = palette[idx % palette.length];
    });
    return map;
  }, [statementMode, groupStatement]);

  const s = useMemo(() => {
    if (statementMode === 'single') return statement?.data;
    if (statementMode === 'group' && groupStatement?.success && groupStatement.statements.length > 0) {
      const visible = groupStatement.statements.filter(stmt => visibleFirmIds.includes(stmt.customer.contactId));
      if (visible.length === 0) return undefined;

      const combinedClosing = visible.reduce((acc, stmt) => acc + stmt.closingBalance, 0);
      const combinedOpeningRaw = visible.reduce((acc, stmt) => acc + stmt.openingBalance, 0);

      const mergedTransactionsRaw = visible.flatMap(stmt =>
        stmt.transactions.map(t => ({
          ...t,
          firmName: stmt.customer.companyName || stmt.customer.contactName,
          firmId: stmt.customer.contactId
        }))
      );

      // Extract timestamp or compute it, then sort newest first
      mergedTransactionsRaw.forEach((t: any) => {
        if (!t.timestamp) {
          t.timestamp = new Date(t.datetime || t.date || 0).getTime();
        }
      });
      mergedTransactionsRaw.sort((a: any, b: any) => b.timestamp - a.timestamp);

      let runningBalance = combinedClosing;
      const transactions = [];
      for (const t of mergedTransactionsRaw) {
        transactions.push({
          ...t,
          balanceAfter: runningBalance
        });
        runningBalance -= t.netEffect;
      }
      const calculatedOpening = runningBalance;
      transactions.reverse();

      // Accounting Validation (Phase 4)
      let integrityError = null;
      if (Math.abs(calculatedOpening - combinedOpeningRaw) > 0.01) {
        integrityError = `Accounting Integrity Error: Calculated opening (₹${calculatedOpening}) differs from sum of openings (₹${combinedOpeningRaw}). Tolerance exceeded.`;
        console.error(integrityError);
      }

      const combinedReceivable = visible.reduce((acc, stmt) => acc + (stmt.outstandingReceivable || 0), 0);
      const combinedPayable = visible.reduce((acc, stmt) => acc + (stmt.outstandingPayable || 0), 0);

      const mergedStatement = {
        isGroup: true,
        groupFirms: visible,
        integrityError,
        firmNames: visible.map(stmt => stmt.customer.companyName || stmt.customer.contactName),
        customer: {
          contactId: 'GROUP',
          contactName: `${visible.length} Firms Selected`,
          companyName: 'Group Portfolio',
        },
        openingBalance: calculatedOpening,
        closingBalance: combinedClosing,
        outstandingReceivable: combinedReceivable,
        outstandingPayable: combinedPayable,
        isHybrid: visible.some(stmt => stmt.isHybrid),
        transactions: transactions,
        transactionCount: transactions.length,
        unpaidInvoices: visible.flatMap(stmt =>
          stmt.unpaidInvoices?.map(inv => ({ ...inv, firmName: stmt.customer.companyName || stmt.customer.contactName, firmId: stmt.customer.contactId })) || []
        ),
        telemetry: {
          totalApiCalls: visible.reduce((acc, stmt) => acc + (stmt.telemetry?.totalApiCalls || 0), 0)
        }
      } as any;
      
      console.debug('[Group Statement Render]', {
        visibleCount: visible.length,
        transactionCount: mergedStatement.transactionCount,
        closingBalance: mergedStatement.closingBalance,
        calculatedOpening
      });
      return mergedStatement;
    }
    return undefined;
  }, [statementMode, statement?.data, groupStatement, visibleFirmIds]);

  return (
    <div className="flex flex-col w-full relative">
      <div className="space-y-4 w-full">
        {/* ── Page Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customer Statement</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              View and manage customer transactions, payments and outstanding balance
            </p>
          </div>
          
          <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
            {/* Mode Toggle */}
            <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
              <button
                onClick={() => handleModeChange('single')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  statementMode === 'single' 
                    ? 'bg-white text-[#1A2766] shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Single
              </button>
              <button
                onClick={() => handleModeChange('group')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  statementMode === 'group' 
                    ? 'bg-[#1A2766] text-white shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Group
              </button>
            </div>

            {/* Header Calculator Button */}
            <button
              onClick={() => setIsCalcOpen(!isCalcOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm ${
                isCalcOpen
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
              }`}
              title={isCalcOpen ? "Close Balance Calculator" : "Open Balance Calculator"}
            >
              <Calculator size={14} />
              <span>{isCalcOpen ? "Close Calculator" : "Open Calculator"}</span>
              {calcEntries.length > 0 && (
                <span className={`${isCalcOpen ? 'bg-white text-purple-700' : 'bg-purple-600 text-white'} text-[10px] px-1.5 py-0.2 rounded-full font-bold`}>
                  {calcEntries.length}
                </span>
              )}
            </button>
          </div>
        </div>

      {/* ── Search & Action Bar ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 flex flex-col xl:flex-row items-start xl:items-end justify-between gap-4 sticky top-0 z-40 xl:static">
        
        {/* Left: Search */}
        <div className="flex-1 w-full xl:max-w-md flex flex-col gap-1.5 relative">
          <div className="flex items-center justify-between px-0.5">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-700">
              {statementMode === 'group' ? 'Selected Firms' : 'Customer Search'}
              {isLocked && (
                <span className="flex items-center gap-1 text-[10px] text-[#1A2766] font-medium bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                  <Lock size={10} /> Prefilled
                </span>
              )}
            </label>
          </div>

          {statementMode === 'group' && selectedCustomers.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-1">
              {selectedCustomers.map(c => (
                <div key={c.id} className="flex items-center gap-1.5 bg-gray-100 border border-gray-200 text-gray-800 px-2.5 py-1 rounded-full text-xs font-semibold">
                  <span className="truncate max-w-[200px]">{c.name}</span>
                  <button 
                    onClick={() => setSelectedCustomers(prev => prev.filter(x => x.id !== c.id))}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              id="customer-id-input"
              type="text"
              placeholder={statementMode === 'group' 
                ? (selectedCustomers.length >= 5 ? "Maximum 5 firms selected" : "+ Search...") 
                : "Name, Mobile, GST or ID..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onKeyDown={(e) => {
                if (isLocked) return;
                if (e.key === 'Enter' && statementMode === 'single') {
                  setCustomerId(searchQuery);
                  handleFetch(searchQuery, true);
                  setShowSuggestions(false);
                }
              }}
              disabled={isLocked || (statementMode === 'group' && selectedCustomers.length >= 5)}
              className={`w-full pl-9 pr-4 h-[36px] text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-[#1A2766] focus:border-transparent transition-all shadow-sm ${
                (isLocked || (statementMode === 'group' && selectedCustomers.length >= 5)) 
                  ? 'bg-gray-50 text-gray-500 border-gray-200 cursor-not-allowed' 
                  : 'bg-white border-gray-300 hover:border-gray-400'
              }`}
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <RefreshCw size={14} className="animate-spin text-gray-400" />
              </div>
            )}
            
            {/* Autocomplete Dropdown */}
            {showSuggestions && suggestions.length > 0 && !isLocked && (() => {
              const filteredSuggestions = statementMode === 'group' 
                ? suggestions.filter(c => !selectedCustomers.some(sc => sc.id === c.id))
                : suggestions;
                
              return (
                <div className="absolute z-50 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 overflow-hidden">
                  <div className="max-h-60 overflow-y-auto">
                    {filteredSuggestions.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500 italic text-center">No additional firms found.</div>
                    ) : (
                      filteredSuggestions.map((c) => (
                        <div 
                          key={c.id} 
                          className="px-4 py-2.5 border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors"
                          onMouseDown={(e) => {
                            e.preventDefault(); // Prevent blur
                            if (statementMode === 'group') {
                              if (selectedCustomers.length < 5 && !selectedCustomers.find(x => x.id === c.id)) {
                                setSelectedCustomers(prev => [...prev, {id: c.id, name: c.name}]);
                              }
                              setSearchQuery('');
                              setShowSuggestions(false);
                            } else {
                              setSearchQuery(c.name);
                              setCustomerId(c.id);
                              setShowSuggestions(false);
                              handleFetch(c.id);
                            }
                          }}
                        >
                          <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-start">
                              <div className="text-sm font-semibold text-gray-900 pr-2">{c.name}</div>
                              {c.status === 'active' ? (
                                <div className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white flex items-center gap-1 shadow-sm shrink-0 bg-[#16a34a]">
                                  <span className="text-[8px]">🟢</span>ACTIVE
                                </div>
                              ) : c.status === 'inactive' ? (
                                <div className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white flex items-center gap-1 shadow-sm shrink-0 bg-[#dc2626]">
                                  <span className="text-[8px]">🔴</span>INACTIVE
                                </div>
                              ) : (
                                <div className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white flex items-center gap-1 shadow-sm shrink-0 bg-gray-500">
                                  <span className="text-[8px]">⚪</span>UNKNOWN
                                </div>
                              )}
                            </div>
                            <div className="flex justify-between items-end">
                              <div>
                                {c.gstNumber && c.gstNumber !== 'NOT_AVAILABLE' && (
                                  <div className="text-[10px] font-mono text-gray-500 tracking-wide">GST: {c.gstNumber}</div>
                                )}
                              </div>
                              <div className="text-[10px] text-gray-400 font-mono">ID: {c.id}</div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex flex-row flex-wrap sm:flex-nowrap items-center gap-2.5 w-full xl:w-auto mt-2 xl:mt-0 shrink-0">
          <button
            id="fetch-statement-btn"
            onClick={() => {
              if (statementMode === 'group') {
                handleFetchGroup(true);
              } else {
                handleFetch(undefined, true);
              }
            }}
            disabled={(statementMode === 'single' && loading) || (statementMode === 'group' && (groupLoading || selectedCustomers.length === 0))}
            className="flex items-center justify-center gap-2 px-4 h-[36px] bg-[#1A2766] text-white rounded-md text-sm font-medium hover:bg-[#25368a] transition-colors shadow-sm disabled:opacity-50 w-full sm:w-auto whitespace-nowrap"
          >
            {(loading || groupLoading) ? <RefreshCw size={14} className="animate-spin" /> : (
              statementMode === 'group' 
                ? `Load Group Statement${selectedCustomers.length > 0 ? ` (${selectedCustomers.length} Firms)` : ''}`
                : 'Load Statement'
            )}
          </button>

          {s && (
            <>
              {/* Success: Download PDF (Opens Preview Modal First) */}
              <button
                onClick={() => handleDownloadPDF(visibleStatementData)}
                disabled={pdfGenerating}
                className="flex items-center justify-center gap-1.5 px-4 h-[36px] bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 w-full sm:w-auto print:hidden"
              >
                {pdfGenerating ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                {pdfGenerating ? 'Preparing…' : 'Download PDF'}
              </button>

              {/* Outline / Secondary: View DCR Summary */}
              {statementMode === 'single' && (
                <a
                  href={`/staff/dashboard/accounts/dcr/customer-lookup?customerId=${customerId}&filterMode=ALL&statusFilter=ALL`}
                  className="flex items-center justify-center gap-1.5 px-4 h-[36px] bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm w-full sm:w-auto print:hidden"
                >
                  View DCR Summary
                </a>
              )}
            </>
          )}
        </div>
      </div>


      {/* ── Main Content & Calculator Side-by-Side Container ── */}
      <div className="flex flex-col lg:flex-row w-full gap-4 items-start">
        <main className="min-w-0 flex-1 w-full flex flex-col gap-4">
          {/* ── Error state ────────────────────────────────────────────────── */}
          {statementMode === 'single' && statement && !statement.success && (
            <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm">
              <AlertCircle size={18} className="shrink-0" />
              <span>{statement.error || 'Unknown error'}</span>
            </div>
          )}

      {/* ── Group Mode Empty State ─────────────────────────────────────── */}
      {statementMode === 'group' && !groupStatement && (
        <div className="w-full flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-gray-100 shadow-sm min-h-[400px]">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-[#1A2766]">
            <Users size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Build Group Statement</h3>
          <p className="text-gray-500 max-w-sm mb-6 text-sm whitespace-pre-wrap">
            {selectedCustomers.length === 0 
              ? "No firms selected.\nSearch and add between 2–5 firms to generate a Group Statement."
              : "Search and add at least 1 more firm to generate a Group Statement."
            }
          </p>
        </div>
      )}

      {/* ── Portfolio Health (Moved to Unified KPI Section below) ── */}

      {(() => {
        if (!s) return null;
        // Calculate visible statement data dynamically based on UI state/filters
        const isValidClip = clipFromIndex !== null && clipFromIndex >= 0 && clipFromIndex < s.transactions.length && !!s.transactions[clipFromIndex];
        const clipIdx = isValidClip ? clipFromIndex : -1;
        const isClipped = clipIdx !== -1;
        const activeTxs = isClipped ? s.transactions.slice(clipIdx) : s.transactions;

        // 1. Date Range Filter
        const { start: dateStart, end: dateEnd } = getDateFilterRange(dateFilter);
        const dateFilteredTxs = (dateStart || dateEnd)
          ? activeTxs.filter((tx: any) => {
              const d = (tx.date || tx.datetime || '').slice(0, 10);
              if (!d) return true;
              if (dateStart && d < dateStart) return false;
              if (dateEnd && d > dateEnd) return false;
              return true;
            })
          : activeTxs;

        // 2. Period Opening Balance (balance immediately before the period starts)
        let periodOpeningBalance: number;
        if (!dateStart && !dateEnd) {
          periodOpeningBalance = isClipped
            ? (activeTxs[0].balanceAfter - activeTxs[0].netEffect)
            : s.openingBalance;
        } else if (dateFilteredTxs.length > 0) {
          periodOpeningBalance = dateFilteredTxs[0].balanceAfter - dateFilteredTxs[0].netEffect;
        } else {
          const priorTxs = dateStart
            ? activeTxs.filter((tx: any) => {
                const d = (tx.date || tx.datetime || '').slice(0, 10);
                return d && d < dateStart;
              })
            : [];
          if (priorTxs.length > 0) {
            periodOpeningBalance = priorTxs[priorTxs.length - 1].balanceAfter;
          } else {
            periodOpeningBalance = (isClipped && activeTxs.length > 0)
              ? (activeTxs[0].balanceAfter - activeTxs[0].netEffect)
              : s.openingBalance;
          }
        }

        // 3. Search & Type Filter
        const filteredTransactions = dateFilteredTxs.filter((tx: any) => {
          if (tx.type === 'invoice' && !filterSales) return false;
          if (tx.type === 'payment' && !filterCustPmts) return false;
          if (tx.type === 'bill' && !filterBills) return false;
          if (tx.type === 'vendor_payment' && !filterVendorPmts) return false;
          
          if (ledgerSearch.trim()) {
            const term = ledgerSearch.toLowerCase();
            const searchable = [
              tx.referenceNumber,
              tx.description,
              tx.type,
              tx.firmName,
              ...(tx.appliedBills || []).map((b: any) => b.billNumber)
            ].filter(Boolean).join(' ').toLowerCase();
            if (!searchable.includes(term)) return false;
          }
          return true;
        });

        const visibleTransactions = filteredTransactions;
        const dynamicOpeningBalance = visibleTransactions.length > 0
          ? (visibleTransactions[0].balanceAfter - visibleTransactions[0].netEffect)
          : periodOpeningBalance;

        const openingPresentation = getOpeningBalancePresentation(dynamicOpeningBalance);

        // Totals for visible/filtered period
        const totalDebitAmount = visibleTransactions
          .filter((t: any) => t.type === 'invoice' || t.type === 'vendor_payment' || (t.type === 'journal' && t.netEffect > 0))
          .reduce((sum: number, t: any) => sum + Math.abs(t.netEffect), 0);
        const totalCreditAmount = visibleTransactions
          .filter((t: any) => t.type === 'payment' || t.type === 'bill' || (t.type === 'journal' && t.netEffect <= 0))
          .reduce((sum: number, t: any) => sum + Math.abs(t.netEffect), 0);
        const dynamicClosingBalance = dynamicOpeningBalance + visibleTransactions.reduce((sum: number, t: any) => sum + t.netEffect, 0);

        // Payment breakdown (clean mode labels)
        const paymentBreakdown = visibleTransactions
          .filter((t: any) => t.type === 'payment')
          .reduce((acc: Record<string, number>, p: any) => {
            const cleaned = cleanDescription(p.description, 'payment');
            const mode = cleaned || 'Other';
            acc[mode] = (acc[mode] || 0) + Math.abs(p.netEffect);
            return acc;
          }, {});

        const activeUnpaidInvoices = s.unpaidInvoices ? (
          isClipped ? s.unpaidInvoices.filter((inv: any) => {
            const clippedTx = s.transactions[clipIdx];
            if (!clippedTx) return true;
            const clipDate = clippedTx.date || clippedTx.datetime || 0;
            const invDate = inv.invoiceDate || 0;
            return new Date(invDate).getTime() >= new Date(clipDate).getTime();
          }) : s.unpaidInvoices
        ) : [];

        // Dynamic Statement object for PDF print/download to ensure accurate sync
        const dynamicStatementToPrint = {
          ...s,
          openingBalance: dynamicOpeningBalance,
          closingBalance: dynamicClosingBalance,
          transactions: visibleTransactions,
          transactionCount: filteredTransactions.length,
          unpaidInvoices: activeUnpaidInvoices
        };

        // ── Monthly Grouping presentation derivation ────────────────────────
        // Transactions are grouped by calendar month in chronological order.
        // The latest/current month is at the bottom.
        const monthGroupsMap = new Map<string, {
          key: string;
          label: string;
          debitTotal: number;
          creditTotal: number;
          monthEndBalance: number;
          transactions: any[];
        }>();

        const monthNames = [
          'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
          'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
        ];

        visibleTransactions.forEach((tx: any) => {
          const dateIso = (tx.date || tx.datetime || '').slice(0, 10);
          let key = 'UNKNOWN';
          let label = 'OTHER';
          if (dateIso && dateIso.length >= 7) {
            const yearStr = dateIso.slice(0, 4);
            const monthStr = dateIso.slice(5, 7);
            const monthNum = parseInt(monthStr, 10);
            if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
              key = `${yearStr}-${monthStr}`;
              label = `${monthNames[monthNum - 1]} ${yearStr}`;
            }
          }

          if (!monthGroupsMap.has(key)) {
            monthGroupsMap.set(key, {
              key,
              label,
              debitTotal: 0,
              creditTotal: 0,
              monthEndBalance: tx.balanceAfter,
              transactions: []
            });
          }

          const group = monthGroupsMap.get(key)!;
          group.transactions.push(tx);
          // Update month-end balance to the latest transaction in this month
          group.monthEndBalance = tx.balanceAfter;

          // Debit transactions
          if (tx.type === 'invoice' || tx.type === 'vendor_payment' || (tx.type === 'journal' && tx.netEffect > 0)) {
            group.debitTotal += Number(tx.amount || 0);
          }
          // Credit transactions
          if (tx.type === 'payment' || tx.type === 'bill' || (tx.type === 'journal' && tx.netEffect <= 0)) {
            group.creditTotal += Number(tx.amount || 0);
          }
        });

        const monthGroups = Array.from(monthGroupsMap.values());
        const latestMonthKey = monthGroups.length > 0 ? monthGroups[monthGroups.length - 1].key : null;
        const effectiveExpandedMonths = userExpandedMonths !== null
          ? userExpandedMonths
          : (latestMonthKey ? new Set([latestMonthKey]) : new Set<string>());

        const toggleMonthExpand = (monthKey: string) => {
          const next = new Set(effectiveExpandedMonths);
          if (next.has(monthKey)) {
            next.delete(monthKey);
          } else {
            next.add(monthKey);
          }
          setUserExpandedMonths(next);
        };

        return (
          <div className="flex flex-col w-full gap-4">
            {statementMode === 'group' && selectedCustomers.length === 1 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <AlertCircle className="shrink-0 text-amber-600" size={18} />
                  <span className="font-medium text-sm">Only one firm remaining.</span>
                </div>
                <button 
                  onClick={() => {
                    handleModeChange('single');
                    handleFetch(selectedCustomers[0].id, true);
                  }}
                  className="px-4 py-2 bg-white text-amber-700 text-xs font-bold rounded-md border border-amber-200 shadow-sm hover:bg-amber-100 transition-colors"
                >
                  Switch to Single Mode
                </button>
              </div>
            )}
            {s.integrityError && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex items-start gap-3">
                <AlertCircle className="shrink-0 mt-0.5 text-red-600" size={18} />
                <div className="flex flex-col">
                  <span className="font-bold">Accounting Integrity Error</span>
                  <span className="text-sm mt-1">{s.integrityError}</span>
                </div>
              </div>
            )}
            {(!s.integrityError) && (
              <div className="flex flex-col gap-4">
            {/* Primary Content: Full Width */}
            <div className="space-y-4 pb-20">
              {/* ── Section 1: Customer card ──────────────────────────────── */}
              {statementMode === 'single' && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-2.5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-[#1A2766]" />
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                      {s.customer.associatedVendorId ? 'Hybrid Account' : 'Customer Details'}
                    </span>
                  </div>
                  {s.customer.gstNo && (
                    <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                      GST: {s.customer.gstNo}
                    </span>
                  )}
                </div>
                <div className="px-5 py-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-center text-xs">
                  {/* Col 1-2: Customer Name */}
                  <div className="sm:col-span-2 lg:col-span-2">
                    <div className="text-[10px] uppercase text-gray-400 font-bold mb-0.5 tracking-wider">Account Name</div>
                    <a 
                      href={`https://books.zoho.in/app/60027595766#/contacts/${s.customer.contactId}`}
                      target="_blank" rel="noreferrer"
                      className="text-sm font-extrabold text-blue-700 hover:text-blue-900 hover:underline leading-tight inline-flex items-center gap-1"
                    >
                      {s.customer.contactName}
                      <span className="text-xs text-blue-500">↗</span>
                    </a>
                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {s.customer.contactId}</div>
                  </div>

                  {/* Col 3: Mobile */}
                  <div className="lg:col-span-1">
                    <div className="text-[10px] uppercase text-gray-400 font-bold mb-0.5 tracking-wider">Mobile</div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-800">
                      <Phone size={12} className="text-gray-400 shrink-0" />
                      <span>{s.customer.mobile || '—'}</span>
                    </div>
                  </div>

                  {/* Col 4: Address */}
                  <div className="lg:col-span-1 min-w-0">
                    <div className="text-[10px] uppercase text-gray-400 font-bold mb-0.5 tracking-wider">Address</div>
                    <div className="text-xs font-medium text-gray-700 leading-tight">
                      {(() => {
                        const addr = s.customer.rawAddress;
                        if (!addr) return '—';
                        
                        const line1 = addr.address ? addr.address.replace(/\n/g, ', ') : '';
                        const line2 = [addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
                        
                        if (!line1 && !line2) return '—';
                        
                        const fullAddress = [line1, line2].filter(Boolean).join(' | ');
                        
                        return (
                          <div title={fullAddress} className="flex flex-col">
                            {line1 && <div className="truncate">{line1}</div>}
                            {line2 && <div className="truncate text-gray-400 text-[11px]">{line2}</div>}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Col 5: Outstanding Balance */}
                  <div className="lg:col-span-1 flex flex-col items-start lg:items-end justify-center pt-2 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                    <div className="text-[10px] uppercase text-gray-400 font-bold mb-0.5 tracking-wider">Outstanding Balance</div>
                    <div className={`text-base font-black tabular-nums flex items-center ${
                      s.closingBalance > 0 ? 'text-rose-600' : s.closingBalance < 0 ? 'text-emerald-600' : 'text-gray-500'
                    }`}>
                      <BalanceIndicator balance={s.closingBalance} />
                      {fmtBalance(s.closingBalance)}
                    </div>
                    <div className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider mt-0.5">
                      {Math.abs(s.closingBalance) < 0.01 ? 'Settled' : s.closingBalance > 0 ? 'Receivable' : 'Advance'}
                    </div>
                  </div>
                </div>
                </div>
              )}

              {/* ── Section 1b: Net Account Position summary (hybrid only) ── */}
              {s.isHybrid && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Sales Card */}
                  <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-4 py-2 border-b border-blue-100 bg-blue-50/50 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wide">Sales</span>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Receivable</span>
                    </div>
                    <div className="px-4 py-3 flex-1 flex flex-col justify-between gap-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500 font-medium">Opening Balance</span>
                        {(() => {
                          const customerNetEffectSum = s.transactions.reduce((sum: number, t: any) => sum + (t.customerNetEffect || 0), 0);
                          const salesOpening = s.customerNet - customerNetEffectSum;
                          const isCredit = salesOpening < 0;
                          return (
                            <div className="flex items-center gap-1.5">
                              <span className={`font-bold ${isCredit ? 'text-emerald-600' : 'text-gray-800'}`}>{fmt(Math.abs(salesOpening))}</span>
                              {isCredit && <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded-sm uppercase font-bold tracking-wider leading-none">Cr</span>}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500 font-medium">Total Invoiced</span>
                        <span className="font-bold text-gray-800">{fmt(s.transactions.filter((t:any) => (t.customerNetEffect || 0) > 0).reduce((sum:number, t:any) => sum + Math.abs(t.customerNetEffect), 0))}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500 font-medium">Total Received</span>
                        <span className="font-bold text-emerald-600">{fmt(s.transactions.filter((t:any) => (t.customerNetEffect || 0) < 0).reduce((sum:number, t:any) => sum + Math.abs(t.customerNetEffect), 0))}</span>
                      </div>
                      <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                        <span className="text-[10px] uppercase font-bold text-gray-400">Outstanding</span>
                        {(() => {
                          const isCredit = s.customerNet < 0;
                          return (
                            <div className="flex items-center gap-1.5">
                              <span className={`font-extrabold text-sm ${isCredit ? 'text-emerald-600' : 'text-gray-800'}`}>{fmt(Math.abs(s.customerNet))}</span>
                              {isCredit && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded-sm uppercase font-bold tracking-wider leading-none">Cr</span>}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Purchase Card */}
                  <div className="bg-white rounded-xl border border-orange-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-4 py-2 border-b border-orange-100 bg-orange-50/50 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-orange-800 uppercase tracking-wide">Purchase</span>
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">Payable</span>
                    </div>
                    <div className="px-4 py-3 flex-1 flex flex-col justify-between gap-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500 font-medium">Opening Balance</span>
                        {(() => {
                          const vendorNetEffectSum = s.transactions.reduce((sum: number, t: any) => sum + (t.vendorNetEffect || 0), 0);
                          const purchaseOpening = s.vendorNet - vendorNetEffectSum;
                          const isCredit = purchaseOpening < 0;
                          return (
                            <div className="flex items-center gap-1.5">
                              <span className={`font-bold ${isCredit ? 'text-rose-600' : 'text-gray-800'}`}>{fmt(Math.abs(purchaseOpening))}</span>
                              {isCredit && <span className="text-[8px] bg-rose-100 text-rose-700 px-1 py-0.5 rounded-sm uppercase font-bold tracking-wider leading-none">Cr</span>}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500 font-medium">Total Billed</span>
                        <span className="font-bold text-gray-800">{fmt(s.transactions.filter((t:any) => (t.vendorNetEffect || 0) < 0).reduce((sum:number, t:any) => sum + Math.abs(t.vendorNetEffect), 0))}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500 font-medium">Total Paid</span>
                        <span className="font-bold text-blue-600">{fmt(s.transactions.filter((t:any) => (t.vendorNetEffect || 0) > 0).reduce((sum:number, t:any) => sum + Math.abs(t.vendorNetEffect), 0))}</span>
                      </div>
                      <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                        <span className="text-[10px] uppercase font-bold text-gray-400">Outstanding</span>
                        {(() => {
                          const isCredit = s.vendorNet < 0;
                          return (
                            <div className="flex items-center gap-1.5">
                              <span className={`font-extrabold text-sm ${isCredit ? 'text-rose-600' : 'text-gray-800'}`}>{fmt(Math.abs(s.vendorNet))}</span>
                              {isCredit && <span className="text-[9px] bg-rose-100 text-rose-700 px-1 py-0.5 rounded-sm uppercase font-bold tracking-wider leading-none">Cr</span>}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Net Position Card */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wide">Net Position</span>
                      {(() => {
                        const net = s.closingBalance;
                        const isZero = net === 0 || Math.abs(net) < 0.01;
                        if (isZero) return <span className="text-[10px] font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">Settled</span>;
                        return net > 0 
                          ? <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Receivable</span>
                          : <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">Payable</span>;
                      })()}
                    </div>
                    <div className="px-4 py-3 flex-1 flex flex-col justify-center items-center text-center">
                      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Final Balance</div>
                      <div className={`text-xl font-black tabular-nums flex items-center justify-center ${
                        s.closingBalance === 0 || Math.abs(s.closingBalance) < 0.01 ? 'text-gray-800' :
                        s.closingBalance > 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        <BalanceIndicator balance={s.closingBalance} />
                        {s.closingBalance === 0 || Math.abs(s.closingBalance) < 0.01 ? '₹0' : fmt(Math.abs(s.closingBalance))}
                      </div>
                      <div className="text-[9px] text-gray-400 mt-2 font-medium bg-gray-50 px-2 py-1 rounded">
                        Receivables − Payables
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Unified Firm KPI Section (Group Mode) ── */}
              {statementMode === 'group' && groupStatement?.success && groupStatement.statements.length > 0 && (
                <div className="w-full flex flex-col gap-4 mb-2 order-3 xl:order-none">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                    <div className="flex items-center gap-2">
                      <Activity size={16} className="text-[#1A2766]" />
                      <h3 className="text-sm font-bold text-gray-800 tracking-wide uppercase">Portfolio Health</h3>
                    </div>
                    {/* Toggle */}
                    <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 self-start sm:self-auto shrink-0">
                      <button
                        onClick={() => setKpiMode('compact')}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                          kpiMode === 'compact' ? 'bg-white text-[#1A2766] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Compact
                      </button>
                      <button
                        onClick={() => setKpiMode('financial')}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                          kpiMode === 'financial' ? 'bg-white text-[#1A2766] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Financial
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {groupStatement.statements.map(stmt => {
                      const firmId = stmt.customer.contactId;
                      const firmName = stmt.customer.companyName || stmt.customer.contactName;
                      const isVisible = visibleFirmIds.includes(firmId);
                      const fc = firmColors[firmId] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', bar: 'bg-gray-400' };
                      
                      const outstanding = stmt.closingBalance;
                      const totalOut = groupStatement.statements.reduce((acc, x) => acc + x.closingBalance, 0);
                      const percent = totalOut === 0 ? 0 : Math.round((outstanding / totalOut) * 100);
                      
                      const unpaidInvoices = stmt.unpaidInvoices || [];
                      const unpaidCount = unpaidInvoices.length;
                      let oldestDue = 0;
                      if (unpaidCount > 0) {
                        const oldestDate = new Date(unpaidInvoices[unpaidInvoices.length - 1].invoiceDate);
                        oldestDue = Math.floor((Date.now() - oldestDate.getTime()) / (1000 * 3600 * 24));
                      }

                      // Decouple from combined visibleTransactions to act as independent financial snapshots
                      const firmVisibleTxs = stmt.transactions;
                      const firmInvoiced = firmVisibleTxs.filter((tx: any) => tx.type === 'invoice').reduce((sum: number, tx: any) => sum + Math.abs(tx.netEffect), 0);
                      const firmPaid = firmVisibleTxs.filter((tx: any) => tx.type === 'payment').reduce((sum: number, tx: any) => sum + Math.abs(tx.netEffect), 0);
                      
                      const firmDynamicOpening = firmVisibleTxs.length > 0
                        ? (firmVisibleTxs[0].balanceAfter - firmVisibleTxs[0].netEffect)
                        : stmt.closingBalance;
                      const pres = getOpeningBalancePresentation(firmDynamicOpening);

                      return (
                        <div key={firmId} className={`relative flex flex-col bg-white rounded-xl border transition-all duration-200 overflow-hidden ${isVisible ? 'border-gray-200 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md' : 'border-gray-100 bg-gray-50/50 grayscale opacity-60'}`}>
                          {kpiMode === 'compact' && (
                            <>
                              <div className={`absolute top-0 left-0 h-1 transition-all duration-500 ease-out ${fc.bar}`} style={{ width: `${percent}%` }} />
                              <div className="absolute top-0 left-0 w-full h-1 bg-gray-100 -z-10" />
                            </>
                          )}
                          {kpiMode === 'financial' && (
                            <div className={`absolute top-0 left-0 w-full h-1 transition-all duration-500 ease-out ${fc.bar}`} />
                          )}

                          <div className={`px-4 pt-3 flex justify-between items-start ${kpiMode === 'financial' ? 'pb-2 border-b border-gray-100 bg-gray-50/30' : ''}`}>
                            <div className="flex items-start gap-2.5">
                              <div className="pt-0.5">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                                  style={{ accentColor: `rgb(${fc.hex.join(',')})` }}
                                  checked={isVisible}
                                  onChange={(e) => {
                                    setClipFromIndex(null);
                                    if (e.target.checked) {
                                      setVisibleFirmIds(prev => [...prev, firmId]);
                                    } else {
                                      if (visibleFirmIds.length > 1) {
                                        setVisibleFirmIds(prev => prev.filter(id => id !== firmId));
                                      } else {
                                        toast.error('At least one firm must remain visible.');
                                      }
                                    }
                                  }}
                                />
                              </div>
                              <div className="flex flex-col">
                                <span className={`text-xs font-bold uppercase leading-tight line-clamp-2 pr-2 ${kpiMode === 'financial' ? fc.text : 'text-gray-900'}`}>{firmName}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {kpiMode === 'compact' && (
                                <div className="flex flex-col items-end mr-1">
                                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Share</span>
                                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-sm ${fc.text} ${fc.bg}`}>{percent}%</span>
                                </div>
                              )}
                              <button 
                                onClick={() => {
                                  const newSel = selectedCustomers.filter(c => c.id !== firmId);
                                  setSelectedCustomers(newSel);
                                  handleFetchGroup(true, newSel);
                                }}
                                className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1 rounded-md transition-colors"
                                title="Remove Firm"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>

                          {kpiMode === 'compact' ? (
                            <div className="p-4 pt-3 flex flex-col h-full">
                              <div className="mt-auto">
                                <div className="flex flex-col mb-3">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Outstanding</span>
                                  <span className={`text-lg font-extrabold tabular-nums leading-none ${outstanding > 0 ? 'text-rose-600' : outstanding < 0 ? 'text-emerald-600' : 'text-gray-900'}`}>{fmtBalance(outstanding)}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Open Invoices</span>
                                    <span className="text-[11px] font-bold text-gray-700">{unpaidCount}</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Oldest Due</span>
                                    <span className="text-[11px] font-bold text-gray-700">{oldestDue > 0 ? <span className="text-rose-600">{oldestDue} Days</span> : '—'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 flex flex-col gap-3 text-sm flex-1">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">Opening Balance</span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`font-extrabold tabular-nums ${pres.isCredit ? 'text-emerald-600' : 'text-gray-900'}`}>{pres.amount}</span>
                                  {pres.isCredit && <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase font-bold tracking-wider leading-none">Cr</span>}
                                </div>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">Total Invoiced</span>
                                <span className="font-extrabold text-gray-900 tabular-nums">{fmt(firmInvoiced)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">Total Paid</span>
                                <span className="font-extrabold text-emerald-600 tabular-nums">− {fmt(firmPaid)}</span>
                              </div>
                              <div className="flex justify-between items-center pt-3 border-t border-gray-100 mt-auto">
                                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">Closing Balance</span>
                                <span className={`font-extrabold tabular-nums flex items-center justify-end ${stmt.closingBalance > 0 ? 'text-rose-600' : stmt.closingBalance < 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                                  <BalanceIndicator balance={stmt.closingBalance} />
                                  {fmtBalance(stmt.closingBalance)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Section 2: Statement table ────────────────────────────── */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {isClipped && clipIdx !== -1 && (
                  <div className="bg-blue-50 border-b border-blue-100 px-5 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>📌</span>
                      <span className="text-xs font-semibold text-blue-800">
                        Clipped From: <span className="font-bold">{fmtDate(s.transactions[clipIdx].date)}</span> — {cleanDescription(s.transactions[clipIdx].description, s.transactions[clipIdx].type)}
                      </span>
                    </div>
                    <button 
                      onClick={() => setClipFromIndex(null)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-white border border-blue-200 px-3 py-1 rounded-md shadow-sm transition-colors"
                    >
                      Clear Clip
                    </button>
                  </div>
                )}
                {/* Table header bar */}
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                      <TrendingUp size={14} className="text-[#1A2766]" />
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                        Statement Ledger
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">
                        ({filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''})
                      </span>
                    </div>

                    {/* Quick Date Filter Chips */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {DATE_FILTER_CHIPS.map((chip) => {
                        const isActive = dateFilter === chip.id;
                        return (
                          <button
                            key={chip.id}
                            type="button"
                            onClick={() => {
                              setDateFilter(chip.id);
                              setUserExpandedMonths(null);
                            }}
                            className={`px-2.5 py-1 text-xs rounded-full border transition-all select-none font-semibold ${
                              isActive
                                ? 'bg-[#1A2766] text-white border-[#1A2766] shadow-sm'
                                : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-gray-200'
                            }`}
                          >
                            {chip.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {s.isHybrid && (
                      <div className="flex bg-white border border-gray-200 rounded-md shadow-sm p-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-600">
                        <label className={`cursor-pointer px-2 py-1 rounded transition-colors ${filterSales ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-400'}`}>
                          <input type="checkbox" className="hidden" checked={filterSales} onChange={e => setFilterSales(e.target.checked)} />
                          Sales Invoices
                        </label>
                        <label className={`cursor-pointer px-2 py-1 rounded transition-colors ${filterCustPmts ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-gray-50 text-gray-400'}`}>
                          <input type="checkbox" className="hidden" checked={filterCustPmts} onChange={e => setFilterCustPmts(e.target.checked)} />
                          Cust Payments
                        </label>
                        <label className={`cursor-pointer px-2 py-1 rounded transition-colors ${filterBills ? 'bg-orange-50 text-orange-700' : 'hover:bg-gray-50 text-gray-400'}`}>
                          <input type="checkbox" className="hidden" checked={filterBills} onChange={e => setFilterBills(e.target.checked)} />
                          Purchase Bills
                        </label>
                        <label className={`cursor-pointer px-2 py-1 rounded transition-colors ${filterVendorPmts ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-400'}`}>
                          <input type="checkbox" className="hidden" checked={filterVendorPmts} onChange={e => setFilterVendorPmts(e.target.checked)} />
                          Vendor Payments
                        </label>
                      </div>
                    )}
                    <div className="relative w-full sm:w-auto">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type="text" 
                        placeholder="Filter transactions..."
                        value={ledgerSearch}
                        onChange={(e) => setLedgerSearch(e.target.value)}
                        className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-[#1A2766] focus:ring-1 focus:ring-[#1A2766] w-full sm:w-[180px]"
                      />
                    </div>
                  </div>
                </div>

                <div className="hidden md:block overflow-x-auto max-h-[75vh] overflow-y-auto">
                  <table className="w-full text-sm relative" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase text-gray-500 font-bold border-b border-gray-200 z-10 shadow-sm">
                      <tr>
                        <th className="px-3 py-3 text-left w-28 whitespace-nowrap tracking-wider">Date</th>
                        <th className="w-[36px] text-center px-1 py-3" title="Clip column"></th>
                        {statementMode === 'group' && <th className="px-3 py-3 text-left whitespace-nowrap tracking-wider">Firm</th>}
                        <th className="px-3 py-3 text-left whitespace-nowrap tracking-wider">Type</th>
                        <th className="px-4 py-3 text-left tracking-wider w-full min-w-[200px]">Document & Details</th>
                        <th className="px-3 py-3 text-right whitespace-nowrap tracking-wider w-28">Debit</th>
                        <th className="px-3 py-3 text-right whitespace-nowrap tracking-wider w-28">Credit</th>
                        <th className="px-4 py-3 text-right tracking-wider w-36 whitespace-nowrap">
                          Running Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {/* Opening balance row */}
                      <tr className="bg-blue-50/20">
                        <td className="px-4 py-1.5 text-[11px] text-gray-400 whitespace-nowrap">—</td>
                        <td className="w-[45px] px-1 py-1.5 text-center text-gray-300/50">—</td>
                        {statementMode === 'group' && <td className="px-4 py-1.5 text-[11px] text-gray-400">—</td>}
                        <td className="px-4 py-1.5 text-[11px] text-gray-400 whitespace-nowrap">—</td>
                        <td className="px-4 py-1.5 text-[11px]">
                          {openingPresentation.isCredit ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="font-bold text-gray-800">Opening Balance</span>
                              <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded tracking-wide border border-emerald-200/50">
                                ADVANCE
                              </span>
                            </span>
                          ) : (
                            <span className="font-bold text-gray-800">
                              Opening Balance
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-1.5 text-right text-[11px] text-gray-400">—</td>
                        <td className="px-4 py-1.5 text-right text-[11px] text-gray-400">—</td>
                        <td className="px-4 py-1.5 text-right text-[11.5px] font-extrabold tabular-nums">
                          <BalanceIndicator balance={dynamicOpeningBalance} />
                          {openingPresentation.isCredit ? (
                            <span className="text-emerald-600">{openingPresentation.amount}</span>
                          ) : (
                            <span className="text-gray-900">{openingPresentation.amount}</span>
                          )}
                        </td>
                      </tr>

                      {/* Monthly Groups with Summary Rows */}
                      {monthGroups.map((mg) => {
                        const isMonthExpanded = effectiveExpandedMonths.has(mg.key);
                        const isGroupMode = statementMode === 'group';
                        const totalCols = isGroupMode ? 8 : 7;

                        return (
                          <React.Fragment key={`group-${mg.key}`}>
                            {/* Monthly Summary Row */}
                            <tr
                              onClick={() => toggleMonthExpand(mg.key)}
                              className="bg-slate-100/80 hover:bg-slate-200/70 border-y border-slate-200 cursor-pointer select-none transition-colors"
                              title={isMonthExpanded ? 'Click to collapse month' : 'Click to expand month'}
                            >
                              {/* Date / Month Label with Chevron */}
                              <td colSpan={isGroupMode ? 4 : 3} className="px-3 py-2.5 align-middle">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold text-slate-500 w-3 text-center transition-transform">
                                    {isMonthExpanded ? '▼' : '▶'}
                                  </span>
                                  <span className="text-xs font-black tracking-wider text-slate-800 uppercase">
                                    {mg.label}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-medium ml-1">
                                    ({mg.transactions.length} txn{mg.transactions.length !== 1 ? 's' : ''})
                                  </span>
                                </div>
                              </td>

                              {/* Document & Details column in summary row */}
                              <td className="px-4 py-2.5 text-xs text-slate-400 italic">
                                Month Summary
                              </td>

                              {/* Month Total Debit */}
                              <td className="px-3 py-2.5 text-right text-[11.5px] font-extrabold whitespace-nowrap align-middle tabular-nums text-slate-900">
                                {mg.debitTotal > 0 ? fmt(mg.debitTotal) : '—'}
                              </td>

                              {/* Month Total Credit */}
                              <td className="px-3 py-2.5 text-right text-[11.5px] font-extrabold whitespace-nowrap align-middle tabular-nums text-emerald-700">
                                {mg.creditTotal > 0 ? fmt(mg.creditTotal) : '—'}
                              </td>

                              {/* Net Monthly Movement (Credit - Debit) */}
                              <td className="px-4 py-2.5 text-right whitespace-nowrap align-middle">
                                {(() => {
                                  const net = mg.creditTotal - mg.debitTotal;
                                  const isZero = Math.abs(net) < 0.01;
                                  if (isZero) {
                                    return <span className="text-[11.5px] tabular-nums font-black text-gray-400">₹0.00</span>;
                                  }
                                  const isPositive = net > 0;
                                  const colorClass = isPositive ? 'text-emerald-600' : 'text-rose-600';
                                  return (
                                    <span className={`text-[11.5px] tabular-nums font-black flex items-center justify-end ${colorClass}`}>
                                      <span className="mr-1 text-[11px] font-bold" title={isPositive ? 'Net Inflow / Surplus' : 'Net Outflow / Deficit'}>
                                        {isPositive ? '↗' : '↙'}
                                      </span>
                                      {fmtBalance(net)}
                                    </span>
                                  );
                                })()}
                              </td>
                            </tr>

                            {/* Transactions inside this month when expanded */}
                            {isMonthExpanded && mg.transactions.map((tx: any) => {
                              const txIdx = visibleTransactions.indexOf(tx);
                              const displayDesc = cleanDescription(tx.description, tx.type);
                              const isTxExpanded = expandedTx[tx.id];
                              const lineItems = txLineItems[tx.id];
                              const isLoading = loadingTx[tx.id];
                              const errorMsg = txErrors[tx.id];

                              return (
                                <React.Fragment key={tx.id}>
                                  <tr 
                                    className={`group even:bg-gray-50/40 hover:bg-blue-50/80 transition-all relative ${
                                      calcEntries.some(e => e.id === tx.id) ? 'bg-purple-50/50 even:bg-purple-50/50' : ''
                                    }`}
                                    onClick={(tx.type === 'bill' || tx.type === 'invoice') ? (e) => toggleTxExpand(tx.id, tx.type, e) : undefined}
                                    style={{ cursor: (tx.type === 'bill' || tx.type === 'invoice') ? 'pointer' : 'default' }}
                                  >
                                    <td className="px-3 py-1.5 text-[10.5px] text-gray-500 whitespace-nowrap align-middle">
                                      {fmtDateTime(tx.datetime || tx.date)}
                                    </td>
                                    <td className="w-[36px] text-center px-1 py-1.5 align-middle">
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); setClipFromIndex(s.transactions.indexOf(tx)); }}
                                        className={`text-gray-300 hover:text-blue-500 transition-colors print:hidden focus:opacity-100 ${clipIdx === s.transactions.indexOf(tx) ? 'opacity-100 text-blue-600' : 'opacity-0 group-hover:opacity-100'}`}
                                        title="Start statement from this transaction"
                                      >
                                        📌
                                      </button>
                                    </td>
                                    {isGroupMode && (
                                      <td className="px-3 py-1.5 align-middle whitespace-nowrap">
                                        {(() => {
                                          const fc = firmColors[tx.firmId] || { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' };
                                          return (
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded border border-opacity-80 text-[10px] font-bold uppercase tracking-wide shadow-sm ${fc.bg} ${fc.text} ${fc.border}`}>
                                              {tx.firmName}
                                            </span>
                                          );
                                        })()}
                                      </td>
                                    )}
                                    <td className="px-3 py-1.5 align-middle whitespace-nowrap">
                                      {(() => {
                                        if (tx.type === 'invoice') return (
                                          <div className="flex items-center gap-1.5">
                                            <span className={`text-[10px] text-gray-400 transition-transform ${isTxExpanded ? 'rotate-90' : ''}`}>▶</span>
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-[9px] font-bold text-slate-700 uppercase tracking-wide">Sales Invoice</span>
                                          </div>
                                        );
                                        if (tx.type === 'payment') return <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-[9px] font-bold text-emerald-700 uppercase tracking-wide">Customer Payment</span>;
                                        if (tx.type === 'vendor_payment') return <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-purple-200 bg-purple-50 text-[9px] font-bold text-purple-700 uppercase tracking-wide">Vendor Payment</span>;
                                        if (tx.type === 'bill') return (
                                          <div className="flex items-center gap-1.5">
                                            <span className={`text-[10px] text-gray-400 transition-transform ${isTxExpanded ? 'rotate-90' : ''}`}>▶</span>
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-orange-200 bg-orange-50 text-[9px] font-bold text-orange-700 uppercase tracking-wide">Purchase Bill</span>
                                          </div>
                                        );
                                        if (tx.type === 'journal') return <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-[9px] font-bold text-gray-600 uppercase tracking-wide">JOURNAL</span>;
                                        return <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-[9px] font-bold text-gray-500 uppercase tracking-wide">{tx.type}</span>;
                                      })()}
                                    </td>
                                    <td className="px-4 py-1.5 align-middle">
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-5 shrink-0 flex justify-center print:hidden">
                                          {!calcEntries.some(e => e.id === tx.id) ? (
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); addCalcEntry(tx); }}
                                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                                              title="Add to Calculator"
                                            >
                                              <div className="bg-purple-100 text-purple-700 w-5 h-5 flex items-center justify-center rounded hover:bg-purple-200 shadow-sm border border-purple-200">
                                                <Plus size={12} strokeWidth={3} />
                                              </div>
                                            </button>
                                          ) : (
                                            <div className="text-purple-600 flex items-center justify-center w-5 h-5 bg-purple-50 rounded border border-purple-100" title="Added to Calculator">
                                              <Check size={12} strokeWidth={4} />
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex flex-col min-w-0 flex-1">
                                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-blue-700 underline-offset-2">
                                            {tx.zohoUrl ? (
                                              <a 
                                                href={tx.zohoUrl} 
                                                target="_blank" 
                                                rel="noreferrer" 
                                                onClick={(e) => e.stopPropagation()}
                                                className="hover:text-blue-900 hover:underline flex items-center gap-1 truncate"
                                              >
                                                <span className="truncate">{tx.type === 'journal' ? (tx.entryNumber || 'Journal') : (tx.referenceNumber || displayDesc)}</span>
                                                <span className="text-[9px] shrink-0">↗</span>
                                              </a>
                                            ) : (
                                              <span className="truncate">{tx.type === 'journal' ? (tx.entryNumber || 'Journal') : (tx.referenceNumber || displayDesc)}</span>
                                            )}
                                            {draftStatuses[tx.id] && (
                                              <span className="text-[8px] font-bold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap leading-none border border-orange-200/50 shrink-0">
                                                Draft
                                              </span>
                                            )}
                                            {tx.isVerified && (
                                              <span className="inline-flex items-center justify-center bg-emerald-500 text-white rounded-full w-[14px] h-[14px] shrink-0 shadow-sm" title="Verified Payment">
                                                <Check size={9} strokeWidth={4} />
                                              </span>
                                            )}
                                          </div>
                                          {tx.type === 'journal' ? (
                                            <>
                                              {(() => {
                                                const entryNum = (tx.entryNumber || '').trim();
                                                const refNum = (tx.referenceNumber || '').trim();
                                                const cleanDesc = tx.description ? cleanDescription(tx.description, tx.type).trim() : '';
                                                const cleanNotes = tx.notes ? tx.notes.trim() : '';

                                                const showRef = refNum && (refNum !== cleanDesc) && (refNum !== entryNum);
                                                const showNotes = cleanNotes && (cleanNotes !== cleanDesc);

                                                return (
                                                  <>
                                                    {showRef && (
                                                      <span className="text-[11px] text-gray-500 mt-0.5 leading-tight truncate">Ref: {refNum}</span>
                                                    )}
                                                    {cleanDesc && (
                                                      <div title={cleanDesc} className="mt-0.5 text-[#6B7280] italic text-[11px] leading-tight truncate">
                                                        {cleanDesc}
                                                      </div>
                                                    )}
                                                    {showNotes && (
                                                      <div title={cleanNotes} className="mt-0.5 text-[#6B7280] italic text-[11px] leading-tight truncate">
                                                        {cleanNotes}
                                                      </div>
                                                    )}
                                                  </>
                                                );
                                              })()}
                                            </>
                                          ) : (
                                            <>
                                              {tx.referenceNumber && tx.referenceNumber !== displayDesc && (
                                                <span title={displayDesc} className="text-[10px] text-gray-500 mt-0.5 leading-tight truncate">{displayDesc}</span>
                                              )}
                                              {(tx.type === 'payment' || tx.type === 'vendor_payment') && tx.notes && (
                                                <div title={tx.notes} className="mt-0.5 text-[#6B7280] italic text-[11px] leading-tight truncate">
                                                  {tx.notes}
                                                </div>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    {/* DEBIT Column */}
                                    <td className="px-3 py-1.5 text-right text-[11.5px] font-semibold whitespace-nowrap align-middle tabular-nums text-slate-800">
                                      {(tx.type === 'invoice' || tx.type === 'vendor_payment' || (tx.type === 'journal' && tx.netEffect > 0)) ? fmt(tx.amount) : '—'}
                                    </td>
                                    {/* CREDIT Column */}
                                    <td className="px-3 py-1.5 text-right text-[11.5px] font-semibold whitespace-nowrap align-middle tabular-nums" style={{ color: (tx.type === 'payment' || tx.type === 'bill' || (tx.type === 'journal' && tx.netEffect <= 0)) ? ((tx.type === 'payment' || (tx.type === 'journal' && tx.netEffect <= 0)) ? '#059669' : '#c2410c') : 'transparent' }}>
                                      {(tx.type === 'payment' || tx.type === 'bill' || (tx.type === 'journal' && tx.netEffect <= 0)) ? fmt(tx.amount) : '—'}
                                    </td>
                                    {/* RUNNING BALANCE */}
                                    <td className="px-4 py-1.5 text-right whitespace-nowrap align-middle">
                                      {(() => {
                                        const b = tx.balanceAfter;
                                        const isZero = b === 0 || Math.abs(b) < 0.01;
                                        
                                        if (isZero) {
                                          return (
                                            <span className="text-[11.5px] tabular-nums font-extrabold text-gray-400">
                                              ₹0
                                            </span>
                                          );
                                        }
                                        
                                        const isPositive = b > 0;
                                        const colorClass = isPositive ? 'text-rose-600' : b < 0 ? 'text-emerald-600' : 'text-gray-400';
                                        const overallTxIdx = visibleTransactions.findIndex((t: any) => t.id === tx.id);
                                        const prevBalance = overallTxIdx > 0 ? visibleTransactions[overallTxIdx - 1].balanceAfter : dynamicOpeningBalance;
                                        return (
                                          <span className={`text-[11.5px] tabular-nums font-extrabold flex items-center justify-end ${colorClass}`}>
                                            <BalanceChangeIndicator current={b} previous={prevBalance} />
                                            {fmtBalance(b)}
                                          </span>
                                        );
                                      })()}
                                    </td>
                                  </tr>
                                  {isTxExpanded && (tx.type === 'bill' || tx.type === 'invoice') && (() => {
                                    const isBill = tx.type === 'bill';
                                    const theme = isBill ? {
                                      bg: 'bg-orange-50/20',
                                      borderLeft: 'border-orange-300',
                                      spinner: 'border-orange-400',
                                      rowBorder: 'border-orange-100/60'
                                    } : {
                                      bg: 'bg-slate-50/40',
                                      borderLeft: 'border-slate-300',
                                      spinner: 'border-slate-400',
                                      rowBorder: 'border-slate-200/60'
                                    };
                                    return (
                                      <tr className={theme.bg}>
                                        <td colSpan={totalCols} className={`px-4 py-3 border-l-[3px] ${theme.borderLeft}`}>
                                          <div className="pl-6">
                                            {isLoading ? (
                                              <div className="text-xs text-gray-500 flex items-center gap-2">
                                                <span className={`w-3 h-3 border-2 ${theme.spinner} border-t-transparent rounded-full animate-spin`}></span>
                                                Loading items...
                                              </div>
                                            ) : errorMsg ? (
                                              <div className="text-xs text-red-500 flex items-center gap-1.5">
                                                <span className="font-bold">⚠️</span> {errorMsg}
                                              </div>
                                            ) : lineItems && lineItems.length > 0 ? (
                                              <div className="flex flex-col gap-1.5 max-w-3xl">
                                                {lineItems.map((item: any, idx: number) => {
                                                  let qty = Number(item.quantity || 0);
                                                  let rate = Number(item.rate || 0);
                                                  let unit = item.unit ? ` ${item.unit}` : '';
                                                  
                                                  const caseSize = Number(item.case_size || 0);
                                                  if (caseSize > 0) {
                                                    rate = rate / caseSize;
                                                  }

                                                  return (
                                                    <div key={item.line_item_id || idx} className={`text-[11px] flex items-center justify-between text-gray-600 pb-1.5 border-b ${theme.rowBorder} last:border-0 last:pb-0`}>
                                                      <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-gray-400 font-mono">#{idx + 1}</span>
                                                        <span className="font-medium text-gray-800">{item.name}</span>
                                                      </div>
                                                      <div className="flex items-center gap-4 text-right tabular-nums">
                                                        <span className="w-32 text-gray-500 whitespace-nowrap">{qty}{unit} @ {fmt(rate)}</span>
                                                        <span className="w-20 font-semibold text-gray-900">{fmt(item.item_total)}</span>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            ) : (
                                              <div className="text-xs text-gray-500 italic">No line items found.</div>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })()}
                                </React.Fragment>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}

                      {visibleTransactions.length === 0 && (
                        <tr>
                          <td colSpan={statementMode === 'group' ? 8 : 7} className="px-3 py-6 text-center text-xs text-gray-400 font-medium">
                            No transactions in window.
                          </td>
                        </tr>
                      )}


                    </tbody>
                  </table>
                </div>

                {/* Mobile Statement Ledger Cards */}
                <div className="md:hidden flex flex-col divide-y divide-gray-100 max-h-[600px] overflow-y-auto bg-gray-50/30">
                  {/* Opening Balance Card */}
                  <div className="p-4 bg-blue-50/30 flex justify-between items-center shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-gray-800 text-sm">Opening Balance</span>
                      {openingPresentation.isCredit && (
                        <span className="w-fit text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full tracking-wide uppercase">
                          Advance / Credit
                        </span>
                      )}
                    </div>
                    <div className={`text-sm font-bold tabular-nums ${openingPresentation.isCredit ? 'text-emerald-600' : 'text-gray-900'}`}>
                      {openingPresentation.amount}
                    </div>
                  </div>

                  {/* Transaction Cards grouped by Month */}
                  {visibleTransactions.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400 font-medium bg-white">
                      No transactions in window.
                    </div>
                  ) : (
                    monthGroups.map((mg) => {
                      const isMonthExpanded = effectiveExpandedMonths.has(mg.key);
                      return (
                        <div key={mg.key} className="flex flex-col">
                          {/* Monthly Summary Header Bar */}
                          <button
                            type="button"
                            onClick={() => toggleMonthExpand(mg.key)}
                            className="w-full text-left px-4 py-2.5 bg-slate-100 hover:bg-slate-200/80 transition-colors border-y border-slate-200 flex flex-col gap-1 focus:outline-none"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] text-slate-500 font-bold transition-transform inline-block ${isMonthExpanded ? 'rotate-90' : ''}`}>
                                  ▶
                                </span>
                                <span className="text-xs font-black text-slate-800 tracking-wide">
                                  {mg.label}
                                </span>
                                <span className="text-[10px] text-slate-500 font-normal">
                                  ({mg.transactions.length} txn{mg.transactions.length === 1 ? '' : 's'})
                                </span>
                              </div>
                              {/* Net Monthly Movement */}
                              <div className="text-right">
                                {(() => {
                                  const net = mg.creditTotal - mg.debitTotal;
                                  const isZero = Math.abs(net) < 0.01;
                                  if (isZero) return <span className="text-xs font-bold text-gray-400">₹0.00</span>;
                                  const isPositive = net > 0;
                                  const colorClass = isPositive ? 'text-emerald-600' : 'text-rose-600';
                                  return (
                                    <span className={`text-xs font-black tabular-nums flex items-center justify-end ${colorClass}`}>
                                      <span className="mr-0.5 text-[10px] font-bold">{isPositive ? '↗' : '↙'}</span>
                                      {fmtBalance(net)}
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] tabular-nums">
                              <div>
                                <span className="text-slate-400 text-[10px] mr-1">Dr:</span>
                                <span className="font-semibold text-slate-800">{mg.debitTotal > 0 ? fmt(mg.debitTotal) : '—'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 text-[10px] mr-1">Cr:</span>
                                <span className="font-semibold text-emerald-700">{mg.creditTotal > 0 ? fmt(mg.creditTotal) : '—'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 text-[10px] mr-1">Net:</span>
                                <span className={`font-bold ${Math.abs(mg.creditTotal - mg.debitTotal) < 0.01 ? 'text-gray-400' : (mg.creditTotal > mg.debitTotal ? 'text-emerald-600' : 'text-rose-600')}`}>
                                  {fmtBalance(mg.creditTotal - mg.debitTotal)}
                                </span>
                              </div>
                            </div>
                          </button>

                          {/* Expanded Month Transactions */}
                          {isMonthExpanded && (
                            <div className="flex flex-col divide-y divide-gray-100">
                              {mg.transactions.map((tx: any) => {
                                const displayDesc = cleanDescription(tx.description, tx.type);
                                const isInvoice = tx.type === 'invoice';
                                const isPayment = tx.type === 'payment';
                                const overallTxIdx = visibleTransactions.findIndex((t: any) => t.id === tx.id);
                                const prevBalance = overallTxIdx > 0 ? visibleTransactions[overallTxIdx - 1].balanceAfter : dynamicOpeningBalance;
                                
                                return (
                                  <div 
                                    key={tx.id} 
                                    className={`p-4 bg-white hover:bg-blue-50/80 transition-all flex flex-col gap-3 relative ${calcEntries.some(e => e.id === tx.id) ? 'bg-purple-50/50' : ''}`}
                                  >
                                    {/* Header: Date & Type */}
                                    <div className="flex justify-between items-center">
                                      <span className="text-[11px] text-gray-500 font-medium">{fmtDateTime(tx.datetime || tx.date)}</span>
                                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                        {isInvoice ? 'Invoice' : isPayment ? 'Payment' : tx.type === 'vendor_payment' ? 'Vendor Pmt' : tx.type === 'journal' ? 'JOURNAL' : 'Purchase Bill'}
                                      </span>
                                    </div>

                                    {/* Details */}
                                    <div className="flex flex-col gap-1">
                                      <div className="text-sm font-bold text-blue-700 underline-offset-2 flex flex-wrap items-center gap-1.5">
                                        {tx.zohoUrl ? (
                                          <a href={tx.zohoUrl} target="_blank" rel="noopener noreferrer" className="hover:text-blue-900 hover:underline">
                                            {tx.type === 'journal' ? (tx.entryNumber || 'Journal') : displayDesc}
                                          </a>
                                        ) : (
                                          <span>{tx.type === 'journal' ? (tx.entryNumber || 'Journal') : displayDesc}</span>
                                        )}
                                        {draftStatuses[tx.id] && (
                                          <span className="text-[8px] font-bold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap leading-none border border-orange-200/50">
                                            Draft
                                          </span>
                                        )}
                                        {tx.isVerified && (
                                          <span className="inline-flex items-center justify-center bg-emerald-500 text-white rounded-full w-[14px] h-[14px] shrink-0 shadow-sm" title="Verified Payment">
                                            <Check size={9} strokeWidth={4} />
                                          </span>
                                        )}
                                      </div>
                                      {tx.type === 'journal' ? (
                                        <>
                                          {(() => {
                                            const entryNum = (tx.entryNumber || '').trim();
                                            const refNum = (tx.referenceNumber || '').trim();
                                            const cleanDesc = tx.description ? cleanDescription(tx.description, tx.type).trim() : '';
                                            const cleanNotes = tx.notes ? tx.notes.trim() : '';

                                            const showRef = refNum && (refNum !== cleanDesc) && (refNum !== entryNum);
                                            const showNotes = cleanNotes && (cleanNotes !== cleanDesc);

                                            return (
                                              <>
                                                {showRef && (
                                                  <span className="text-[11px] text-gray-500 mt-0.5 leading-tight">Ref: {refNum}</span>
                                                )}
                                                {cleanDesc && (
                                                  <div className="text-[#6B7280] italic text-[11px] leading-tight break-words whitespace-normal mt-0.5">
                                                    {cleanDesc}
                                                  </div>
                                                )}
                                                {showNotes && (
                                                  <div className="text-[#6B7280] italic text-[11px] leading-tight break-words whitespace-normal mt-0.5">
                                                    {cleanNotes}
                                                  </div>
                                                )}
                                              </>
                                            );
                                          })()}
                                        </>
                                      ) : (
                                        <>
                                          {tx.referenceNumber && tx.referenceNumber !== displayDesc && (
                                            <span className="text-[10px] text-gray-500">{displayDesc}</span>
                                          )}
                                          {(isPayment || tx.type === 'vendor_payment') && tx.notes && (
                                            <div className="text-[#6B7280] italic text-[11px] leading-tight break-words whitespace-normal mt-0.5">
                                              {tx.notes}
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>

                                    {/* Amounts */}
                                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-50">
                                      <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] text-gray-400 font-medium">Inv Amt</span>
                                        <span className="text-xs font-bold text-gray-700">{tx.netEffect > 0 ? fmt(tx.amount) : '—'}</span>
                                      </div>
                                      <div className="flex flex-col gap-0.5 text-right">
                                        <span className="text-[10px] text-gray-400 font-medium">Pay Amt</span>
                                        <span className="text-xs font-bold text-emerald-600">{tx.netEffect <= 0 ? fmt(tx.amount) : '—'}</span>
                                      </div>
                                    </div>

                                    {/* Balance */}
                                    <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Balance</span>
                                      {(() => {
                                        const b = tx.balanceAfter;
                                        const isPositive = b > 0;
                                        const colorClass = isPositive ? 'text-rose-600' : b < 0 ? 'text-emerald-600' : 'text-gray-400';
                                        return (
                                          <span className={`text-xs font-bold tabular-nums flex items-center ${colorClass}`}>
                                            <BalanceChangeIndicator current={b} previous={prevBalance} />
                                            {fmtBalance(b)}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                </div>
              </div>{/* end ledger card */}
            </div>{/* end space-y-4 pb-20 */}
          </div>
        )}
      </div>
    );
  })()}
        </main>

        {/* ── Persistent Balance Calculator Side Panel ── */}
        {isCalcOpen && (
          <aside className="w-full lg:w-[380px] shrink-0 print:hidden sticky top-4 self-start">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-purple-50/60">
                <div className="flex items-center gap-2">
                  <Calculator size={16} className="text-purple-700" />
                  <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Balance Calculator</h2>
                  {calcEntries.length > 0 && (
                    <span className="bg-purple-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                      {calcEntries.length}
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => setIsCalcOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                  title="Close Calculator"
                >
                  <X size={16} />
                </button>
              </div>
              
              {/* Manual Entry Form */}
              <div className="p-3 bg-white border-b border-gray-100 relative">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      placeholder="Amount" 
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleManualAdd(true);
                        else if (e.key === '+') { e.preventDefault(); handleManualAdd(true); }
                        else if (e.key === '-') { e.preventDefault(); handleManualAdd(false); }
                      }}
                      className="flex-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Description (optional)" 
                    value={manualDesc}
                    onChange={(e) => setManualDesc(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualAdd(true)}
                    className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleManualAdd(true)} className="flex-1 bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-bold py-1.5 rounded-md transition-colors flex items-center justify-center gap-1">
                      <Plus size={12} /> Add
                    </button>
                    <button onClick={() => handleManualAdd(false)} className="flex-1 bg-orange-100 hover:bg-orange-200 text-orange-800 text-xs font-bold py-1.5 rounded-md transition-colors flex items-center justify-center gap-1">
                      <Minus size={12} /> Deduct
                    </button>
                  </div>
                </div>
              </div>

              {/* Entry List */}
              <div className="overflow-y-auto p-3 bg-gray-50/40 max-h-[300px]">
                {calcEntries.length === 0 ? (
                  <div className="py-8 flex flex-col items-center justify-center text-center px-4">
                    <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center mb-2">
                      <Calculator size={18} className="text-purple-300" />
                    </div>
                    <p className="text-xs font-semibold text-gray-700">Calculator is empty</p>
                    <p className="text-[11px] text-gray-500 mt-1">Click the <Plus size={10} className="inline text-purple-500"/> button on any ledger row to add it here.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {calcEntries.map((e, idx) => {
                      let colorClass = 'bg-gray-50 text-gray-600';
                      let iconClass = 'text-gray-400';
                      if (e.type === 'invoice') { colorClass = 'bg-blue-50/50 text-blue-700'; iconClass = 'text-blue-500'; }
                      else if (e.type === 'payment') { colorClass = 'bg-emerald-50/50 text-emerald-700'; iconClass = 'text-emerald-500'; }
                      else if (e.type === 'manual-add') { colorClass = 'bg-purple-50 text-purple-700'; iconClass = 'text-purple-500'; }
                      else if (e.type === 'manual-deduct') { colorClass = 'bg-orange-50 text-orange-700'; iconClass = 'text-orange-500'; }
                      
                      return (
                        <div key={idx} className={`flex items-center justify-between px-2.5 py-1.5 rounded-md group transition-colors ${colorClass}`}>
                          <div className="flex items-center gap-2 overflow-hidden w-full">
                            <div className={`shrink-0 font-bold text-xs ${iconClass}`}>
                              {e.netEffect > 0 ? '+' : '-'}
                            </div>
                            <div className="truncate flex-1 min-w-0">
                              <div className="text-[11px] font-bold truncate">{e.description}</div>
                              <div className="text-[9px] uppercase tracking-wider opacity-60">{e.type.replace('-', ' ')}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <div className="text-xs font-bold tabular-nums">
                              {fmt(e.amount)}
                            </div>
                            <button 
                              onClick={() => removeCalcEntry(e.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-red-400 hover:text-red-600"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Footer / Total */}
              <div className="p-3 border-t border-gray-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="mb-2">
                  <div className="flex justify-between items-center text-[10px] uppercase text-gray-400 font-bold mb-1">
                    <span>Items: {calcEntries.length}</span>
                    <span>Formula</span>
                  </div>
                  <div className="text-[10px] font-mono text-gray-600 bg-gray-50 p-1.5 rounded border border-gray-100 overflow-x-auto whitespace-nowrap scrollbar-hide">
                    {calcEntries.length > 0 ? calcEntries.map(e => `${e.netEffect > 0 ? '+' : '-'}${e.amount}`).join(' ') : 'Empty'}
                  </div>
                </div>
                <div className="flex items-center justify-between mb-3 border-t border-gray-100 pt-2">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Result</span>
                  <span className={`text-lg font-extrabold tabular-nums ${
                    calcRunningTotal > 0 ? 'text-rose-600' :
                    calcRunningTotal < 0 ? 'text-emerald-600' : 'text-gray-900'
                  }`}>
                    {fmtBalance(calcRunningTotal)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={copyCalcFormula}
                    disabled={calcEntries.length === 0}
                    className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Copy size={13} /> Copy Formula
                  </button>
                  <button 
                    onClick={copyCalcTotal}
                    disabled={calcEntries.length === 0}
                    className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Copy size={13} /> Copy Total
                  </button>
                </div>
                <div className="mt-2 text-center">
                  <button 
                    onClick={clearCalc}
                    disabled={calcEntries.length === 0}
                    className="text-[10px] font-bold text-gray-400 hover:text-red-500 transition-colors uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* PDF export is generated programmatically via jspdf — no hidden DOM required */}
      </div>

      {/* ── PDF Preview Modal (2-Step PDF Generation) ──────────────────────── */}
      {pdfPreviewModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={closePdfPreviewModal} 
          />

          {/* Modal Content */}
          <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col w-full max-w-4xl h-[90vh] overflow-hidden z-10">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Download size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Statement PDF Preview</h3>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">{pdfPreviewModal.fileName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={closePdfPreviewModal}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body: PDF Preview Frame */}
            <div className="flex-1 w-full h-full bg-slate-100 relative">
              {pdfPreviewModal.blobUrl ? (
                <iframe
                  src={pdfPreviewModal.blobUrl}
                  title="PDF Preview"
                  className="w-full h-full border-none"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">
                  <RefreshCw size={18} className="animate-spin mr-2" /> Loading preview...
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
              <span>Review the generated statement pages above before saving to your device.</span>
              <div className="flex gap-2">
                <button
                  onClick={closePdfPreviewModal}
                  className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 font-semibold rounded-md hover:bg-gray-100 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={confirmPdfDownload}
                  className="px-4 py-1.5 bg-emerald-600 text-white font-bold rounded-md hover:bg-emerald-700 transition-colors inline-flex items-center gap-1.5"
                >
                  <Download size={13} />
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

