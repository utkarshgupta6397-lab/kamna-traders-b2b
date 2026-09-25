import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';
import {
  CustomerStatement,
  CustomerStatementCustomer,
  CustomerStatementInvoice,
  CustomerStatementPayment,
  StatementTransaction,
  StatementFetchOptions,
  getCustomerById,
  getCustomerPayments
} from './customer-statement';
import {
  parseNativeContactStatementPdf,
  NativeStatementParsedData
} from './native-contact-statement-parser';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

export function getTodayIST(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  return istDate.toISOString().split('T')[0];
}

/**
 * Concurrency runner for bounded parallel execution.
 */
export async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await fn(items[idx]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

export interface NativeStatementFetchResult {
  success: boolean;
  data?: CustomerStatement;
  parsedNativeData?: NativeStatementParsedData;
  raw?: any;
  error?: string;
}

/**
 * Fetches and processes Zoho Books native Contact Statement for a given customer.
 * Uses native Contact Statement PDF as the single source of truth.
 */
export async function getNativeCustomerStatement(
  contactId: string,
  minDate: string = '2026-03-01',
  maxDate?: string,
  options?: StatementFetchOptions,
  prefetchedCustomer?: CustomerStatementCustomer
): Promise<NativeStatementFetchResult> {
  const orgId = options?.orgId || getZohoOrgId() || process.env.ZOHO_BOOKS_ORG_ID;
  if (!orgId) {
    throw new Error('Missing Zoho Organization ID');
  }

  const token = options?.accessToken || await getZohoTokens();
  if (!token) {
    throw new Error('Failed to obtain Zoho access token');
  }

  const fetchImpl = options?.fetchFn || fetch;
  const startDate = minDate;
  const endDate = maxDate || getTodayIST();

  console.log(`[Native Statement] Fetching statement for contact ${contactId} (${startDate} → ${endDate})`);

  const pdfUrl = `${API_BASE_URL}/books/v3/contacts/${contactId}/statements?organization_id=${orgId}&start_date=${startDate}&end_date=${endDate}`;
  const pdfResponse = await fetchImpl(pdfUrl, {
    method: 'GET',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      Accept: 'application/pdf',
    },
  });

  if (!pdfResponse.ok) {
    const errorBody = await pdfResponse.text();
    console.error(`[Native Statement] Zoho returned HTTP ${pdfResponse.status}:`, errorBody);
    throw new Error(`Zoho Native Statement endpoint returned HTTP ${pdfResponse.status}: ${errorBody}`);
  }

  const contentType = pdfResponse.headers && typeof pdfResponse.headers.get === 'function'
    ? (pdfResponse.headers.get('content-type') || '')
    : '';
  if (!contentType.includes('application/pdf') && !contentType.includes('octet-stream')) {
    const textBody = await pdfResponse.text();
    console.error('[Native Statement] Unexpected content type:', contentType, textBody);
    throw new Error(`Expected PDF response from Zoho but received content-type "${contentType}": ${textBody.slice(0, 300)}`);
  }

  const pdfArrayBuf = await pdfResponse.arrayBuffer();
  const pdfBuffer = Buffer.from(pdfArrayBuf);

  if (pdfBuffer.length === 0) {
    throw new Error('Received empty PDF response from Zoho Native Statement endpoint');
  }

  console.log(`[Native Statement] Downloaded PDF (${pdfBuffer.length.toLocaleString()} bytes). Parsing...`);
  const parsed = await parseNativeContactStatementPdf(pdfBuffer);
  console.log(`[Native Statement] Parsed ${parsed.totalRows} rows across statement period: ${parsed.statementPeriod}`);

  // Fetch base customer details and customer payments list concurrently
  const financialRows = parsed.rows.filter(r => !r.isOpeningBalance && !r.isInformational);
  const paymentRows = financialRows.filter(r => r.type === 'payment');

  const [customerResult, paymentsListResult] = await Promise.all([
    prefetchedCustomer ? Promise.resolve({ success: true, data: prefetchedCustomer } as const) : getCustomerById(contactId, options),
    paymentRows.length > 0 ? getCustomerPayments(contactId, options) : Promise.resolve({ success: true, data: [] as CustomerStatementPayment[] })
  ]);

  const customer: CustomerStatementCustomer = customerResult.success && customerResult.data ? customerResult.data : {
    contactId,
    contactName: parsed.customerName || 'Customer',
    outstandingReceivable: parsed.accountSummary.balanceDue,
    outstandingReceivableFormatted: `₹${parsed.accountSummary.balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    unusedCreditsReceivable: 0,
    outstandingPayable: 0,
    unusedCreditsPayable: 0
  };

  // Extract informational Payment Applied rows and map allocations by payment number
  const paymentAllocationsMap = new Map<string, Array<{ invoiceNumber: string; amountApplied: number }>>();
  parsed.rows
    .filter(r => r.isInformational && r.type === 'payment_applied')
    .forEach(r => {
      const pmtRef = r.paymentNumber || r.reference;
      if (pmtRef && r.applicationPairs.length > 0) {
        const key = pmtRef.toLowerCase();
        const existing = paymentAllocationsMap.get(key) || [];
        existing.push(...r.applicationPairs);
        paymentAllocationsMap.set(key, existing);
      }
    });

  // Build payment resolution indices directly from customer payments list response (NO detail calls)
  const customerPayments = paymentsListResult.success && paymentsListResult.data ? paymentsListResult.data : [];
  const pmtById = new Map<string, CustomerStatementPayment>();
  const pmtByNumber = new Map<string, CustomerStatementPayment>();
  const pmtByReference = new Map<string, CustomerStatementPayment>();
  const pmtByDateAmount = new Map<string, CustomerStatementPayment>();

  for (const p of customerPayments) {
    if (p.paymentId) {
      pmtById.set(p.paymentId, p);
    }
    if (p.paymentNumber) {
      pmtByNumber.set(p.paymentNumber.toLowerCase().trim(), p);
    }
    if (p.referenceNumber) {
      pmtByReference.set(p.referenceNumber.toLowerCase().trim(), p);
    }
    if (p.date && p.amount !== undefined) {
      pmtByDateAmount.set(`${p.date}_${Number(p.amount).toFixed(2)}`, p);
    }
  }

  // Convert parsed financial rows to ERP statement transactions
  const transactions: StatementTransaction[] = [];

  for (let idx = 0; idx < financialRows.length; idx++) {
    const row = financialRows[idx];
    const timestamp = new Date(row.isoDate || 0).getTime();

    if (row.type === 'invoice') {
      const actualInvoiceNumber = row.invoiceNumber || (row.reference && !row.reference.startsWith('SO-') ? row.reference : undefined);
      const salesOrderRef = row.reference?.startsWith('SO-') ? row.reference : (row.reference !== actualInvoiceNumber ? row.reference : undefined);
      const isBillOfSupply = row.rawType.toLowerCase().includes('bill of supply');
      const prefix = isBillOfSupply ? 'Bill of Supply' : 'Invoice';

      transactions.push({
        id: `inv-${actualInvoiceNumber || row.reference || idx}`,
        type: 'invoice',
        date: row.isoDate,
        datetime: row.isoDate,
        timestamp,
        description: actualInvoiceNumber ? `${prefix} ${actualInvoiceNumber}` : (row.reference ? `${prefix} ${row.reference}` : row.details),
        amount: row.debit,
        debit: row.debit,
        credit: 0,
        netEffect: row.debit,
        customerNetEffect: row.debit,
        vendorNetEffect: 0,
        balanceAfter: row.balance,
        invoiceNumber: actualInvoiceNumber,
        referenceNumber: salesOrderRef,
        zohoUrl: undefined
      });
    } else if (row.type === 'payment') {
      const pmtRef = (row.reference || row.paymentNumber || '').trim();
      const pmtKey = pmtRef.toLowerCase();

      let enriched = (row as any).paymentId ? pmtById.get((row as any).paymentId) : undefined;
      if (!enriched && pmtKey) {
        enriched = pmtByNumber.get(pmtKey) || pmtByReference.get(pmtKey);
      }
      if (!enriched && row.isoDate && row.credit) {
        const dateAmtKey = `${row.isoDate}_${Number(row.credit).toFixed(2)}`;
        enriched = pmtByDateAmount.get(dateAmtKey);
      }
      const resolvedId = enriched?.paymentId || (row as any).paymentId;

      const directPairs = row.applicationPairs || [];
      const informationalPairs = paymentAllocationsMap.get(pmtKey) || [];
      const combinedPairs = [...directPairs, ...informationalPairs];

      // Deduplicate application pairs by invoice number
      const appliedMap = new Map<string, number>();
      for (const pair of combinedPairs) {
        appliedMap.set(pair.invoiceNumber, (appliedMap.get(pair.invoiceNumber) || 0) + pair.amountApplied);
      }
      const appliedInvoices = Array.from(appliedMap.entries()).map(([invoiceNumber, amountApplied]) => ({
        invoiceNumber,
        amountApplied
      }));

      // Metadata enrichment from Customer Payments List
      const pmtNumber = enriched?.paymentNumber || pmtRef;
      const pmtMode = enriched?.paymentMode || '';
      const pmtReference = enriched?.referenceNumber || '';
      const pmtDesc = enriched?.description || enriched?.notes || '';
      const pmtNotes = enriched?.notes || pmtDesc;
      const isVerified = enriched?.isVerified !== undefined ? enriched.isVerified : (row as any).isVerified;

      let desc = pmtRef ? `Customer Payment - ${pmtRef}` : 'Customer Payment';
      if (pmtMode) {
        desc = `Payment - ${pmtMode}`;
      }

      transactions.push({
        id: resolvedId ? `pmt-${resolvedId}` : `pmt-${pmtRef || idx}`,
        type: 'payment',
        date: row.isoDate,
        datetime: row.isoDate,
        timestamp,
        description: desc,
        amount: row.credit,
        debit: 0,
        credit: row.credit,
        netEffect: -row.credit,
        customerNetEffect: -row.credit,
        vendorNetEffect: 0,
        balanceAfter: row.balance,
        referenceNumber: pmtReference || pmtRef,
        paymentId: resolvedId,
        paymentNumber: pmtNumber,
        paymentMode: pmtMode,
        paymentReference: pmtReference,
        paymentDescription: pmtDesc,
        notes: pmtNotes,
        isVerified,
        appliedInvoices,
        zohoUrl: undefined
      });
    } else if (row.type === 'refund') {
      // Payment Refund: Must appear in the UI's Debit column with signed positive netEffect
      const refundRef = row.reference || row.paymentNumber || '';
      const displayDetails = refundRef ? `Payment Refund / ${refundRef}` : 'Payment Refund';

      transactions.push({
        id: `ref-${refundRef || idx}`,
        type: 'payment_refund', // Distinguished normalized type
        date: row.isoDate,
        datetime: row.isoDate,
        timestamp,
        description: displayDetails,
        entryNumber: displayDetails,
        referenceNumber: refundRef,
        amount: row.amount,
        debit: row.amount,
        credit: 0,
        netEffect: row.amount, // Positive netEffect represents a debit
        customerNetEffect: row.amount,
        vendorNetEffect: 0,
        balanceAfter: row.balance,
        zohoUrl: undefined // Specific document link only when verified, avoids unwanted ↗
      });
    } else if (row.type === 'credit_note') {
      const cnRef = row.reference || '';
      const displayDetails = cnRef ? `Credit Note ${cnRef}` : 'Credit Note';

      transactions.push({
        id: `cn-${row.reference || idx}`,
        type: 'journal',
        date: row.isoDate,
        datetime: row.isoDate,
        timestamp,
        description: displayDetails,
        entryNumber: displayDetails,
        referenceNumber: cnRef,
        amount: row.amount,
        debit: 0,
        credit: row.amount,
        netEffect: -row.amount, // Negative netEffect represents a credit
        customerNetEffect: -row.amount,
        vendorNetEffect: 0,
        balanceAfter: row.balance,
        zohoUrl: undefined
      });
    } else {
      // Fallback for any other native row type
      const isDebit = row.debit > 0;
      const amt = isDebit ? row.debit : row.credit;
      transactions.push({
        id: `tx-${row.reference || idx}`,
        type: 'journal',
        date: row.isoDate,
        datetime: row.isoDate,
        timestamp,
        description: row.details || row.rawType,
        entryNumber: row.rawType,
        referenceNumber: row.reference,
        amount: amt,
        debit: isDebit ? amt : 0,
        credit: !isDebit ? amt : 0,
        netEffect: isDebit ? amt : -amt,
        customerNetEffect: isDebit ? amt : -amt,
        vendorNetEffect: 0,
        balanceAfter: row.balance
      });
    }
  }

  const unpaidInvoices: CustomerStatementInvoice[] = [];

  const closingBalance = parsed.accountSummary.balanceDue;
  const openingBalance = parsed.accountSummary.openingBalance;

  const paymentListCalls = (paymentsListResult as any)?._meta?.apiCalls || (customerPayments.length > 0 ? 1 : 0);
  const totalPaymentApiCalls = paymentListCalls;

  const finalStatement: CustomerStatement = {
    customer,
    openingBalance,
    closingBalance,
    outstandingReceivable: closingBalance,
    outstandingPayable: 0,
    customerNet: closingBalance,
    vendorNet: 0,
    isHybrid: false,
    transactions,
    transactionCount: transactions.length,
    unpaidInvoices,
    isTruncated: false,
    telemetry: {
      customerApiCalls: prefetchedCustomer ? 0 : 1,
      invoiceApiCalls: 0,
      paymentApiCalls: totalPaymentApiCalls,
      billApiCalls: 0,
      totalApiCalls: (prefetchedCustomer ? 1 : 2) + totalPaymentApiCalls,
      rawInvoicesFetched: 0,
      validInvoicesAfterFilter: 0,
      rawPaymentsFetched: customerPayments.length,
      validPaymentsAfterFilter: customerPayments.length,
      rawBillsFetched: 0,
      validBillsAfterFilter: 0,
      debugReceivable: closingBalance,
      debugPayable: 0,
      debugNetClosingBalance: closingBalance,
      debugIsHybrid: false
    }
  };

  return {
    success: true,
    data: finalStatement,
    parsedNativeData: parsed
  };
}
