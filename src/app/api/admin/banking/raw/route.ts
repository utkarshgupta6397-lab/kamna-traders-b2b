import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const fetchStartedAt = Date.now();

  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
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

    // Fetch raw transactions for the specific ICICI Bank Account
    const apiBase = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';
    const method = 'GET';
    const accountId = '1759923000003416718';
    const accountName = 'KAMNA TRADERS ICICI';
    
    // Using the Bank Transactions API which returns the actual statement/feed lines
    const url = `${apiBase}/books/v3/banktransactions?organization_id=${orgId}&account_id=${accountId}`;
    
    console.log('[Zoho Banking] Account ID:', accountId);
    console.log('[Zoho Banking] Endpoint:', url);
    console.log('[Zoho Banking] Method:', method);
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[Zoho Banking] Status:', response.status);
    
    const data = await response.json();
    console.log('[Zoho Banking] Raw Response:', data);

    const fetchCompletedAt = Date.now();

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: data.message || `Zoho API Error (${response.status})`,
        rawError: data,
        debug: { url, method, accountId, accountName }
      }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      data: data,
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
    console.error('[Bank Transactions API] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
