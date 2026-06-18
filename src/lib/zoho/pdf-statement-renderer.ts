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
  if (n === 0) return '₹0.00';
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
    return desc.replace(/^payment\s*[-–]\s*/i, '').trim();
  }
  if (type === 'invoice' || type === 'bill') {
    return desc.replace(/^(invoice|bill)\s+/i, '').trim();
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
  if (!iso) return '—';
  const raw = parseRawDate(iso);
  if (raw) return `${raw.d} ${raw.m} ${raw.y}`;
  
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function pdfFmt(n: number): string {
  return '\u20b9' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
}

export function pdfFmtBalance(n: number): string {
  if (n === 0) return '\u20b90.00';
  const val = '\u20b9' + new Intl.NumberFormat('en-IN', {
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

export async function getCachedAssets(theme: 'color' | 'economy') {
  if (!cachedFontRegular) {
    try {
      const res = await fetch('/fonts/NotoSans-Regular.ttf?v=3');
      if (res.ok) cachedFontRegular = await toBase64(res);
    } catch (e) { console.warn('Failed to load Regular font', e); }
  }

  if (!cachedFontBold) {
    try {
      const res = await fetch('/fonts/NotoSans-Bold.ttf?v=3');
      if (res.ok) cachedFontBold = await toBase64(res);
    } catch (e) { console.warn('Failed to load Bold font', e); }
  }

  if (theme === 'color' && !cachedLogoColor) {
    cachedLogoColor = await loadLogo(theme);
  } else if (theme === 'economy' && !cachedLogoEconomy) {
    cachedLogoEconomy = await loadLogo(theme);
  }

  return {
    fontRegular: cachedFontRegular,
    fontBold: cachedFontBold,
    logo: theme === 'color' ? cachedLogoColor : cachedLogoEconomy
  };
}

async function loadLogo(theme: 'color' | 'economy'): Promise<string | null> {
  try {
    const svgRes = await fetch('/logo.svg');
    const svgText = await svgRes.text();
    const whiteSvg = theme === 'economy' ? svgText : svgText
      .replace(/#1A2766/gi, '#FFFFFF')
      .replace(/#003347/gi, '#FFFFFF')
      .replace(/#AE1B1E/gi, '#FFFFFF');
      
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

// ─── PDF Renderer ────────────────────────────────────────────────────────────

export async function renderStatementToPdf(
  doc: any, // jsPDF instance
  autoTable: any, // jspdf-autotable instance
  s: Statement,
  theme: 'color' | 'economy',
  options: {
    isExpanded: boolean;
    clipFromIndex: number | null;
    isBatchRecovery?: boolean;
    firmColors?: any;
  }
) {
  const { fontRegular, fontBold, logo } = await getCachedAssets(theme);

  if (fontRegular && !fontRegular.startsWith('PCF') && !fontRegular.includes('<!DOCTYPE')) {
    doc.addFileToVFS('NotoSans-Regular.ttf', fontRegular);
    doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
  }
  if (fontBold && !fontBold.startsWith('PCF') && !fontBold.includes('<!DOCTYPE')) {
    doc.addFileToVFS('NotoSans-Bold.ttf', fontBold);
    doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
  }

  const pdfFont = doc.getFontList()['NotoSans'] ? 'NotoSans' : 'helvetica';

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const colW = pageW - margin * 2;

  const cNavy: [number, number, number]   = [26,  39, 102];
  const cSlate: [number, number, number]  = [100, 116, 139];
  const cDark: [number, number, number]   = [15,  23,  42];
  const cRed: [number, number, number]    = [220, 38,  38];
  const cGreen: [number, number, number]  = [5,  150, 105];

  const clipIdx = options.clipFromIndex !== null ? options.clipFromIndex : -1;
  const activeTxs = clipIdx !== -1 ? s.transactions.slice(clipIdx) : s.transactions;
  
  let visibleTxs = activeTxs;
  let isTruncated = false;

  if (options.isBatchRecovery) {
    const maxRows = 15;
    if (activeTxs.length > maxRows) {
      visibleTxs = activeTxs.slice(-maxRows);
      isTruncated = true;
    }
  } else if (!options.isExpanded) {
    visibleTxs = activeTxs.slice(-12);
  }

  const openingBal = visibleTxs.length > 0
    ? visibleTxs[0].balanceAfter - visibleTxs[0].netEffect
    : s.closingBalance;
  const openingPres = getOpeningBalancePresentation(openingBal);
  const pdfOpeningAmt  = pdfFmt(openingBal);
  const totalInvoiced  = visibleTxs.filter(t => t.type === 'invoice').reduce((a, t) => a + Math.abs(t.netEffect), 0);
  const totalPaid      = visibleTxs.filter(t => t.type === 'payment').reduce((a, t) => a + Math.abs(t.netEffect), 0);

  
  const isGroup = !!(s as any).isGroup;
  let currentY = 12;

  if (!isGroup) {
    const logoH = theme === 'economy' ? 14 : 18;
    const logoW = logoH * (599 / 579);
    const logoY = 14;
    
    // Left Side
    const titleY = logoY + logoH + 8;
    const ledgerY = titleY + 5;
    
    // Right Side
    const cNameY = logoY + 6;
    const gstY = cNameY + 5;
    const phoneY = gstY + 5;
    
    const dividerY = Math.max(ledgerY, phoneY) + 6;
    const headerH = dividerY;
    
    if (theme === 'color') {
      doc.setFillColor(...cNavy);
      doc.rect(0, 0, pageW, headerH, 'F');
    }

    if (logo) {
      doc.addImage(logo, 'PNG', margin, logoY, logoW, logoH);
    }
    
    doc.setTextColor(...(theme === 'economy' ? cDark : [255, 255, 255] as [number, number, number]));
    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(14);
    doc.text('Customer Statement', margin, titleY);
    
    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...(theme === 'economy' ? cSlate : [190, 205, 225] as [number, number, number]));
    doc.text('Kamna Traders · Receivables Ledger', margin, ledgerY);

    const rightX = pageW - margin;
    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...(theme === 'economy' ? cDark : [255, 255, 255] as [number, number, number]));
    let cName = s.customer.contactName || 'Customer';
    const maxRightWidth = (pageW - margin * 2) * 0.5;
    if (doc.getStringUnitWidth(cName) * doc.internal.getFontSize() / doc.internal.scaleFactor > maxRightWidth) {
      while (cName.length > 0 && doc.getStringUnitWidth(cName + '...') * doc.internal.getFontSize() / doc.internal.scaleFactor > maxRightWidth) {
        cName = cName.slice(0, -1);
      }
      cName += '...';
    }
    doc.text(cName, rightX, cNameY, { align: 'right' });

    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...(theme === 'economy' ? cSlate : [190, 205, 225] as [number, number, number]));
    if (s.customer.gstNo) {
      doc.text(`GST: ${s.customer.gstNo}`, rightX, gstY, { align: 'right' });
    }
    if (s.customer.mobile) {
      doc.text(`Phone: ${s.customer.mobile}`, rightX, phoneY, { align: 'right' });
    }

    if (theme === 'economy') {
      doc.setDrawColor(...cNavy);
      doc.setLineWidth(0.3);
      doc.line(margin, dividerY, pageW - margin, dividerY);
    }

    const kpis = [
      { label: openingPres.isCredit ? 'Advance / Credit' : 'Opening Balance', val: pdfOpeningAmt, color: openingPres.isCredit ? cGreen : cDark, accent: [59, 130, 246] as [number, number, number] },
      { label: 'Total Invoiced',  val: pdfFmt(totalInvoiced), color: cDark, accent: cNavy  },
      { label: 'Total Paid',      val: pdfFmt(totalPaid),     color: cGreen, accent: [16, 185, 129] as [number, number, number] },
      { label: 'Closing Balance', val: pdfFmtBalance(s.closingBalance),
        color: s.closingBalance > 0 ? cRed : s.closingBalance < 0 ? cGreen : cDark, accent: [239, 68, 68] as [number, number, number] },
    ];
    
    const boxW = (colW - 8 * 3) / 4;
    const kpiY = dividerY + 8; // Breathing room above KPIs
    kpis.forEach((box, i) => {
      const bx = margin + i * (boxW + 8);
      const bh = 16; // Taller for breathing room
      
      if (theme === 'economy') {
        doc.setFillColor(252, 252, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(bx, kpiY, boxW, bh, 1, 1, 'FD');

        doc.setFillColor(...box.accent);
        doc.rect(bx, kpiY + 0.3, 2.5, bh - 0.6, 'F');
      } else {
        const bg = box.color === cRed ? [254, 242, 242] :
                   box.color === cGreen ? [236, 253, 245] :
                   [248, 250, 252];
        doc.setFillColor(bg[0], bg[1], bg[2]);
        doc.roundedRect(bx, kpiY, boxW, bh, 2, 2, 'F');
      }

      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(6);
      doc.setTextColor(...cSlate);
      doc.text(box.label.toUpperCase(), bx + 4, kpiY + 6);

      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...box.color);
      doc.text(box.val, bx + 4, kpiY + 12);
    });

    currentY = kpiY + 16 + 8; // Spacing below KPIs, before Payment Breakdown

  } else {
    // ---- GROUP STATEMENT HEADER REDESIGN ----
    const headerH = theme === 'economy' ? 24 : 32;
    if (theme === 'color') {
      doc.setFillColor(...cNavy);
      doc.rect(0, 0, pageW, headerH, 'F');
    }

    const logoH = theme === 'economy' ? 14 : 16;
    const logoW = logoH * (599 / 579);
    const logoY = theme === 'economy' ? 12 : 8;
    if (logo) {
      doc.addImage(logo, 'PNG', margin, logoY, logoW, logoH);
    }

    const titleX = logo ? margin + logoW + 6 : margin;
    const rightX = pageW - margin;

    // Left Column
    doc.setTextColor(...(theme === 'economy' ? cDark : [255, 255, 255] as [number, number, number]));
    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(14);
    doc.text('GROUP STATEMENT', titleX, logoY + 5);

    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...(theme === 'economy' ? cSlate : [190, 205, 225] as [number, number, number]));
    doc.text('Kamna Traders · Receivables Ledger', titleX, logoY + 10);
    doc.text('Combined Portfolio Statement', titleX, logoY + 14);

    // Right Column
    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...(theme === 'economy' ? cDark : [255, 255, 255] as [number, number, number]));
    doc.text('Combined Portfolio', rightX, logoY + 5, { align: 'right' });

    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...(theme === 'economy' ? cSlate : [190, 205, 225] as [number, number, number]));
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    doc.text(`Generated On: ${today}`, rightX, logoY + 10, { align: 'right' });
    doc.text(`Generated By: Kamna ERP System`, rightX, logoY + 14, { align: 'right' });

    if (theme === 'economy') {
      doc.setDrawColor(...cNavy);
      doc.setLineWidth(0.3);
      doc.line(margin, headerH, pageW - margin, headerH);
    }

    currentY = headerH + 8;

    // Included Firms Section
    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...cDark);
    doc.text('Included Firms', margin, currentY);
    currentY += 6;

    const groupFirms = (s as any).groupFirms || [];
    groupFirms.forEach((stmt: any, idx: number) => {
      const firmName = stmt.customer.companyName || stmt.customer.contactName || 'Unknown Firm';
      const gstin = stmt.customer.gstNo || '—';
      const bal = stmt.closingBalance;
      
      const fc = options.firmColors?.[stmt.customer.contactId] || { hex: [100,116,139] };

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
      doc.setTextColor(bal > 0 ? cRed[0] : bal < 0 ? cGreen[0] : cDark[0], bal > 0 ? cRed[1] : bal < 0 ? cGreen[1] : cDark[1], bal > 0 ? cRed[2] : bal < 0 ? cGreen[2] : cDark[2]);
      doc.text(pdfFmtBalance(bal), rightX, currentY + 2, { align: 'right' });
      
      doc.setFont(pdfFont, 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...cSlate);
      doc.text('Outstanding :', rightX - doc.getStringUnitWidth(pdfFmtBalance(bal)) * 8 / doc.internal.scaleFactor - 2, currentY + 2, { align: 'right' });

      currentY += 8;
      
      if (idx < groupFirms.length - 1) {
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(margin + 4, currentY, rightX, currentY);
        currentY += 5;
      } else {
        currentY += 3;
      }
      
      if (currentY > pageH - 40) {
        doc.addPage();
        currentY = 15;
      }
    });

    currentY += 8;

    // Combined Portfolio Summary KPIs
    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...cDark);
    doc.text('Combined Portfolio Summary KPIs', margin, currentY);
    currentY += 6;

    const groupKpis = [
      { label: openingPres.isCredit ? 'Advance / Credit' : 'Opening Balance', val: pdfOpeningAmt, color: openingPres.isCredit ? cGreen : cDark, accent: [59, 130, 246] as [number, number, number] },
      { label: 'Total Invoiced',  val: pdfFmt(totalInvoiced), color: cDark, accent: cNavy  },
      { label: 'Total Paid',      val: pdfFmt(totalPaid),     color: cGreen, accent: [16, 185, 129] as [number, number, number] },
      { label: 'Closing Balance', val: pdfFmtBalance(s.closingBalance),
        color: s.closingBalance > 0 ? cRed : s.closingBalance < 0 ? cGreen : cDark, accent: [239, 68, 68] as [number, number, number] },
    ];
    
    const boxW = (colW - 8 * 3) / 4;
    groupKpis.forEach((box, i) => {
      const bx = margin + i * (boxW + 8);
      const by = currentY;
      const bh = 14;
      
      if (theme === 'economy') {
        doc.setFillColor(252, 252, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(bx, by, boxW, bh, 1, 1, 'FD');

        doc.setFillColor(...box.accent);
        doc.rect(bx, by + 0.3, 2.5, bh - 0.6, 'F');
      } else {
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

    currentY += 24;

    // Financial Portfolio Section (Firm Cards)
    if (currentY + 25 > pageH - margin) {
      doc.addPage();
      currentY = margin;
    }

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
        if (cardY + 24 > pageH - margin) {
          doc.addPage();
          cardY = margin;
        }
      } else if (idx % 2 !== 0) {
        cardX = margin + cardW + 8;
      }

      const firmName = stmt.customer.companyName || stmt.customer.contactName || 'Unknown Firm';
      const fc = options.firmColors?.[stmt.customer.contactId] || { hex: [100,116,139] };

      const fVisibleTxs = options.isExpanded ? stmt.transactions : stmt.transactions.slice(-12);
      const fInvoiced = fVisibleTxs.filter((tx: any) => tx.type === 'invoice').reduce((a: number, t: any) => a + Math.abs(t.netEffect), 0);
      const fPaid = fVisibleTxs.filter((tx: any) => tx.type === 'payment').reduce((a: number, t: any) => a + Math.abs(t.netEffect), 0);
      const fOpening = fVisibleTxs.length > 0 ? (fVisibleTxs[0].balanceAfter - fVisibleTxs[0].netEffect) : stmt.closingBalance;
      const fClosing = stmt.closingBalance;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(cardX, cardY, cardW, 20, 2, 2, 'FD');

      if (theme === 'color') {
        doc.setFillColor(...fc.hex);
        doc.roundedRect(cardX, cardY, cardW, 1.5, 2, 2, 'F');
        doc.rect(cardX, cardY + 0.8, cardW, 0.7, 'F');
      }

      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...cDark);
      
      let truncName = firmName;
      if (doc.getStringUnitWidth(truncName) * 7.5 / doc.internal.scaleFactor > cardW - 10) {
        while (truncName.length > 0 && doc.getStringUnitWidth(truncName + '...') * 7.5 / doc.internal.scaleFactor > cardW - 10) {
          truncName = truncName.slice(0, -1);
        }
        truncName += '...';
      }
      
      if (theme === 'economy') {
        doc.setFillColor(...fc.hex);
        doc.rect(cardX + 3, cardY + 4, 2, 2, 'F');
        doc.text(truncName, cardX + 7, cardY + 6);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(cardX + 3, cardY + 8, cardX + cardW - 3, cardY + 8);
      } else {
        doc.text(truncName, cardX + 3, cardY + 5);
      }

      const mY = cardY + 11;
      doc.setFontSize(5.5);
      
      doc.setFont(pdfFont, 'normal'); doc.setTextColor(...cSlate); doc.text('Opening Balance', cardX + 3, mY);
      doc.setFont(pdfFont, 'normal'); doc.setTextColor(...cDark); doc.text(pdfFmtBalance(fOpening), cardX + cardW/2 - 3, mY, { align: 'right' });
      
      doc.setFont(pdfFont, 'normal'); doc.setTextColor(...cSlate); doc.text('Total Paid', cardX + cardW/2 + 3, mY);
      doc.setFont(pdfFont, 'normal'); doc.setTextColor(...cGreen); doc.text(pdfFmt(fPaid), cardX + cardW - 3, mY, { align: 'right' });

      const mY2 = cardY + 16;
      doc.setFont(pdfFont, 'normal'); doc.setTextColor(...cSlate); doc.text('Total Invoiced', cardX + 3, mY2);
      doc.setFont(pdfFont, 'normal'); doc.setTextColor(...cDark); doc.text(pdfFmt(fInvoiced), cardX + cardW/2 - 3, mY2, { align: 'right' });

      doc.setFont(pdfFont, 'bold'); doc.setTextColor(...cSlate); doc.text('Closing Balance', cardX + cardW/2 + 3, mY2);
      doc.setFont(pdfFont, 'bold'); doc.setTextColor(fClosing > 0 ? cRed[0] : fClosing < 0 ? cGreen[0] : cDark[0], fClosing > 0 ? cRed[1] : fClosing < 0 ? cGreen[1] : cDark[1], fClosing > 0 ? cRed[2] : fClosing < 0 ? cGreen[2] : cDark[2]);
      doc.text(pdfFmtBalance(fClosing), cardX + cardW - 3, mY2, { align: 'right' });
    });

    currentY = cardY + 28;
  }
  // --- Payment Breakdown ---
  const paymentBreakdown = visibleTxs
    .filter((t: any) => t.type === 'payment')
    .reduce((acc: any, p: any) => {
      const cleaned = cleanDescription(p.description, 'payment') || 'Other';
      acc[cleaned] = (acc[cleaned] || 0) + Math.abs(p.netEffect);
      return acc;
    }, {});

  const breakDownKeys = Object.keys(paymentBreakdown);
  if (breakDownKeys.length > 0) {
    if (currentY + 10 > pageH - margin) {
      doc.addPage();
      currentY = margin;
    }
    
    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text('PAYMENT BREAKDOWN', margin, currentY);
    
    currentY += 4;
    let currentX = margin;
    let localY = currentY;
    const maxAvailableWidth = pageW - margin * 2;
    
    breakDownKeys.forEach((k) => {
      const amtStr = pdfFmt(paymentBreakdown[k]);
      doc.setFont(pdfFont, 'normal');
      doc.setFontSize(7);
      const labelW = doc.getStringUnitWidth(k + '  ') * doc.internal.getFontSize() / doc.internal.scaleFactor;
      
      doc.setFont(pdfFont, 'bold');
      const amtW = doc.getStringUnitWidth(amtStr) * doc.internal.getFontSize() / doc.internal.scaleFactor;
      
      const itemW = labelW + amtW + 8; // 8mm spacing between items
      
      if (currentX + itemW > margin + maxAvailableWidth && currentX > margin) {
        currentX = margin;
        localY += 4;
      }
      
      doc.setFont(pdfFont, 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(k, currentX, localY);
      
      doc.setFont(pdfFont, 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text(amtStr, currentX + labelW, localY);
      
      currentX += itemW;
    });
    currentY = localY + 6;
  } else {
    currentY += 4;
  }
  const tableHead = [
    isGroup
      ? ['Date', 'Firm', 'Type', 'Document & Details', 'Invoice Amt', 'Payment Amt', 'Balance']
      : ['Date', 'Type', 'Details', 'Invoice Amt', 'Payment Amt', 'Balance']
  ];

  const openRow = isGroup ? [
    '—', '—', '—',
    `Opening Balance${openingPres.isCredit ? ' (Advance/Credit)' : ''}`,
    '—', '—', pdfOpeningAmt
  ] : [
    '—', '—',
    `Opening Balance${openingPres.isCredit ? ' (Advance/Credit)' : ''}`,
    '—', '—', pdfOpeningAmt
  ];

  const txRows = visibleTxs.map((tx: any) => {
    const typeLabel = tx.type === 'invoice' ? 'Invoice' : tx.type === 'payment' ? 'Payment' : 'Bill';
    const displayDesc = cleanDescription(tx.description, tx.type);
    const combinedDesc = tx.referenceNumber ? (tx.referenceNumber !== displayDesc ? `${tx.referenceNumber}\n${displayDesc}` : tx.referenceNumber) : displayDesc;
    
    if (isGroup) {
      return [
        fmtDate(tx.date),
        tx.firmName || '—',
        typeLabel,
        combinedDesc,
        tx.netEffect > 0  ? pdfFmt(tx.amount) : '—',
        tx.netEffect <= 0 ? pdfFmt(tx.amount) : '—',
        pdfFmtBalance(tx.balanceAfter),
      ];
    }

    return [
      fmtDate(tx.date),
      typeLabel,
      combinedDesc,
      tx.netEffect > 0  ? pdfFmt(tx.amount) : '—',
      tx.netEffect <= 0 ? pdfFmt(tx.amount) : '—',
      pdfFmtBalance(tx.balanceAfter),
    ];
  });

  const totalsRow = isGroup ? [
    '', '', '', 'TOTALS',
    pdfFmt(totalInvoiced),
    pdfFmt(totalPaid),
    pdfFmtBalance(s.closingBalance),
  ] : [
    '', '', 'TOTALS',
    pdfFmt(totalInvoiced),
    pdfFmt(totalPaid),
    pdfFmtBalance(s.closingBalance),
  ];

  // Smart Pagination for Single Statements
  let rowsPerPage = 16; // Approximate optimal rows per page after compactness
  if (!isGroup) {
      const totalTx = txRows.length;
      if (totalTx > 0) {
          const pagesNeeded = Math.ceil(totalTx / rowsPerPage);
          if (pagesNeeded > 1) {
              // Balance rows perfectly across required pages
              const optimal = Math.ceil(totalTx / pagesNeeded);
              rowsPerPage = optimal;
          }
      }
  }

  autoTable(doc, {
    startY: currentY + 12, // Move table position slightly downward for breathing room
    head: tableHead,
    body: [openRow, ...txRows, totalsRow],
    theme: 'grid',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    headStyles: {
      fillColor: theme === 'economy' ? [255, 255, 255] : cNavy,
      textColor: theme === 'economy' ? cDark : [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: { top: 3.5, bottom: 3.5, left: 2, right: 2 }
    },
    bodyStyles: { fontSize: 7.25, textColor: [51, 65, 85], font: pdfFont },
    columnStyles: isGroup ? {
      0: { cellWidth: 20, overflow: 'visible' },
      1: { cellWidth: 26, overflow: 'linebreak' },
      2: { cellWidth: 16, overflow: 'visible' },
      3: { cellWidth: 50, overflow: 'linebreak' },
      4: { halign: 'right', cellWidth: 22, fontStyle: 'bold', fontSize: 7.5, overflow: 'visible' },
      5: { halign: 'right', cellWidth: 22, textColor: [5, 150, 105], fontStyle: 'bold', fontSize: 7.5, overflow: 'visible' },
      6: { halign: 'right', cellWidth: 24, fontStyle: 'bold', fontSize: 7.5, overflow: 'visible' },
    } : {
      0: { cellWidth: 22, overflow: 'visible' },
      1: { cellWidth: 16, overflow: 'visible' },
      2: { cellWidth: 58, overflow: 'linebreak' },
      3: { halign: 'right', cellWidth: 28, fontStyle: 'bold', fontSize: 7.5, overflow: 'visible' },
      4: { halign: 'right', cellWidth: 28, textColor: [5, 150, 105], fontStyle: 'bold', fontSize: 7.5, overflow: 'visible' },
      5: { halign: 'right', cellWidth: 30, fontStyle: 'bold', fontSize: 7.5, overflow: 'visible' },
    },
    styles: { 
      cellPadding: { top: 2.5, bottom: 2.5, left: 1.5, right: 1.5 }, 
      font: pdfFont,
      ...(theme === 'economy' ? { lineWidth: 0.1, lineColor: [226, 232, 240] } : {})
    },
    margin: { top: 25, left: margin, right: margin, bottom: 65 },
    willDrawCell: (data: any) => {
      // Prevent the Totals row from being orphaned on a new page.
      if (data.row.section === 'body') {
        const isApproachingEnd = data.row.index >= txRows.length - 2;
        if (isApproachingEnd) {
          data.settings.margin.bottom = 105;
        }
      }
    },
    didDrawPage: (data: any) => {
      if (data.pageNumber > 1 && !isGroup) {
        const logoH = 8;
        const logoW = logoH * (599 / 579);
        if (logo) {
          doc.addImage(logo, 'PNG', margin, 8, logoW, logoH);
        }
        
        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42); 
        let cName = s.customer.contactName || 'Customer';
        doc.text(cName, margin + logoW + 4, 12);
        
        doc.setFontSize(7);
        doc.setFont(pdfFont, 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text('Customer Statement (Cont.)', margin + logoW + 4, 15.5);
        
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, 19, pageW - margin, 19);
      }
    },
    didParseCell: (data: any) => {
      // Smart Pagination trigger for balanced pages
      if (!isGroup && data.section === 'body' && data.row.index > 0 && data.row.index < txRows.length) {
         if (data.row.index % rowsPerPage === 0) {
             data.row.pageBreak = 'always';
         }
      }

      if (data.section === 'head' && theme === 'economy') {
        data.cell.styles.lineWidth = { bottom: 0.5 };
        data.cell.styles.lineColor = [15, 23, 42];
      }
      if (data.section === 'body') {
        if (data.row.index === txRows.length + 1) {
           data.cell.styles.fontStyle = 'bold';
           data.cell.styles.fontSize = 8;
           if (theme !== 'economy') {
             data.cell.styles.fillColor = [226, 232, 240];
             data.cell.styles.textColor = [15, 23, 42];
           } else {
             data.cell.styles.fillColor = [248, 250, 252];
             data.cell.styles.lineWidth = { top: 1, bottom: 1 };
             data.cell.styles.lineColor = [100, 116, 139];
           }
        }

        const isLast = data.row.index === txRows.length + 1;
        if (!isLast && theme === 'economy') {
          if (data.row.index % 2 !== 0) {
            data.cell.styles.fillColor = [248, 250, 252];
          } else {
            data.cell.styles.fillColor = [255, 255, 255];
          }
        }
        
        if (data.row.index === 0) {
          if (theme !== 'economy') {
            data.cell.styles.fillColor = [239, 246, 255];
          }
        }
        const typeColIdx = isGroup ? 2 : 1;
        const invColIdx = isGroup ? 4 : 3;
        const pmtColIdx = isGroup ? 5 : 4;
        const balColIdx = isGroup ? 6 : 5;

        // No colored types in economy mode except numbers
        if (data.column.index === typeColIdx && data.row.index > 0 && !isLast && theme !== 'economy') {
          const txType = txRows[data.row.index - 1][typeColIdx];
          if (txType === 'Invoice') {
            data.cell.styles.fillColor = [239, 246, 255];
            data.cell.styles.textColor = [30, 64, 175];
          } else if (txType === 'Payment') {
            data.cell.styles.fillColor = [236, 253, 245];
            data.cell.styles.textColor = [6, 95, 70];
          }
        }

        if (isGroup && data.column.index === 1 && data.row.index > 0 && !isLast) {
          const txIdx = data.row.index - 1;
          if (txIdx >= 0 && txIdx < visibleTxs.length) {
            const tx = visibleTxs[txIdx];
            const fc = options.firmColors?.[(tx as any).firmId];
            if (fc && fc.bgHex && fc.hex) {
              if (theme === 'economy') {
                // Prepend brackets
                const currentText = typeof data.cell.raw === 'string' ? data.cell.raw : '';
                // Actually autoTable will just render text. We will draw square in didDrawCell.
                // Instead of editing cell.raw, we edit text in cell.text array
                if (data.cell.text && data.cell.text.length > 0) {
                  data.cell.text[0] = `[${data.cell.text[0]}]`;
                }
                data.cell.styles.cellPadding = { top: 3.5, bottom: 3.5, left: 4.5, right: 1.5 };
                data.cell.styles.textColor = [51, 65, 85];
              } else {
                data.cell.styles.fillColor = fc.bgHex;
                data.cell.styles.textColor = fc.hex;
              }
            }
          }
        }

        if (isLast) {
          if (theme !== 'economy') {
            data.cell.styles.fillColor = [241, 245, 249];
          } else {
            data.cell.styles.fillColor = [255, 255, 255];
            data.cell.styles.lineWidth = { top: 0.5 };
            data.cell.styles.lineColor = [15, 23, 42];
          }
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 8.5;
          if (data.column.index === invColIdx) data.cell.styles.textColor = [15, 23, 42];
          if (data.column.index === pmtColIdx) data.cell.styles.textColor = [5, 150, 105];
          if (data.column.index === balColIdx) {
            data.cell.styles.textColor = s.closingBalance > 0 ? [220, 38, 38]
              : s.closingBalance < 0 ? [5, 150, 105] : [15, 23, 42];
            data.cell.styles.fontSize = 9;
          }
        }
        if (data.column.index === balColIdx && data.row.index > 0 && !isLast) {
          const txIdx = data.row.index - 1;
          if (txIdx >= 0 && txIdx < visibleTxs.length) {
            const b = visibleTxs[txIdx].balanceAfter;
            data.cell.styles.textColor = b > 0 ? [220, 38, 38] : b < 0 ? [5, 150, 105] : [15, 23, 42];
          }
        }
      }
    },
    didDrawCell: (data: any) => {
      if (theme === 'economy' && isGroup && data.section === 'body' && data.column.index === 1 && data.row.index > 0) {
        const isLast = data.row.index === txRows.length + 1;
        if (!isLast) {
          const txIdx = data.row.index - 1;
          if (txIdx >= 0 && txIdx < visibleTxs.length) {
            const tx = visibleTxs[txIdx];
            const fc = options.firmColors?.[(tx as any).firmId];
            if (fc && fc.hex) {
              const rectX = data.cell.x + 1.5;
              const rectY = data.cell.y + (data.cell.height / 2) - 0.75;
              doc.setFillColor(...fc.hex);
              doc.rect(rectX, rectY, 1.5, 1.5, 'F');
            }
          }
        }
      }
    }
  });
  const closingBal = s.closingBalance;
  const finalTableY = doc.lastAutoTable?.finalY ?? 96;

  const footerHeight = theme === 'economy' ? 42 : 56;
  const spaceRequired = footerHeight + 10;
  
  if (finalTableY + spaceRequired > pageH && !options.isBatchRecovery) {
    doc.addPage();
  }

  const footerY = pageH - margin - footerHeight;

  doc.setDrawColor(...cSlate);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY, pageW - margin, footerY);

  const generatedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  doc.setFont(pdfFont, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...cSlate);
  
  // Left: Generated By/At
  doc.text(`Generated By: ${options.isBatchRecovery ? 'Admin' : 'Staff'}`, margin, footerY + 8);
  doc.text(`Generated At: ${generatedAt}`, margin, footerY + 13);

  if (isTruncated && options.isBatchRecovery) {
    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...cSlate);
    doc.text('Showing latest transactions only. Complete statement available in Customer Statement module.', margin, footerY + 22);
  }

  // Right: QR Code and Outstanding
  const UPI_ID = 'ibkPOS.EP208232@icici';
  if (closingBal > 0) {
    const customerForRemarks = s.customer.contactName || s.customer.companyName || 'Customer';
    const remarks = `${customerForRemarks} Balance`;
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

    const qrSize = 22;
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
    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...cSlate);
    doc.text('Kamna Traders B2B — Confidential', pageW - margin, footerY + 8, { align: 'right' });
  }
}
