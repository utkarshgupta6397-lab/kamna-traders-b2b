/**
 * Shared Recovery Queue Report Generator (PDF)
 * Kamna Traders ERP | Accounts Module
 *
 * Authoritative batch PDF report generator extracted from the original Recovery Queue sidebar
 * in AccountsSummaryView.tsx.
 *
 * Produces:
 * 1. Cover Page 1: Portfolio Recovery Report & Executive KPI Cards
 * 2. Cover Page 2: Customer Summary Index with dynamically calculated Statement Page numbers
 * 3. Subsequent Pages: Complete, finance-grade Customer Statement for each customer in the filtered queue
 * 4. Header/Footer: Global pagination ("Page X of Y"), company logo, and official metadata.
 * 5. Filename: `Recovery Statements - <date>.pdf`
 */

import { renderStatementToPdf, getCachedAssets } from '@/lib/zoho/pdf-statement-renderer';
import toast from 'react-hot-toast';

export interface BatchRecoveryCustomerInput {
  customerId: string;
  customerName: string;
  totalOutstanding: number;
  invoiceCount?: number;
  oldestDue?: number;
  invoices: Array<{
    task?: {
      invoiceId?: string;
      invoiceNumber?: string;
      flaggedByName?: string | null;
      flaggedAt?: string | null;
      lastSyncedAt?: string | null;
      lastKnownPendingAmount?: number | null;
      [key: string]: any;
    } | null;
    inv?: {
      invoiceId?: string;
      invoiceNumber?: string;
      invoiceValue?: number;
      amountPaid?: number;
      amountPending?: number;
      paymentStatus?: string;
      isOverdue?: boolean;
      overdueDays?: number;
      [key: string]: any;
    } | null;
    pending: number;
    ageDays: number;
    invoiceDate: string;
  }>;
}

export interface BatchPdfProgress {
  current: number;
  total: number;
  failures: string[];
}

export interface GenerateRecoveryReportOptions {
  refreshedBy?: string;
  onProgress?: (progress: BatchPdfProgress) => void;
  onComplete?: () => void;
}

/**
 * Generate and trigger download of the Portfolio Recovery Report PDF
 * Reused by both the AccountsSummaryView sidebar and dedicated RecoveryQueueWorkspace
 */
export async function generateRecoveryReportPdf(
  customers: BatchRecoveryCustomerInput[],
  options: GenerateRecoveryReportOptions = {}
): Promise<{ success: boolean; total: number; generated: number; failed: number; failures: string[] }> {
  if (!customers || customers.length === 0) {
    toast.error('No customers available to generate report');
    return { success: false, total: 0, generated: 0, failed: 0, failures: [] };
  }

  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;

  // 1. Load assets
  const { fontRegular, fontBold, logo } = await getCachedAssets();

  const isValidBase64Font = (b64: string | null) => {
    if (!b64 || b64.length < 1000) return false;
    try {
      const decoded =
        typeof window !== 'undefined'
          ? atob(b64.slice(0, 1000))
          : Buffer.from(b64.slice(0, 1000), 'base64').toString('ascii');
      return !decoded.toLowerCase().includes('<!doctype') && !decoded.toLowerCase().includes('<html');
    } catch {
      return true;
    }
  };

  const applyFonts = (d: any) => {
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

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n);

  // Calculate how many pages the Index will take using a temporary document
  const tempDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pdfFontTemp = applyFonts(tempDoc);

  const indexBody = customers.map((c, i) => [
    (i + 1).toString(),
    c.customerName,
    (c.invoiceCount ?? c.invoices.length).toString(),
    fmtCurrency(c.totalOutstanding),
    c.oldestDue ? `${c.oldestDue} Days` : '—',
    '...', // Placeholder
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
      5: { halign: 'center', cellWidth: 25 },
    },
    margin: { top: 25, right: margin, bottom: 25, left: margin },
  });
  const indexPagesCount =
    (tempDoc as any).internal.getNumberOfPages() || (tempDoc as any).getNumberOfPages();
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
  const generatedTimestamp = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  doc.text(`Generated: ${generatedTimestamp} | By: ${options.refreshedBy || 'Admin'}`, titleX, 27);

  // Thin blue divider
  doc.setDrawColor(...cBlue);
  doc.setLineWidth(0.5);
  doc.line(margin, headerH + 5, pageWidth - margin, headerH + 5);

  // Calculate batch metrics from the exact dataset being exported
  const batchTotalCustomers = customers.length;
  let batchTotalInvoices = 0;
  let batchTotalOutstanding = 0;
  let batchTotalInvoiced = 0;
  let batchTotalPaid = 0;
  let batchOverdueInvoices = 0;
  let batchVoidedInvoices = 0;

  customers.forEach((c) => {
    batchTotalInvoices += c.invoices.length;
    batchTotalOutstanding += c.totalOutstanding;
    c.invoices.forEach((i) => {
      const inv = i.inv;
      const pending = i.pending;
      const value = inv ? (inv.invoiceValue ?? pending) : pending;
      const paid = inv ? (inv.amountPaid ?? 0) : 0;

      batchTotalInvoiced += value;
      batchTotalPaid += paid;

      const isOverdue = inv ? Boolean((inv as any).isOverdue) : i.ageDays > 7;
      if (isOverdue) {
        batchOverdueInvoices++;
      }
      if ((inv as any)?.paymentStatus === 'void') {
        batchVoidedInvoices++;
      }
    });
  });

  const batchCollectionPct =
    batchTotalInvoiced > 0 ? Math.round((batchTotalPaid / batchTotalInvoiced) * 100) : 0;
  const batchAvgOutstanding = batchTotalOutstanding / (batchTotalCustomers || 1);
  const batchFullyPaidCustomers = customers.filter((c) => c.totalOutstanding === 0).length;
  const batchOpenCustomers = customers.filter((c) => c.totalOutstanding > 0).length;

  let highestExposureCustomer = customers[0];
  customers.forEach((c) => {
    if (!highestExposureCustomer || c.totalOutstanding > highestExposureCustomer.totalOutstanding) {
      highestExposureCustomer = c;
    }
  });
  const oldestDue = customers.reduce(
    (oldest: number, c) => Math.max(oldest, c.oldestDue || 0),
    0
  );

  let startY = headerH + 15;
  doc.setTextColor(...cDark);
  doc.setFont(pdfFont, 'bold');
  doc.setFontSize(12);
  doc.text('Key Performance Indicators', margin, startY);

  startY += 8;

  const drawKpiCard = (
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    value: string,
    valColor: [number, number, number]
  ) => {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, w, h, 1, 1, 'F'); // Fill only, no border outline

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
  drawKpiCard(margin, startY, cardW, cardH, 'Total Customers', batchTotalCustomers.toString(), cDark);
  drawKpiCard(margin + cardW + 8, startY, cardW, cardH, 'Total Invoices', batchTotalInvoices.toString(), cDark);
  drawKpiCard(margin + (cardW + 8) * 2, startY, cardW, cardH, 'Total Outstanding', fmtCurrency(batchTotalOutstanding), cRed);

  // Row 2
  startY += cardH + 4;
  drawKpiCard(margin, startY, cardW, cardH, 'Total Invoiced', fmtCurrency(batchTotalInvoiced), cDark);
  drawKpiCard(margin + cardW + 8, startY, cardW, cardH, 'Total Paid', fmtCurrency(batchTotalPaid), cGreen);
  drawKpiCard(margin + (cardW + 8) * 2, startY, cardW, cardH, 'Collection Efficiency', `${batchCollectionPct}%`, cBlue);

  // Row 3
  startY += cardH + 4;
  drawKpiCard(margin, startY, cardW, cardH, 'Average Outstanding', fmtCurrency(batchAvgOutstanding), cDark);
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
      ['Fully Paid Customers', batchFullyPaidCustomers.toString(), 'Healthy'],
      ['Open Customers', batchOpenCustomers.toString(), 'Requires Follow-up'],
      ['Overdue Invoices', batchOverdueInvoices.toString(), 'Critical'],
      ['Voided Invoices', batchVoidedInvoices.toString(), '—'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: cDark, fontSize: 8, font: pdfFont },
    bodyStyles: { fontSize: 8, font: pdfFont },
    margin: { left: margin, right: margin },
  });

  // --- COVER PAGE 2: Customer Summary (Index) ---
  doc.addPage();

  doc.setTextColor(...cDark);
  doc.setFont(pdfFont, 'bold');
  doc.setFontSize(14);
  doc.text('Customer Summary Index', margin, 20);

  // Calculate real statement pages
  let currentStatementPage = totalCoverPages + 1;
  const realIndexBody = customers.map((c, i) => {
    const row = [
      (i + 1).toString(),
      c.customerName,
      (c.invoiceCount ?? c.invoices.length).toString(),
      fmtCurrency(c.totalOutstanding),
      c.oldestDue ? `${c.oldestDue} Days` : '—',
      currentStatementPage.toString(),
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
      5: { halign: 'center', cellWidth: 25 },
    },
    margin: { top: 25, right: margin, bottom: 25, left: margin },
  });

  // Render the actual statements
  const failures: string[] = [];
  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    options.onProgress?.({ current: i + 1, total: customers.length, failures });

    try {
      const res = await fetch(
        `/api/admin/customer-statement/statement?customerId=${encodeURIComponent(customer.customerId)}`
      );
      const json = await res.json();
      if (!json.success || !json.data) throw new Error(json.error || 'Failed to fetch statement');

      doc.addPage();

      await renderStatementToPdf(doc, autoTable, json.data, {
        isExpanded: true,
        clipFromIndex: null,
        isBatchRecovery: true,
      });
    } catch (e: any) {
      console.error(`Batch PDF failed for ${customer.customerName}`, e);
      failures.push(customer.customerName);
      options.onProgress?.({ current: i + 1, total: customers.length, failures });
    }
  }

  // Global Print Optimizations: Page Numbers
  const totalPages = (doc as any).internal.getNumberOfPages() || (doc as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Page X of Y footer
    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 12, { align: 'center' });
  }

  const dateStr = new Date()
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/ /g, ' ');
  doc.save(`Recovery Statements - ${dateStr}.pdf`);

  options.onComplete?.();

  const successCount = customers.length - failures.length;
  toast.success(
    `Recovery Statements Generated. ${successCount} successful, ${failures.length} failed.`,
    { id: 'batch-pdf' }
  );

  return {
    success: true,
    total: customers.length,
    generated: successCount,
    failed: failures.length,
    failures,
  };
}
