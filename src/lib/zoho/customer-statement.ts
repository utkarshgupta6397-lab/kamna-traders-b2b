import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';
import { getNativeCustomerStatement } from './native-contact-statement';
import { getNativeVendorStatement } from './native-vendor-statement';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

export type CustomerStatementCustomer = {
  contactId: string;
  contactName: string;
  contactType?: string;
  companyName?: string;
  gstNo?: string;
  mobile?: string;
  email?: string;
  outstandingReceivable?: number;
  outstandingReceivableFormatted?: string;
  unusedCreditsReceivable?: number;
  associatedVendorId?: string;
  associatedCustomerId?: string;
  outstandingPayable?: number;
  unusedCreditsPayable?: number;
  billingAddress?: string;
  rawAddress?: any;
};

export type CustomerStatementInvoice = {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  status: string;
  total: number;
  balance: number;
  currencyCode?: string;
  referenceNumber?: string;
  salespersonName?: string;
};

export type StatementTransaction = {
  id: string;
  type: 'invoice' | 'payment' | 'bill' | 'vendor_payment' | 'journal' | 'payment_refund' | 'vendor_credit' | 'other';
  datetime?: string;
  date: string;
  timestamp?: number;
  description: string;
  amount: number;
  debit?: number;
  credit?: number;
  /**
   * Signed net effect on the party's receivable position.
   * invoice => +amount, payment => -amount, bill => -amount, vendor_payment => +amount
   */
  netEffect: number;
  customerNetEffect?: number;
  vendorNetEffect?: number;
  balanceAfter: number;
  isVerified?: boolean;
  zohoUrl?: string;
  appliedBills?: { billNumber: string; appliedAmount: number }[];
  appliedInvoices?: { invoiceNumber: string; invoiceId?: string; amountApplied: number; date?: string }[];
  notes?: string;
  entryNumber?: string;
  referenceNumber?: string;
  invoiceNumber?: string;
  paymentId?: string;
  paymentNumber?: string;
  paymentMode?: string;
  paymentReference?: string;
  paymentDescription?: string;
};

export type CustomerStatement = {
  customer: CustomerStatementCustomer;
  openingBalance: number;
  closingBalance: number;
  /** For hybrid accounts: raw outstanding_receivable_amount from Zoho */
  outstandingReceivable: number;
  /** For hybrid accounts: raw outstanding_payable_amount from Zoho */
  outstandingPayable: number;
  /** True net customer position including unused credits */
  customerNet: number;
  /** True net vendor position including unused credits */
  vendorNet: number;
  /** true for hybrid contacts (customer + vendor) */
  isHybrid: boolean;
  transactions: StatementTransaction[];
  transactionCount: number;
  unpaidInvoices: CustomerStatementInvoice[];
  /** true when fewer than all transactions are shown */
  isTruncated: boolean;
  /** API telemetry for the debug card */
  telemetry: {
    customerApiCalls: number;
    invoiceApiCalls: number;
    paymentApiCalls: number;
    billApiCalls: number;
    totalApiCalls: number;
    rawInvoicesFetched: number;
    validInvoicesAfterFilter: number;
    rawPaymentsFetched?: number;
    validPaymentsAfterFilter?: number;
    rawBillsFetched: number;
    validBillsAfterFilter: number;
    // Net position debug
    debugReceivable: number;
    debugPayable: number;
    debugNetClosingBalance: number;
    debugIsHybrid: boolean;
  };
};

export type StatementFetchMeta = {
  rawFetched: number;
  validCount: number;
  apiCalls: number;
  isTruncated?: boolean;
};

export type StatementFetchOptions = {
  fetchFn?: typeof fetch;
  orgId?: string;
  accessToken?: string;
  pageSize?: number;
  maxPages?: number;
  useCustomEngine?: boolean;
};

/**
 * Fetch all non-void invoices for a contact across all pages, sorted newest-first.
 * Uses Zoho Books maximum page size of 200 per call and automatically paginates
 * until all invoices are retrieved or safety limits are reached.
 */
export async function getCustomerInvoices(
  contactId: string,
  options?: StatementFetchOptions
): Promise<{
  success: boolean;
  data?: CustomerStatementInvoice[];
  raw?: any;
  error?: string;
  _meta?: StatementFetchMeta;
}> {
  try {
    const orgId = options?.orgId || getZohoOrgId();
    if (!orgId) throw new Error('Missing ZOHO_BOOKS_ORG_ID or ZOHO_ORGANIZATION_ID in environment variables');
    const accessToken = options?.accessToken || await getZohoTokens();
    if (!accessToken) throw new Error('Failed to get Zoho Access Token. Please re-authenticate.');

    const fetchImpl = options?.fetchFn || fetch;
    const perPage = options?.pageSize || 200;
    const maxPages = options?.maxPages || 50;

    let page = 1;
    let hasMore = true;
    let apiCalls = 0;
    let isTruncated = false;
    const rawInvoices: any[] = [];
    const seenIds = new Set<string>();
    let lastRawResponse: any = null;

    while (hasMore) {
      const url = `${API_BASE_URL}/books/v3/invoices?organization_id=${orgId}&customer_id=${contactId}&page=${page}&per_page=${perPage}&sort_column=date&sort_order=D`;
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });
      apiCalls++;

      const data = await response.json();
      lastRawResponse = data;

      if (!response.ok) {
        console.error(`[Zoho Invoices] Error on page ${page}:`, data);
        return {
          success: false,
          error: data.message || `Failed to fetch invoices (page ${page})`,
          raw: data,
          _meta: {
            rawFetched: rawInvoices.length,
            validCount: 0,
            apiCalls,
            isTruncated: true,
          },
        };
      }

      const pageInvoices: any[] = data.invoices ?? [];
      const hasMorePage = Boolean(data.page_context?.has_more_page);

      console.log(`[Zoho Invoices] Customer: ${contactId}`);
      console.log(`[Zoho Invoices] Page: ${page}`);
      console.log(`[Zoho Invoices] Requested: ${perPage}`);
      console.log(`[Zoho Invoices] Received: ${pageInvoices.length}`);
      console.log(`[Zoho Invoices] Has more: ${hasMorePage}`);

      let newItemsOnThisPage = 0;
      for (const inv of pageInvoices) {
        if (!inv.invoice_id) continue;
        if (!seenIds.has(inv.invoice_id)) {
          seenIds.add(inv.invoice_id);
          rawInvoices.push(inv);
          newItemsOnThisPage++;
        } else {
          console.warn(`[Zoho Invoices] Duplicate invoice detected across pages: ${inv.invoice_id} (${inv.invoice_number})`);
        }
      }

      // Determine whether more pages exist
      if (data.page_context && typeof data.page_context.has_more_page === 'boolean') {
        if (!data.page_context.has_more_page || pageInvoices.length === 0) {
          hasMore = false;
        } else {
          if (newItemsOnThisPage === 0 && pageInvoices.length > 0) {
            console.warn('[Zoho Invoices] Page returned only duplicate records, stopping pagination to prevent loop');
            hasMore = false;
            break;
          }
          page++;
        }
      } else {
        // Fallback when page_context is absent
        if (pageInvoices.length < perPage || pageInvoices.length === 0) {
          hasMore = false;
        } else {
          if (newItemsOnThisPage === 0) {
            hasMore = false;
            break;
          }
          page++;
        }
      }

      if (hasMore && page > maxPages) {
        console.warn(`[Zoho Invoices] Reached safety limit of ${maxPages} pages for customer ${contactId}. Halting pagination.`);
        isTruncated = true;
        hasMore = false;
        break;
      }
    }

    const items: CustomerStatementInvoice[] = rawInvoices
      .filter((inv: any) => inv.status !== 'void') // exclude void in app-layer
      .map((inv: any) => {
        if (!inv.date) {
          console.warn('[Zoho] Invoice missing date field. Raw object:', inv);
        }
        return {
          invoiceId: inv.invoice_id,
          invoiceNumber: inv.invoice_number,
          invoiceDate: inv.date || inv.created_time || inv.last_modified_time || '',
          dueDate: inv.due_date,
          status: inv.status,
          total: Number(inv.total),
          balance: Number(inv.balance !== undefined ? inv.balance : inv.balance_amount),
          currencyCode: inv.currency_code,
          referenceNumber: inv.reference_number,
          salespersonName: inv.salesperson_name,
        };
      });

    // Ensure sorting by date descending
    items.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());

    console.log('[Zoho Invoices] Complete');
    console.log(`[Zoho Invoices] Total raw invoices: ${rawInvoices.length}`);
    console.log(`[Zoho Invoices] Valid invoices: ${items.length}`);
    console.log(`[Zoho Invoices] API calls: ${apiCalls}`);

    return {
      success: true,
      data: items,
      raw: lastRawResponse,
      _meta: {
        rawFetched: rawInvoices.length,
        validCount: items.length,
        apiCalls,
        isTruncated,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Internal Server Error' };
  }
}

export async function getCustomerInvoiceById(invoiceId: string): Promise<{
  success: boolean;
  data?: any;
  raw?: any;
  error?: string;
}> {
  try {
    const orgId = getZohoOrgId();
    if (!orgId) throw new Error('Missing ZOHO_BOOKS_ORG_ID or ZOHO_ORGANIZATION_ID in environment variables');
    const accessToken = await getZohoTokens();
    if (!accessToken) throw new Error('Failed to get Zoho Access Token. Please re-authenticate.');

    const url = `${API_BASE_URL}/books/v3/invoices/${invoiceId}?organization_id=${orgId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to fetch invoice details', raw: data };
    }
    
    return { success: true, data: data.invoice, raw: data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Internal Server Error' };
  }
}

export type CustomerStatementPayment = {
  paymentId: string;
  paymentNumber: string;
  paymentMode: string;
  date: string;
  amount: number;
  referenceNumber?: string;
  isVerified?: boolean;
  notes?: string;
  description?: string;
};

export async function getCustomerPayments(
  contactId: string,
  options?: StatementFetchOptions
): Promise<{
  success: boolean;
  data?: CustomerStatementPayment[];
  raw?: any;
  error?: string;
  _meta?: StatementFetchMeta;
}> {
  try {
    const orgId = options?.orgId || getZohoOrgId();
    if (!orgId) throw new Error('Missing ZOHO_BOOKS_ORG_ID or ZOHO_ORGANIZATION_ID in environment variables');
    const accessToken = options?.accessToken || await getZohoTokens();
    if (!accessToken) throw new Error('Failed to get Zoho Access Token. Please re-authenticate.');

    const fetchImpl = options?.fetchFn || fetch;
    const perPage = options?.pageSize || 200;
    const maxPages = options?.maxPages || 50;

    let page = 1;
    let hasMore = true;
    let apiCalls = 0;
    let isTruncated = false;
    const rawPayments: any[] = [];
    const seenIds = new Set<string>();
    let lastRawResponse: any = null;

    while (hasMore) {
      const url = `${API_BASE_URL}/books/v3/customerpayments?organization_id=${orgId}&customer_id=${contactId}&page=${page}&per_page=${perPage}&sort_column=date&sort_order=D`;
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });
      apiCalls++;

      const data = await response.json();
      lastRawResponse = data;

      if (!response.ok) {
        console.warn(`[Zoho Payments] Failed to fetch payments (page ${page}):`, data);
        return {
          success: false,
          error: data.message || `Failed to fetch payments (page ${page})`,
          raw: data,
          _meta: {
            rawFetched: rawPayments.length,
            validCount: 0,
            apiCalls,
            isTruncated: true,
          },
        };
      }

      const pagePayments: any[] = data.customerpayments ?? [];
      const hasMorePage = Boolean(data.page_context?.has_more_page);

      console.log(`[Zoho Payments] Customer: ${contactId}`);
      console.log(`[Zoho Payments] Page: ${page}`);
      console.log(`[Zoho Payments] Requested: ${perPage}`);
      console.log(`[Zoho Payments] Received: ${pagePayments.length}`);
      console.log(`[Zoho Payments] Has more: ${hasMorePage}`);

      let newItemsOnThisPage = 0;
      for (const pmt of pagePayments) {
        if (!pmt.payment_id) continue;
        if (!seenIds.has(pmt.payment_id)) {
          seenIds.add(pmt.payment_id);
          rawPayments.push(pmt);
          newItemsOnThisPage++;
        } else {
          console.warn(`[Zoho Payments] Duplicate payment detected across pages: ${pmt.payment_id} (${pmt.payment_number})`);
        }
      }

      if (data.page_context && typeof data.page_context.has_more_page === 'boolean') {
        if (!data.page_context.has_more_page || pagePayments.length === 0) {
          hasMore = false;
        } else {
          if (newItemsOnThisPage === 0 && pagePayments.length > 0) {
            console.warn('[Zoho Payments] Page returned only duplicate records, stopping pagination to prevent loop');
            hasMore = false;
            break;
          }
          page++;
        }
      } else {
        if (pagePayments.length < perPage || pagePayments.length === 0) {
          hasMore = false;
        } else {
          if (newItemsOnThisPage === 0) {
            hasMore = false;
            break;
          }
          page++;
        }
      }

      if (hasMore && page > maxPages) {
        console.warn(`[Zoho Payments] Reached safety limit of ${maxPages} pages for customer ${contactId}. Halting.`);
        isTruncated = true;
        hasMore = false;
        break;
      }
    }

    const items: CustomerStatementPayment[] = rawPayments
      .filter((pmt: any) => !(pmt.deleted === true || pmt.status === 'void' || pmt.status === 'cancelled' || pmt.status === 'failure'))
      .map((pmt: any) => {
        const verifiedVal = String(pmt.custom_field_hash?.cf_is_verified ?? pmt.cf_is_verified ?? '').toLowerCase();
        const isVerified = ['true', '1'].includes(verifiedVal);
        return {
          paymentId: pmt.payment_id,
          paymentNumber: pmt.payment_number,
          paymentMode: pmt.payment_mode,
          date: pmt.date,
          amount: Number(pmt.amount),
          referenceNumber: pmt.reference_number,
          isVerified,
          notes: pmt.description,
          description: pmt.description,
        };
      });

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    console.log('[Zoho Payments] Complete');
    console.log(`[Zoho Payments] Total raw payments: ${rawPayments.length}`);
    console.log(`[Zoho Payments] Valid payments: ${items.length}`);
    console.log(`[Zoho Payments] API calls: ${apiCalls}`);

    return {
      success: true,
      data: items,
      raw: lastRawResponse,
      _meta: {
        rawFetched: rawPayments.length,
        validCount: items.length,
        apiCalls,
        isTruncated,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Internal Server Error' };
  }
}

export type CustomerPaymentDetail = {
  paymentId: string;
  paymentNumber: string;
  referenceNumber?: string;
  paymentMode?: string;
  description?: string;
  notes?: string;
  isVerified?: boolean;
  amount?: number;
  date?: string;
  raw?: any;
};

export async function getCustomerPaymentById(
  paymentId: string,
  options?: StatementFetchOptions
): Promise<{
  success: boolean;
  data?: CustomerPaymentDetail;
  error?: string;
}> {
  try {
    const orgId = options?.orgId || getZohoOrgId();
    if (!orgId) throw new Error('Missing ZOHO_BOOKS_ORG_ID or ZOHO_ORGANIZATION_ID in environment variables');
    const accessToken = options?.accessToken || await getZohoTokens();
    if (!accessToken) throw new Error('Failed to get Zoho Access Token. Please re-authenticate.');

    const fetchImpl = options?.fetchFn || fetch;
    const url = `${API_BASE_URL}/books/v3/customerpayments/${paymentId}?organization_id=${orgId}`;
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${errText}` };
    }

    const data = await res.json();
    const p = data?.payment;
    if (!p) {
      return { success: false, error: 'Payment object not found in response' };
    }

    const verifiedVal = String(p.custom_field_hash?.cf_is_verified ?? p.cf_is_verified ?? '').toLowerCase();
    const isVerified = ['true', '1'].includes(verifiedVal);

    return {
      success: true,
      data: {
        paymentId: p.payment_id,
        paymentNumber: p.payment_number,
        referenceNumber: (p.reference_number || '').trim(),
        paymentMode: (p.payment_mode || '').trim(),
        description: (p.description || '').trim(),
        notes: (p.notes || p.description || '').trim(),
        isVerified,
        amount: Number(p.amount || 0),
        date: p.date,
        raw: p,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Internal Server Error' };
  }
}

export type CustomerStatementBill = {
  billId: string;
  billNumber: string;
  date: string;
  amount: number;
  balance?: number;
  referenceNumber?: string;
};

export async function getVendorBills(
  vendorId: string,
  options?: StatementFetchOptions
): Promise<{
  success: boolean;
  data?: CustomerStatementBill[];
  raw?: any;
  error?: string;
  _meta?: StatementFetchMeta;
}> {
  try {
    const orgId = options?.orgId || getZohoOrgId();
    if (!orgId) throw new Error('Missing ZOHO_BOOKS_ORG_ID or ZOHO_ORGANIZATION_ID in environment variables');
    const accessToken = options?.accessToken || await getZohoTokens();
    if (!accessToken) throw new Error('Failed to get Zoho Access Token. Please re-authenticate.');

    const fetchImpl = options?.fetchFn || fetch;
    const perPage = options?.pageSize || 200;
    const maxPages = options?.maxPages || 50;

    let page = 1;
    let hasMore = true;
    let apiCalls = 0;
    let isTruncated = false;
    const rawBills: any[] = [];
    const seenIds = new Set<string>();
    let lastRawResponse: any = null;

    while (hasMore) {
      const url = `${API_BASE_URL}/books/v3/bills?organization_id=${orgId}&vendor_id=${vendorId}&page=${page}&per_page=${perPage}&sort_column=date&sort_order=D`;
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });
      apiCalls++;

      const data = await response.json();
      lastRawResponse = data;

      if (!response.ok) {
        console.warn(`[Zoho Bills] Failed to fetch bills (page ${page}):`, data);
        return {
          success: false,
          error: data.message || `Failed to fetch bills (page ${page})`,
          raw: data,
          _meta: {
            rawFetched: rawBills.length,
            validCount: 0,
            apiCalls,
            isTruncated: true,
          },
        };
      }

      const pageBills: any[] = data.bills ?? [];
      const hasMorePage = Boolean(data.page_context?.has_more_page);

      console.log(`[Zoho Bills] Vendor: ${vendorId}`);
      console.log(`[Zoho Bills] Page: ${page}`);
      console.log(`[Zoho Bills] Requested: ${perPage}`);
      console.log(`[Zoho Bills] Received: ${pageBills.length}`);
      console.log(`[Zoho Bills] Has more: ${hasMorePage}`);

      let newItemsOnThisPage = 0;
      for (const b of pageBills) {
        if (!b.bill_id) continue;
        if (!seenIds.has(b.bill_id)) {
          seenIds.add(b.bill_id);
          rawBills.push(b);
          newItemsOnThisPage++;
        }
      }

      if (data.page_context && typeof data.page_context.has_more_page === 'boolean') {
        if (!data.page_context.has_more_page || pageBills.length === 0) {
          hasMore = false;
        } else {
          if (newItemsOnThisPage === 0 && pageBills.length > 0) {
            hasMore = false;
            break;
          }
          page++;
        }
      } else {
        if (pageBills.length < perPage || pageBills.length === 0) {
          hasMore = false;
        } else {
          if (newItemsOnThisPage === 0) {
            hasMore = false;
            break;
          }
          page++;
        }
      }

      if (hasMore && page > maxPages) {
        isTruncated = true;
        hasMore = false;
        break;
      }
    }

    const items: CustomerStatementBill[] = rawBills
      .filter((b: any) => !(b.deleted === true || b.status === 'void' || b.status === 'cancelled'))
      .map((b: any) => ({
        billId: b.bill_id,
        billNumber: b.bill_number,
        date: b.date || b.created_time || b.last_modified_time || '',
        amount: Number(b.total),
        balance: Number(b.balance ?? 0),
        referenceNumber: b.reference_number,
      }));

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    console.log('[Zoho Bills] Complete');
    console.log(`[Zoho Bills] Total raw bills: ${rawBills.length}`);
    console.log(`[Zoho Bills] Valid bills: ${items.length}`);
    console.log(`[Zoho Bills] API calls: ${apiCalls}`);

    return {
      success: true,
      data: items,
      raw: lastRawResponse,
      _meta: {
        rawFetched: rawBills.length,
        validCount: items.length,
        apiCalls,
        isTruncated,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Internal Server Error' };
  }
}

export async function getVendorBillById(billId: string): Promise<{
  success: boolean;
  data?: any;
  raw?: any;
  error?: string;
}> {
  try {
    const orgId = getZohoOrgId();
    if (!orgId) throw new Error('Missing ZOHO_BOOKS_ORG_ID or ZOHO_ORGANIZATION_ID in environment variables');
    const accessToken = await getZohoTokens();
    if (!accessToken) throw new Error('Failed to get Zoho Access Token. Please re-authenticate.');

    const url = `${API_BASE_URL}/books/v3/bills/${billId}?organization_id=${orgId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to fetch bill details', raw: data };
    }
    
    return { success: true, data: data.bill, raw: data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Internal Server Error' };
  }
}

export type CustomerStatementVendorPayment = {
  paymentId: string;
  paymentNumber: string;
  paymentMode: string;
  date: string;
  amount: number;
  referenceNumber?: string;
  appliedBills?: { billNumber: string; appliedAmount: number }[];
  notes?: string;
  description?: string;
};

export async function getVendorPayments(
  vendorId: string,
  options?: StatementFetchOptions
): Promise<{
  success: boolean;
  data?: CustomerStatementVendorPayment[];
  raw?: any;
  error?: string;
}> {
  try {
    const orgId = options?.orgId || getZohoOrgId();
    if (!orgId) throw new Error('Missing ZOHO_BOOKS_ORG_ID or ZOHO_ORGANIZATION_ID in environment variables');
    const accessToken = options?.accessToken || await getZohoTokens();
    if (!accessToken) throw new Error('Failed to get Zoho Access Token. Please re-authenticate.');

    const fetchImpl = options?.fetchFn || fetch;
    const url = `${API_BASE_URL}/books/v3/vendorpayments?organization_id=${orgId}&vendor_id=${vendorId}&page=1&per_page=200&sort_column=date&sort_order=D`;
    console.log('[Zoho Vendor Payments] API URL:', url);
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    const data = await response.json();
    
    if (!response.ok) {
      console.warn('[Zoho Vendor Payments] Failed to fetch vendor payments:', data);
      return { success: false, error: data.message || 'Failed to fetch vendor payments', raw: data };
    }
    const raw: any[] = data.vendorpayments ?? [];
    
    const mappedPayments: CustomerStatementVendorPayment[] = raw.map((vp: any) => ({
      paymentId: vp.payment_id,
      paymentNumber: vp.payment_number,
      paymentMode: vp.payment_mode,
      date: vp.date,
      amount: Number(vp.amount),
      referenceNumber: vp.reference_number,
      appliedBills: [],
      notes: vp.description,
      description: vp.description || '',
    }));
      
    return {
      success: true,
      data: mappedPayments,
      raw: data,
      _meta: { rawFetched: raw.length, validCount: mappedPayments.length, apiCalls: 1 },
    } as any;
  } catch (error: any) {
    return { success: false, error: error.message || 'Internal Server Error' };
  }
}

export type CustomerStatementJournal = {
  journalId: string;
  entryNumber: string;
  date: string;
  amount: number;
  netEffect: number; // calculated from line items
  customerNetEffect?: number;
  vendorNetEffect?: number;
  referenceNumber?: string;
  notes?: string;
  description?: string;
};

export async function getHybridJournals(contactId: string, associatedVendorId: string): Promise<{
  success: boolean;
  data?: CustomerStatementJournal[];
  raw?: any;
  error?: string;
}> {
  try {
    const orgId = getZohoOrgId();
    if (!orgId) throw new Error('Missing ZOHO_BOOKS_ORG_ID or ZOHO_ORGANIZATION_ID in environment variables');
    const accessToken = await getZohoTokens();
    if (!accessToken) throw new Error('Failed to get Zoho Access Token. Please re-authenticate.');

    // Fetch journals. We filter by both customer_id and vendor_id if necessary,
    // but Zoho API only supports one customer_id per request. We'll make two requests if needed and merge,
    // or just fetch all for the org if we don't know (but org might have too many).
    // Let's do two requests: one for customer and one for vendor, then merge.
    const urlC = `${API_BASE_URL}/books/v3/journals?organization_id=${orgId}&customer_id=${contactId}&page=1&per_page=50`;
    const urlV = `${API_BASE_URL}/books/v3/journals?organization_id=${orgId}&customer_id=${associatedVendorId}&page=1&per_page=50`;
    
    console.log('[Zoho Journals] API URL C:', urlC);
    console.log('[Zoho Journals] API URL V:', urlV);
    
    const [resC, resV] = await Promise.all([
      fetch(urlC, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }),
      fetch(urlV, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } })
    ]);
    
    const dataC = await resC.json();
    const dataV = await resV.json();
    
    if (!resC.ok && !resV.ok) {
      return { success: false, error: dataC.message || 'Failed to fetch journals', raw: dataC };
    }
    
    const rawC: any[] = dataC.journals ?? [];
    const rawV: any[] = dataV.journals ?? [];
    
    // Merge and deduplicate by journal_id
    const mergedJournals = new Map();
    [...rawC, ...rawV].forEach(j => mergedJournals.set(j.journal_id, j));
    const raw = Array.from(mergedJournals.values());
    
    // Fetch detailed journal entries to get line_items
    const detailedJournals = await Promise.all(
      raw.map(async (j: any) => {
        try {
          const detailUrl = `${API_BASE_URL}/books/v3/journals/${j.journal_id}?organization_id=${orgId}`;
          const detailRes = await fetch(detailUrl, {
            method: 'GET',
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
          });
          const detailData = await detailRes.json();
          const journal = detailData.journal;
          if (!journal || !journal.line_items) return null;
          
          // Filter line items for this customer/vendor
          // Note: Zoho line_items use 'customer_id' to store the contact ID regardless if it's a vendor or customer.
          const relevantLines = journal.line_items.filter((li: any) => 
            li.customer_id === contactId || li.customer_id === associatedVendorId
          );
          
          if (relevantLines.length === 0) return null;
          
          // Determine netEffect from line items. 
          // From the statement perspective: Debit is positive (adds to customer balance), Credit is negative.
          let netEffect = 0;
          let customerNetEffect = 0;
          let vendorNetEffect = 0;
          let amount = 0;
          
          for (const line of relevantLines) {
            const lineAmount = Number(line.amount);
            const isCustomerRow = line.customer_id === contactId;
            const isVendorRow = line.customer_id === associatedVendorId;
            
            if (line.debit_or_credit === 'debit') {
              netEffect += lineAmount;
              if (isCustomerRow) customerNetEffect += lineAmount;
              if (isVendorRow) vendorNetEffect += lineAmount;
              amount += lineAmount;
            } else if (line.debit_or_credit === 'credit') {
              netEffect -= lineAmount;
              if (isCustomerRow) customerNetEffect -= lineAmount;
              if (isVendorRow) vendorNetEffect -= lineAmount;
              amount += lineAmount;
            }
          }

          // Let's filter out empty or duplicate line item descriptions
          const lineDescriptions = relevantLines
            .map((li: any) => li.description)
            .filter(Boolean)
            .filter((val: string, idx: number, self: string[]) => self.indexOf(val) === idx);
          const description = lineDescriptions.join(', ') || journal.notes || '';

          return {
            journalId: journal.journal_id,
            entryNumber: journal.entry_number,
            date: journal.journal_date,
            amount: Math.abs(amount), // absolute value for the display amount
            netEffect,
            customerNetEffect,
            vendorNetEffect,
            referenceNumber: journal.reference_number,
            notes: journal.notes,
            description,
          };
        } catch (e) {
          return null;
        }
      })
    );
      
    const validJournals = detailedJournals.filter(Boolean) as CustomerStatementJournal[];
    
    return {
      success: true,
      data: validJournals,
      raw: { rawC, rawV },
      _meta: { rawFetched: raw.length, validCount: validJournals.length, apiCalls: 2 + raw.length },
    } as any;
  } catch (error: any) {
    return { success: false, error: error.message || 'Internal Server Error' };
  }
}

/**
 * Build a reverse-calculated statement prototype.
 *
 * APPROACH (intentionally approximate — Phase 2A):
 *   closing = customer.outstanding_receivable_amount  (source of truth from Zoho)
 *   opening = closing − sum(invoice totals in this window)
 *   We then replay invoices forward to build balanceAfter per row.
 *
 * This is NOT full reconciliation. Payments, credits and adjustments are
 * excluded and will be added in a future ledger engine phase.
 */
/**
 * Customer Statement Entry Point.
 *
 * For standard customers, Zoho Books native Contact Statement is the authoritative SOURCE OF TRUTH.
 * For hybrid accounts (customer + vendor), the clearly isolated hybrid ledger engine is executed.
 */
export async function getCustomerStatement(
  contactId: string,
  minDate: string = '2026-03-01',
  maxDate?: string,
  options?: StatementFetchOptions
): Promise<{
  success: boolean;
  data?: CustomerStatement;
  raw?: any;
  error?: string;
}> {
  // 1. Fetch customer metadata to check if this is a hybrid account or pure vendor
  const customerResult = await getCustomerById(contactId, options);
  if (!customerResult.success || !customerResult.data) {
    return { success: false, error: customerResult.error, raw: customerResult.raw };
  }
  const customer = customerResult.data;

  // Vendor account: Use Zoho Native Vendor Statement as authoritative source of truth
  if (customer.contactType === 'vendor') {
    console.log(`[Customer Statement] Contact ${contactId} is a Vendor. Using Zoho Native Vendor Statement.`);
    return getNativeVendorStatement(contactId, minDate, maxDate, options, customer);
  }

  // Explicit custom engine request: execute isolated custom engine
  if (options?.useCustomEngine) {
    console.log(`[Customer Statement] Contact ${contactId}: explicit custom engine requested. Using custom hybrid engine.`);
    return getCustomerStatementHybrid(contactId, customerResult, minDate, maxDate, options);
  }

  // Hybrid accounts: execute authoritative hybrid native statement engine
  if (customer.associatedVendorId || customer.associatedCustomerId) {
    console.log(`[Customer Statement] Contact ${contactId} is a Hybrid account. Using native hybrid engine.`);
    return getCustomerStatementHybridNative(contactId, customerResult, minDate, maxDate, options);
  }

  // Standard customer accounts: Zoho Native Contact Statement is the authoritative single source of truth
  console.log(`[Customer Statement] Contact ${contactId} is a standard customer. Using Zoho Native Contact Statement as source of truth.`);
  const nativeResult = await getNativeCustomerStatement(contactId, minDate, maxDate, options, customer);
  if (!nativeResult.success || !nativeResult.data) {
    return { success: false, error: nativeResult.error, raw: nativeResult.raw };
  }

  return { success: true, data: nativeResult.data };
}

/**
 * Authoritative Hybrid Statement Engine combining Native Customer Statement and Native Vendor Statement.
 */
export async function getCustomerStatementHybridNative(
  contactId: string,
  customerResult: { success: boolean; data?: CustomerStatementCustomer; raw?: any; error?: string },
  minDate: string = '2026-03-01',
  maxDate?: string,
  options?: StatementFetchOptions
): Promise<{
  success: boolean;
  data?: CustomerStatement;
  raw?: any;
  error?: string;
}> {
  const customer = customerResult.data!;
  const customerId = customer.contactType === 'vendor' ? customer.associatedCustomerId! : contactId;
  const vendorId = customer.contactType === 'vendor' ? contactId : customer.associatedVendorId!;

  console.log(`[Hybrid Native Statement] Fetching native statements for Customer ${customerId} and Vendor ${vendorId}`);

  // Fetch Native Customer Statement and Native Vendor Statement concurrently
  const [custRes, vendRes] = await Promise.all([
    getNativeCustomerStatement(customerId, minDate, maxDate, options, customer),
    getNativeVendorStatement(vendorId, minDate, maxDate, options)
  ]);

  if (!custRes.success || !custRes.data) {
    return { success: false, error: custRes.error || 'Failed to fetch native customer statement', raw: custRes.raw };
  }
  if (!vendRes.success || !vendRes.data) {
    return { success: false, error: vendRes.error || 'Failed to fetch native vendor statement', raw: vendRes.raw };
  }

  const custData = custRes.data;
  const vendData = vendRes.data;

  // Tag customer transactions
  const customerTransactions: StatementTransaction[] = custData.transactions.map(tx => ({
    ...tx,
    customerNetEffect: tx.netEffect,
    vendorNetEffect: 0,
  }));

  // Tag vendor transactions
  const vendorTransactions: StatementTransaction[] = vendData.transactions.map(tx => ({
    ...tx,
    customerNetEffect: 0,
    vendorNetEffect: tx.netEffect,
  }));

  // Merge customer and vendor transactions
  let merged: StatementTransaction[] = [
    ...customerTransactions,
    ...vendorTransactions
  ];

  // Optional date filtering
  if (minDate) {
    merged = merged.filter(tx => new Date(tx.date) >= new Date(minDate));
  }
  if (maxDate) {
    merged = merged.filter(tx => new Date(tx.date) <= new Date(maxDate));
  }

  // Sort newest first to calculate running balances
  merged.sort((a, b) => {
    const timeA = a.timestamp || new Date(a.date).getTime();
    const timeB = b.timestamp || new Date(b.date).getTime();
    return timeB - timeA;
  });

  const outstandingReceivable = customer.outstandingReceivable ?? custData.outstandingReceivable ?? 0;
  const outstandingPayable = customer.outstandingPayable ?? vendData.outstandingPayable ?? 0;

  // Native statement closing balances (balanceDue) already represent the authoritative net positions
  const customerNet = custData.closingBalance;
  const vendorNet = vendData.closingBalance;
  const netClosingBalance = customerNet - vendorNet;

  // Reverse calculate running balance starting from netClosingBalance
  let runningBalance = netClosingBalance;
  const transactions: StatementTransaction[] = [];

  for (const item of merged) {
    transactions.push({
      ...item,
      balanceAfter: runningBalance,
    });
    runningBalance -= item.netEffect;
  }

  const openingBalance = runningBalance;
  transactions.reverse(); // oldest first for UI display

  const statement: CustomerStatement = {
    customer,
    openingBalance,
    closingBalance: netClosingBalance,
    outstandingReceivable,
    outstandingPayable,
    customerNet,
    vendorNet,
    isHybrid: true,
    transactions,
    transactionCount: transactions.length,
    unpaidInvoices: custData.unpaidInvoices,
    isTruncated: false,
    telemetry: {
      customerApiCalls: 1,
      invoiceApiCalls: 0,
      paymentApiCalls: 2,
      billApiCalls: 0,
      totalApiCalls: 5,
      rawInvoicesFetched: custData.transactionCount,
      validInvoicesAfterFilter: custData.transactionCount,
      rawPaymentsFetched: 0,
      validPaymentsAfterFilter: 0,
      rawBillsFetched: vendData.transactionCount,
      validBillsAfterFilter: vendData.transactionCount,
      debugReceivable: outstandingReceivable,
      debugPayable: outstandingPayable,
      debugNetClosingBalance: netClosingBalance,
      debugIsHybrid: true,
    },
  };

  return {
    success: true,
    data: statement,
    raw: { customer: customerResult.raw, nativeCustomer: custRes.raw, nativeVendor: vendRes.raw },
  };
}

/**
 * Isolated Hybrid Statement Engine for contacts that are simultaneously Customers and Vendors.
 */
export async function getCustomerStatementHybrid(
  contactId: string,
  customerResult: { success: boolean; data?: CustomerStatementCustomer; raw?: any; error?: string },
  minDate?: string,
  maxDate?: string,
  options?: StatementFetchOptions
): Promise<{
  success: boolean;
  data?: CustomerStatement;
  raw?: any;
  error?: string;
}> {
  const customer = customerResult.data!;
  // 1. Parallelize base API calls for invoices and payments
  console.time('invoices');
  const invoicesPromise = getCustomerInvoices(contactId, options).finally(() => console.timeEnd('invoices'));
  
  console.time('payments');
  const paymentsPromise = getCustomerPayments(contactId, options).finally(() => console.timeEnd('payments'));

  const [invoicesResult, paymentsResult] = await Promise.all([
    invoicesPromise,
    paymentsPromise
  ]);

  // 2. Conditionally fetch bills, vendor payments, and journals for Hybrid accounts
  let billsResult: any = { success: true, data: [] };
  let vendorPaymentsResult: any = { success: true, data: [] };
  let journalsResult: any = { success: true, data: [] };
  
  const outstandingPayable = customer.outstandingPayable ?? 0;
  if (customer.associatedVendorId) {
    console.time('hybridData');
    const promises: Promise<any>[] = [];
    promises.push(getVendorBills(customer.associatedVendorId));
    promises.push(getVendorPayments(customer.associatedVendorId));
    // Always fetch journals for Hybrid accounts
    promises.push(getHybridJournals(contactId, customer.associatedVendorId));
    
    const [bRes, vpRes, jRes] = await Promise.all(promises);
    billsResult = bRes;
    vendorPaymentsResult = vpRes;
    journalsResult = jRes;
    console.timeEnd('hybridData');
  }
  
  if (!invoicesResult.success) {
    return { success: false, error: invoicesResult.error, raw: invoicesResult.raw };
  }

  if (!paymentsResult.success) {
    return { success: false, error: paymentsResult.error || 'Failed to fetch customer payments', raw: paymentsResult.raw };
  }

  const invoices = invoicesResult.data ?? [];
  const payments = paymentsResult.data ?? [];
  const bills = (billsResult.success ? billsResult.data : []) ?? [];
  const vendorPayments = (vendorPaymentsResult.success ? vendorPaymentsResult.data : []) ?? [];

  // 3. Merge into unified timeline with signed netEffect and memoized timestamp
  const orgId = getZohoOrgId() || process.env.ZOHO_BOOKS_ORG_ID;
  let mergedRaw: Array<{
    id: string;
    type: 'invoice' | 'payment' | 'bill' | 'vendor_payment' | 'journal';
    date: string;
    datetime: string;
    timestamp: number;
    description: string;
    amount: number;
    netEffect: number;
    customerNetEffect?: number;
    vendorNetEffect?: number;
    isVerified?: boolean;
    zohoUrl?: string;
    appliedBills?: { billNumber: string; appliedAmount: number }[];
    notes?: string;
    referenceNumber?: string;
    invoiceNumber?: string;
  }> = [
    ...invoices.map((inv: any) => ({
      id: inv.invoiceId,
      type: 'invoice' as const,
      date: inv.invoiceDate,
      datetime: inv.invoiceDate,
      timestamp: new Date(inv.invoiceDate || 0).getTime(),
      description: `Invoice ${inv.invoiceNumber}`,
      amount: inv.total,
      netEffect: inv.total,
      customerNetEffect: inv.total,
      vendorNetEffect: 0,
      invoiceNumber: inv.invoiceNumber,
      referenceNumber: inv.referenceNumber,
      zohoUrl: orgId ? `https://books.zoho.in/app/${orgId}#/invoices/${inv.invoiceId}` : undefined,
    })),
    ...payments.map((pmt: any) => {
      let desc = pmt.paymentMode ? `Payment - ${pmt.paymentMode}` : 'Customer Payment';
      
      return {
        id: pmt.paymentId,
        type: 'payment' as const,
        date: pmt.date,
        datetime: pmt.date,
        timestamp: new Date(pmt.date || 0).getTime(),
        description: desc,
        amount: pmt.amount,
        netEffect: -pmt.amount,
        customerNetEffect: -pmt.amount,
        vendorNetEffect: 0,
        isVerified: pmt.isVerified,
        referenceNumber: pmt.referenceNumber,
        zohoUrl: orgId ? `https://books.zoho.in/app/${orgId}#/paymentsreceived/${pmt.paymentId}?customview_id=1759923000006656536&per_page=200&sort_column=date&sort_order=D` : undefined,
        notes: pmt.notes,
      };
    }),
    ...bills.map((b: any) => ({
      id: b.billId,
      type: 'bill' as const,
      date: b.date,
      datetime: b.date,
      timestamp: new Date(b.date || 0).getTime(),
      description: b.referenceNumber ? `Purchase Bill - ${b.referenceNumber}` : `Purchase Bill - ${b.billNumber}`,
      amount: b.amount,
      netEffect: -b.amount,
      customerNetEffect: 0,
      vendorNetEffect: -b.amount,
      zohoUrl: orgId ? `https://books.zoho.in/app/${orgId}#/bills/${b.billId}` : undefined,
    })),
    ...vendorPayments.map((vp: any) => {
      let desc = vp.paymentMode ? `Payment Made - ${vp.paymentMode}` : 'Payment Made';
      if (vp.referenceNumber) {
        desc += ` (${vp.referenceNumber})`;
      }
      return {
        id: vp.paymentId,
        type: 'vendor_payment' as const,
        date: vp.date,
        datetime: vp.date,
        timestamp: new Date(vp.date || 0).getTime(),
        description: desc,
        amount: vp.amount,
        netEffect: vp.amount,
        customerNetEffect: 0,
        vendorNetEffect: vp.amount,
        appliedBills: vp.bills ? vp.bills.map((b: any) => ({
          billNumber: b.billNumber,
          appliedAmount: b.amountApplied
        })) : undefined,
        zohoUrl: orgId ? `https://books.zoho.in/app/${orgId}#/paymentsmade/${vp.paymentId}` : undefined,
        notes: vp.notes,
      };
    }),
    ...(journalsResult.success ? journalsResult.data : []).map((j: any) => {
      return {
        id: j.journalId,
        type: 'journal' as const,
        date: j.date,
        datetime: j.date,
        timestamp: new Date(j.date || 0).getTime(),
        description: j.description || '',
        amount: j.amount,
        netEffect: j.netEffect,
        zohoUrl: orgId ? `https://books.zoho.in/app/${orgId}#/accountant/journals/${j.journalId}?filter_by=Status.All%2CJournalDate.All&per_page=25&sort_column=journal_date&sort_order=D` : undefined,
        notes: j.notes,
        entryNumber: j.entryNumber,
        referenceNumber: j.referenceNumber,
      };
    }),
  ];

  if (minDate) {
    mergedRaw = mergedRaw.filter(tx => {
      const txDate = new Date(tx.date);
      const limit = new Date(minDate);
      return txDate >= limit;
    });
  }
  if (maxDate) {
    mergedRaw = mergedRaw.filter(tx => {
      const txDate = new Date(tx.date);
      const limit = new Date(maxDate);
      return txDate <= limit;
    });
  }

  console.log('[Zoho Statement] Merged transaction count:', mergedRaw.length);

  // 4. Sort chronologically NEWEST FIRST using memoized timestamp
  mergedRaw.sort((a, b) => b.timestamp - a.timestamp);

  // We keep all fetched transactions after the date limit filter
  const renderedTransactions = mergedRaw;
  console.log('[Zoho Statement] Final rendered transaction count:', renderedTransactions.length);

  const outstandingReceivable = customer.outstandingReceivable ?? 0;
  const customerUnusedCredits = customer.unusedCreditsReceivable ?? 0;
  // outstandingPayable is already declared above (line ~319)
  const vendorUnusedCredits = customer.unusedCreditsPayable ?? 0;

  const customerNet = outstandingReceivable - customerUnusedCredits;
  const vendorNet = outstandingPayable - vendorUnusedCredits;
  const isHybrid = !!customer.associatedVendorId;

  const netClosingBalance = isHybrid ? (customerNet - vendorNet) : customerNet;

  console.debug('[Statement Balance Debug]', {
    outstandingReceivables: outstandingReceivable,
    customerUnusedCredits,
    outstandingPayables: outstandingPayable,
    vendorUnusedCredits,
    customerNet,
    vendorNet,
    finalClosingBalance: netClosingBalance,
    isHybrid
  });

  // 7. Reverse-calculate running balances from newest → oldest
  //    runningBalance starts at netClosingBalance (after the last transaction)
  //    For each transaction (newest first): balanceAfter = runningBalance, then runningBalance -= tx.netEffect
  let runningBalance = netClosingBalance;
  const transactions: StatementTransaction[] = [];

  for (const item of renderedTransactions) {
    transactions.push({
      ...item,
      balanceAfter: runningBalance,
    });
    // Reverse the netEffect to get balance before this transaction
    runningBalance -= item.netEffect;
  }

  const openingBalance = runningBalance;

  // Display oldest → newest
  transactions.reverse();

  // Extract unpaid invoices and sort oldest first
  const unpaidInvoices = invoices.filter((i: any) => i.balance > 0);
  unpaidInvoices.sort((a, b) => new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime());

  const invMeta  = (invoicesResult as any)._meta  ?? { rawFetched: invoices.length, validCount: invoices.length, apiCalls: 1, isTruncated: false };
  const pmtMeta  = paymentsResult.success ? ((paymentsResult as any)._meta ?? { rawFetched: 0, validCount: 0, apiCalls: 1, isTruncated: false }) : { rawFetched: 0, validCount: 0, apiCalls: 1, isTruncated: false };
  const billMeta = (billsResult.success && (billsResult as any)._meta) ? (billsResult as any)._meta : { rawFetched: 0, validCount: 0, apiCalls: 0, isTruncated: false };
  const vpMeta   = (vendorPaymentsResult.success && (vendorPaymentsResult as any)._meta) ? (vendorPaymentsResult as any)._meta : { rawFetched: 0, validCount: 0, apiCalls: 0, isTruncated: false };
  const jMeta    = (journalsResult.success && (journalsResult as any)._meta) ? (journalsResult as any)._meta : { rawFetched: 0, validCount: 0, apiCalls: 0, isTruncated: false };

  const invoiceApiCalls = invMeta.apiCalls ?? 1;
  const paymentApiCalls = pmtMeta.apiCalls ?? 1;
  const billApiCalls = isHybrid ? ((billMeta.apiCalls ?? 0) + (vpMeta.apiCalls ?? 0)) : 0;
  const journalApiCalls = isHybrid ? (jMeta.apiCalls ?? 0) : 0;
  const totalApiCalls = 1 + invoiceApiCalls + paymentApiCalls + billApiCalls + journalApiCalls;

  const isTruncated = Boolean(
    invMeta.isTruncated ||
    pmtMeta.isTruncated ||
    (isHybrid && (billMeta.isTruncated || vpMeta.isTruncated || jMeta.isTruncated))
  );

  return {
    success: true,
    data: {
      customer,
      openingBalance,
      closingBalance: netClosingBalance,
      outstandingReceivable,
      outstandingPayable,
      customerNet,
      vendorNet,
      isHybrid,
      transactions,
      transactionCount: transactions.length,
      unpaidInvoices,
      isTruncated,
      telemetry: {
        customerApiCalls: 1,
        invoiceApiCalls,
        paymentApiCalls,
        billApiCalls,
        totalApiCalls,
        rawInvoicesFetched: invMeta.rawFetched,
        validInvoicesAfterFilter: invMeta.validCount,
        rawPaymentsFetched: pmtMeta.rawFetched,
        validPaymentsAfterFilter: pmtMeta.validCount,
        rawBillsFetched: isHybrid ? (billMeta.rawFetched + (vpMeta.rawFetched || 0)) : 0,
        validBillsAfterFilter: isHybrid ? (billMeta.validCount + (vpMeta.validCount || 0)) : 0,
        debugReceivable: outstandingReceivable,
        debugPayable: outstandingPayable,
        debugNetClosingBalance: netClosingBalance,
        debugIsHybrid: isHybrid,
      },
    },
    raw: { customer: customerResult.raw, invoices: invoicesResult.raw, bills: billsResult.raw },
  };
}


export async function getCustomerById(
  contactId: string,
  options?: StatementFetchOptions
): Promise<{ success: boolean; data?: CustomerStatementCustomer; raw?: any; error?: string }> {
  try {
    const orgId = options?.orgId || getZohoOrgId();
    if (!orgId) {
      throw new Error('Missing ZOHO_BOOKS_ORG_ID or ZOHO_ORGANIZATION_ID in environment variables');
    }
    
    const accessToken = options?.accessToken || await getZohoTokens();
    if (!accessToken) {
      throw new Error('Failed to get Zoho Access Token. Please re-authenticate.');
    }

    const fetchImpl = options?.fetchFn || fetch;
    const url = `${API_BASE_URL}/books/v3/contacts/${contactId}?organization_id=${orgId}`;
    
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to fetch customer from Zoho', raw: data };
    }

    const contact = data.contact;
    if (!contact) {
       return { success: false, error: 'Customer data missing in Zoho response', raw: data };
    }

    console.log('[GST Fetch Debug]', {
      customerId: contactId,
      zohoResponse: data,
      gstNo: contact.gst_no,
      gstin: contact.gstin,
      gstNumber: contact.gst_number,
      taxNumber: contact.tax_number,
      taxId: contact.tax_id
    });

    const billingAddr = contact.billing_address ? 
      [contact.billing_address.address, contact.billing_address.city, contact.billing_address.state, contact.billing_address.zip].filter(Boolean).join(', ') 
      : undefined;

    const normalized: CustomerStatementCustomer = {
      contactId: contact.contact_id,
      contactName: contact.contact_name,
      contactType: contact.contact_type,
      companyName: contact.company_name,
      gstNo: contact.gst_no,
      mobile: contact.mobile,
      email: contact.email,
      outstandingReceivable: contact.outstanding_receivable_amount ?? contact.associated_customer_details?.outstanding_receivable_amount ?? 0,
      unusedCreditsReceivable: contact.unused_credits_receivable_amount ?? contact.associated_customer_details?.unused_credits_receivable_amount ?? 0,
      outstandingReceivableFormatted: contact.outstanding_receivable_amount_formatted,
      associatedVendorId: contact.associated_vendor_details?.vendor_id,
      associatedCustomerId: contact.associated_customer_details?.customer_id,
      outstandingPayable: contact.outstanding_payable_amount ?? contact.associated_vendor_details?.outstanding_payable_amount ?? 0,
      unusedCreditsPayable: contact.unused_credits_payable_amount ?? contact.associated_vendor_details?.unused_credits_payable_amount ?? 0,
      billingAddress: billingAddr,
      rawAddress: contact.billing_address || contact.shipping_address || null
    };

    return { success: true, data: normalized, raw: data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Internal Server Error' };
  }
}
