import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

export type CustomerStatementCustomer = {
  contactId: string;
  contactName: string;
  companyName?: string;
  gstNo?: string;
  mobile?: string;
  email?: string;
  outstandingReceivable?: number;
  outstandingReceivableFormatted?: string;
  billingAddress?: string;
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
  type: 'invoice';
  date: string;
  reference: string;       // invoice number
  narration: string;       // e.g. "Invoice INV-001"
  amount: number;          // invoice total (positive = charge)
  balanceAfter: number;    // running balance after this line
};

export type CustomerStatement = {
  customer: CustomerStatementCustomer;
  openingBalance: number;
  closingBalance: number;
  transactions: StatementTransaction[];
  invoiceCount: number;
  /** true when fewer than all invoices are shown */
  isTruncated: boolean;
  /** API telemetry for the debug card */
  telemetry: {
    customerApiCalls: number;
    invoiceApiCalls: number;
    totalApiCalls: number;
    rawInvoicesFetched: number;
    validInvoicesAfterFilter: number;
  };
};

/**
 * Fetch up to 10 latest non-void invoices for a contact, sorted newest-first.
 * Returns the raw list for the debugger.
 */
export async function getCustomerInvoices(contactId: string): Promise<{
  success: boolean;
  data?: CustomerStatementInvoice[];
  raw?: any;
  error?: string;
}> {
  try {
    const orgId = getZohoOrgId();
    if (!orgId) throw new Error('Missing ZOHO_BOOKS_ORG_ID or ZOHO_ORGANIZATION_ID in environment variables');
    const accessToken = await getZohoTokens();
    if (!accessToken) throw new Error('Failed to get Zoho Access Token. Please re-authenticate.');

    // Fetch invoices — no custom sort/status params (Zoho rejects unsupported enums)
    // We filter void and sort locally after receiving the response
    // Fetch 15 as buffer — void invoices are filtered in-app, so 15 ensures we always have 10 valid
    const url = `${API_BASE_URL}/books/v3/invoices?organization_id=${orgId}&contact_id=${contactId}&per_page=15`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to fetch invoices', raw: data };
    }
    const raw: any[] = data.invoices ?? [];
    const items: CustomerStatementInvoice[] = raw
      .filter((inv: any) => inv.status !== 'void')       // exclude void in app-layer
      .sort((a: any, b: any) =>                          // newest-first
        new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()
      )
      .slice(0, 10)                                       // take latest 10 valid invoices
      .map((inv: any) => ({
        invoiceId: inv.invoice_id,
        invoiceNumber: inv.invoice_number,
        invoiceDate: inv.invoice_date,
        dueDate: inv.due_date,
        status: inv.status,
        total: Number(inv.total),
        balance: Number(inv.balance_amount),
        currencyCode: inv.currency_code,
        referenceNumber: inv.reference_number,
        salespersonName: inv.salesperson_name,
      }));
    return {
      success: true,
      data: items,
      raw: data,
      // telemetry fields for caller
      _meta: { rawFetched: raw.length, validCount: items.length },
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
export async function getCustomerStatement(contactId: string): Promise<{
  success: boolean;
  data?: CustomerStatement;
  raw?: any;
  error?: string;
}> {
  // 1. Fetch customer master
  const customerResult = await getCustomerById(contactId);
  if (!customerResult.success || !customerResult.data) {
    return { success: false, error: customerResult.error, raw: customerResult.raw };
  }
  const customer = customerResult.data;

  // 2. Fetch latest 10 invoices
  const invoicesResult = await getCustomerInvoices(contactId);
  if (!invoicesResult.success) {
    return { success: false, error: invoicesResult.error, raw: invoicesResult.raw };
  }

  const invoices = invoicesResult.data ?? [];

  // 3. Reverse-balance calculation
  const closingBalance = customer.outstandingReceivable ?? 0;
  const invoiceTotal = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const openingBalance = closingBalance - invoiceTotal;

  // 4. Build forward-running transactions
  let runningBalance = openingBalance;
  // Invoices come newest-first from Zoho; reverse to display chronologically
  const chronological = [...invoices].reverse();
  const transactions: StatementTransaction[] = chronological.map((inv) => {
    runningBalance = runningBalance + inv.total;
    return {
      id: inv.invoiceId,
      type: 'invoice',
      date: inv.invoiceDate,
      reference: inv.invoiceNumber,
      narration: `Invoice ${inv.invoiceNumber}`,   // Ref excluded — cleaner statement rows
      amount: inv.total,
      balanceAfter: runningBalance,
    };
  });

  const meta = (invoicesResult as any)._meta ?? { rawFetched: invoices.length, validCount: invoices.length };

  return {
    success: true,
    data: {
      customer,
      openingBalance,
      closingBalance,
      transactions,
      invoiceCount: invoices.length,
      isTruncated: (invoicesResult.raw?.page_context?.has_more_page) ?? false,
      telemetry: {
        customerApiCalls: 1,
        invoiceApiCalls: 1,
        totalApiCalls: 2,
        rawInvoicesFetched: meta.rawFetched,
        validInvoicesAfterFilter: meta.validCount,
      },
    },
    raw: { customer: customerResult.raw, invoices: invoicesResult.raw },
  };
}


// Existing exports
export async function getCustomerById(contactId: string): Promise<{ success: boolean; data?: CustomerStatementCustomer; raw?: any; error?: string }> {
  try {
    const orgId = getZohoOrgId();
    if (!orgId) {
      throw new Error('Missing ZOHO_BOOKS_ORG_ID or ZOHO_ORGANIZATION_ID in environment variables');
    }
    
    const accessToken = await getZohoTokens();
    if (!accessToken) {
      throw new Error('Failed to get Zoho Access Token. Please re-authenticate.');
    }

    const url = `${API_BASE_URL}/books/v3/contacts/${contactId}?organization_id=${orgId}`;
    
    const response = await fetch(url, {
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

    const billingAddr = contact.billing_address ? 
      [contact.billing_address.address, contact.billing_address.city, contact.billing_address.state, contact.billing_address.zip].filter(Boolean).join(', ') 
      : undefined;

    const normalized: CustomerStatementCustomer = {
      contactId: contact.contact_id,
      contactName: contact.contact_name,
      companyName: contact.company_name,
      gstNo: contact.gst_no,
      mobile: contact.mobile,
      email: contact.email,
      outstandingReceivable: contact.outstanding_receivable_amount,
      outstandingReceivableFormatted: contact.outstanding_receivable_amount_formatted,
      billingAddress: billingAddr
    };

    return { success: true, data: normalized, raw: data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Internal Server Error' };
  }
}
