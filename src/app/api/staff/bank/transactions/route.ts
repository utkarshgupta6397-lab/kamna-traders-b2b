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
    
    // Using the Bank Transactions API for the specific account
    const url = `${apiBase}/books/v3/banktransactions?organization_id=${orgId}&account_id=${accountId}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    const fetchCompletedAt = Date.now();

    if (!response.ok) {
      console.error('[Bank Transactions API] Error Response:', data);
      return NextResponse.json({
        success: false,
        error: data.message || `Zoho API Error (${response.status})`,
      }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      data: data.banktransactions || [],
      telemetry: {
        accountName,
        accountId,
        endpoint: url,
        method: method,
        status: response.status,
        durationMs: fetchCompletedAt - fetchStartedAt,
        recordCount: data.banktransactions?.length || 0
      }
    });

  } catch (error: any) {
    console.error('[Bank Transactions API] Exception:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
