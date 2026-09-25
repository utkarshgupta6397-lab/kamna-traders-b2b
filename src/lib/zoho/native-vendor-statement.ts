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
  CustomerStatementInvoice,
  StatementFetchOptions,
  getVendorPayments,
  CustomerStatementVendorPayment
} from './customer-statement';
import { getTodayIST } from './native-contact-statement';

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
    const endDate = maxDate || getTodayIST();
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

    // 1. Fetch native PDF and vendor payments list concurrently
    console.time('nativeVendorStatementFetch');
    const [pdfResult, vpResult] = await Promise.all([
      getNativeVendorStatementPdf(vendorId, minDate, maxDate, options),
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

    // 3. Build lookup maps directly from vendor payments list response (NO detail calls)
    const vendorPayments: CustomerStatementVendorPayment[] = vpResult.success && vpResult.data ? vpResult.data : [];
    const vpById = new Map<string, CustomerStatementVendorPayment>();
    const vpByNumber = new Map<string, CustomerStatementVendorPayment>();
    const vpByRef = new Map<string, CustomerStatementVendorPayment>();
    const vpByDateAmt = new Map<string, CustomerStatementVendorPayment>();

    for (const vp of vendorPayments) {
      if (vp.paymentId) {
        vpById.set(vp.paymentId, vp);
      }
      if (vp.paymentNumber) {
        vpByNumber.set(vp.paymentNumber.toLowerCase().trim(), vp);
      }
      if (vp.referenceNumber) {
        vpByRef.set(vp.referenceNumber.toLowerCase().trim(), vp);
      }
      if (vp.date && vp.amount !== undefined) {
        vpByDateAmt.set(`${vp.date}_${Number(vp.amount).toFixed(2)}`, vp);
      }
    }

    // Filter financial rows
    const financialRows = parsed.rows.filter(r => !r.isOpeningBalance && !r.isInformational);

    // 4. Transform parsed rows into ERP StatementTransaction[]
    const transactions: StatementTransaction[] = [];

    for (let idx = 0; idx < financialRows.length; idx++) {
      const row = financialRows[idx];
      const timestamp = new Date(row.isoDate || 0).getTime() + idx;

      if (row.type === 'bill') {
        const actualBillNumber = row.billNumber || row.reference || '';

        transactions.push({
          id: `bill-${actualBillNumber || idx}`,
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
          referenceNumber: row.reference || actualBillNumber,
          zohoUrl: undefined
        });
      } else if (row.type === 'payment_made') {
        const vpNum = row.paymentNumber || row.reference || '';
        const vpKey = vpNum.toLowerCase().trim();
        let matchedVp = vpKey ? (vpByNumber.get(vpKey) || vpByRef.get(vpKey)) : undefined;
        if (!matchedVp && row.isoDate && row.paidAmount) {
          matchedVp = vpByDateAmt.get(`${row.isoDate}_${Number(row.paidAmount).toFixed(2)}`);
        }
        const paymentId = matchedVp?.paymentId;
        const pmtMode = matchedVp?.paymentMode || '';
        const pmtRef = matchedVp?.referenceNumber || vpNum;
        const pmtDesc = matchedVp?.description || matchedVp?.notes || row.details || '';

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
      } else if (row.type === 'vendor_credit') {
        const vcNum = row.reference || '';
        const txAmount = row.amount || row.billedAmount || row.paidAmount || 0;

        let desc = 'Vendor Credit Note';
        if (row.billNumber) {
          desc = `Applied to ${row.billNumber}`;
        } else if (row.details) {
          desc = row.details;
        }

        transactions.push({
          id: `vc-${vcNum || idx}`,
          type: 'vendor_credit',
          date: row.isoDate,
          datetime: row.isoDate,
          timestamp,
          description: desc,
          amount: txAmount,
          debit: txAmount,
          credit: 0,
          netEffect: txAmount,
          customerNetEffect: 0,
          vendorNetEffect: txAmount,
          balanceAfter: row.balance,
          referenceNumber: vcNum,
          zohoUrl: undefined
        });
      } else {
        // Fallback for other transactions
        const isCredit = row.paidAmount > 0;
        const txAmount = row.amount || (isCredit ? row.paidAmount : row.billedAmount);
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

    const unpaidBills: CustomerStatementInvoice[] = [];

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
      unpaidInvoices: unpaidBills,
      isTruncated: false,
      telemetry: {
        customerApiCalls: vendorMetadata ? 0 : 1,
        invoiceApiCalls: 0,
        paymentApiCalls: 1,
        billApiCalls: 0,
        totalApiCalls: (vendorMetadata ? 1 : 2) + 1,
        rawInvoicesFetched: 0,
        validInvoicesAfterFilter: 0,
        rawBillsFetched: 0,
        validBillsAfterFilter: 0,
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
