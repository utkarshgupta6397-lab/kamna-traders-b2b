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

async function getCachedAssets(theme: 'color' | 'economy') {
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
    const maxRows = 20;
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

  const headerH = theme === 'economy' ? 22 : 30;
  if (theme === 'color') {
    doc.setFillColor(...cNavy);
    doc.rect(0, 0, pageW, headerH, 'F');
  }

  const logoH = theme === 'economy' ? 14 : 18;
  const logoW = logoH * (599 / 579);
  if (logo) {
    doc.addImage(logo, 'PNG', margin, (headerH - logoH) / 2, logoW, logoH);
  }

  const titleX = logo ? margin + logoW + 4 : margin;
  doc.setTextColor(...(theme === 'economy' ? cDark : [255, 255, 255] as [number, number, number]));
  doc.setFont(pdfFont, 'bold');
  doc.setFontSize(13);
  doc.text('Customer Statement', titleX, theme === 'economy' ? 10 : 12);

  doc.setFont(pdfFont, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...(theme === 'economy' ? cSlate : [190, 205, 225] as [number, number, number]));
  doc.text('Kamna Traders · Receivables Ledger', titleX, theme === 'economy' ? 15 : 20);

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
    didParseCell: (data: any) => {
      if (data.section === 'body') {
        if (data.row.index === 0) {
          if (theme !== 'economy') {
            data.cell.styles.fillColor = [239, 246, 255];
          }
          if (data.column.index === 5) {
            data.cell.styles.textColor = openingPres.isCredit ? [5, 150, 105] : [15, 23, 42];
            data.cell.styles.fontStyle = 'bold';
          }
        }
        const isLast = data.row.index === txRows.length + 1;
        
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
  doc.text('Generated By: Admin', margin, footerY + 8);
  doc.text(`Generated At: ${generatedAt}`, margin, footerY + 13);

  if (isTruncated && options.isBatchRecovery) {
    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...cSlate);
    doc.text('Showing latest transactions only. Complete statement available in Customer Statement module.', margin, footerY + 22);
  }

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

    if (theme === 'economy') {
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
      const qrSize = 32;
      const qrX = pageW - margin - qrSize - 4;
      const qrBoxY = footerY + 4;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      
      const boxPadding = 4;
      const boxExtraH = 22;
      doc.rect(qrX - boxPadding, qrBoxY - 2, qrSize + boxPadding * 2, qrSize + boxExtraH, 'FD');

      if (qrDataUrl) {
        doc.addImage(qrDataUrl, 'PNG', qrX, qrBoxY, qrSize, qrSize);
      } else {
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

      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...cRed);
      doc.text(`Outstanding: ${pdfFmtBalance(closingBal)}`, qrLabelX, qrBoxY + qrSize + 13, { align: 'center' });

      if (closingBal >= 100000) {
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
}
