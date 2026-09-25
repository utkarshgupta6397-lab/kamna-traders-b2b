import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
// @ts-ignore
import * as pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';

// In bundled server environments (e.g. Next.js / Turbopack), pdfjs requires pdfjsWorker on globalThis
// to avoid trying to dynamically import a relative pdf.worker.mjs file from server chunks.
if (typeof globalThis !== 'undefined' && !(globalThis as any).pdfjsWorker) {
  (globalThis as any).pdfjsWorker = pdfWorker;
}

export interface NativeVendorStatementParsedRow {
  rowNumber: number;
  page: number;
  date: string;
  isoDate: string;
  rawType: string;
  type: 'opening_balance' | 'bill' | 'payment_made' | 'vendor_credit' | 'other';
  isInformational: boolean;
  isOpeningBalance: boolean;
  reference: string;
  billNumber?: string;
  paymentNumber?: string;
  details: string;
  billedAmount: number;
  paidAmount: number;
  amount: number;
  balance: number;
}

export interface NativeVendorStatementParsedData {
  vendorName: string;
  statementPeriod: string;
  accountSummary: {
    openingBalance: number;
    billedAmount: number;
    amountPaid: number;
    balanceDue: number;
  };
  totalRows: number;
  rows: NativeVendorStatementParsedRow[];
}

export class NativeVendorStatementParseError extends Error {
  constructor(message: string, public context?: any) {
    super(message);
    this.name = 'NativeVendorStatementParseError';
  }
}

function toIsoDate(dateStr: string): string {
  const months: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
  };
  const parts = dateStr.trim().split(/\s+/);
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = months[parts[1]] || '01';
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

export function parseAmount(str: string): number {
  const clean = str.replace(/[₹\s]/g, '');
  if (clean.startsWith('(') && clean.endsWith(')')) {
    return -parseFloat(clean.slice(1, -1).replace(/,/g, ''));
  }
  return parseFloat(clean.replace(/,/g, ''));
}

export function isAmountStr(str: string): boolean {
  const clean = str.replace(/[₹\s]/g, '');
  return /^[-+]?[\d,.]+$|^\([-\d,.]+\)$/.test(clean);
}

/**
 * Parses a Zoho Books native Vendor Statement PDF into a strongly-typed normalized structure.
 */
export async function parseNativeVendorStatementPdf(
  pdfBuffer: Buffer | Uint8Array
): Promise<NativeVendorStatementParsedData> {
  let doc: any;
  try {
    const data = Buffer.isBuffer(pdfBuffer)
      ? new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength)
      : (pdfBuffer instanceof Uint8Array ? pdfBuffer : new Uint8Array(pdfBuffer));
    doc = await pdfjs.getDocument({ data }).promise;
  } catch (err: any) {
    throw new NativeVendorStatementParseError(`Failed to load PDF with pdfjs-dist: ${err.message}`, { error: err });
  }

  const numPages = doc.numPages;
  if (!numPages || numPages < 1) {
    throw new NativeVendorStatementParseError('Invalid PDF: document contains 0 pages');
  }

  let vendorName = '';
  let statementPeriod = '';
  let openingBalance: number | null = null;
  let billedAmount: number | null = null;
  let amountPaid: number | null = null;
  let balanceDue: number | null = null;

  const rawRows: any[] = [];

  for (let p = 1; p <= numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items as any[])
      .filter(it => it.str && it.str.trim())
      .map(it => ({
        x: Math.round(it.transform[4]),
        y: Math.round(it.transform[5]),
        str: it.str.trim()
      }));

    if (p === 1) {
      const fullText = items.map(it => it.str).join(' ');

      const periodMatch = fullText.match(/STATEMENT OF ACCOUNTS\s+([\d]{1,2}\s+[A-Za-z]{3}\s+[\d]{4}\s+To\s+[\d]{1,2}\s+[A-Za-z]{3}\s+[\d]{4})/i);
      if (periodMatch) statementPeriod = periodMatch[1].trim();

      const toMatch = fullText.match(/(?:KAMNA TRADERS\s+)?To\s+([A-Z0-9\s.,&-]+?)\s+(?:[A-Z0-9-]{3,}|GSTIN|\d{10}|MEERUT|Uttar)/i);
      if (toMatch) vendorName = toMatch[1].trim();

      const openMatch = fullText.match(/Opening Balance\s+₹?\s*([-\d,.]+)/i);
      if (openMatch) openingBalance = parseAmount(openMatch[1]);

      const billMatch = fullText.match(/Billed Amount\s+₹?\s*([-\d,.]+)/i);
      if (billMatch) billedAmount = parseAmount(billMatch[1]);

      const paidMatch = fullText.match(/Amount Paid\s+₹?\s*([-\d,.]+)/i);
      if (paidMatch) amountPaid = parseAmount(paidMatch[1]);

      const balMatch = fullText.match(/Balance Due\s+₹?\s*([-\d,.]+)/i);
      if (balMatch) balanceDue = parseAmount(balMatch[1]);
    }

    let inTable = false;
    let currentRow: any = null;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];

      // End of table check on footer lines
      if (inTable && (it.str.includes('Balance Due') || it.str.includes('Aging Summary') || it.str.includes('Period (in Days)'))) {
        if (currentRow) { rawRows.push(currentRow); currentRow = null; }
        inTable = false;
        break;
      }

      if (it.str === 'Date' && it.x >= 40 && it.x <= 60 && it.y <= (p === 1 ? 440 : 790)) {
        inTable = true;
        continue;
      }

      if (!inTable) continue;

      if (['Transactions', 'Details', 'Amount', 'Payments', 'Balance'].includes(it.str) && it.y > (p === 1 ? 420 : 760)) {
        continue;
      }

      const isDate = it.x >= 40 && it.x <= 80 && /^\d{2}\s+[A-Za-z]{3}\s+\d{4}$/.test(it.str);
      if (isDate) {
        if (currentRow) rawRows.push(currentRow);
        currentRow = {
          page: p,
          date: it.str,
          isoDate: toIsoDate(it.str),
          typeItems: [],
          detailItems: [],
          billedAmount: 0,
          paidAmount: 0,
          balance: 0,
          rawItems: [it]
        };
        continue;
      }

      if (!currentRow) continue;
      currentRow.rawItems.push(it);

      if (it.x >= 480 && it.x <= 580 && isAmountStr(it.str)) {
        currentRow.balance = parseAmount(it.str);
      } else if (it.x >= 395 && it.x <= 480 && isAmountStr(it.str)) {
        currentRow.paidAmount = parseAmount(it.str);
      } else if (it.x >= 320 && it.x <= 395 && isAmountStr(it.str)) {
        currentRow.billedAmount = parseAmount(it.str);
      } else if (it.x >= 100 && it.x <= 185) {
        currentRow.typeItems.push(it.str);
      } else if (it.x >= 180 && it.x < 320) {
        currentRow.detailItems.push(it.str);
      }
    }
    if (currentRow) { rawRows.push(currentRow); currentRow = null; }
  }

  if (openingBalance === null) {
    throw new NativeVendorStatementParseError('Failed to parse Opening Balance from native vendor statement header');
  }
  if (balanceDue === null) {
    throw new NativeVendorStatementParseError('Failed to parse Balance Due from native vendor statement header');
  }

  // Format and strongly type rows
  const parsedRows: NativeVendorStatementParsedRow[] = rawRows.map((r, idx) => {
    const rawType = r.typeItems.join(' ').trim();
    const rawDetails = r.detailItems.join(' ').trim();

    let cleanType: NativeVendorStatementParsedRow['type'] = 'other';
    let isInformational = false;
    let isOpeningBalance = false;

    if (rawType.includes('Opening Balance')) {
      cleanType = 'opening_balance';
      isOpeningBalance = true;
      isInformational = true;
    } else if (rawType.toLowerCase().includes('bill')) {
      cleanType = 'bill';
    } else if (rawType.toLowerCase().includes('payment')) {
      cleanType = 'payment_made';
    } else if (rawType.toLowerCase().includes('credit')) {
      cleanType = 'vendor_credit';
    }

    // Extract bill number or payment number from detailItems
    let billNumber: string | undefined;
    let paymentNumber: string | undefined;
    let reference = '';

    if (cleanType === 'bill') {
      // Typically: "31" or "31 31 - due on 17 Apr 2026" or "1349 - due on 14 Sep 2026"
      const billMatch = rawDetails.match(/^(\S+?)(?:\s+-\s+due\s+on|\s+\S+\s+-\s+due\s+on|$)/i);
      if (billMatch) {
        billNumber = billMatch[1].trim();
        reference = billNumber || '';
      }
    } else if (cleanType === 'payment_made') {
      // Typically includes: "VP-KT/26-27/0376" or payment reference
      const vpMatch = rawDetails.match(/(VP-[A-Z0-9/-]+)/i);
      if (vpMatch) {
        paymentNumber = vpMatch[1].trim();
        reference = paymentNumber || '';
      } else {
        const firstToken = r.detailItems[0];
        if (firstToken) {
          paymentNumber = firstToken;
          reference = firstToken || '';
        }
      }
    } else if (cleanType === 'vendor_credit') {
      // Typically: "187 1,24,766.00 for payment of NSS/26-27/03732" or "187"
      const vcMatch = rawDetails.match(/^(\S+)/);
      if (vcMatch) {
        reference = vcMatch[1].trim();
      }
      const billMatch = rawDetails.match(/for payment of\s+(\S+)/i);
      if (billMatch) {
        billNumber = billMatch[1].trim();
      }
    }

    const absBilled = Math.abs(r.billedAmount);
    const absPaid = Math.abs(r.paidAmount);
    const amount = absBilled > 0 ? absBilled : (absPaid > 0 ? absPaid : 0);

    return {
      rowNumber: idx + 1,
      page: r.page,
      date: r.date,
      isoDate: r.isoDate,
      rawType,
      type: cleanType,
      isInformational,
      isOpeningBalance,
      reference,
      billNumber,
      paymentNumber,
      details: rawDetails,
      billedAmount: absBilled,
      paidAmount: absPaid,
      amount,
      balance: r.balance
    };
  });

  return {
    vendorName,
    statementPeriod,
    accountSummary: {
      openingBalance,
      billedAmount: billedAmount ?? 0,
      amountPaid: amountPaid ?? 0,
      balanceDue
    },
    totalRows: parsedRows.length,
    rows: parsedRows
  };
}
