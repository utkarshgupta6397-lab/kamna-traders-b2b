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
  unusedCreditsReceivable?: number;
  associatedVendorId?: string;
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
  type: 'invoice' | 'payment' | 'bill' | 'vendor_payment';
  datetime?: string;
  date: string;
  timestamp?: number;
  description: string;
  amount: number;
  /**
   * Signed net effect on the party's receivable position.
   * invoice => +amount, payment => -amount, bill => -amount, vendor_payment => +amount
   */
  netEffect: number;
  balanceAfter: number;
  isVerified?: boolean;
  zohoUrl?: string;
  appliedBills?: { billNumber: string; appliedAmount: number }[];
};

export type CustomerStatement = {
  customer: CustomerStatementCustomer;
  openingBalance: number;
  closingBalance: number;
  /** For hybrid accounts: raw outstanding_receivable_amount from Zoho */
  outstandingReceivable: number;
  /** For hybrid accounts: raw outstanding_payable_amount from Zoho */
  outstandingPayable: number;
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
    rawBillsFetched: number;
    validBillsAfterFilter: number;
    // Net position debug
    debugReceivable: number;
    debugPayable: number;
    debugNetClosingBalance: number;
    debugIsHybrid: boolean;
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
    const url = `${API_BASE_URL}/books/v3/invoices?organization_id=${orgId}&customer_id=${contactId}&page=1&per_page=100&sort_column=date&sort_order=D`;
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
          balance: Number(inv.balance !== undefined ? inv.balance : inv.balance_amount),
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
  isVerified?: boolean;
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

    const url = `${API_BASE_URL}/books/v3/customerpayments?organization_id=${orgId}&customer_id=${contactId}&page=1&per_page=30&sort_column=date&sort_order=D`;
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
      .filter((pmt: any) => !(pmt.deleted === true || pmt.status === 'void' || pmt.status === 'cancelled'))
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
        };
      });
      
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

export type CustomerStatementBill = {
  billId: string;
  billNumber: string;
  date: string;
  amount: number;
  referenceNumber?: string;
};

export async function getVendorBills(vendorId: string): Promise<{
  success: boolean;
  data?: CustomerStatementBill[];
  raw?: any;
  error?: string;
}> {
  try {
    const orgId = getZohoOrgId();
    if (!orgId) throw new Error('Missing ZOHO_BOOKS_ORG_ID or ZOHO_ORGANIZATION_ID in environment variables');
    const accessToken = await getZohoTokens();
    if (!accessToken) throw new Error('Failed to get Zoho Access Token. Please re-authenticate.');

    const url = `${API_BASE_URL}/books/v3/bills?organization_id=${orgId}&vendor_id=${vendorId}&page=1&per_page=30&sort_column=date&sort_order=D`;
    console.log('[Zoho Bills] Vendor ID Used:', vendorId);
    console.log('[Zoho Bills] API URL:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    const data = await response.json();
    
    if (!response.ok) {
      console.warn('[Zoho Bills] Failed to fetch bills:', data);
      return { success: false, error: data.message || 'Failed to fetch bills', raw: data };
    }
    const raw: any[] = data.bills ?? [];
    console.log('[Zoho Bills] Raw bill count:', raw.length);
    if (raw.length > 0) {
      console.log('RAW BILL PAYLOAD (First Bill):', JSON.stringify(raw[0], null, 2));
    }
    
    const items: CustomerStatementBill[] = raw
      .filter((b: any) => !(b.deleted === true || b.status === 'void' || b.status === 'cancelled'))
      .map((b: any) => {
        console.log('BILL DEBUG', {
          bill_id: b.bill_id,
          bill_number: b.bill_number,
          reference_number: b.reference_number,
          vendor_name: b.vendor_name
        });
        return {
          billId: b.bill_id,
          billNumber: b.bill_number,
          date: b.date || b.created_time || b.last_modified_time || '',
          amount: Number(b.total),
          referenceNumber: b.reference_number,
        };
      });
      
    console.log('[Zoho Bills] Normalized bill count:', items.length);
    
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

export type CustomerStatementVendorPayment = {
  paymentId: string;
  paymentNumber: string;
  paymentMode: string;
  date: string;
  amount: number;
  referenceNumber?: string;
  appliedBills?: { billNumber: string; appliedAmount: number }[];
};

export async function getVendorPayments(vendorId: string): Promise<{
  success: boolean;
  data?: CustomerStatementVendorPayment[];
  raw?: any;
  error?: string;
}> {
  try {
    const orgId = getZohoOrgId();
    if (!orgId) throw new Error('Missing ZOHO_BOOKS_ORG_ID or ZOHO_ORGANIZATION_ID in environment variables');
    const accessToken = await getZohoTokens();
    if (!accessToken) throw new Error('Failed to get Zoho Access Token. Please re-authenticate.');

    const url = `${API_BASE_URL}/books/v3/vendorpayments?organization_id=${orgId}&vendor_id=${vendorId}&page=1&per_page=30&sort_column=date&sort_order=D`;
    console.log('[Zoho Vendor Payments] API URL:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    const data = await response.json();
    
    if (!response.ok) {
      console.warn('[Zoho Vendor Payments] Failed to fetch vendor payments:', data);
      return { success: false, error: data.message || 'Failed to fetch vendor payments', raw: data };
    }
    const raw: any[] = data.vendorpayments ?? [];
    
    // Fetch detailed allocations
    const detailedPayments = await Promise.all(
      raw.map(async (vp: any) => {
        try {
          const detailUrl = `${API_BASE_URL}/books/v3/vendorpayments/${vp.payment_id}?organization_id=${orgId}`;
          const detailRes = await fetch(detailUrl, {
            method: 'GET',
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
          });
          const detailData = await detailRes.json();
          let appliedBills = [];
          if (detailRes.ok && detailData.vendorpayment?.bills) {
            appliedBills = detailData.vendorpayment.bills.map((b: any) => ({
              billNumber: b.bill_number,
              appliedAmount: Number(b.amount_applied),
            }));
          }
          return {
            paymentId: vp.payment_id,
            paymentNumber: vp.payment_number,
            paymentMode: vp.payment_mode,
            date: vp.date,
            amount: Number(vp.amount),
            referenceNumber: vp.reference_number,
            appliedBills,
          };
        } catch (e) {
          return {
            paymentId: vp.payment_id,
            paymentNumber: vp.payment_number,
            paymentMode: vp.payment_mode,
            date: vp.date,
            amount: Number(vp.amount),
            referenceNumber: vp.reference_number,
            appliedBills: [],
          };
        }
      })
    );
      
    return {
      success: true,
      data: detailedPayments,
      raw: data,
      _meta: { rawFetched: raw.length, validCount: detailedPayments.length },
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
export async function getCustomerStatement(contactId: string, minDate?: string): Promise<{
  success: boolean;
  data?: CustomerStatement;
  raw?: any;
  error?: string;
}> {
  // 1. Parallelize base API calls
  console.time('customer');
  const customerPromise = getCustomerById(contactId).finally(() => console.timeEnd('customer'));
  
  console.time('invoices');
  const invoicesPromise = getCustomerInvoices(contactId).finally(() => console.timeEnd('invoices'));
  
  console.time('payments');
  const paymentsPromise = getCustomerPayments(contactId).finally(() => console.timeEnd('payments'));

  const [customerResult, invoicesResult, paymentsResult] = await Promise.all([
    customerPromise,
    invoicesPromise,
    paymentsPromise
  ]);

  if (!customerResult.success || !customerResult.data) {
    return { success: false, error: customerResult.error, raw: customerResult.raw };
  }
  const customer = customerResult.data;

  // 2. Conditionally fetch bills and vendor payments only if hybrid AND payable > 0
  let billsResult: any = { success: true, data: [] };
  let vendorPaymentsResult: any = { success: true, data: [] };
  const outstandingPayable = customer.outstandingPayable ?? 0;
  if (customer.associatedVendorId && outstandingPayable > 0) {
    console.time('billsAndVendorPayments');
    const [bRes, vpRes] = await Promise.all([
      getVendorBills(customer.associatedVendorId),
      getVendorPayments(customer.associatedVendorId)
    ]);
    billsResult = bRes;
    vendorPaymentsResult = vpRes;
    console.timeEnd('billsAndVendorPayments');
  }
  
  if (!invoicesResult.success) {
    return { success: false, error: invoicesResult.error, raw: invoicesResult.raw };
  }

  const invoices = invoicesResult.data ?? [];
  const payments = (paymentsResult.success ? paymentsResult.data : []) ?? [];
  const bills = (billsResult.success ? billsResult.data : []) ?? [];
  const vendorPayments = (vendorPaymentsResult.success ? vendorPaymentsResult.data : []) ?? [];

  // 3. Merge into unified timeline with signed netEffect and memoized timestamp
  const orgId = getZohoOrgId() || process.env.ZOHO_BOOKS_ORG_ID;
  let mergedRaw: Array<{
    id: string;
    type: 'invoice' | 'payment' | 'bill' | 'vendor_payment';
    date: string;
    datetime: string;
    timestamp: number;
    description: string;
    amount: number;
    netEffect: number;
    isVerified?: boolean;
    zohoUrl?: string;
    appliedBills?: { billNumber: string; appliedAmount: number }[];
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
        isVerified: pmt.isVerified,
        zohoUrl: orgId ? `https://books.zoho.in/app/${orgId}#/customerpayments/${pmt.paymentId}` : undefined,
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
        appliedBills: vp.appliedBills,
        zohoUrl: orgId ? `https://books.zoho.in/app/${orgId}#/paymentsmade/${vp.paymentId}` : undefined,
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

  const invMeta  = (invoicesResult as any)._meta  ?? { rawFetched: invoices.length, validCount: invoices.length };
  const pmtMeta  = paymentsResult.success ? ((paymentsResult as any)._meta ?? { rawFetched: 0, validCount: 0 }) : { rawFetched: 0, validCount: 0 };
  const billMeta = (billsResult.success && (billsResult as any)._meta) ? (billsResult as any)._meta : { rawFetched: 0, validCount: 0 };

  return {
    success: true,
    data: {
      customer,
      openingBalance,
      closingBalance: netClosingBalance,
      outstandingReceivable,
      outstandingPayable,
      isHybrid,
      transactions,
      transactionCount: transactions.length,
      unpaidInvoices,
      isTruncated: false,
      telemetry: {
        customerApiCalls: 1,
        invoiceApiCalls: 1,
        paymentApiCalls: 1,
        billApiCalls: isHybrid ? 2 : 0, // bills + vendor payments
        totalApiCalls: isHybrid ? 5 : 3,
        rawInvoicesFetched: invMeta.rawFetched + pmtMeta.rawFetched,
        validInvoicesAfterFilter: invMeta.validCount + pmtMeta.validCount,
        rawBillsFetched: billMeta.rawFetched + (vendorPaymentsResult._meta?.rawFetched || 0),
        validBillsAfterFilter: billMeta.validCount + (vendorPaymentsResult._meta?.validCount || 0),
        debugReceivable: outstandingReceivable,
        debugPayable: outstandingPayable,
        debugNetClosingBalance: netClosingBalance,
        debugIsHybrid: isHybrid,
      },
    },
    raw: { customer: customerResult.raw, invoices: invoicesResult.raw, bills: billsResult.raw },
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
      companyName: contact.company_name,
      gstNo: contact.gst_no,
      mobile: contact.mobile,
      email: contact.email,
      outstandingReceivable: contact.outstanding_receivable_amount,
      unusedCreditsReceivable: contact.unused_credits_receivable_amount,
      outstandingReceivableFormatted: contact.outstanding_receivable_amount_formatted,
      associatedVendorId: contact.associated_vendor_details?.vendor_id,
      // NOTE: outstanding_payable_amount lives inside associated_vendor_details, NOT at top level
      outstandingPayable: contact.associated_vendor_details?.outstanding_payable_amount ?? 0,
      unusedCreditsPayable: contact.associated_vendor_details?.unused_credits_payable_amount ?? 0,
      billingAddress: billingAddr,
      rawAddress: contact.billing_address || contact.shipping_address || null
    };

    return { success: true, data: normalized, raw: data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Internal Server Error' };
  }
}
