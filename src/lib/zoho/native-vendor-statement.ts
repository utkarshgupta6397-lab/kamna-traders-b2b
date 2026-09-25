import { getZohoTokens, getZohoOrgId } from '../zoho-auth';
import {
  parseNativeVendorStatementPdf,
  NativeVendorStatementParsedData,
  NativeVendorStatementParsedRow
} from './native-vendor-statement-parser';
import {
  StatementTransaction,
  CustomerStatement,
  CustomerStatementCustomer,
  StatementFetchOptions,
  getVendorBills,
  getVendorPayments,
  CustomerStatementBill,
  CustomerStatementVendorPayment
} from './customer-statement';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

/**
 * Fetches the raw PDF bytes of the native Zoho Vendor Statement.
 * Uses: GET /books/v3/vendors/{vendor_id}/statements?organization_id={orgId}&from_date={minDate}&to_date={maxDate}
 */
export async function getNativeVendorStatementPdf(
  vendorId: string,
  minDate: string = '2026-03-01',
  maxDate?: string,
  options?: StatementFetchOptions
): Promise<{ success: boolean; data?: Buffer; contentType?: string; error?: string }> {
  try {
    const orgId = options?.orgId || getZohoOrgId();
    if (!orgId) {
      return { success: false, error: 'Missing organization_id for Zoho Books API' };
    }

    const accessToken = options?.accessToken || await getZohoTokens();
    if (!accessToken) {
      return { success: false, error: 'Missing access token for Zoho Books API' };
    }

    const fetchImpl = options?.fetchFn || fetch;
    const endDate = maxDate || new Date().toISOString().slice(0, 10);
    const url = `${API_BASE_URL}/books/v3/vendors/${vendorId}/statements?organization_id=${orgId}&from_date=${minDate}&to_date=${endDate}`;

    console.log(`[Native Vendor Statement] Fetching statement PDF for vendor ${vendorId} (${minDate} → ${endDate})`);

    const res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        Accept: 'application/pdf',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        error: `Zoho Vendor Statement API returned HTTP ${res.status}: ${errText}`
      };
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get('content-type') || 'application/pdf';

    return {
      success: true,
      data: buffer,
      contentType
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to fetch native Zoho Vendor Statement PDF'
    };
  }
}

/**
 * Authoritative Vendor Statement implementation backed by Zoho Books native Vendor Statement API.
 */
export async function getNativeVendorStatement(
  vendorId: string,
  minDate: string = '2026-03-01',
  maxDate?: string,
  options?: StatementFetchOptions,
  vendorMetadata?: CustomerStatementCustomer
): Promise<{
  success: boolean;
  data?: CustomerStatement;
  raw?: any;
  error?: string;
}> {
  try {
    const orgId = options?.orgId || getZohoOrgId();

    // 1. Fetch native PDF and metadata lists (bills & vendor payments) concurrently
    console.time('nativeVendorStatementFetch');
    const [pdfResult, billsResult, vpResult] = await Promise.all([
      getNativeVendorStatementPdf(vendorId, minDate, maxDate, options),
      getVendorBills(vendorId, options),
      getVendorPayments(vendorId, options)
    ]);
    console.timeEnd('nativeVendorStatementFetch');

    if (!pdfResult.success || !pdfResult.data) {
      return {
        success: false,
        error: pdfResult.error || 'Failed to retrieve native vendor statement PDF'
      };
    }

    console.log(`[Native Vendor Statement] Downloaded PDF (${pdfResult.data.length.toLocaleString()} bytes). Parsing...`);

    // 2. Parse native PDF
    const parsed: NativeVendorStatementParsedData = await parseNativeVendorStatementPdf(pdfResult.data);

    // 3. Build lookup maps for bills and vendor payments to resolve IDs and enriched details
    const bills: CustomerStatementBill[] = billsResult.success && billsResult.data ? billsResult.data : [];
    const vendorPayments: CustomerStatementVendorPayment[] = vpResult.success && vpResult.data ? vpResult.data : [];

    const billByNumber = new Map<string, CustomerStatementBill>();
    for (const b of bills) {
      if (b.billNumber) {
        billByNumber.set(b.billNumber.toLowerCase().trim(), b);
      }
      if (b.referenceNumber) {
        billByNumber.set(b.referenceNumber.toLowerCase().trim(), b);
      }
    }

    const vpByNumber = new Map<string, CustomerStatementVendorPayment>();
    for (const vp of vendorPayments) {
      if (vp.paymentNumber) {
        vpByNumber.set(vp.paymentNumber.toLowerCase().trim(), vp);
      }
      if (vp.referenceNumber) {
        vpByNumber.set(vp.referenceNumber.toLowerCase().trim(), vp);
      }
    }

    // Filter financial rows
    const financialRows = parsed.rows.filter(r => !r.isOpeningBalance && !r.isInformational);

    // 4. Transform parsed rows into ERP StatementTransaction[]
    const transactions: StatementTransaction[] = [];

    for (let idx = 0; idx < financialRows.length; idx++) {
      const row = financialRows[idx];
      const timestamp = new Date(row.isoDate || 0).getTime();

      if (row.type === 'bill') {
        const billNum = row.billNumber || row.reference || '';
        const matchedBill = billByNumber.get(billNum.toLowerCase());
        const billId = matchedBill?.billId;
        const actualBillNumber = matchedBill?.billNumber || billNum;

        transactions.push({
          id: billId || `bill-${actualBillNumber || idx}`,
          type: 'bill',
          date: row.isoDate,
          datetime: row.isoDate,
          timestamp,
          description: actualBillNumber ? `Purchase Bill - ${actualBillNumber}` : (row.details || 'Purchase Bill'),
          amount: row.billedAmount,
          debit: 0,
          credit: row.billedAmount,
          netEffect: -row.billedAmount,
          customerNetEffect: 0,
          vendorNetEffect: -row.billedAmount,
          balanceAfter: row.balance,
          referenceNumber: matchedBill?.referenceNumber || actualBillNumber,
          zohoUrl: orgId && billId ? `https://books.zoho.in/app/${orgId}#/bills/${billId}` : undefined
        });
      } else if (row.type === 'payment_made') {
        const vpNum = row.paymentNumber || row.reference || '';
        const matchedVp = vpByNumber.get(vpNum.toLowerCase());
        const paymentId = matchedVp?.paymentId;
        const pmtMode = matchedVp?.paymentMode || '';
        const pmtRef = matchedVp?.referenceNumber || vpNum;
        const pmtDesc = matchedVp?.description || row.details || '';

        let desc = pmtMode ? `Payment Made - ${pmtMode}` : 'Payment Made';
        if (pmtRef) {
          desc += ` (${pmtRef})`;
        }

        transactions.push({
          id: paymentId || `vp-${vpNum || idx}`,
          type: 'vendor_payment',
          date: row.isoDate,
          datetime: row.isoDate,
          timestamp,
          description: desc,
          amount: row.paidAmount,
          debit: row.paidAmount,
          credit: 0,
          netEffect: row.paidAmount,
          customerNetEffect: 0,
          vendorNetEffect: row.paidAmount,
          balanceAfter: row.balance,
          referenceNumber: pmtRef,
          paymentNumber: vpNum,
          paymentMode: pmtMode,
          paymentReference: pmtRef,
          paymentDescription: pmtDesc,
          notes: pmtDesc,
          zohoUrl: undefined
        });
      } else {
        // Fallback for vendor credit or other transactions
        const isCredit = row.type === 'vendor_credit' || row.paidAmount > 0;
        const txAmount = isCredit ? row.paidAmount : row.billedAmount;
        const net = isCredit ? txAmount : -txAmount;

        transactions.push({
          id: `tx-other-${idx}`,
          type: (row.type as any) || 'journal',
          date: row.isoDate,
          datetime: row.isoDate,
          timestamp,
          description: row.details || row.rawType || 'Transaction',
          amount: txAmount,
          debit: isCredit ? txAmount : 0,
          credit: isCredit ? 0 : txAmount,
          netEffect: net,
          customerNetEffect: 0,
          vendorNetEffect: net,
          balanceAfter: row.balance,
          referenceNumber: row.reference,
          zohoUrl: undefined
        });
      }
    }

    // Unpaid bills for statement
    const unpaidBills = bills.filter(b => (b.balance ?? 0) > 0);
    unpaidBills.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Assemble CustomerStatement object
    const vendorCustomerObj: CustomerStatementCustomer = vendorMetadata || {
      contactId: vendorId,
      contactName: parsed.vendorName || 'Vendor',
      outstandingPayable: parsed.accountSummary.balanceDue,
      outstandingReceivable: 0,
      contactType: 'vendor'
    };

    const openingBalance = parsed.accountSummary.openingBalance;
    const closingBalance = parsed.accountSummary.balanceDue;

    const statementData: CustomerStatement = {
      customer: vendorCustomerObj,
      openingBalance,
      closingBalance,
      outstandingReceivable: 0,
      outstandingPayable: parsed.accountSummary.balanceDue,
      customerNet: 0,
      vendorNet: parsed.accountSummary.balanceDue,
      isHybrid: false,
      transactions,
      transactionCount: transactions.length,
      unpaidInvoices: unpaidBills as any,
      isTruncated: false,
      telemetry: {
        customerApiCalls: 1,
        invoiceApiCalls: 0,
        paymentApiCalls: 1,
        billApiCalls: 1,
        totalApiCalls: 3,
        rawInvoicesFetched: 0,
        validInvoicesAfterFilter: 0,
        rawBillsFetched: bills.length,
        validBillsAfterFilter: bills.length,
        debugReceivable: 0,
        debugPayable: parsed.accountSummary.balanceDue,
        debugNetClosingBalance: parsed.accountSummary.balanceDue,
        debugIsHybrid: false,
      }
    };

    return {
      success: true,
      data: statementData
    };
  } catch (error: any) {
    console.error('[Native Vendor Statement] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to process native Zoho Vendor Statement'
    };
  }
}
