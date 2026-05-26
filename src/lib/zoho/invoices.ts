import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

export async function fetchInvoicesByRange(startDate: string, endDate: string) {
  const orgId = getZohoOrgId();
  if (!orgId) throw new Error('Missing ZOHO_BOOKS_ORG_ID or ZOHO_ORGANIZATION_ID in environment variables');
  const accessToken = await getZohoTokens();
  if (!accessToken) throw new Error('Failed to get Zoho Access Token. Please re-authenticate.');

  let allInvoices: any[] = [];
  let page = 1;
  let hasMore = true;
  let apiCallsUsed = 0;

  while (hasMore) {
    const url = `${API_BASE_URL}/books/v3/invoices?organization_id=${orgId}&date_start=${startDate}&date_end=${endDate}&page=${page}&per_page=200`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    apiCallsUsed++;

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch invoices');
    }

    const invoices = data.invoices || [];
    allInvoices = allInvoices.concat(invoices);

    if (data.page_context && data.page_context.has_more_page) {
      page++;
    } else {
      hasMore = false;
    }
  }

  return {
    invoices: allInvoices,
    apiCallsUsed,
  };
}

export async function fetchInvoiceById(invoiceId: string) {
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
    throw new Error(data.message || 'Failed to fetch invoice');
  }

  return {
    invoice: data.invoice,
    apiCallsUsed: 1,
  };
}

export async function fetchInvoicesByCustomerId(customerId: string, startDate: string, endDate: string) {
  const orgId = getZohoOrgId();
  if (!orgId) throw new Error('Missing ZOHO_BOOKS_ORG_ID or ZOHO_ORGANIZATION_ID in environment variables');
  const accessToken = await getZohoTokens();
  if (!accessToken) throw new Error('Failed to get Zoho Access Token. Please re-authenticate.');

  let allInvoices: any[] = [];
  let page = 1;
  let hasMore = true;
  let apiCallsUsed = 0;

  while (hasMore) {
    const url = `${API_BASE_URL}/books/v3/invoices?organization_id=${orgId}&customer_id=${customerId}&date_start=${startDate}&date_end=${endDate}&page=${page}&per_page=200`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    apiCallsUsed++;

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch customer invoices');
    }

    const invoices = data.invoices || [];
    allInvoices = allInvoices.concat(invoices);

    if (data.page_context && data.page_context.has_more_page) {
      page++;
    } else {
      hasMore = false;
    }
  }

  return {
    invoices: allInvoices,
    apiCallsUsed,
  };
}

