'use client';

import { useState } from 'react';
import {
  Search, RefreshCw, ChevronDown, ChevronRight,
  FileJson, Copy, AlertCircle, User, Phone,
  TrendingUp, Activity, Lock, Printer, Check, Download,
  Calculator, Plus, Minus, Trash2, X
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { qzManager } from '@/lib/print/qz-tray';
import { renderStatementSlip } from '@/lib/print/slip-renderer';

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
  associatedVendorId?: string;
  outstandingPayable?: number;
  unusedCreditsPayable?: number;
  unusedCreditsReceivable?: number;
  billingAddress?: string;
};

type Transaction = {
  id: string;
  type: 'invoice' | 'payment' | 'bill';
  date: string;
  datetime?: string;
  description: string;
  amount: number;
  netEffect: number;
  balanceAfter: number;
  isVerified?: boolean;
  zohoUrl?: string;
};

type Telemetry = {
  customerApiCalls: number;
  invoiceApiCalls: number;
  paymentApiCalls: number;
  billApiCalls: number;
  totalApiCalls: number;
  rawInvoicesFetched: number;
  validInvoicesAfterFilter: number;
  rawBillsFetched: number;
  validBillsAfterFilter: number;
  debugReceivable: number;
  debugPayable: number;
  debugNetClosingBalance: number;
  debugIsHybrid: boolean;
};

type Statement = {
  customer: Customer;
  openingBalance: number;
  closingBalance: number;
  outstandingReceivable: number;
  outstandingPayable: number;
  isHybrid: boolean;
  transactions: Transaction[];
  transactionCount: number;
  unpaidInvoices: any[];
  isTruncated: boolean;
  telemetry: Telemetry;
};

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
  if (n === 0) return '₹0.00';
  const val = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  return n > 0 ? val : `-${val}`;
}

/**
 * Render the opening balance in presentation-friendly form.
 * If negative (advance/credit), returns an object with label + amount for special display.
 * Internal calculations always use the raw number.
 */
function getOpeningBalancePresentation(n: number): { label: string; amount: string; isCredit: boolean } {
  if (n < 0) {
    return {
      label: 'Advance Balance',
      amount: fmt(n), // fmt uses Math.abs
      isCredit: true,
    };
  }
  return {
    label: 'Opening Balance',
    amount: fmtBalance(n),
    isCredit: false,
  };
}

/** Strip redundant prefixes from transaction description */
function cleanDescription(desc: string, type: string): string {
  if (!desc) return desc;
  if (type === 'payment') {
    // Remove "Payment - " or "Payment-" prefix (case-insensitive)
    return desc.replace(/^payment\s*[-–]\s*/i, '').trim();
  }
  if (type === 'invoice' || type === 'bill') {
    // Remove "Invoice " or "Bill " prefix (case-insensitive)
    return desc.replace(/^(invoice|bill)\s+/i, '').trim();
  }
  return desc;
}

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
  const raw = parseRawDate(iso);
  if (raw) {
    datePart = `${raw.d} ${raw.m} ${raw.y}`;
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

// PDF number formatters — use NotoSans font (embedded) which supports ₹ (U+20B9)
/** Absolute value formatted as ₹X,XX,XXX.XX for PDF output */
function pdfFmt(n: number): string {
  return '\u20b9' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
}

/** Signed balance formatted for PDF — negative = credit/advance */
function pdfFmtBalance(n: number): string {
  if (n === 0) return '\u20b90.00';
  const val = '\u20b9' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  return n > 0 ? val : `-${val}`;
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
  const [debugOpen, setDebugOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfMenuOpen, setPdfMenuOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
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

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('calc-session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.isCalcOpen !== undefined) setIsCalcOpen(parsed.isCalcOpen);
        if (parsed.calcEntries) setCalcEntries(parsed.calcEntries);
      }
    } catch (e) {}
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
          balance: t.balanceAfter
        }))
      };

      const bytes = renderStatementSlip(payload);
      await qzManager.printRaw(bytes);
      toast.success('Statement sent to printer successfully');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Printing Failed';
      console.error('Print error:', err);
      toast.error(msg);
    } finally {
      setPrinting(false);
    }
  };

  // ── PDF Download (visible statement only) ────────────────────────────────
  const handleDownloadPDF = async (theme: 'color' | 'economy' = 'color') => {
    const s = statement?.data;
    if (!s) return;
    setPdfGenerating(true);
    try {
      toast.loading('Generating PDF…', { id: 'pdf-stmt' });

      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 14;
      const colW = pageW - margin * 2;

      // Helper to convert Response blob to clean Base64 string
      const toBase64 = async (res: Response): Promise<string> => {
        const blob = await res.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result as string;
            const commaIndex = base64data.indexOf(',');
            resolve(commaIndex > -1 ? base64data.slice(commaIndex + 1) : base64data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };

      // ── Embed NotoSans for ₹ (U+20B9) support ──────────────────────────
      try {
        const fontRes = await fetch('/fonts/NotoSans-Regular.ttf?v=3');
        if (!fontRes.ok) throw new Error(`Status ${fontRes.status}`);
        const fontB64 = await toBase64(fontRes);
        if (fontB64.startsWith('PCFvY') || fontB64.startsWith('PCFET') || fontB64.includes('<!DOCTYPE')) {
          throw new Error('Fetched HTML page instead of font file');
        }
        doc.addFileToVFS('NotoSans-Regular.ttf', fontB64);
        doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
      } catch (err) {
        console.warn('[PDF] NotoSans Regular font load failed', err);
      }

      try {
        const fontRes = await fetch('/fonts/NotoSans-Bold.ttf?v=3');
        if (!fontRes.ok) throw new Error(`Status ${fontRes.status}`);
        const fontB64 = await toBase64(fontRes);
        if (fontB64.startsWith('PCFvY') || fontB64.startsWith('PCFET') || fontB64.includes('<!DOCTYPE')) {
          throw new Error('Fetched HTML page instead of font file');
        }
        doc.addFileToVFS('NotoSans-Bold.ttf', fontB64);
        doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
      } catch (err) {
        console.warn('[PDF] NotoSans Bold font load failed', err);
      }

      const pdfFont = doc.getFontList()['NotoSans'] ? 'NotoSans' : 'helvetica';

      // ── Fetch logo as raster image for PDF embedding ────────────────────
      // SVG is converted to PNG via a canvas element so jsPDF can embed it.
      let logoDataUrl: string | null = null;
      try {
        const svgRes = await fetch('/logo.svg');
        const svgText = await svgRes.text();
        // Convert dark-fill SVG to white for color theme, or keep original for economy theme
        const whiteSvg = theme === 'economy' ? svgText : svgText
          .replace(/#1A2766/gi, '#FFFFFF')
          .replace(/#003347/gi, '#FFFFFF')
          .replace(/#AE1B1E/gi, '#FFFFFF');
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 387; // aspect ratio ~599:579
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const img = new Image();
          const blob = new Blob([whiteSvg], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
          await new Promise<void>((resolve) => {
            img.onload = () => { ctx.drawImage(img, 0, 0, 400, 387); resolve(); };
            img.onerror = () => resolve();
            img.src = url;
          });
          URL.revokeObjectURL(url);
          logoDataUrl = canvas.toDataURL('image/png');
        }
      } catch {
        console.warn('[PDF] Logo load failed — header will be text only');
      }

      // ── colour palette ──────────────────────────────────────────────────
      const cNavy: [number, number, number]   = [26,  39, 102];  // #1A2766
      const cSlate: [number, number, number]  = [100, 116, 139]; // slate-500
      const cDark: [number, number, number]   = [15,  23,  42];  // slate-900
      const cRed: [number, number, number]    = [220, 38,  38];  // red-600
      const cGreen: [number, number, number]  = [5,  150, 105];  // emerald-600
      const cBg: [number, number, number]     = [248, 250, 252]; // slate-50

      // ── Visible transactions ────────────────────────────────────────────
      const clipIdx = clipFromIndex !== null ? clipFromIndex : -1;
      const activeTxs = clipIdx !== -1 ? s.transactions.slice(clipIdx) : s.transactions;
      const visibleTxs = isExpanded ? activeTxs : activeTxs.slice(-12);

      const openingBal = visibleTxs.length > 0
        ? visibleTxs[0].balanceAfter - visibleTxs[0].netEffect
        : s.closingBalance;
      const openingPres = getOpeningBalancePresentation(openingBal);
      const pdfOpeningAmt  = pdfFmt(openingBal);
      const totalInvoiced  = visibleTxs.filter(t => t.type === 'invoice').reduce((a, t) => a + Math.abs(t.netEffect), 0);
      const totalPaid      = visibleTxs.filter(t => t.type === 'payment').reduce((a, t) => a + Math.abs(t.netEffect), 0);

      // ── Header bar ──────────────────────────────────────────────────────
      const headerH = theme === 'economy' ? 22 : 30;
      if (theme === 'color') {
        doc.setFillColor(...cNavy);
        doc.rect(0, 0, pageW, headerH, 'F');
      }

      // Logo (white version) at top-left
      const logoH = theme === 'economy' ? 14 : 18;
      const logoW = logoH * (599 / 579); // maintain SVG aspect ratio
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', margin, (headerH - logoH) / 2, logoW, logoH);
      }

      // Title block — starts after logo
      const titleX = logoDataUrl ? margin + logoW + 4 : margin;
      doc.setTextColor(...(theme === 'economy' ? cDark : [255, 255, 255] as [number, number, number]));
      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(13);
      doc.text('Customer Statement', titleX, theme === 'economy' ? 10 : 12);

      doc.setFont(pdfFont, 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...(theme === 'economy' ? cSlate : [190, 205, 225] as [number, number, number]));
      doc.text('Kamna Traders · Receivables Ledger', titleX, theme === 'economy' ? 15 : 20);

      // Customer name + GST + phone — right-aligned
      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...(theme === 'economy' ? cDark : [255, 255, 255] as [number, number, number]));
      doc.text(s.customer.contactName, pageW - margin, theme === 'economy' ? 9 : 11, { align: 'right' });
      if (s.customer.gstNo) {
        doc.setFont(pdfFont, 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...(theme === 'economy' ? cSlate : [190, 205, 225] as [number, number, number]));
        doc.text(`GST: ${s.customer.gstNo}`, pageW - margin, theme === 'economy' ? 14 : 18, { align: 'right' });
      }
      if (s.customer.mobile) {
        doc.setFontSize(7);
        doc.text(s.customer.mobile, pageW - margin, theme === 'economy' ? 19 : 24, { align: 'right' });
      }

      if (theme === 'economy') {
        doc.setDrawColor(...cNavy);
        doc.setLineWidth(0.3);
        doc.line(margin, headerH, pageW - margin, headerH);
      }

      // ── KPI strip ──────────────────────────────────────────────────────
      const kpis = [
        { label: openingPres.isCredit ? 'Advance / Credit' : 'Opening Balance', val: pdfOpeningAmt, color: openingPres.isCredit ? cGreen : cDark, accent: [59, 130, 246] as [number, number, number] },
        { label: 'Total Invoiced',  val: pdfFmt(totalInvoiced), color: cDark, accent: cNavy  },
        { label: 'Total Paid',      val: pdfFmt(totalPaid),     color: cGreen, accent: [16, 185, 129] as [number, number, number] },
        { label: 'Closing Balance', val: pdfFmtBalance(s.closingBalance),
          color: s.closingBalance > 0 ? cRed : s.closingBalance < 0 ? cGreen : cDark, accent: [239, 68, 68] as [number, number, number] },
      ];
      
      const boxW = (colW - 8 * 3) / 4;
      kpis.forEach((box, i) => {
        const bx = margin + i * (boxW + 8);
        const by = theme === 'economy' ? 28 : 38;
        const bh = 14;
        
        if (theme === 'economy') {
          doc.setFillColor(252, 252, 252);
          doc.setDrawColor(226, 232, 240); // slate-200 border
          doc.setLineWidth(0.3);
          doc.roundedRect(bx, by, boxW, bh, 1, 1, 'FD');

          doc.setFillColor(...box.accent);
          doc.rect(bx, by + 0.3, 2.5, bh - 0.6, 'F');
        } else {
          // Pastel background mapped from the primary color for color theme
          const bg = box.color === cRed ? [254, 242, 242] :
                     box.color === cGreen ? [236, 253, 245] :
                     [248, 250, 252];
          doc.setFillColor(bg[0], bg[1], bg[2]);
          doc.roundedRect(bx, by, boxW, bh, 2, 2, 'F');
        }

        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(...cSlate);
        doc.text(box.label.toUpperCase(), bx + 3, by + 5);

        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...box.color);
        doc.text(box.val, bx + 3, by + 11);
      });

      // ── Ledger table ────────────────────────────────────────────────────
      const tableHead = [['Date', 'Type', 'Details', 'Invoice Amt', 'Payment Amt', 'Balance']];

      const openRow = [
        '—', '—',
        `Opening Balance${openingPres.isCredit ? ' (Advance/Credit)' : ''}`,
        '—', '—', pdfOpeningAmt
      ];

      const txRows = visibleTxs.map(tx => [
        fmtDate(tx.date),
        tx.type === 'invoice' ? 'Invoice' : tx.type === 'payment' ? 'Payment' : 'Bill',
        cleanDescription(tx.description, tx.type),
        tx.netEffect > 0  ? pdfFmt(tx.amount) : '—',
        tx.netEffect <= 0 ? pdfFmt(tx.amount) : '—',
        pdfFmtBalance(tx.balanceAfter),
      ]);

      const totalsRow = [
        '', '', 'TOTALS',
        pdfFmt(totalInvoiced),
        pdfFmt(totalPaid),
        pdfFmtBalance(s.closingBalance),
      ];

      autoTable(doc, {
        startY: theme === 'economy' ? 46 : 56,
        head: tableHead,
        body: [openRow, ...txRows, totalsRow],
        theme: 'grid',
        headStyles: { 
          fillColor: theme === 'economy' ? [243, 244, 246] : cNavy, 
          textColor: theme === 'economy' ? [0, 0, 0] : [255, 255, 255], 
          fontSize: 7, 
          fontStyle: 'bold', 
          font: pdfFont,
          lineWidth: theme === 'economy' ? 0.2 : 0,
          lineColor: theme === 'economy' ? [220, 220, 220] : undefined
        },
        bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85], font: pdfFont },
        alternateRowStyles: { fillColor: theme === 'economy' ? [250, 250, 250] : [250, 250, 250] },
        columnStyles: {
          0: { cellWidth: 22, overflow: 'visible' },
          1: { cellWidth: 16, overflow: 'visible' },
          2: { cellWidth: 58, overflow: 'linebreak' },
          3: { halign: 'right', cellWidth: 28, fontStyle: 'bold', fontSize: 8, overflow: 'visible' },
          4: { halign: 'right', cellWidth: 28, textColor: [5, 150, 105], fontStyle: 'bold', fontSize: 8, overflow: 'visible' },
          5: { halign: 'right', cellWidth: 30, fontStyle: 'bold', fontSize: 8, overflow: 'visible' },
        },
        styles: { 
          cellPadding: { top: 2.2, bottom: 2.2, left: 1.5, right: 1.5 }, 
          font: pdfFont,
          ...(theme === 'economy' ? { lineWidth: 0.1, lineColor: [226, 232, 240] } : {})
        },
        margin: { left: margin, right: margin, bottom: 65 },
        didParseCell: (data) => {
          if (data.section === 'body') {
            // Opening balance row — light blue tint
            if (data.row.index === 0) {
              if (theme !== 'economy') {
                data.cell.styles.fillColor = [239, 246, 255];
              }
              if (data.column.index === 5) {
                data.cell.styles.textColor = openingPres.isCredit ? [5, 150, 105] : [15, 23, 42];
                data.cell.styles.fontStyle = 'bold';
              }
            }
            // Totals row — slate bg, all bold, larger balance
            const isLast = data.row.index === txRows.length + 1;
            
            // Transaction type badges for Invoice and Payment in economy mode
            if (data.column.index === 1 && data.row.index > 0 && !isLast && theme === 'economy') {
              const txType = txRows[data.row.index - 1][1];
              if (txType === 'Invoice') {
                data.cell.styles.fillColor = [239, 246, 255];
                data.cell.styles.textColor = [30, 64, 175];
              } else if (txType === 'Payment') {
                data.cell.styles.fillColor = [236, 253, 245];
                data.cell.styles.textColor = [6, 95, 70];
              }
            }

            if (isLast) {
              if (theme !== 'economy') {
                data.cell.styles.fillColor = [241, 245, 249];
              }
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fontSize = 8.5;
              if (data.column.index === 3) data.cell.styles.textColor = [15, 23, 42];
              if (data.column.index === 4) data.cell.styles.textColor = [5, 150, 105];
              if (data.column.index === 5) {
                data.cell.styles.textColor = s.closingBalance > 0 ? [220, 38, 38]
                  : s.closingBalance < 0 ? [5, 150, 105] : [15, 23, 42];
                data.cell.styles.fontSize = 9;
              }
            }
            // Balance column colouring for normal rows (red = owes us, green = credit)
            if (data.column.index === 5 && data.row.index > 0 && !isLast) {
              const txIdx = data.row.index - 1;
              if (txIdx >= 0 && txIdx < visibleTxs.length) {
                const b = visibleTxs[txIdx].balanceAfter;
                data.cell.styles.textColor = b > 0 ? [220, 38, 38] : b < 0 ? [5, 150, 105] : [15, 23, 42];
              }
            }
          }
        }
      });

      // ── Footer / Payment Section (Fixed at bottom of page) ───────────────
      const closingBal = s.closingBalance;
      const finalTableY = (doc as any).lastAutoTable?.finalY ?? 96;

      // Determine height of the footer
      const footerHeight = theme === 'economy' ? 42 : 56;
      const spaceRequired = footerHeight + 10; // 66mm total space needed at bottom
      
      // If table ended too low on the current page, add a new page
      if (finalTableY + spaceRequired > pageH) {
        doc.addPage();
      }

      const footerY = pageH - margin - footerHeight;

      // Draw horizontal divider line
      doc.setDrawColor(...cSlate);
      doc.setLineWidth(0.3);
      doc.line(margin, footerY, pageW - margin, footerY);

      // LEFT: Generated Info
      const generatedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
      doc.setFont(pdfFont, 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...cSlate);
      doc.text('Generated By: Admin', margin, footerY + 8);
      doc.text(`Generated At: ${generatedAt}`, margin, footerY + 13);

      // RIGHT: QR Payment Box
      const UPI_ID = 'ibkPOS.EP208232@icici';
      if (closingBal > 0) {
        const customerForRemarks = s.customer.contactName || s.customer.companyName || 'Customer';
        const remarks = `${customerForRemarks} Balance`;
        // Only pre-fill amount when balance is below ₹1,00,000
        const amountParam = closingBal < 100000
          ? `&am=${closingBal.toFixed(2)}`
          : '';
        const upiUrl = `upi://pay?pa=${UPI_ID}&pn=Kamna+Traders&tn=${encodeURIComponent(remarks)}${amountParam}&cu=INR`;

        let qrDataUrl: string | null = null;
        try {
          const QRCode = (await import('qrcode')).default;
          qrDataUrl = await QRCode.toDataURL(upiUrl, {
            margin: 1,
            width: 250,
            errorCorrectionLevel: 'M'
          });
        } catch (err) {
          console.warn('[PDF] QR generation failed via client-side QRCode library', err);
        }

        if (theme === 'economy') {
          const qrSize = 22; // mm
          const boxW = 44;
          const boxH = 38;
          const boxX = pageW - margin - boxW;
          const boxY = footerY + 2;

          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(200, 200, 200);
          doc.rect(boxX, boxY, boxW, boxH, 'FD');

          const centerX = boxX + boxW / 2;

          doc.setFont(pdfFont, 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(...cDark);
          doc.text('Amount Due', centerX, boxY + 5, { align: 'center' });

          doc.setFont(pdfFont, 'bold');
          doc.setFontSize(11);
          doc.setTextColor(...cRed);
          doc.text(pdfFmtBalance(closingBal), centerX, boxY + 10, { align: 'center' });

          if (qrDataUrl) {
            doc.addImage(qrDataUrl, 'PNG', centerX - qrSize / 2, boxY + 11, qrSize, qrSize);
          } else {
            doc.setFont(pdfFont, 'normal');
            doc.setFontSize(6);
            doc.setTextColor(...cSlate);
            doc.text('[QR unavailable]', centerX, boxY + 22, { align: 'center', maxWidth: qrSize });
          }

          doc.setFont(pdfFont, 'normal');
          doc.setFontSize(6);
          doc.setTextColor(...cSlate);
          doc.text(UPI_ID, centerX, boxY + 12 + qrSize + 3, { align: 'center' });
        } else {
          const qrSize = 32; // mm
          const qrX = pageW - margin - qrSize - 4; // Right-aligned with padding
          const qrBoxY = footerY + 4;

          // Draw background box for QR code
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          
          const boxPadding = 4;
          const boxExtraH = 22;
          doc.rect(qrX - boxPadding, qrBoxY - 2, qrSize + boxPadding * 2, qrSize + boxExtraH, 'FD');

          if (qrDataUrl) {
            doc.addImage(qrDataUrl, 'PNG', qrX, qrBoxY, qrSize, qrSize);
          } else {
            // Fallback text if QR couldn't be generated
            doc.setFont(pdfFont, 'normal');
            doc.setFontSize(6);
            doc.setTextColor(...cSlate);
            doc.text('[QR unavailable — pay via UPI ID]', qrX, qrBoxY + 15, { align: 'left', maxWidth: qrSize });
          }

          const qrLabelX = qrX + qrSize / 2;
          doc.setFont(pdfFont, 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(...cDark);
          doc.text('Scan to Pay', qrLabelX, qrBoxY + qrSize + 4, { align: 'center' });

          doc.setFont(pdfFont, 'normal');
          doc.setFontSize(6);
          doc.setTextColor(...cSlate);
          doc.text(UPI_ID, qrLabelX, qrBoxY + qrSize + 8, { align: 'center' });

          // Outstanding amount label
          doc.setFont(pdfFont, 'bold');
          doc.setFontSize(7);
          doc.setTextColor(...cRed);
          doc.text(`Outstanding: ${pdfFmtBalance(closingBal)}`, qrLabelX, qrBoxY + qrSize + 13, { align: 'center' });

          if (closingBal >= 100000) {
            // Note about manual amount entry
            doc.setFont(pdfFont, 'normal');
            doc.setFontSize(5.5);
            doc.setTextColor(...cSlate);
            doc.text('Enter amount manually when scanning', qrLabelX, qrBoxY + qrSize + 17, { align: 'center' });
          }
        }
      } else {
        doc.setFont(pdfFont, 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...cSlate);
        doc.text('Kamna Traders B2B — Confidential', pageW - margin, footerY + 8, { align: 'right' });
      }

      // ── Save ────────────────────────────────────────────────────────────
      const safeName = (s.customer.contactName || 'CUSTOMER')
        .toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
      const dateStr = new Date().toISOString().slice(0, 10);
      doc.save(`${safeName}_STATEMENT_${dateStr}.pdf`);
      toast.success('Statement PDF downloaded!', { id: 'pdf-stmt' });
    } catch (err) {
      console.error('[PDF Export Error]', err);
      toast.error('Failed to generate PDF.', { id: 'pdf-stmt' });
    } finally {
      setPdfGenerating(false);
    }
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const handleFetch = async (overrideId?: string, force = false) => {
    const idToFetch = (overrideId || customerId).trim();
    if (!idToFetch) {
      toast.error('Please select or enter a valid customer.');
      return;
    }

    const cacheKey = `customer-statement-${idToFetch}`;
    
    if (!force) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setStatement({ success: true, data: parsed.data });
          setCachedAt(parsed.cachedAt);
          return;
        } catch (e) {
          console.error('Failed to parse cache', e);
        }
      }
    }

    setLoading(true);
    setStatement(null);
    setCachedAt(null);
    try {
      const res = await fetch(
        `/api/admin/customer-statement/statement?customerId=${encodeURIComponent(idToFetch)}`
      );
      const data = await res.json();
      setStatement(data);
      if (data.success && data.data) {
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

  // ── Render ─────────────────────────────────────────────────────────────────
  const s = statement?.data;

  if (s) {
    console.debug('[Statement Ledger Render]', {
      transactionCount: s.transactionCount,
      closingBalance: s.closingBalance,
      isHybrid: s.isHybrid
    });
  }

  return (
    <div className="flex gap-5 items-start w-full relative">
      <div className={`transition-all duration-300 space-y-4 shrink-0 ${isCalcOpen ? 'w-[calc(70%-1.25rem)]' : 'w-full'}`}>
        <div>
        <h1 className="text-2xl font-bold">Customer Statement Preview</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Finance-grade customer ledger · Reverse-calculated opening balance
        </p>
      </div>

      {/* ── Search bar ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row items-end gap-3">
        <div className="flex-1 w-full">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-600 mb-1">
            Search Customer
            {isLocked && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                <Lock size={10} /> Prefilled from Zoho Books
              </span>
            )}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              id="customer-id-input"
              type="text"
              placeholder="Name, Mobile, GST or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onKeyDown={(e) => {
                if (!isLocked && e.key === 'Enter') {
                  setCustomerId(searchQuery);
                  handleFetch(searchQuery, true);
                  setShowSuggestions(false);
                }
              }}
              disabled={isLocked}
              className={`w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A2766] focus:border-transparent ${
                isLocked ? 'bg-gray-50 text-gray-500 border-gray-200 cursor-not-allowed' : 'border-gray-200'
              }`}
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <RefreshCw size={14} className="animate-spin text-gray-400" />
              </div>
            )}
            
            {/* Autocomplete Dropdown */}
            {showSuggestions && suggestions.length > 0 && !isLocked && (
              <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden">
                <div className="max-h-60 overflow-y-auto">
                  {suggestions.map((c) => (
                    <div 
                      key={c.id} 
                      className="px-4 py-3 border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent blur
                        setSearchQuery(c.name);
                        setCustomerId(c.id);
                        setShowSuggestions(false);
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-sm font-bold text-gray-900">{c.name}</div>
                          {c.gstNumber && c.gstNumber !== 'NOT_AVAILABLE' && (
                            <div className="text-[10px] font-mono text-gray-500 mt-0.5 tracking-wide">GST: {c.gstNumber}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cached label — stable position, right-aligned */}
        {cachedAt && (
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-gray-400 font-medium self-end pb-2 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            Cached {formatCachedAge(now - cachedAt)}
          </div>
        )}

        <button
          id="fetch-statement-btn"
          onClick={() => handleFetch(undefined, true)}
          disabled={loading}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-[#1A2766] text-white rounded-lg text-sm font-bold hover:bg-[#25368a] transition-colors disabled:opacity-50 h-[38px]"
        >
          {loading ? <RefreshCw size={15} className="animate-spin" /> : 'Load Statement'}
        </button>
        {s && (
          <>
            <button
              onClick={handleThermalPrint}
              disabled={printing}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-black transition-colors disabled:opacity-50 h-[38px] print:hidden"
            >
              {printing ? <RefreshCw size={15} className="animate-spin" /> : <Printer size={15} />}
              {printing ? 'Printing…' : 'Print'}
            </button>
            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => setPdfMenuOpen(!pdfMenuOpen)}
                disabled={pdfGenerating}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-emerald-700 text-white rounded-lg text-sm font-bold hover:bg-emerald-800 transition-colors disabled:opacity-50 h-[38px] print:hidden"
              >
                {pdfGenerating ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
                {pdfGenerating ? 'Generating PDF…' : 'Download Statement PDF'}
                <ChevronDown size={14} className={`transition-transform ${pdfMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {pdfMenuOpen && (
                <div className="absolute top-full right-0 sm:left-0 sm:right-auto mt-1 w-full sm:w-56 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-50">
                  <button 
                    onClick={() => { setPdfMenuOpen(false); handleDownloadPDF('color'); }}
                    className="w-full text-left px-4 py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-50 border-b border-gray-100 flex items-center gap-2.5 transition-colors"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></div>
                    Color PDF
                  </button>
                  <button 
                    onClick={() => { setPdfMenuOpen(false); handleDownloadPDF('economy'); }}
                    className="w-full text-left px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
                  >
                    <div className="w-2.5 h-2.5 rounded-full border-2 border-gray-300"></div>
                    Print PDF (Low Ink)
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setIsCalcOpen(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-purple-700 text-white rounded-lg text-sm font-bold hover:bg-purple-800 transition-colors h-[38px] print:hidden"
            >
              <Calculator size={15} /> Calculator
            </button>
            <a
              href={`/staff/dashboard/accounts/dcr/customer-lookup?customerId=${customerId}&filterMode=ALL&statusFilter=ALL`}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors h-[38px] print:hidden"
            >
              View DCR Summary
            </a>
          </>
        )}
      </div>

      {/* Mobile cached label */}
      {cachedAt && (
        <div className="sm:hidden flex items-center gap-1.5 text-[10px] text-gray-400 font-medium px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          Cached {formatCachedAge(now - cachedAt)}
        </div>
      )}

      {/* ── Error state ────────────────────────────────────────────────── */}
      {statement && !statement.success && (
        <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm">
          <AlertCircle size={18} className="shrink-0" />
          <span>{statement.error || 'Unknown error'}</span>
        </div>
      )}

      {s && (() => {
        const clipIdx = clipFromIndex !== null ? clipFromIndex : -1;
        const isClipped = clipIdx !== -1;
        const activeTxs = isClipped ? s.transactions.slice(clipIdx) : s.transactions;
        const visibleTransactions = isExpanded ? activeTxs : activeTxs.slice(-12);

        const dynamicOpeningBalance = visibleTransactions.length > 0
          ? (visibleTransactions[0].balanceAfter - visibleTransactions[0].netEffect)
          : s.closingBalance;
        const openingPresentation = getOpeningBalancePresentation(dynamicOpeningBalance);

        // Totals for visible period
        const totalInvoiceAmount = visibleTransactions
          .filter((t: any) => t.type === 'invoice')
          .reduce((sum: number, t: any) => sum + Math.abs(t.netEffect), 0);
        const totalPaymentAmount = visibleTransactions
          .filter((t: any) => t.type === 'payment')
          .reduce((sum: number, t: any) => sum + Math.abs(t.netEffect), 0);

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
            return inv.invoiceDate >= clippedTx.date;
          }) : s.unpaidInvoices
        ) : [];

        return (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left Column: Ledger and Customer Info */}
            <div className="xl:col-span-8 space-y-4">
              {/* ── Section 1: Customer card ──────────────────────────────── */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
                  <User size={14} className="text-[#1A2766]" />
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                    {s.customer.associatedVendorId ? 'Hybrid Account' : 'Customer'}
                  </span>
                </div>
                <div className="px-4 py-2.5 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="col-span-2 sm:col-span-1">
                    <div className="text-[10px] uppercase text-gray-500 font-bold mb-0.5">Name</div>
                    <a 
                      href={`https://books.zoho.in/app/60027595766#/contacts/${s.customer.contactId}`}
                      target="_blank" rel="noreferrer"
                      className="text-sm font-extrabold text-blue-700 hover:text-blue-900 hover:underline leading-tight flex items-center gap-1 w-fit"
                    >
                      {s.customer.contactName} ↗
                    </a>
                    {s.customer.gstNo && (
                      <div className="text-[11px] font-mono text-gray-400 leading-tight mt-0.5 tracking-wide">{s.customer.gstNo}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-gray-500 font-bold mb-0.5">Mobile</div>
                    <div className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-800">
                      <Phone size={12} className="text-gray-400" />
                      {s.customer.mobile || '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Section 1b: Net Account Position summary (hybrid only) ── */}
              {s.isHybrid && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
                    <TrendingUp size={14} className="text-[#1A2766]" />
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Net Account Position</span>
                  </div>
                  <div className="px-5 py-4 grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-[10px] uppercase text-gray-400 font-bold mb-1">Outstanding Receivables</div>
                      <div className="text-base font-extrabold text-rose-600">{fmt(s.outstandingReceivable)}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">Customer owes us</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-gray-400 font-bold mb-1">Outstanding Payables</div>
                      <div className="text-base font-extrabold text-amber-600">{fmt(s.outstandingPayable)}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">We owe vendor</div>
                    </div>
                    <div className="border-l border-gray-100 pl-4">
                      <div className="text-[10px] uppercase text-gray-400 font-bold mb-1">Net Position</div>
                      <div className={`text-base font-extrabold ${
                        s.closingBalance > 0 ? 'text-[#1A2766]' : s.closingBalance < 0 ? 'text-amber-600' : 'text-gray-400'
                      }`}>
                        {fmtBalance(s.closingBalance)}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">Receivables − Payables</div>
                    </div>
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
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-[#1A2766]" />
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                      Statement Ledger
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">
                      ({s.transactionCount} transaction{s.transactionCount !== 1 ? 's' : ''})
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm relative" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase text-gray-500 font-bold border-b border-gray-200 z-10 shadow-sm">
                      <tr>
                        <th className="px-3 py-2 text-left w-24">Date</th>
                        <th className="w-[45px] text-center px-1" title="Clip column"></th>
                        <th className="px-3 py-2 text-left min-w-[120px] whitespace-nowrap">Type</th>
                        <th className="px-3 py-2 text-left">Details</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Invoice Amt</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Payment Amt</th>
                        <th className="px-3 py-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {/* Opening balance row */}
                      <tr className="bg-blue-50/20">
                        <td className="px-3 py-1.5 text-[11px] text-gray-400 whitespace-nowrap">—</td>
                        <td className="w-[45px] px-1 py-1.5 text-center text-gray-300/50">—</td>
                        <td className="px-3 py-1.5 text-[11px] text-gray-400 whitespace-nowrap">—</td>
                        <td className="px-3 py-1.5 text-[11px]">
                          {openingPresentation.isCredit ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="font-bold text-gray-800">Opening Balance</span>
                              <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full tracking-wide uppercase">
                                Advance / Credit
                              </span>
                            </span>
                          ) : (
                            <span className="font-bold text-gray-800">
                              Opening Balance {isExpanded ? '' : '(Visible Period)'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right text-[11px] text-gray-400">—</td>
                        <td className="px-3 py-1.5 text-right text-[11px] text-gray-400">—</td>
                        <td className="px-3 py-1.5 text-right text-xs font-bold tabular-nums">
                          {openingPresentation.isCredit ? (
                            <span className="text-emerald-600">{openingPresentation.amount}</span>
                          ) : (
                            <span className="text-gray-900">{openingPresentation.amount}</span>
                          )}
                        </td>
                      </tr>

                      {/* Transaction rows */}
                      {visibleTransactions.map((tx) => {
                        const displayDesc = cleanDescription(tx.description, tx.type);
                        return (
                          <tr 
                            key={tx.id} 
                            onClick={() => {
                              if (isCalcOpen) {
                                addCalcEntry(tx);
                              } else if (tx.zohoUrl) {
                                window.open(tx.zohoUrl, '_blank');
                              }
                            }}
                            className={`group even:bg-gray-50/40 hover:bg-blue-50/80 transition-all cursor-pointer relative ${
                              calcEntries.some(e => e.id === tx.id) ? 'bg-purple-50/50 even:bg-purple-50/50' : ''
                            }`}
                          >
                            <td className="px-3 py-1.5 text-[11px] text-gray-500 whitespace-nowrap align-middle">
                              {fmtDateTime(tx.datetime || tx.date)}
                            </td>
                            <td className="w-[45px] text-center px-1 py-1.5 align-middle">
                              <button 
                                onClick={(e) => { e.stopPropagation(); setClipFromIndex(s.transactions.indexOf(tx)); }}
                                className={`text-gray-300 hover:text-blue-500 transition-colors print:hidden focus:opacity-100 ${clipIdx === s.transactions.indexOf(tx) ? 'opacity-100 text-blue-600' : 'opacity-0 group-hover:opacity-100'}`}
                                title="Start statement from this transaction"
                              >
                                📌
                              </button>
                            </td>
                            <td className="px-3 py-1.5 text-[10px] font-semibold text-gray-600 align-middle uppercase tracking-wider whitespace-nowrap">
                              {tx.type === 'invoice' ? 'Invoice' : tx.type === 'payment' ? 'Payment' : 'Purchase Bill'}
                            </td>
                            <td className="px-3 py-1.5 text-[11px] font-medium text-blue-700 group-hover:text-blue-900 group-hover:underline underline-offset-2 align-middle relative">
                              <div className="flex items-center gap-1.5">
                                <span>{displayDesc}</span>
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
                              {/* Add to calc button on hover */}
                              <button 
                                onClick={(e) => { e.stopPropagation(); addCalcEntry(tx); }}
                                className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden ${calcEntries.some(e => e.id === tx.id) ? 'hidden' : ''}`}
                                title="Add to Calculator"
                              >
                                <div className="bg-purple-100 text-purple-700 p-1 rounded hover:bg-purple-200">
                                  <Plus size={12} />
                                </div>
                              </button>
                            </td>
                            <td className="px-3 py-1.5 text-right text-[11px] font-semibold text-gray-700 whitespace-nowrap align-middle tabular-nums">
                              {tx.netEffect > 0 ? fmt(tx.amount) : '—'}
                            </td>
                            <td className="px-3 py-1.5 text-right text-[11px] font-semibold whitespace-nowrap align-middle tabular-nums" style={{ color: tx.netEffect <= 0 ? '#059669' : 'transparent' }}>
                              {tx.netEffect <= 0 ? fmt(tx.amount) : '—'}
                            </td>
                            <td className="px-3 py-1.5 text-right whitespace-nowrap align-middle">
                              {(() => {
                                const b = tx.balanceAfter;
                                const isZero = b === 0;
                                const isNearSettled = !isZero && Math.abs(b) <= 100;
                                
                                if (isZero) {
                                  return (
                                    <span className="text-[11px] font-extrabold text-emerald-600 tabular-nums">
                                      {fmtBalance(b)}
                                    </span>
                                  );
                                }
                                
                                if (isNearSettled) {
                                  return (
                                    <div className="flex flex-col items-end justify-center bg-emerald-50/50 -my-1 -mx-2 px-2 py-1 rounded border border-emerald-100/60">
                                      <span className="text-[11px] tabular-nums font-extrabold text-emerald-700">
                                        {fmtBalance(b)}
                                      </span>
                                      <span className="text-[7px] font-bold text-emerald-600/80 tracking-widest uppercase leading-none mt-0.5">Settled</span>
                                    </div>
                                  );
                                }
                                
                                return (
                                  <span className={`text-[11px] tabular-nums font-semibold ${
                                    b > 0 ? 'text-rose-600' :
                                    b < 0 ? 'text-emerald-600' : 'text-gray-900'
                                  }`}>
                                    {fmtBalance(b)}
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                        );
                      })}

                      {visibleTransactions.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-3 py-6 text-center text-xs text-gray-400 font-medium">
                            No transactions in window.
                          </td>
                        </tr>
                      )}

                      {/* ── TOTALS footer row ── */}
                      <tr className="border-t-2 border-gray-300 bg-gray-50">
                        <td className="px-3 py-2.5 text-[10px] text-gray-400 font-bold uppercase tracking-widest" colSpan={3}>Totals</td>
                        <td className="px-3 py-2.5">
                          <span className="text-[11px] font-extrabold text-gray-700 uppercase tracking-wide">
                            {isExpanded ? 'All Transactions' : 'Visible Period'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-0.5">Total Invoiced</span>
                            <span className="text-[12px] font-extrabold text-gray-800 tabular-nums">{fmt(totalInvoiceAmount)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-0.5">Total Paid</span>
                            <span className="text-[12px] font-extrabold text-emerald-700 tabular-nums">{fmt(totalPaymentAmount)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-0.5">Closing Balance</span>
                            <span className={`text-[13px] font-extrabold tabular-nums ${
                              s.closingBalance > 0 ? 'text-rose-600' :
                              s.closingBalance < 0 ? 'text-emerald-600' : 'text-gray-900'
                            }`}>
                              {fmtBalance(s.closingBalance)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {/* View All Toggle */}
                {s.transactions.length > 12 && (
                  <div className="border-t border-gray-100 bg-gray-50 p-2 text-center">
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="text-xs font-bold text-[#1A2766] hover:text-[#25368a] px-4 py-1.5 rounded-md hover:bg-blue-50 transition-colors"
                    >
                      {isExpanded ? 'Show Less' : `View All Transactions (${s.transactions.length})`}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Financial Summary and Telemetry */}
            <div className="xl:col-span-4 space-y-4">
              
              {/* Financial Summary Card */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
                  <Activity size={14} className="text-[#1A2766]" />
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                    Period Summary {isExpanded ? '(All)' : '(Visible)'}
                  </span>
                </div>
                <div className="p-5 space-y-4">
                  {/* Opening Balance — with credit clarity */}
                  <div className="flex justify-between items-start text-sm gap-2">
                    <span className="text-gray-500 font-medium shrink-0">Opening Balance</span>
                    {openingPresentation.isCredit ? (
                      <div className="text-right">
                        <div className="font-semibold text-emerald-600 tabular-nums">{openingPresentation.amount}</div>
                        <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-wide mt-0.5">Advance / Credit</div>
                      </div>
                    ) : (
                      <span className="font-semibold text-gray-900 tabular-nums">{openingPresentation.amount}</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-medium">Total Invoiced</span>
                    <span className="font-semibold text-gray-900 tabular-nums">{fmt(totalInvoiceAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-medium">Total Paid</span>
                    <span className="font-semibold text-emerald-600 tabular-nums">− {fmt(totalPaymentAmount)}</span>
                  </div>
                  <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-gray-900 font-bold uppercase text-xs tracking-wider">Closing Balance</span>
                    <span className={`text-lg font-extrabold tabular-nums ${s.closingBalance > 0 ? 'text-rose-600' : s.closingBalance < 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                      {fmtBalance(s.closingBalance)}
                    </span>
                  </div>
                  
                  {Object.keys(paymentBreakdown).length > 0 && (
                    <div className="pt-4 border-t border-gray-100">
                      <div className="text-[10px] uppercase text-gray-400 font-bold mb-2">Payment Breakdown</div>
                      <div className="space-y-1.5">
                        {Object.entries(paymentBreakdown).map(([mode, amt]) => (
                          <div key={mode} className="flex justify-between items-center text-xs">
                            <span className="text-gray-500">{mode}</span>
                            <span className="font-medium text-gray-700 tabular-nums">{fmt(amt as number)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Unpaid Invoices */}
              {s.unpaidInvoices && s.unpaidInvoices.length > 0 ? (
                <div className="bg-white rounded-xl border border-rose-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-rose-100 bg-rose-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={14} className="text-rose-600" />
                      <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                        Outstanding Invoices
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.unpaidInvoices.length > 0 && (
                        <span className="text-[10px] font-bold text-rose-600 border border-rose-200 px-2 py-0.5 rounded-md bg-white">
                          Oldest Due: {Math.max(...s.unpaidInvoices.map((inv: any) => Math.floor((Date.now() - new Date(inv.invoiceDate).getTime()) / (1000 * 60 * 60 * 24))))}d
                        </span>
                      )}
                      <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {s.unpaidInvoices.length} Due
                      </span>
                    </div>
                  </div>
                  
                  {/* Card Table Header */}
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    <div className="col-span-4">Invoice</div>
                    <div className="col-span-3 text-right">Value</div>
                    <div className="col-span-3 text-right">Pending</div>
                    <div className="col-span-2 text-right">Age</div>
                  </div>

                  <div className="divide-y divide-gray-50">
                    {s.unpaidInvoices.slice(0, 8).map((inv: any) => {
                      const pendingDays = Math.floor((Date.now() - new Date(inv.invoiceDate).getTime()) / (1000 * 60 * 60 * 24));
                      
                      let pillClass = "bg-gray-100 text-gray-600";
                      if (pendingDays > 60) pillClass = "bg-orange-100 text-orange-700 border border-orange-200/60";
                      else if (pendingDays > 30) pillClass = "bg-amber-50 text-amber-700 border border-amber-200/60";

                      return (
                        <div key={inv.invoiceId} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-gray-50/80 transition-colors">
                          <div className="col-span-4">
                            <a 
                              href={`https://books.zoho.in/app/60027595766#/invoices/${inv.invoiceId}`}
                              target="_blank" 
                              rel="noreferrer"
                              className="text-[11px] font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
                            >
                              {inv.invoiceNumber}
                            </a>
                            <div className="text-[9px] text-gray-400 mt-0.5">{fmtDate(inv.invoiceDate)}</div>
                          </div>
                          <div className="col-span-3 text-right text-[11px] text-gray-500 tabular-nums">
                            {fmt(inv.total)}
                          </div>
                          <div className="col-span-3 text-right text-[11px] font-bold text-rose-600 tabular-nums">
                            {fmt(inv.balance)}
                          </div>
                          <div className="col-span-2 flex justify-end">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pillClass}`}>
                              {pendingDays}d
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {s.unpaidInvoices.length > 8 && (
                      <div className="px-4 py-2 bg-gray-50 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        + {s.unpaidInvoices.length - 8} more
                      </div>
                    )}
                    <div className="px-4 py-3 bg-rose-50/10 border-t border-rose-100 flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Pending</span>
                        <span className="text-xs font-bold text-rose-600 tabular-nums">
                          {fmt(s.unpaidInvoices.reduce((sum, i) => sum + i.balance, 0))}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Unused Credits</span>
                        <span className="text-xs font-bold text-emerald-600 tabular-nums">
                          − {fmt(s.customer.unusedCreditsReceivable || 0)}
                        </span>
                      </div>
                      <div className="pt-2 mt-1 border-t border-gray-100 flex justify-between items-center">
                        <span className="text-[11px] font-bold text-gray-900 uppercase tracking-wider">Net Receivable</span>
                        <span className="text-sm font-extrabold text-gray-900 tabular-nums">
                          {fmt((s.unpaidInvoices.reduce((sum, i) => sum + i.balance, 0)) - (s.customer.unusedCreditsReceivable || 0))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden p-6 flex flex-col items-center justify-center gap-2">
                  <Check size={20} className="text-emerald-500" />
                  <span className="text-sm font-bold text-gray-600">No outstanding invoices</span>
                </div>
              )}

              {/* API Usage KPI Card */}
              <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden print:hidden">
                <div className="px-5 py-3 border-b border-blue-100 bg-blue-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity size={14} className="text-blue-700" />
                    <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                      API Telemetry
                    </span>
                  </div>
                  <div className="flex bg-gray-100/80 p-0.5 rounded-lg">
                    {['today', '7d', 'month'].map(p => (
                      <button
                        key={p}
                        onClick={() => setUsagePeriod(p as any)}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors uppercase ${
                          usagePeriod === p ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {p === 'today' ? 'Today' : p === '7d' ? '7D' : 'Month'}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="p-5">
                  {isFetchingUsage && !apiUsage ? (
                    <div className="flex justify-center py-4"><RefreshCw size={16} className="animate-spin text-gray-400" /></div>
                  ) : apiUsage ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <div className="text-[10px] uppercase text-gray-400 font-bold mb-0.5">Calls</div>
                          <div className="text-lg font-extrabold text-gray-900">{apiUsage.totalCalls}</div>
                        </div>
                        <div className="border-l border-gray-100">
                          <div className="text-[10px] uppercase text-gray-400 font-bold mb-0.5">Users</div>
                          <div className="text-lg font-extrabold text-blue-600">{apiUsage.activeUsers}</div>
                        </div>
                        <div className="border-l border-gray-100">
                          <div className="text-[10px] uppercase text-gray-400 font-bold mb-0.5">Avg/User</div>
                          <div className="text-lg font-extrabold text-gray-900">{apiUsage.avgPerUser}</div>
                        </div>
                      </div>
                      
                      <div className="pt-3 border-t border-gray-100">
                        <div className="text-[9px] uppercase text-gray-400 font-bold mb-2 tracking-wider">Module Breakdown</div>
                        <div className="space-y-1.5">
                          {Object.entries(apiUsage.breakdown).map(([mod, count]) => (
                            <div key={mod} className="flex justify-between items-center text-xs">
                              <span className="text-gray-600 font-medium">{mod}</span>
                              <span className="font-bold text-gray-800 tabular-nums">{count as number}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-center text-gray-400">Failed to load</div>
                  )}
                </div>
              </div>

              {/* ── Section 4: Debug accordion ────────────────────────────── */}
              <div className="rounded-xl border border-gray-200 overflow-hidden text-xs print:hidden">
                <button
                  onClick={() => setDebugOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-gray-500 font-medium"
                >
                  <span className="flex items-center gap-2">
                    <FileJson size={14} />
                    Debug Info & API Telemetry
                  </span>
                  {debugOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {debugOpen && (
                  <div className="bg-gray-900 border-t border-gray-200">
                    <div className="p-4 bg-white grid grid-cols-2 gap-4 border-b border-gray-200">
                      <div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">API Calls</div>
                        <div className="text-gray-700 font-bold">Total: {s.telemetry.totalApiCalls}</div>
                        <div className="text-gray-500 mt-1">Invoices: {s.telemetry.invoiceApiCalls}, Payments: {s.telemetry.paymentApiCalls}</div>
                        {s.isHybrid && <div className="text-gray-500">Bills: {s.telemetry.billApiCalls}</div>}
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Items Fetched</div>
                        <div className="text-gray-700 font-bold">Invoices: {s.telemetry.rawInvoicesFetched}</div>
                        <div className="text-gray-500 mt-1">Valid: {s.telemetry.validInvoicesAfterFilter}</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center px-4 py-2 border-b border-gray-800">
                      <span className="text-gray-400 font-bold text-[10px] uppercase">Raw JSON Payload</span>
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
            </div>
          </div>
        );
      })()}

      {/* PDF export is generated programmatically via jspdf — no hidden DOM required */}
      </div>
      
      {/* ── Balance Calculator Panel ────────────────────────────────────────── */}
      {isCalcOpen && (
        <div className="w-[30%] bg-white border border-gray-200 shadow-sm z-10 flex flex-col sticky top-4 h-[calc(100vh-2rem)] rounded-xl overflow-hidden print:hidden shrink-0">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-purple-50/50">
              <div className="flex items-center gap-2">
                <Calculator size={18} className="text-purple-700" />
                <h2 className="text-sm font-bold text-gray-900">Balance Calculator</h2>
              </div>
              <button 
                onClick={() => setIsCalcOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            {/* Manual Entry Form */}
            <div className="px-4 py-3 bg-white border-b border-gray-100 shadow-sm z-10 relative">
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
                    className="flex-1 text-sm px-3 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <input 
                  type="text" 
                  placeholder="Description (optional)" 
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualAdd(true)}
                  className="w-full text-xs px-3 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <div className="flex gap-2 mt-1">
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
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30">
              {calcEntries.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-6">
                  <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center mb-3">
                    <Calculator size={20} className="text-purple-300" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Calculator is empty</p>
                  <p className="text-xs text-gray-500 mt-1">Click the <Plus size={10} className="inline text-purple-500"/> button on any ledger row to add it here.</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {calcEntries.map((e, idx) => {
                    let colorClass = 'bg-gray-50 text-gray-600';
                    let iconClass = 'text-gray-400';
                    if (e.type === 'invoice') { colorClass = 'bg-blue-50/50 text-blue-700'; iconClass = 'text-blue-500'; }
                    else if (e.type === 'payment') { colorClass = 'bg-emerald-50/50 text-emerald-700'; iconClass = 'text-emerald-500'; }
                    else if (e.type === 'manual-add') { colorClass = 'bg-purple-50 text-purple-700'; iconClass = 'text-purple-500'; }
                    else if (e.type === 'manual-deduct') { colorClass = 'bg-orange-50 text-orange-700'; iconClass = 'text-orange-500'; }
                    
                    return (
                      <div key={idx} className={`flex items-center justify-between px-3 py-2 rounded-md group transition-colors ${colorClass}`}>
                        <div className="flex items-center gap-2 overflow-hidden w-full">
                          <div className={`shrink-0 font-bold ${iconClass}`}>
                            {e.netEffect > 0 ? '+' : '-'}
                          </div>
                          <div className="truncate flex-1">
                            <div className="text-[11px] font-bold truncate">{e.description}</div>
                            <div className="text-[9px] uppercase tracking-wider opacity-60">{e.type.replace('-', ' ')}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <div className="text-sm font-bold tabular-nums">
                            {fmt(e.amount)}
                          </div>
                          <button 
                            onClick={() => removeCalcEntry(e.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-400 hover:text-red-600"
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
            <div className="p-4 border-t border-gray-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <div className="mb-3">
                <div className="flex justify-between items-center text-[10px] uppercase text-gray-400 font-bold mb-1">
                  <span>Items: {calcEntries.length}</span>
                  <span>Formula</span>
                </div>
                <div className="text-[11px] font-mono text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 overflow-x-auto whitespace-nowrap scrollbar-hide">
                  {calcEntries.length > 0 ? calcEntries.map(e => `${e.netEffect > 0 ? '+' : '-'}${e.amount}`).join(' ') : 'Empty'}
                </div>
              </div>
              <div className="flex items-center justify-between mb-4 border-t border-gray-100 pt-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Result</span>
                <span className={`text-2xl font-extrabold tabular-nums ${
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
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Copy size={14} /> Copy Formula
                </button>
                <button 
                  onClick={copyCalcTotal}
                  disabled={calcEntries.length === 0}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Copy size={14} /> Copy Total
                </button>
              </div>
              <div className="mt-3 text-center">
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
      )}
    </div>
  );
}

