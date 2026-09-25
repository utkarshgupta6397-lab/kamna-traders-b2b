import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCustomerStatement } from '@/lib/zoho/customer-statement';
import { hasMobileFeatureAccess } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isDesktopAllowed = session.role === 'ADMIN' || Boolean(session.accounts_customer_statement);
  const isMobileAllowed = hasMobileFeatureAccess(session, 'mobile_accounts', 'mobile_accounts_customer_statement');
  if (!isDesktopAllowed && !isMobileAllowed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get('customerId');

  if (!customerId || !/^\d+$/.test(customerId.trim()) || customerId.trim().length < 15) {
    return NextResponse.json(
      { error: 'Invalid or missing customerId. Must be a numeric ID (min 15 digits).' },
      { status: 400 }
    );
  }

  const statementLoadId = `STMT_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const traceCalls: Array<{
    index: number;
    timestamp: string;
    method: string;
    endpoint: string;
    queryParams: Record<string, string>;
    status: number;
    durationMs: number;
    category: string;
    purpose: string;
  }> = [];

  let callIndex = 0;

  const tracedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method || 'GET';

    if (urlStr.includes('zohoapis.in') || urlStr.includes('zoho.in')) {
      const idx = ++callIndex;
      const start = performance.now();
      const parsedUrl = new URL(urlStr);
      const queryParams: Record<string, string> = {};
      parsedUrl.searchParams.forEach((val, key) => {
        queryParams[key] = val;
      });

      // Classify category and purpose
      let category = 'Other Zoho API requests';
      let purpose = 'unknown';

      if (parsedUrl.pathname.includes('/statements')) {
        if (parsedUrl.pathname.includes('/contacts/')) {
          category = 'Native customer statement';
          purpose = 'customer_statement_pdf';
        } else if (parsedUrl.pathname.includes('/vendors/')) {
          category = 'Native vendor statement';
          purpose = 'vendor_statement_pdf';
        }
      } else if (parsedUrl.pathname.match(/\/books\/v3\/contacts\/\d+$/)) {
        category = 'Contact lookup';
        purpose = 'contact_lookup';
      } else if (parsedUrl.pathname.endsWith('/customerpayments')) {
        category = 'Customer payments LIST';
        purpose = 'customer_payment_enrichment_list';
      } else if (parsedUrl.pathname.match(/\/customerpayments\/\d+$/)) {
        category = 'Customer payment DETAIL';
        purpose = 'customer_payment_detail';
      } else if (parsedUrl.pathname.endsWith('/vendorpayments')) {
        category = 'Vendor payments LIST';
        purpose = 'vendor_payment_enrichment_list';
      } else if (parsedUrl.pathname.match(/\/vendorpayments\/\d+$/)) {
        category = 'Vendor payment DETAIL';
        purpose = 'vendor_payment_detail';
      } else if (parsedUrl.pathname.endsWith('/invoices')) {
        category = 'Customer invoices LIST';
        purpose = 'customer_invoices_list';
      } else if (parsedUrl.pathname.endsWith('/bills')) {
        category = 'Vendor bills LIST';
        purpose = 'vendor_bills_list';
      } else if (parsedUrl.pathname.endsWith('/journals')) {
        category = 'Customer journals LIST';
        purpose = 'journals_list';
      }

      console.log(`[${statementLoadId}] #${idx} ${method} ${parsedUrl.pathname}${parsedUrl.search}`);

      const res = await fetch(input, init);
      const durationMs = Math.round(performance.now() - start);

      traceCalls.push({
        index: idx,
        timestamp: new Date().toISOString(),
        method,
        endpoint: parsedUrl.pathname,
        queryParams,
        status: res.status,
        durationMs,
        category,
        purpose
      });

      console.log(`[${statementLoadId}] #${idx} -> HTTP ${res.status} (${durationMs}ms) [${category}]`);
      return res;
    }

    return fetch(input, init);
  };

  console.log(`STATEMENT_LOAD_START`);
  console.log(`statementLoadId=${statementLoadId}`);
  console.log(`customerId=${customerId.trim()}`);

  try {
    const minDate = searchParams.get('startDate') || searchParams.get('minDate') || '2026-03-01';
    const maxDate = searchParams.get('endDate') || searchParams.get('maxDate') || undefined;
    const result = await getCustomerStatement(customerId.trim(), minDate, maxDate, {
      fetchFn: tracedFetch as any
    });

    console.log(`STATEMENT_LOAD_END`);
    console.log(`statementLoadId=${statementLoadId}`);
    console.log(`totalHttpCalls=${traceCalls.length}`);

    if (!result.success) {
      return NextResponse.json({ error: result.error, raw: result.raw, trace: traceCalls }, { status: 400 });
    }

    return NextResponse.json({
      ...result,
      statementLoadId,
      actualZohoHttpCalls: traceCalls.length,
      auditTrace: traceCalls
    });
  } catch (e: any) {
    console.log(`STATEMENT_LOAD_END_ERROR`);
    console.log(`statementLoadId=${statementLoadId}`);
    console.log(`totalHttpCalls=${traceCalls.length}`);
    return NextResponse.json({
      success: false,
      error: String(e),
      statementLoadId,
      actualZohoHttpCalls: traceCalls.length,
      auditTrace: traceCalls
    }, { status: 500 });
  }
}
