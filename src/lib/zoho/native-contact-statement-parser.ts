import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
// @ts-ignore
import * as pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';

// In bundled server environments (e.g. Next.js / Turbopack), pdfjs requires pdfjsWorker on globalThis
// to avoid trying to dynamically import a relative pdf.worker.mjs file from server chunks.
if (typeof globalThis !== 'undefined' && !(globalThis as any).pdfjsWorker) {
  (globalThis as any).pdfjsWorker = pdfWorker;
}

export interface NativeStatementParsedRow {
  rowNumber: number;
  page: number;
  date: string;
  isoDate: string;
  rawType: string;
  type: 'opening_balance' | 'invoice' | 'payment' | 'refund' | 'payment_applied' | 'credit_note' | 'other';
  isInformational: boolean;
  isOpeningBalance: boolean;
  reference: string;
  invoiceNumber?: string;
  paymentNumber?: string;
  details: string;
  debit: number;
  credit: number;
  amount: number;
  balance: number;
  applicationPairs: Array<{ invoiceNumber: string; amountApplied: number }>;
}

export interface NativeStatementParsedData {
  customerName: string;
  statementPeriod: string;
  accountSummary: {
    openingBalance: number;
    invoicedAmount: number;
    amountPaid: number;
    balanceDue: number;
  };
  agingSummary?: {
    current: number;
    days1To30: number;
    days31To60: number;
    days61To90: number;
    over90: number;
    total: number;
  } | null;
  totalRows: number;
  rows: NativeStatementParsedRow[];
}

export class NativeStatementParseError extends Error {
  constructor(message: string, public context?: any) {
    super(message);
    this.name = 'NativeStatementParseError';
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
 * Parses a Zoho Books native Contact Statement PDF into a strongly-typed normalized structure.
 */
export async function parseNativeContactStatementPdf(
  pdfBuffer: Buffer | Uint8Array
): Promise<NativeStatementParsedData> {
  let doc: any;
  try {
    const data = Buffer.isBuffer(pdfBuffer)
      ? new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength)
      : (pdfBuffer instanceof Uint8Array ? pdfBuffer : new Uint8Array(pdfBuffer));
    doc = await pdfjs.getDocument({ data }).promise;
  } catch (err: any) {
    throw new NativeStatementParseError(`Failed to load PDF with pdfjs-dist: ${err.message}`, { error: err });
  }

  const numPages = doc.numPages;
  if (!numPages || numPages < 1) {
    throw new NativeStatementParseError('Invalid PDF: document contains 0 pages');
  }

  let customerName = '';
  let statementPeriod = '';
  let openingBalance: number | null = null;
  let invoicedAmount: number | null = null;
  let amountPaid: number | null = null;
  let balanceDue: number | null = null;
  let agingSummary: any = null;

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

      const toMatch = fullText.match(/KAMNA TRADERS\s+To\s+([A-Z0-9\s.,&-]+?)\s+(?:B-|Plot|Shop|Street|GSTIN|\d{10}|CHHETELA)/i);
      if (toMatch) customerName = toMatch[1].trim();

      const openMatch = fullText.match(/Opening Balance\s+₹?\s*([-\d,.]+)/i);
      if (openMatch) openingBalance = parseFloat(openMatch[1].replace(/,/g, ''));

      const invMatch = fullText.match(/Invoiced Amount\s+₹?\s*([-\d,.]+)/i);
      if (invMatch) invoicedAmount = parseFloat(invMatch[1].replace(/,/g, ''));

      const paidMatch = fullText.match(/Amount Paid\s+₹?\s*([-\d,.]+)/i);
      if (paidMatch) amountPaid = parseFloat(paidMatch[1].replace(/,/g, ''));

      const balMatch = fullText.match(/Balance Due\s+₹?\s*([-\d,.]+)/i);
      if (balMatch) balanceDue = parseFloat(balMatch[1].replace(/,/g, ''));
    }

    // Check aging summary across pages
    const pageText = items.map(it => it.str).join(' ');
    const agingMatch = pageText.match(/Current\s+1\s*-\s*30\s+31\s*-\s*60\s+61\s*-\s*90\s+>\s*90\s+Total\s+(?:Amount\s+)?₹?\s*([\d,.]+)\s+₹?\s*([\d,.]+)\s+₹?\s*([\d,.]+)\s+₹?\s*([\d,.]+)\s+₹?\s*([\d,.]+)\s+₹?\s*([\d,.]+)/i);
    if (agingMatch && !agingSummary) {
      agingSummary = {
        current: parseFloat(agingMatch[1].replace(/,/g, '')),
        days1To30: parseFloat(agingMatch[2].replace(/,/g, '')),
        days31To60: parseFloat(agingMatch[3].replace(/,/g, '')),
        days61To90: parseFloat(agingMatch[4].replace(/,/g, '')),
        over90: parseFloat(agingMatch[5].replace(/,/g, '')),
        total: parseFloat(agingMatch[6].replace(/,/g, ''))
      };
    }

    let inTable = false;
    let currentRow: any = null;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];

      // End of table check on footer lines (occurs below transactions)
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
        if (currentRow) {
          rawRows.push(currentRow);
        }
        currentRow = {
          page: p,
          date: it.str,
          isoDate: toIsoDate(it.str),
          typeItems: [],
          detailItems: [],
          debit: 0,
          credit: 0,
          balance: 0,
          rawItems: [it]
        };
        continue;
      }

      if (!currentRow) continue;
      currentRow.rawItems.push(it);

      if (it.x >= 100 && it.x <= 185) {
        currentRow.typeItems.push(it.str);
      } else if (it.x >= 180 && it.x <= 335) {
        currentRow.detailItems.push(it.str);
      } else if (it.x >= 335 && it.x <= 390 && isAmountStr(it.str)) {
        currentRow.debit = parseAmount(it.str);
      } else if (it.x >= 390 && it.x <= 480 && isAmountStr(it.str)) {
        currentRow.credit = parseAmount(it.str);
      } else if (it.x >= 480 && it.x <= 580 && isAmountStr(it.str)) {
        currentRow.balance = parseAmount(it.str);
      }
    }

    if (currentRow) {
      rawRows.push(currentRow);
      currentRow = null;
    }
  }

  if (openingBalance === null) {
    throw new NativeStatementParseError('Failed to parse Opening Balance from native statement header');
  }
  if (balanceDue === null) {
    throw new NativeStatementParseError('Failed to parse Balance Due from native statement header');
  }

  // Format and strongly type rows
  const parsedRows: NativeStatementParsedRow[] = rawRows.map((r, idx) => {
    const rawType = r.typeItems.join(' ').trim();
    const rawDetails = r.detailItems.join(' ').trim();

    let cleanType: NativeStatementParsedRow['type'] = 'other';
    let isInformational = false;
    let isOpeningBalance = false;

    if (rawType.includes('Opening Balance')) {
      cleanType = 'opening_balance';
      isOpeningBalance = true;
    } else if (rawType.toLowerCase().includes('invoice') || rawType.toLowerCase().includes('bill of supply')) {
      cleanType = 'invoice';
    } else if (rawType.toLowerCase().includes('payment received')) {
      cleanType = 'payment';
    } else if (rawType.toLowerCase().includes('payment applied')) {
      cleanType = 'payment_applied';
      isInformational = true;
    } else if (rawType.toLowerCase().includes('credit note')) {
      cleanType = 'credit_note';
    } else if (rawType.toLowerCase().includes('refund')) {
      cleanType = 'refund';
    }

    let reference = '';
    let invoiceNumber: string | undefined = undefined;
    let paymentNumber: string | undefined = undefined;
    const invMatch = rawDetails.match(/(?:^|[^\w-])((?:KT|BOS)\/[\d-]+\/\d+)/i);
    const soMatch = rawDetails.match(/(SO-KT\/[\d-]+\/\d+)/i);
    const pmtMatch = rawDetails.match(/(PT-KT\/[\d-]+\/\d+|\b\d{4,6}\b)/i);

    if (cleanType === 'invoice') {
      if (invMatch) {
        reference = invMatch[1];
        invoiceNumber = invMatch[1];
      }
      if (soMatch && !reference) {
        reference = soMatch[1];
      }
      if (!reference) {
        const anyInvMatch = rawDetails.match(/([A-Za-z0-9\/-]+)/);
        if (anyInvMatch) reference = anyInvMatch[1];
      }
    } else if (cleanType === 'payment' || cleanType === 'payment_applied' || cleanType === 'refund') {
      if (pmtMatch) {
        reference = pmtMatch[1];
        paymentNumber = pmtMatch[1];
      } else {
        const anyRef = rawDetails.match(/([A-Za-z0-9\/-]+)/);
        if (anyRef) reference = anyRef[1];
      }
    } else {
      const anyRef = rawDetails.match(/([A-Za-z0-9\/-]+)/);
      if (anyRef) reference = anyRef[1];
    }

    const applicationPairs: Array<{ invoiceNumber: string; amountApplied: number }> = [];
    const appRegex = /₹?([\d,.]+)\s+for\s+payment\s+of\s+([A-Za-z0-9\s\/-]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = appRegex.exec(rawDetails)) !== null) {
      applicationPairs.push({
        amountApplied: parseFloat(match[1].replace(/,/g, '')),
        invoiceNumber: match[2].replace(/\s+/g, '')
      });
    }

    let txAmount = 0;
    if (cleanType === 'invoice') {
      txAmount = r.debit;
    } else if (cleanType === 'payment') {
      txAmount = r.credit;
    } else if (cleanType === 'refund') {
      txAmount = Math.abs(r.credit !== 0 ? r.credit : r.debit);
    } else if (cleanType === 'credit_note') {
      txAmount = r.credit !== 0 ? r.credit : r.debit;
    }

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
      invoiceNumber,
      paymentNumber,
      details: rawDetails,
      debit: cleanType === 'invoice' ? r.debit : (cleanType === 'refund' ? txAmount : 0),
      credit: cleanType === 'payment' ? r.credit : (cleanType === 'credit_note' ? txAmount : 0),
      amount: txAmount,
      balance: r.balance,
      applicationPairs
    };
  });

  return {
    customerName,
    statementPeriod,
    accountSummary: {
      openingBalance,
      invoicedAmount: invoicedAmount ?? 0,
      amountPaid: amountPaid ?? 0,
      balanceDue
    },
    agingSummary,
    totalRows: parsedRows.length,
    rows: parsedRows
  };
}
