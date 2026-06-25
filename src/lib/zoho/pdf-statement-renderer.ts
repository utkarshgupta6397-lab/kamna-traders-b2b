export type Customer = {
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

export type Transaction = {
  id: string;
  type: 'invoice' | 'payment' | 'bill' | 'vendor_payment';
  date: string;
  datetime?: string;
  description: string;
  amount: number;
  netEffect: number;
  balanceAfter: number;
  isVerified?: boolean;
  zohoUrl?: string;
};

export type Telemetry = {
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

export type Statement = {
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

// ─── Formatting Helpers ──────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
}

function fmtBalance(n: number) {
  if (n === 0) return '\u20b90.00';
  const val = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  return n > 0 ? val : `-${val}`;
}

export function getOpeningBalancePresentation(n: number): { label: string; amount: string; isCredit: boolean } {
  if (n < 0) {
    return {
      label: 'Advance Balance',
      amount: fmt(n),
      isCredit: true,
    };
  }
  return {
    label: 'Opening Balance',
    amount: fmtBalance(n),
    isCredit: false,
  };
}

export function cleanDescription(desc: string, type: string): string {
  if (!desc) return desc;
  if (type === 'payment') {
    return desc.replace(/^payment\s*[-\u2013]\s*/i, '').trim();
  }
  if (type === 'invoice' || type === 'bill') {
    return desc.replace(/^(invoice|bill)\s+/i, '').trim();
  }
  if (type === 'vendor_payment') {
    return desc.replace(/^payment made\s*[-\u2013]\s*/i, '').trim();
  }
  return desc;
}

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

export function fmtDate(iso: string) {
  if (!iso) return '\u2014';
  const raw = parseRawDate(iso);
  if (raw) return `${raw.d} ${raw.m} ${raw.y}`;
  
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function pdfFmt(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
}

export function pdfFmtBalance(n: number): string {
  if (n === 0) return '₹0.00';
  const val = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  return n > 0 ? val : `-${val}`;
}

// ─── Font & Logo Caching ─────────────────────────────────────────────────────

let cachedFontRegular: string | null = null;
let cachedFontBold: string | null = null;
let cachedLogoColor: string | null = null;
let cachedLogoEconomy: string | null = null;

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

export async function getCachedAssets() {
  if (!cachedFontRegular) {
    try {
      const res = await fetch('/fonts/NotoSans-Regular.ttf?v=4');
      if (res.ok) cachedFontRegular = await toBase64(res);
    } catch (e) { console.warn('Failed to load NotoSans Regular font', e); }
  }

  if (!cachedFontBold) {
    try {
      const res = await fetch('/fonts/NotoSans-Bold.ttf?v=4');
      if (res.ok) cachedFontBold = await toBase64(res);
    } catch (e) { console.warn('Failed to load NotoSans Bold font', e); }
  }

  if (!cachedLogoEconomy) {
    cachedLogoEconomy = await loadLogo();
  }

  return {
    fontRegular: cachedFontRegular,
    fontBold: cachedFontBold,
    logo: cachedLogoEconomy
  };
}

async function loadLogo(): Promise<string | null> {
  try {
    const svgRes = await fetch('/logo.svg');
    const svgText = await svgRes.text();
    const whiteSvg = svgText;
      
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 387;
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
      return canvas.toDataURL('image/png');
    }
  } catch (e) {
    console.warn('Logo load failed', e);
  }
  return null;
}

// ─── PDF Renderer v4 — Finance Grade Professional ─────────────────────────────

export async function renderStatementToPdf(
  doc: any,       // jsPDF instance
  autoTable: any, // jspdf-autotable plugin
  s: Statement,
  options: {
    isExpanded: boolean;
    clipFromIndex: number | null;
    isBatchRecovery?: boolean;
    firmColors?: any;
    generatedBy?: string;
  }
) {
  // ─── Font Registration ────────────────────────────────────────────────────
  const { fontRegular, fontBold, logo } = await getCachedAssets();

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
      doc.addFileToVFS('NotoSans-Regular.ttf', fontRegular!);
      doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
    } catch (e) {
      console.error('Failed to register NotoSans-Regular.ttf', e);
    }
  } else {
    console.error('Invalid font payload detected for Regular font. Aborting registration to prevent fallback corruption.');
  }

  if (isValidBase64Font(fontBold)) {
    try {
      doc.addFileToVFS('NotoSans-Bold.ttf', fontBold!);
      doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
    } catch (e) {
      console.error('Failed to register NotoSans-Bold.ttf', e);
    }
  } else {
    console.error('Invalid font payload detected for Bold font. Aborting registration to prevent fallback corruption.');
  }

  const pdfFont = doc.getFontList()['NotoSans'] ? 'NotoSans' : 'helvetica';

  // Safe string width — falls back to char-count when font metrics aren't ready
  const safeWidth = (text: string, fontSize: number): number => {
    try {
      return doc.getStringUnitWidth(text) * fontSize / doc.internal.scaleFactor;
    } catch {
      return text.length * fontSize * 0.45 / doc.internal.scaleFactor;
    }
  };

  // ─── Page Geometry ────────────────────────────────────────────────────────
  const pageW  = doc.internal.pageSize.getWidth();
  const pageH  = doc.internal.pageSize.getHeight();
  const margin = 12;                    // 12 mm each side → 186 mm usable on A4
  const colW   = pageW - margin * 2;

  // ─── Colour Palette ───────────────────────────────────────────────────────
  const cNavy:  [number, number, number] = [26,  39,  102];
  const cSlate: [number, number, number] = [100, 116, 139];
  const cDark:  [number, number, number] = [15,  23,  42];
  const cRed:   [number, number, number] = [220, 38,  38];
  const cGreen: [number, number, number] = [5,   150, 105];

  // ─── Clip / Truncation ───────────────────────────────────────────────────
  let visibleTxs = s.transactions;
  let isTruncated = false;
  const isGroup = !!(s as any).isGroup;

  // ─── Financial Summaries ─────────────────────────────────────────────────
  const openingBal    = s.openingBalance;
  const openingPres   = getOpeningBalancePresentation(openingBal);
  const pdfOpeningAmt = pdfFmt(openingBal);
  const totalDebit    = visibleTxs
    .filter(t => t.type === 'invoice' || t.type === 'vendor_payment')
    .reduce((a, t) => a + Math.abs(t.netEffect), 0);
  const totalCredit   = visibleTxs
    .filter(t => t.type === 'payment' || t.type === 'bill')
    .reduce((a, t) => a + Math.abs(t.netEffect), 0);

  // ─── Y Cursor ────────────────────────────────────────────────────────────
  let currentY = 10;

  // ═════════════════════════════════════════════════════════════════════════
  // PAGE 1 HEADER — Single Customer Statement
  // ═════════════════════════════════════════════════════════════════════════
  if (!isGroup) {
    const logoH    = 10;
    const logoW    = logoH * (599 / 579);
    const logoY    = 8;
    const dividerY = logoY + 13;      // tighter: was +16

    // Logo
    if (logo) {
      doc.addImage(logo, 'PNG', margin, logoY, logoW, logoH);
    }

    // Left: Title block
    const titleX = margin + logoW + 4;
    doc.setFontSize(12);
    doc.setFont(pdfFont, 'bold');
    doc.setTextColor(...cDark);
    doc.text('Customer Statement', titleX, logoY + 5.5);

    doc.setFontSize(7.5);
    doc.setFont(pdfFont, 'normal');
    doc.setTextColor(...cSlate);
    doc.text('Kamna Traders \u00b7 Receivables Ledger', titleX, logoY + 9.5);

    // Right: Customer info block
    const rightX = pageW - margin;
    doc.setFontSize(10);
    doc.setFont(pdfFont, 'bold');
    doc.setTextColor(...cDark);
    let cName = s.customer.contactName || 'Customer';
    const maxRightWidth = (pageW - margin * 2) * 0.45;
    const fs10 = 10;
    if (safeWidth(cName, fs10) > maxRightWidth) {
      while (cName.length > 0 && safeWidth(cName + '...', fs10) > maxRightWidth) {
        cName = cName.slice(0, -1);
      }
      cName += '...';
    }
    doc.text(cName, rightX, logoY + 4, { align: 'right' });

    doc.setFontSize(7.5);
    doc.setFont(pdfFont, 'normal');
    doc.setTextColor(...cSlate);
    let infoY = logoY + 7.5;
    if (s.customer.gstNo) { 
      doc.text(`GST: ${s.customer.gstNo}`, rightX, infoY, { align: 'right' }); 
      infoY += 3.5; 
    }
    const rawMobile = s.customer.mobile;
    const hasValidPhone = rawMobile && rawMobile.trim() !== '' && rawMobile.trim() !== '0000000000';
    if (hasValidPhone && rawMobile) { 
      doc.text(`Ph: ${rawMobile.trim()}`, rightX, infoY, { align: 'right' }); 
      infoY += 3.5; 
    }

    // Navy divider line
    doc.setDrawColor(...cNavy);
    doc.setLineWidth(0.35);
    doc.line(margin, dividerY, pageW - margin, dividerY);

    currentY = dividerY + 2.5;

  } else {
    // ═══════════════════════════════════════════════════════════════════════
    // GROUP STATEMENT HEADER (unchanged)
    // ═══════════════════════════════════════════════════════════════════════
    const headerH = 24;
    const logoH   = 14;
    const logoW   = logoH * (599 / 579);
    const logoY   = 12;
    if (logo) {
      doc.addImage(logo, 'PNG', margin, logoY, logoW, logoH);
    }

    const titleX = logo ? margin + logoW + 6 : margin;
    const rightX = pageW - margin;

    doc.setTextColor(...cDark);
    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(14);
    doc.text('GROUP STATEMENT', titleX, logoY + 5);

    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...cSlate);
    doc.text('Kamna Traders \u00b7 Receivables Ledger', titleX, logoY + 10);
    doc.text('Combined Portfolio Statement', titleX, logoY + 14);

    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...cDark);
    doc.text('Combined Portfolio', rightX, logoY + 5, { align: 'right' });

    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...cSlate);
    doc.text(`Generated By: Kamna ERP System`, rightX, logoY + 10, { align: 'right' });

    doc.setDrawColor(...cNavy);
    doc.setLineWidth(0.3);
    doc.line(margin, headerH, pageW - margin, headerH);

    currentY = headerH + 8;

    // Included Firms
    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...cDark);
    doc.text('Included Firms', margin, currentY);
    currentY += 6;

    const groupFirms = (s as any).groupFirms || [];
    groupFirms.forEach((stmt: any, idx: number) => {
      const firmName = stmt.customer.companyName || stmt.customer.contactName || 'Unknown Firm';
      const gstin    = stmt.customer.gstNo || '\u2014';
      const bal      = stmt.closingBalance;
      const fc       = options.firmColors?.[stmt.customer.contactId] || { hex: [100,116,139] };

      doc.setFillColor(...fc.hex);
      doc.rect(margin, currentY - 3, 2, 8, 'F');

      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...cDark);
      doc.text(`${idx + 1}.  ${firmName}`, margin + 4, currentY);

      doc.setFont(pdfFont, 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...cSlate);
      doc.text(`GSTIN : ${gstin}`, margin + 4, currentY + 4);

      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(8);
      doc.setTextColor(
        bal > 0 ? cRed[0]   : bal < 0 ? cGreen[0] : cDark[0],
        bal > 0 ? cRed[1]   : bal < 0 ? cGreen[1] : cDark[1],
        bal > 0 ? cRed[2]   : bal < 0 ? cGreen[2] : cDark[2],
      );
      doc.text(pdfFmtBalance(bal), rightX, currentY + 2, { align: 'right' });

      doc.setFont(pdfFont, 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...cSlate);
      doc.text('Outstanding :', rightX - safeWidth(pdfFmtBalance(bal), 8) - 2, currentY + 2, { align: 'right' });

      currentY += 8;
      if (idx < groupFirms.length - 1) {
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(margin + 4, currentY, rightX, currentY);
        currentY += 5;
      } else {
        currentY += 3;
      }
      if (currentY > pageH - 40) { doc.addPage(); currentY = 15; }
    });

    currentY += 8;

    // Financial Portfolio (firm cards)
    if (currentY + 25 > pageH - margin) { doc.addPage(); currentY = margin; }

    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...cDark);
    doc.text('Financial Portfolio', margin, currentY);
    currentY += 6;

    const cardW = (colW - 8) / 2;
    let cardX = margin;
    let cardY = currentY;

    groupFirms.forEach((stmt: any, idx: number) => {
      if (idx % 2 === 0 && idx > 0) {
        cardX = margin;
        cardY += 24;
        if (cardY + 24 > pageH - margin) { doc.addPage(); cardY = margin; }
      } else if (idx % 2 !== 0) {
        cardX = margin + cardW + 8;
      }

      const firmName = stmt.customer.companyName || stmt.customer.contactName || 'Unknown Firm';
      const fc = options.firmColors?.[stmt.customer.contactId] || { hex: [100,116,139] };

      const fVisibleTxs = options.isExpanded ? stmt.transactions : stmt.transactions.slice(-12);
      const fInvoiced   = fVisibleTxs.filter((tx: any) => tx.type === 'invoice').reduce((a: number, t: any) => a + Math.abs(t.netEffect), 0);
      const fPaid       = fVisibleTxs.filter((tx: any) => tx.type === 'payment').reduce((a: number, t: any) => a + Math.abs(t.netEffect), 0);
      const fOpening    = fVisibleTxs.length > 0 ? (fVisibleTxs[0].balanceAfter - fVisibleTxs[0].netEffect) : stmt.closingBalance;
      const fClosing    = stmt.closingBalance;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(cardX, cardY, cardW, 20, 2, 2, 'FD');

      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...cDark);

      let truncName = firmName;
      if (safeWidth(truncName, 7.5) > cardW - 10) {
        while (truncName.length > 0 && safeWidth(truncName + '...', 7.5) > cardW - 10) {
          truncName = truncName.slice(0, -1);
        }
        truncName += '...';
      }

      doc.setFillColor(...fc.hex);
      doc.rect(cardX + 3, cardY + 4, 2, 2, 'F');
      doc.text(truncName, cardX + 7, cardY + 6);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(cardX + 3, cardY + 8, cardX + cardW - 3, cardY + 8);

      const mY = cardY + 11;
      doc.setFontSize(5.5);
      doc.setFont(pdfFont, 'normal');  doc.setTextColor(...cSlate); doc.text('Opening Balance', cardX + 3, mY);
      doc.setFont(pdfFont, 'normal');  doc.setTextColor(...cDark);  doc.text(pdfFmtBalance(fOpening), cardX + cardW/2 - 3, mY, { align: 'right' });
      doc.setFont(pdfFont, 'normal');  doc.setTextColor(...cSlate); doc.text('Total Paid', cardX + cardW/2 + 3, mY);
      doc.setFont(pdfFont, 'normal');  doc.setTextColor(...cGreen); doc.text(pdfFmt(fPaid), cardX + cardW - 3, mY, { align: 'right' });

      const mY2 = cardY + 16;
      doc.setFont(pdfFont, 'normal');  doc.setTextColor(...cSlate); doc.text('Total Invoiced', cardX + 3, mY2);
      doc.setFont(pdfFont, 'normal');  doc.setTextColor(...cDark);  doc.text(pdfFmt(fInvoiced), cardX + cardW/2 - 3, mY2, { align: 'right' });
      doc.setFont(pdfFont, 'bold');    doc.setTextColor(...cSlate); doc.text('Closing Balance', cardX + cardW/2 + 3, mY2);
      doc.setFont(pdfFont, 'bold');
      doc.setTextColor(
        fClosing > 0 ? cRed[0]   : fClosing < 0 ? cGreen[0] : cDark[0],
        fClosing > 0 ? cRed[1]   : fClosing < 0 ? cGreen[1] : cDark[1],
        fClosing > 0 ? cRed[2]   : fClosing < 0 ? cGreen[2] : cDark[2],
      );
      doc.text(pdfFmtBalance(fClosing), cardX + cardW - 3, mY2, { align: 'right' });
    });

    currentY = cardY + 28;
  }



  // ─── Table Headers ────────────────────────────────────────────────────────
  const tableHead = [
    isGroup
      ? ['Date', 'Firm', 'Type', 'Document & Details', 'Debit', 'Credit', 'Balance']
      : ['Date', 'Type', 'Details', 'Debit', 'Credit', 'Balance'],
  ];

  // Balance indicator — [OUT] for Receivable (Red) and [IN] for Payable/Credit (Green)
  function pdfFmtBalanceWithIndicator(balance: number) {
    if (balance > 0) return '[OUT] ' + pdfFmtBalance(balance); // Receivable by Kamna (customer owes us)
    if (balance < 0) return '[IN] '  + pdfFmtBalance(balance); // Payable by Kamna (customer has credit / we owe them)
    return pdfFmtBalance(balance);
  }

  // ─── Build Table Row Data ─────────────────────────────────────────────────
  const finalTableRows: any[] = [];
  const monthHeaderRowIndices = new Set<number>();

  // Opening balance row
  const openRow = isGroup ? [
    '\u2014', '\u2014', '\u2014',
    `Opening Balance${openingPres.isCredit ? ' (Advance/Credit)' : ''}`,
    '\u2014', '\u2014', pdfFmtBalanceWithIndicator(openingBal),
  ] : [
    '\u2014', '\u2014',
    `Opening Balance${openingPres.isCredit ? ' (Advance/Credit)' : ''}`,
    '\u2014', '\u2014', pdfFmtBalanceWithIndicator(openingBal),
  ];
  finalTableRows.push(openRow);

  let currentMonth    = '';

  const getMonthStr = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase();
  };

  // Precalculate monthly totals
  const monthTotalsMap = new Map<string, { debit: number; credit: number; balance: number }>();
  let runningBalForPrecalc = openingBal;
  visibleTxs.forEach((tx: any) => {
    const txMonth = getMonthStr(tx.date);
    if (!monthTotalsMap.has(txMonth)) {
      monthTotalsMap.set(txMonth, { debit: 0, credit: 0, balance: 0 });
    }
    const current = monthTotalsMap.get(txMonth)!;
    if (tx.netEffect > 0) current.debit += Math.abs(tx.netEffect);
    else if (tx.netEffect < 0) current.credit += Math.abs(tx.netEffect);
    runningBalForPrecalc = tx.balanceAfter;
  });

  visibleTxs.forEach((tx: any, i: number) => {
    const txMonth = getMonthStr(tx.date);

    // ── Month header row ───────────────────────────────────────────────────
    if (currentMonth !== txMonth) {
      currentMonth = txMonth;
      const totals = monthTotalsMap.get(txMonth) || { debit: 0, credit: 0, balance: 0 };
      const monthlyNet = totals.debit - totals.credit;
      monthHeaderRowIndices.add(finalTableRows.length);
      finalTableRows.push(isGroup ? [
        {
          content: currentMonth,
          colSpan: 4,
          styles: {
            fillColor:   [241, 245, 249],
            textColor:   [26, 39, 102],
            fontStyle:   'bold',
            halign:      'left',
            fontSize:    7,
            cellPadding: { top: 1.3, bottom: 1.3, left: 3, right: 1 },
          },
        },
        { content: pdfFmt(totals.debit), styles: { fontStyle: 'bold', textColor: [15, 23, 42], fillColor: [241, 245, 249], fontSize: 7, cellPadding: { top: 1.3, bottom: 1.3 } } },
        { content: pdfFmt(totals.credit), styles: { fontStyle: 'bold', textColor: [5, 150, 105], fillColor: [241, 245, 249], fontSize: 7, cellPadding: { top: 1.3, bottom: 1.3 } } },
        { content: pdfFmtBalanceWithIndicator(monthlyNet), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], fontSize: 7, cellPadding: { top: 1.3, bottom: 1.3 } } },
      ] : [
        {
          content: currentMonth,
          colSpan: 3,
          styles: {
            fillColor:   [241, 245, 249],
            textColor:   [26, 39, 102],
            fontStyle:   'bold',
            halign:      'left',
            fontSize:    7,
            cellPadding: { top: 1.3, bottom: 1.3, left: 3, right: 1 },
          },
        },
        { content: pdfFmt(totals.debit), styles: { fontStyle: 'bold', textColor: [15, 23, 42], fillColor: [241, 245, 249], fontSize: 7, cellPadding: { top: 1.3, bottom: 1.3 } } },
        { content: pdfFmt(totals.credit), styles: { fontStyle: 'bold', textColor: [5, 150, 105], fillColor: [241, 245, 249], fontSize: 7, cellPadding: { top: 1.3, bottom: 1.3 } } },
        { content: pdfFmtBalanceWithIndicator(monthlyNet), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], fontSize: 7, cellPadding: { top: 1.3, bottom: 1.3 } } },
      ]);
    }

    // ── Transaction type label ─────────────────────────────────────────────
    const typeLabel =
      tx.type === 'invoice'        ? 'Invoice'      :
      tx.type === 'payment'        ? 'Payment'      :
      tx.type === 'vendor_payment' ? 'Payment Made' :
      tx.type === 'journal'        ? 'Journal'      : 'Bill';

    const displayDesc = cleanDescription(tx.description, tx.type);
    let primary   = tx.type === 'journal' ? (tx.entryNumber || 'Journal') : (tx.referenceNumber || displayDesc);
    let secondary = primary !== displayDesc ? displayDesc : (tx.notes || '');

    // Smart description cleanup — strip redundant category words
    if (tx.type === 'payment') {
      secondary = secondary.replace(/Bank Transfer Payment/ig, '').trim();
      secondary = secondary.replace(/Payment received/ig, '').trim();
    } else if (tx.type === 'vendor_payment') {
      secondary = secondary.replace(/Payment made/ig, '').trim();
    } else if (tx.type === 'invoice') {
      secondary = secondary.replace(/Sales Invoice/ig, '').trim();
    } else if (tx.type === 'bill') {
      secondary = secondary.replace(/Purchase Bill/ig, '').trim();
    }

    const descObj = {
      content:    secondary ? `${primary}\n${secondary}` : primary,
      _primary:   primary,
      _secondary: secondary,
      _type:      tx.type,
    };

    // Transaction row
    if (isGroup) {
      finalTableRows.push([
        fmtDate(tx.date),
        tx.firmName || '\u2014',
        typeLabel,
        descObj,
        tx.netEffect >  0 ? pdfFmt(tx.amount) : '\u2014',
        tx.netEffect <= 0 ? pdfFmt(tx.amount) : '\u2014',
        pdfFmtBalanceWithIndicator(tx.balanceAfter),
      ]);
    } else {
      finalTableRows.push([
        fmtDate(tx.date),
        typeLabel,
        descObj,
        tx.netEffect >  0 ? pdfFmt(tx.amount) : '\u2014',
        tx.netEffect <= 0 ? pdfFmt(tx.amount) : '\u2014',
        pdfFmtBalanceWithIndicator(tx.balanceAfter),
      ]);
    }
  });

  // Grand Totals row
  const totalsRow = isGroup ? [
    '', '', '', 'GRAND TOTALS',
    pdfFmt(totalDebit),
    pdfFmt(totalCredit),
    pdfFmtBalanceWithIndicator(s.closingBalance),
  ] : [
    '', '', 'GRAND TOTALS',
    pdfFmt(totalDebit),
    pdfFmt(totalCredit),
    pdfFmtBalanceWithIndicator(s.closingBalance),
  ];
  finalTableRows.push(totalsRow);

  // ─── Smart Pagination ─────────────────────────────────────────────────────
  let rowsPerPage = 20;
  if (!isGroup) {
    const totalTx = finalTableRows.length;
    if (totalTx > 0) {
      const pagesNeeded = Math.ceil(totalTx / rowsPerPage);
      if (pagesNeeded > 1) {
        rowsPerPage = Math.ceil(totalTx / pagesNeeded);
      }
    }
  }

  // ─── autoTable ────────────────────────────────────────────────────────────
  // Column width budget (A4: 210mm, margin 12 each = 186mm usable):
  //   Non-group: 16+13+70+24+24+26 = 173   (autotable distributes ~13mm remainder to details)
  //   Group:     16+24+13+60+22+22+24 = 181
  const rowColorsMap = new Map<number, [number, number, number] | null>();

  autoTable(doc, {
    startY: currentY + 3,
    head:   tableHead,
    body:   finalTableRows,
    theme:  'plain',           // ← no grid; we draw only what's needed
    showHead: 'everyPage',
    rowPageBreak: 'avoid',

    headStyles: {
      fillColor:   [255, 255, 255],
      textColor:   cDark,
      fontStyle:   'normal',
      fontSize:    7,
      cellPadding: { top: 1.5, bottom: 1.8, left: 1.0, right: 1.0 },
      lineWidth:   { bottom: 0.4 },   // only header underline — no grid
      lineColor:   [15, 23, 42],
    },

    bodyStyles: { fontSize: 6.5, textColor: [51, 65, 85], font: pdfFont },

    columnStyles: isGroup ? {
      0: { cellWidth: 16, overflow: 'visible' },
      1: { cellWidth: 24, overflow: 'linebreak' },
      2: { cellWidth: 13, overflow: 'linebreak' },
      3: { cellWidth: 60, overflow: 'ellipsize' },
      4: { halign: 'right', cellWidth: 22, fontSize: 6.5, overflow: 'visible' },
      5: { halign: 'right', cellWidth: 22, textColor: [5, 150, 105], fontSize: 6.5, overflow: 'visible' },
      6: { halign: 'right', cellWidth: 24, fontSize: 6.5, overflow: 'visible' },
    } : {
      0: { cellWidth: 16, overflow: 'visible' },
      1: { cellWidth: 13, overflow: 'linebreak' },
      2: { cellWidth: 70, overflow: 'ellipsize' },      // max space for details
      3: { halign: 'right', cellWidth: 24, fontSize: 6.5, overflow: 'visible' },
      4: { halign: 'right', cellWidth: 24, textColor: [5, 150, 105], fontSize: 6.5, overflow: 'visible' },
      5: { halign: 'right', cellWidth: 26, fontSize: 6.5, overflow: 'visible' },
    },

    styles: {
      cellPadding: { top: 1.2, bottom: 1.2, left: 1.0, right: 1.0 },
      font:        pdfFont,
      lineWidth:   0,               // no borders by default
      lineColor:   [226, 232, 240],
    },

    margin: { top: 18, left: margin, right: margin, bottom: 28 },

    // ── willDrawCell ─────────────────────────────────────────────────────
    willDrawCell: (data: any) => {
      const descColIdx = isGroup ? 3 : 2;
      // Suppress autoTable text for details col; we render manually in didDrawCell
      if (data.section === 'body' && data.column.index === descColIdx && data.cell.raw && data.cell.raw._primary) {
        data.cell.text = [];
      }
    },

    // ── didDrawPage ──────────────────────────────────────────────────────
    didDrawPage: (data: any) => {
      if (data.pageNumber > 1 && !isGroup) {
        const hLogoH = 7;
        const hLogoW = hLogoH * (599 / 579);
        if (logo) {
          doc.addImage(logo, 'PNG', margin, 6, hLogoW, hLogoH);
        }
        const rightX = pageW - margin;
        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(s.customer.contactName || 'Customer', rightX, 10, { align: 'right' });

        doc.setFontSize(6.5);
        doc.setFont(pdfFont, 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text('Customer Statement (Cont.)', rightX, 13.5, { align: 'right' });

        doc.setDrawColor(220, 226, 236);
        doc.setLineWidth(0.25);
        doc.line(margin, 16.5, pageW - margin, 16.5);
      }
    },

    // ── didParseCell ─────────────────────────────────────────────────────
    didParseCell: (data: any) => {
      // Pagination trigger
      if (!isGroup && data.section === 'body' && data.row.index > 0 && data.row.index < finalTableRows.length) {
        if (data.row.index % rowsPerPage === 0) {
          data.row.pageBreak = 'always';
        }
      }

      if (data.section === 'body') {
        const isFirst      = data.row.index === 0;
        const isLast       = data.row.index === finalTableRows.length - 1;
        const isMonthHeader = monthHeaderRowIndices.has(data.row.index);

        const invColIdx = isGroup ? 4 : 3;
        const pmtColIdx = isGroup ? 5 : 4;
        const balColIdx = isGroup ? 6 : 5;

        // ── Alternating row shading for normal transaction rows ────────
        if (!isFirst && !isLast && !isMonthHeader) {
          if (!rowColorsMap.has(data.row.index)) {
            const txRowsBefore = Array.from({ length: data.row.index }, (_, idx) => idx)
              .filter(idx => idx > 0 && !monthHeaderRowIndices.has(idx)).length;
            const color: [number, number, number] | null = txRowsBefore % 2 === 1 ? [250, 250, 250] : null;
            rowColorsMap.set(data.row.index, color);
          }
          const fill = rowColorsMap.get(data.row.index);
          if (fill) {
            data.cell.styles.fillColor = fill;
          }
        }

        // ── Opening balance row: subtle blue tint ──────────────────────
        if (isFirst) {
          data.cell.styles.fillColor = [245, 250, 255];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [26, 39, 102];
        }

        // ── Monthly header/total rows: light grey ──────────────────────
        if (isMonthHeader) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [26, 39, 102];
          data.cell.styles.fontSize  = 7;
          if (data.column.index === invColIdx) data.cell.styles.textColor = [15, 23, 42];
          if (data.column.index === pmtColIdx) data.cell.styles.textColor = [5, 150, 105];
        }

        // ── Grand totals row: navy top border, larger font ─────────────
        if (isLast) {
          data.cell.styles.fillColor = [255, 255, 255];
          data.cell.styles.lineWidth = { top: 0.5 };
          data.cell.styles.lineColor = [26, 39, 102];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize  = 7.5;
          data.cell.styles.textColor = [15, 23, 42];
          if (data.column.index === invColIdx) data.cell.styles.textColor = [15, 23, 42];
          if (data.column.index === pmtColIdx) data.cell.styles.textColor = [5, 150, 105];
          if (data.column.index === balColIdx) {
            data.cell.styles.textColor = s.closingBalance > 0 ? [220, 38, 38]
              : s.closingBalance < 0  ? [5, 150, 105] : [15, 23, 42];
            data.cell.styles.fontSize  = 8.5;
          }
        }

        // ── Group firm name bracketing ─────────────────────────────────
        if (isGroup && data.column.index === 1 && !isFirst && !isLast) {
          if (data.cell.text && data.cell.text.length > 0) {
            data.cell.text[0] = `[${data.cell.text[0]}]`;
          }
          data.cell.styles.cellPadding = { top: 3.5, bottom: 3.5, left: 4.5, right: 1.5 };
          data.cell.styles.textColor   = [51, 65, 85];
        }

      // Balance column: strip [IN]/[OUT] flags, colour, tag for arrows
      if (data.column.index === balColIdx) {
        const strVal = Array.isArray(data.cell.text)
          ? data.cell.text.join('')
          : String(data.cell.text ?? '');

        // Draw indicator on normal transactions, month summaries, grand totals, and opening balance
        const drawIndicator = true;

        if (strVal.includes('[IN]')) {
          data.cell.styles.textColor = [5, 150, 105];
          if (data.cell.raw && typeof data.cell.raw !== 'object') {
            data.cell.raw = { _content: strVal.replace('[IN] ', ''), _indicator: drawIndicator ? 'IN' : undefined };
          } else if (data.cell.raw) {
            data.cell.raw._indicator = drawIndicator ? 'IN' : undefined;
          }
          data.cell.text = [strVal.replace('[IN] ', '')];

        } else if (strVal.includes('[OUT]')) {
          data.cell.styles.textColor = [220, 38, 38];
          if (data.cell.raw && typeof data.cell.raw !== 'object') {
            data.cell.raw = { _content: strVal.replace('[OUT] ', ''), _indicator: drawIndicator ? 'OUT' : undefined };
          } else if (data.cell.raw) {
            data.cell.raw._indicator = drawIndicator ? 'OUT' : undefined;
          }
          data.cell.text = [strVal.replace('[OUT] ', '')];

        } else {
          data.cell.styles.textColor = [15, 23, 42];
        }
      }
    }
  },

  // ── didDrawCell ──────────────────────────────────────────────────────
  didDrawCell: (data: any) => {
    const descColIdx = isGroup ? 3 : 2;

    // Two-tier typography for Details column
    if (data.section === 'body' && data.column.index === descColIdx && data.cell.raw && data.cell.raw._primary) {
      const { _primary, _secondary } = data.cell.raw;
      const x = data.cell.x + data.cell.padding('left');
      const y = data.cell.y + data.cell.padding('top') + 2;

      const maxW = data.cell.width - data.cell.padding('left') - data.cell.padding('right');
      const truncateText = (txt: string, fSize: number, availW: number): string => {
        if (safeWidth(txt, fSize) <= availW) return txt;
        let temp = txt;
        while (temp.length > 0 && safeWidth(temp + '...', fSize) > availW) {
          temp = temp.slice(0, -1);
        }
        return temp + '...';
      };

      const primTrunc = truncateText(_primary, 6.5, maxW);
      doc.setFont(pdfFont, 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(15, 23, 42);
      doc.text(primTrunc, x, y);

      if (_secondary) {
        const secTrunc = truncateText(_secondary, 5.5, maxW);
        doc.setFont(pdfFont, 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(100, 116, 139);
        doc.text(secTrunc, x, y + 3.5);
      }
    }

    // Balance directional arrows
    const balColIdx = isGroup ? 6 : 5;
    if (data.section === 'body' && data.column.index === balColIdx && data.cell.raw && data.cell.raw._indicator) {
      const ind = data.cell.raw._indicator as string | undefined;
      if (!ind) return;

      const cx = data.cell.x + 1.8;
      const cy = data.cell.y + data.cell.height / 2;

      doc.setLineWidth(0.25);
      if (ind === 'OUT') {
        // Down-left corner arrow — Receivable (Red)
        doc.setDrawColor(220, 38, 38);
        doc.line(cx + 1.4, cy - 0.8, cx,       cy + 0.6);
        doc.line(cx,       cy + 0.6, cx + 1.1,  cy + 0.6);
        doc.line(cx,       cy + 0.6, cx,        cy - 0.6);
      } else if (ind === 'IN') {
        // Up-right corner arrow — Payable/Credit (Green)
        doc.setDrawColor(5, 150, 105);
        doc.line(cx,       cy + 0.6, cx + 1.4, cy - 0.8);
        doc.line(cx + 1.4, cy - 0.8, cx + 0.3, cy - 0.8);
        doc.line(cx + 1.4, cy - 0.8, cx + 1.4, cy + 0.4);
      }
    }
  },
  });

  // ─── Footer ───────────────────────────────────────────────────────────────
  const closingBal    = s.closingBalance;
  const finalTableY   = doc.lastAutoTable?.finalY ?? 96;
  const footerHeight  = 28;
  const spaceRequired = footerHeight + 6;

  if (finalTableY + spaceRequired > pageH && !options.isBatchRecovery) {
    doc.addPage();
  }

  const footerY = pageH - margin - footerHeight;

  // Footer separator
  doc.setDrawColor(...cSlate);
  doc.setLineWidth(0.25);
  doc.line(margin, footerY, pageW - margin, footerY);

  const generatedAt = new Date().toLocaleString('en-IN', {
    timeZone:  'Asia/Kolkata',
    day:       'numeric',
    month:     'short',
    year:      'numeric',
    hour:      'numeric',
    minute:    '2-digit',
    hour12:    true,
  });

  const qrPadding = 8;
  const boxW = 46;
  const maxFooterTextW = closingBal > 0 ? (pageW - margin * 2 - boxW - qrPadding) : (pageW - margin * 2);

  const creatorName = options.generatedBy || (options.isBatchRecovery ? 'Admin' : 'Staff');
  const footerLine1 = `Generated By: ${creatorName}   \u00b7   Generated At: ${generatedAt}`;
  const footerLine2 = 'Confidential \u2014 Kamna Traders B2B   \u00b7   Authorised Signatory: ________________________';

  doc.setFont(pdfFont, 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...cSlate);

  const splitLine1: string[] = doc.splitTextToSize(footerLine1, maxFooterTextW);
  const splitLine2: string[] = doc.splitTextToSize(footerLine2, maxFooterTextW);

  let footerTextY = footerY + 5;
  splitLine1.forEach((line: string) => {
    doc.text(line, margin, footerTextY);
    footerTextY += 3.5;
  });

  splitLine2.forEach((line: string) => {
    doc.text(line, margin, footerTextY);
    footerTextY += 3.5;
  });

  if (isTruncated && options.isBatchRecovery) {
    const trunNote = 'Showing latest transactions only. Complete statement available in Customer Statement module.';
    const splitTrun: string[] = doc.splitTextToSize(trunNote, maxFooterTextW);
    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...cSlate);
    splitTrun.forEach((line: string) => {
      doc.text(line, margin, footerTextY);
      footerTextY += 3.0;
    });
  }

  // ─── UPI / QR (when amount is outstanding / Receivable) ──────────────────
  const UPI_ID = 'ibkPOS.EP208232@icici';
  if (closingBal > 0) {
    const customerForRemarks = s.customer.contactName || s.customer.companyName || 'Customer';
    const remarks     = `${customerForRemarks} Balance`;
    const amountParam = closingBal < 100000 ? `&am=${closingBal.toFixed(2)}` : '';
    const upiUrl      = `upi://pay?pa=${UPI_ID}&pn=Kamna+Traders&tn=${encodeURIComponent(remarks)}${amountParam}&cu=INR`;

    let qrDataUrl: string | null = null;
    try {
      const QRCode = (await import('qrcode')).default;
      qrDataUrl = await QRCode.toDataURL(upiUrl, { margin: 1, width: 200, errorCorrectionLevel: 'M' });
    } catch (err) {
      console.warn('[PDF] QR generation failed', err);
    }

    const qrSize = 12;
    const boxW   = 46;
    const boxH   = footerHeight - 3;
    const boxX   = pageW - margin - boxW;
    const boxY   = footerY + 1.5;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(210, 218, 228);
    doc.setLineWidth(0.2);
    doc.rect(boxX, boxY, boxW, boxH, 'FD');

    const centerX = boxX + boxW / 2;

    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(...cSlate);
    doc.text('AMOUNT DUE', centerX, boxY + 4, { align: 'center' });

    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...cRed);
    doc.text(pdfFmtBalance(closingBal), centerX, boxY + 8.5, { align: 'center' });

    if (qrDataUrl) {
      doc.addImage(qrDataUrl, 'PNG', centerX - qrSize / 2, boxY + 11, qrSize, qrSize);
    }

    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...cSlate);
    doc.text(UPI_ID, centerX, boxY + boxH - 1, { align: 'center' });
  }

  // ─── Global Page Numbering ───────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(6.0);
    doc.setTextColor(100, 116, 139);
    const pageNumText = `Page ${i} of ${totalPages}`;
    const pageNumY = pageH - margin - 2;
    doc.text(pageNumText, pageW - margin, pageNumY, { align: 'right' });
  }
}
