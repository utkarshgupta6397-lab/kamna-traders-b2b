import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

export interface FetchInvoicesRangeOptions {
  maxLimit?: number;
  delayMs?: number;
  maxRetries?: number;
}

export async function fetchInvoicesByRange(
  startDate: string,
  endDate: string,
  options: FetchInvoicesRangeOptions = {}
) {
  const maxLimit = options.maxLimit ?? 10000;
  const delayMs = options.delayMs ?? 50;
  const maxRetries = options.maxRetries ?? 3;

  const orgId = getZohoOrgId();
  if (!orgId) throw new Error('Missing ZOHO_BOOKS_ORG_ID or ZOHO_ORGANIZATION_ID in environment variables');
  const accessToken = await getZohoTokens();
  if (!accessToken) throw new Error('Failed to get Zoho Access Token. Please re-authenticate.');

  let allInvoices: any[] = [];
  let page = 1;
  let hasMore = true;
  let apiCallsUsed = 0;
  let hasMorePagesRemaining = false;

  while (hasMore && allInvoices.length < maxLimit) {
    const url = `${API_BASE_URL}/books/v3/invoices?organization_id=${orgId}&date_start=${startDate}&date_end=${endDate}&page=${page}&per_page=200`;
    
    let response: Response | null = null;
    let retries = 0;

    while (retries <= maxRetries) {
      try {
        response = await fetch(url, {
          method: 'GET',
          headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
        });
        apiCallsUsed++;

        if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
          if (retries < maxRetries) {
            retries++;
            const backoffWait = Math.pow(2, retries) * 500;
            console.warn(`[Zoho Invoices API] Rate limit or server error (${response.status}) on page ${page}. Retrying in ${backoffWait}ms...`);
            await new Promise(res => setTimeout(res, backoffWait));
            continue;
          }
        }
        break;
      } catch (networkErr: any) {
        if (retries < maxRetries) {
          retries++;
          const backoffWait = Math.pow(2, retries) * 500;
          console.warn(`[Zoho Invoices API] Network error on page ${page}: ${networkErr.message}. Retrying in ${backoffWait}ms...`);
          await new Promise(res => setTimeout(res, backoffWait));
          continue;
        }
        throw networkErr;
      }
    }

    if (!response) {
      throw new Error(`Failed to fetch invoices for page ${page} after ${maxRetries} retries`);
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Failed to fetch invoices (HTTP ${response.status})`);
    }

    const invoices = data.invoices || [];
    allInvoices = allInvoices.concat(invoices);

    const hasMoreInResponse = !!(data.page_context && data.page_context.has_more_page);

    if (hasMoreInResponse) {
      if (allInvoices.length >= maxLimit) {
        hasMore = false;
        hasMorePagesRemaining = true;
      } else {
        page++;
        if (delayMs > 0) {
          await new Promise(res => setTimeout(res, delayMs));
        }
      }
    } else {
      hasMore = false;
    }
  }

  return {
    invoices: allInvoices,
    apiCallsUsed,
    hasMorePagesRemaining,
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

export async function searchInvoiceByNumber(invoiceNumber: string) {
  const orgId = getZohoOrgId();
  if (!orgId) throw new Error('Missing ZOHO_BOOKS_ORG_ID or ZOHO_ORGANIZATION_ID in environment variables');
  const accessToken = await getZohoTokens();
  if (!accessToken) throw new Error('Failed to get Zoho Access Token. Please re-authenticate.');

  const url = `${API_BASE_URL}/books/v3/invoices?organization_id=${orgId}&invoice_number=${encodeURIComponent(invoiceNumber)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to search invoice');
  }

  return {
    invoices: data.invoices || [],
    apiCallsUsed: 1,
  };
}

