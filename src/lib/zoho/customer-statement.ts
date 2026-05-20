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
  type: 'invoice' | 'payment';
  date: string;
  description: string;
  amount: number;
  direction: 'dr' | 'cr';
  balanceAfter: number;
};

export type CustomerStatement = {
  customer: CustomerStatementCustomer;
  openingBalance: number;
  closingBalance: number;
  transactions: StatementTransaction[];
  transactionCount: number;
  /** true when fewer than all transactions are shown */
  isTruncated: boolean;
  /** API telemetry for the debug card */
  telemetry: {
    customerApiCalls: number;
    invoiceApiCalls: number;
    paymentApiCalls: number;
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
    // Fetch 15 as buffer — void invoices are filtered in-app
    const url = `${API_BASE_URL}/books/v3/invoices?organization_id=${orgId}&customer_id=${contactId}&per_page=15`;
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
      .map((inv: any) => {
        if (!inv.date) {
          console.warn('[Zoho] Invoice missing date field. Raw object:', inv);
        }
        return {
          invoiceId: inv.invoice_id,
          invoiceNumber: inv.invoice_number,
          invoiceDate: inv.date || inv.created_time || inv.last_modified_time || '', // fallback to created_time
          dueDate: inv.due_date,
          status: inv.status,
          total: Number(inv.total),
          balance: Number(inv.balance_amount),
          currencyCode: inv.currency_code,
          referenceNumber: inv.reference_number,
          salespersonName: inv.salesperson_name,
        };
      });
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

export type CustomerStatementPayment = {
  paymentId: string;
  paymentNumber: string;
  paymentMode: string;
  date: string;
  amount: number;
  referenceNumber?: string;
};

export async function getCustomerPayments(contactId: string): Promise<{
  success: boolean;
  data?: CustomerStatementPayment[];
  raw?: any;
  error?: string;
}> {
  try {
    const orgId = getZohoOrgId();
    if (!orgId) throw new Error('Missing ZOHO_BOOKS_ORG_ID or ZOHO_ORGANIZATION_ID in environment variables');
    const accessToken = await getZohoTokens();
    if (!accessToken) throw new Error('Failed to get Zoho Access Token. Please re-authenticate.');

    const url = `${API_BASE_URL}/books/v3/customerpayments?organization_id=${orgId}&customer_id=${contactId}&per_page=15`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    const data = await response.json();
    console.log('[Zoho Payments] API URL:', url);
    
    if (!response.ok) {
      console.warn('[Zoho Payments] Failed to fetch payments:', data);
      return { success: false, error: data.message || 'Failed to fetch payments', raw: data };
    }
    const raw: any[] = data.customerpayments ?? [];
    console.log('[Zoho Payments] Raw payment count:', raw.length);
    
    const items: CustomerStatementPayment[] = raw
      .map((pmt: any) => ({
        paymentId: pmt.payment_id,
        paymentNumber: pmt.payment_number,
        paymentMode: pmt.payment_mode,
        date: pmt.date,
        amount: Number(pmt.amount),
        referenceNumber: pmt.reference_number,
      }));
      
    console.log('[Zoho Payments] Normalized payment count:', items.length);
    
    return {
      success: true,
      data: items,
      raw: data,
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

  // 2. Fetch latest 15 invoices and 15 payments
  const [invoicesResult, paymentsResult] = await Promise.all([
    getCustomerInvoices(contactId),
    getCustomerPayments(contactId)
  ]);
  
  if (!invoicesResult.success) {
    return { success: false, error: invoicesResult.error, raw: invoicesResult.raw };
  }

  const invoices = invoicesResult.data ?? [];
  const payments = (paymentsResult.success ? paymentsResult.data : []) ?? [];

  // 3. Merge into unified timeline
  const mergedRaw = [
    ...invoices.map(inv => ({
      id: inv.invoiceId,
      type: 'invoice' as const,
      date: inv.invoiceDate,
      description: `Invoice ${inv.invoiceNumber}`,
      amount: inv.total,
      direction: 'dr' as const
    })),
    ...payments.map(pmt => ({
      id: pmt.paymentId,
      type: 'payment' as const,
      date: pmt.date,
      description: pmt.paymentMode ? `Payment - ${pmt.paymentMode}` : 'Customer Payment',
      amount: pmt.amount,
      direction: 'cr' as const
    }))
  ];

  console.log('[Zoho Statement] Merged transaction count:', mergedRaw.length);

  // 4. Sort chronologically NEWEST FIRST
  mergedRaw.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // 5. Take latest 10 merged transactions
  const latest10 = mergedRaw.slice(0, 10);
  
  console.log('[Zoho Statement] Final rendered transaction count:', latest10.length);

  // 6. Reverse-balance calculation
  const closingBalance = customer.outstandingReceivable ?? 0;
  
  // We need to work backwards from closing balance to opening balance for these 10 items.
  // We have the latest 10 items in `latest10` (newest first).
  // The balance BEFORE the newest item = closingBalance - (if invoice, add amount; if payment, subtract amount) wait.
  // Actually, to build the balances on the transactions:
  // We can go from index 0 (newest) to 9 (oldest).
  // After item 0 is processed, balance is closingBalance.
  // Balance before item 0 = closingBalance - (item 0 DR) + (item 0 CR)
  
  let currentBalance = closingBalance;
  const transactions: StatementTransaction[] = [];
  
  for (const item of latest10) {
    transactions.push({
      ...item,
      balanceAfter: currentBalance
    });
    // Reverse movement to get the balance *before* this transaction
    if (item.direction === 'dr') {
      currentBalance = currentBalance - item.amount;
    } else {
      currentBalance = currentBalance + item.amount;
    }
  }
  
  const openingBalance = currentBalance;
  
  // To display correctly (oldest first), reverse the array
  transactions.reverse();

  const invMeta = (invoicesResult as any)._meta ?? { rawFetched: invoices.length, validCount: invoices.length };
  const pmtMeta = paymentsResult.success ? (paymentsResult as any)._meta : { rawFetched: 0, validCount: 0 };

  return {
    success: true,
    data: {
      customer,
      openingBalance,
      closingBalance,
      transactions,
      transactionCount: transactions.length,
      isTruncated: true,
      telemetry: {
        customerApiCalls: 1,
        invoiceApiCalls: 1,
        paymentApiCalls: 1,
        totalApiCalls: 3,
        rawInvoicesFetched: invMeta.rawFetched + pmtMeta.rawFetched,
        validInvoicesAfterFilter: invMeta.validCount + pmtMeta.validCount,
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
