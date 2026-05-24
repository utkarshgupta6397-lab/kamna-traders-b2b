import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const fetchStartedAt = Date.now();

  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && !session.accounts_transactions)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = await getZohoTokens();
    if (!token) {
      return NextResponse.json({ success: false, error: 'Zoho token missing. Please reconnect Zoho account.' }, { status: 401 });
    }

    const orgId = getZohoOrgId();
    if (!orgId) {
      return NextResponse.json({ success: false, error: 'Zoho Organization ID missing' }, { status: 400 });
    }

    const apiBase = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';
    const method = 'GET';
    const accountId = '1759923000003416718';
    const accountName = 'KAMNA TRADERS ICICI';
    
    let allStatements: any[] = [];
    let page = 1;
    let hasMorePage = true;
    let isTargetFound = false;
    let statementsLastStatus = 200;

    console.log(`[Bank Transactions API] Starting fetch for account ${accountId}`);

    // Fetch Statements
    const fetchStatements = async () => {
      while (hasMorePage && page <= 10) {
        const url = `${apiBase}/books/v3/bankaccounts/${accountId}/statements?organization_id=${orgId}&page=${page}&per_page=200`;
        const response = await fetch(url, {
          method,
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        statementsLastStatus = response.status;
        const data = await response.json();

        if (!response.ok) {
          console.error(`[Bank Transactions API] Error Response on statements page ${page}:`, data);
          if (page === 1) throw new Error(data.message || `Zoho API Error (${response.status})`);
          break;
        }

        const txns = data.bankstatements || [];
        allStatements = allStatements.concat(txns);
        
        const pageContext = data.page_context || {};
        hasMorePage = pageContext.has_more_page;
        page++;
      }
    };

    // Fetch Customer Payments for today
    let allPayments: any[] = [];
    const fetchPayments = async () => {
      const formatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatter.formatToParts(new Date());
      const d = parts.find(p => p.type === 'day')?.value;
      const m = parts.find(p => p.type === 'month')?.value;
      const y = parts.find(p => p.type === 'year')?.value;
      const todayIST = `${y}-${m}-${d}`;
      
      const url = `${apiBase}/books/v3/customerpayments?organization_id=${orgId}&date=${todayIST}&per_page=200`;
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (response.ok) {
        allPayments = data.customerpayments || [];
      } else {
        console.error(`[Bank Transactions API] Error fetching payments:`, data);
      }
    };

    // Run both fetches in parallel
    await Promise.all([fetchStatements(), fetchPayments()]);

    const fetchCompletedAt = Date.now();
    console.log(`[Bank Transactions API] Total statements: ${allStatements.length} | Total payments: ${allPayments.length}`);

    return NextResponse.json({
      success: true,
      data: {
        statements: allStatements,
        payments: allPayments
      },
      telemetry: {
        accountName,
        accountId,
        method: method,
        status: statementsLastStatus,
        durationMs: fetchCompletedAt - fetchStartedAt,
        statementsCount: allStatements.length,
        paymentsCount: allPayments.length,
        pagesFetched: page - 1
      }
    });

  } catch (error: any) {
    console.error('[Bank Transactions API] Exception:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
