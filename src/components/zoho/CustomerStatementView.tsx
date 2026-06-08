'use client';

import { useState } from 'react';
import {
  Search, RefreshCw, ChevronDown, ChevronRight,
  FileJson, Copy, AlertCircle, User, Phone,
  TrendingUp, Activity, Lock, Printer, Check, Download
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

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
  const handleDownloadPDF = async () => {
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
        // Convert dark-fill SVG to white by replacing known brand colours
        const whiteSvg = svgText
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
      const visibleTxs = isExpanded ? s.transactions : s.transactions.slice(-12);
      const openingBal = visibleTxs.length > 0
        ? visibleTxs[0].balanceAfter - visibleTxs[0].netEffect
        : s.closingBalance;
      const openingPres = getOpeningBalancePresentation(openingBal);
      const pdfOpeningAmt  = pdfFmt(openingBal);
      const totalInvoiced  = visibleTxs.filter(t => t.type === 'invoice').reduce((a, t) => a + Math.abs(t.netEffect), 0);
      const totalPaid      = visibleTxs.filter(t => t.type === 'payment').reduce((a, t) => a + Math.abs(t.netEffect), 0);

      // ── Header bar ──────────────────────────────────────────────────────
      const headerH = 30;
      doc.setFillColor(...cNavy);
      doc.rect(0, 0, pageW, headerH, 'F');

      // Logo (white version) at top-left — 18mm tall
      const logoH = 18;
      const logoW = logoH * (599 / 579); // maintain SVG aspect ratio
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', margin, (headerH - logoH) / 2, logoW, logoH);
      }

      // Title block — starts after logo
      const titleX = logoDataUrl ? margin + logoW + 4 : margin;
      doc.setTextColor(255, 255, 255);
      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(13);
      doc.text('Customer Statement', titleX, 12);

      doc.setFont(pdfFont, 'normal');
      doc.setFontSize(7);
      doc.setTextColor(190, 205, 225);
      doc.text('Kamna Traders · Receivables Ledger', titleX, 20);

      // Customer name + GST + phone — right-aligned
      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(s.customer.contactName, pageW - margin, 11, { align: 'right' });
      if (s.customer.gstNo) {
        doc.setFont(pdfFont, 'normal');
        doc.setFontSize(7);
        doc.setTextColor(190, 205, 225);
        doc.text(`GST: ${s.customer.gstNo}`, pageW - margin, 18, { align: 'right' });
      }
      if (s.customer.mobile) {
        doc.setFontSize(7);
        doc.text(s.customer.mobile, pageW - margin, 24, { align: 'right' });
      }

      let curY = headerH + 6;

      // ── KPI strip (finance-grade bold typography) ────────────────────────
      const kpis = [
        { label: openingPres.isCredit ? 'Advance / Credit' : 'Opening Balance', val: pdfOpeningAmt, color: openingPres.isCredit ? cGreen : cDark },
        { label: 'Total Invoiced',  val: pdfFmt(totalInvoiced), color: cDark  },
        { label: 'Total Paid',      val: pdfFmt(totalPaid),     color: cGreen },
        { label: 'Closing Balance', val: pdfFmtBalance(s.closingBalance),
          color: s.closingBalance > 0 ? cRed : s.closingBalance < 0 ? cGreen : cDark },
      ];
      const kpiCardH = 18;
      const kpiW = colW / kpis.length;
      kpis.forEach((k, i) => {
        const x = margin + i * kpiW;
        doc.setFillColor(...cBg);
        doc.setDrawColor(226, 232, 240);
        doc.rect(x, curY, kpiW - 2, kpiCardH, 'FD');

        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(...cSlate);
        doc.text(k.label.toUpperCase(), x + 3, curY + 6);

        // Bold, larger numeric value for finance-grade readability
        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...k.color);
        doc.text(k.val, x + 3, curY + 14);
      });
      curY += kpiCardH + 4;

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
        startY: curY,
        head: tableHead,
        body: [openRow, ...txRows, totalsRow],
        theme: 'striped',
        headStyles: { fillColor: cNavy, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold', font: pdfFont },
        bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85], font: pdfFont },
        columnStyles: {
          0: { cellWidth: 22, overflow: 'visible' },
          1: { cellWidth: 16, overflow: 'visible' },
          2: { cellWidth: 58, overflow: 'linebreak' },
          // Invoice Amt — bold, dark
          3: { halign: 'right', cellWidth: 28, fontStyle: 'bold', fontSize: 8, overflow: 'visible' },
          // Payment Amt — bold, green
          4: { halign: 'right', cellWidth: 28, textColor: [5, 150, 105], fontStyle: 'bold', fontSize: 8, overflow: 'visible' },
          // Balance — bold, coloured by sign
          5: { halign: 'right', cellWidth: 30, fontStyle: 'bold', fontSize: 8, overflow: 'visible' },
        },
        styles: { cellPadding: { top: 2.2, bottom: 2.2, left: 1.5, right: 1.5 }, font: pdfFont },
        tableWidth: 182,
        didParseCell: (data) => {
          if (data.section === 'body') {
            // Opening balance row — light blue tint
            if (data.row.index === 0) {
              data.cell.styles.fillColor = [239, 246, 255];
              if (data.column.index === 5) {
                data.cell.styles.textColor = openingPres.isCredit ? [5, 150, 105] : [15, 23, 42];
                data.cell.styles.fontStyle = 'bold';
              }
            }
            // Totals row — slate bg, all bold, larger balance
            const isLast = data.row.index === txRows.length + 1;
            if (isLast) {
              data.cell.styles.fillColor = [241, 245, 249];
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
        },
        margin: { left: margin, right: margin, bottom: 65 },
      });

      // ── Footer / Payment Section (Fixed at bottom of page) ───────────────
      const closingBal = s.closingBalance;
      const finalTableY = (doc as any).lastAutoTable?.finalY ?? (curY + 40);

      // Determine height of the footer
      const footerHeight = 56;
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

        const qrSize = 32; // mm
        const qrX = pageW - margin - qrSize - 4; // Right-aligned with padding
        const qrBoxY = footerY + 4;

        // Draw background box for QR code
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.rect(qrX - 4, qrBoxY - 2, qrSize + 8, qrSize + 22, 'FD');

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
    if (!idToFetch || !/^\d+$/.test(idToFetch) || idToFetch.length < 15) {
      toast.error('Please enter a valid Zoho Customer ID.');
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
    <div className="space-y-4">
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
            Zoho Customer / Contact ID
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
              placeholder="e.g. 1759923000018618057"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              onKeyDown={(e) => !isLocked && e.key === 'Enter' && handleFetch(undefined, true)}
              disabled={isLocked}
              className={`w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A2766] focus:border-transparent ${
                isLocked ? 'bg-gray-50 text-gray-500 border-gray-200 cursor-not-allowed' : 'border-gray-200'
              }`}
            />
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
            <button
              onClick={handleDownloadPDF}
              disabled={pdfGenerating}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-emerald-700 text-white rounded-lg text-sm font-bold hover:bg-emerald-800 transition-colors disabled:opacity-50 h-[38px] print:hidden"
            >
              {pdfGenerating ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
              {pdfGenerating ? 'Generating PDF…' : 'Download Statement PDF'}
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
        const visibleTransactions = isExpanded ? s.transactions : s.transactions.slice(-12);
        const dynamicOpeningBalance = visibleTransactions.length > 0
          ? (visibleTransactions[0].balanceAfter - visibleTransactions[0].netEffect)
          : s.closingBalance;
        const openingPresentation = getOpeningBalancePresentation(dynamicOpeningBalance);

        // Totals for visible period
        const totalInvoiceAmount = visibleTransactions
          .filter(t => t.type === 'invoice')
          .reduce((sum, t) => sum + Math.abs(t.netEffect), 0);
        const totalPaymentAmount = visibleTransactions
          .filter(t => t.type === 'payment')
          .reduce((sum, t) => sum + Math.abs(t.netEffect), 0);

        // Payment breakdown (clean mode labels)
        const paymentBreakdown = visibleTransactions
          .filter(t => t.type === 'payment')
          .reduce((acc: Record<string, number>, p) => {
            const cleaned = cleanDescription(p.description, 'payment');
            const mode = cleaned || 'Other';
            acc[mode] = (acc[mode] || 0) + Math.abs(p.netEffect);
            return acc;
          }, {});

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
                            onClick={() => tx.zohoUrl && window.open(tx.zohoUrl, '_blank')}
                            className={`group even:bg-gray-50/40 hover:bg-blue-50/80 transition-all ${tx.zohoUrl ? 'cursor-pointer' : ''}`}
                          >
                            <td className="px-3 py-1.5 text-[11px] text-gray-500 whitespace-nowrap align-middle">
                              {fmtDateTime(tx.datetime || tx.date)}
                            </td>
                            <td className="px-3 py-1.5 text-[10px] font-semibold text-gray-600 align-middle uppercase tracking-wider whitespace-nowrap">
                              {tx.type === 'invoice' ? 'Invoice' : tx.type === 'payment' ? 'Payment' : 'Purchase Bill'}
                            </td>
                            <td className="px-3 py-1.5 text-[11px] font-medium text-blue-700 group-hover:text-blue-900 group-hover:underline underline-offset-2 align-middle">
                              <div className="flex items-center gap-1.5">
                                <span>{displayDesc}</span>
                                {tx.isVerified && (
                                  <span className="inline-flex items-center justify-center bg-emerald-500 text-white rounded-full w-[14px] h-[14px] shrink-0 shadow-sm" title="Verified Payment">
                                    <Check size={9} strokeWidth={4} />
                                  </span>
                                )}
                              </div>
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
                          <td colSpan={6} className="px-3 py-6 text-center text-xs text-gray-400 font-medium">
                            No transactions in window.
                          </td>
                        </tr>
                      )}

                      {/* ── TOTALS footer row ── */}
                      <tr className="border-t-2 border-gray-300 bg-gray-50">
                        <td className="px-3 py-2.5 text-[10px] text-gray-400 font-bold uppercase tracking-widest" colSpan={2}>Totals</td>
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
  );
}

