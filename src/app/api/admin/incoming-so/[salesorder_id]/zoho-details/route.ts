import { NextResponse } from 'next/server';
import { getZohoOrgId, getZohoTokens } from '@/lib/zoho-auth';
import { getSession } from '@/lib/auth';

export async function GET(request: Request, { params }: { params: Promise<{ salesorder_id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const { salesorder_id } = resolvedParams;
    
    // Ensure the ID is numeric and looks valid.
    if (!salesorder_id || !/^\d+$/.test(salesorder_id) || salesorder_id === 'UNKNOWN') {
      return NextResponse.json({ success: false, error: 'Invalid Sales Order ID' }, { status: 400 });
    }

    const orgId = getZohoOrgId();
    if (!orgId) {
      return NextResponse.json({ success: false, error: 'Zoho Organization ID not configured' }, { status: 500 });
    }

    const accessToken = await getZohoTokens();
    if (!accessToken) {
      return NextResponse.json({ success: false, error: 'Zoho authentication failed. No valid token.' }, { status: 401 });
    }

    const apiBase = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';
    const url = `${apiBase}/books/v3/salesorders/${salesorder_id}?organization_id=${orgId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data.message || `Zoho API Error (${response.status})` },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data: data.salesorder });
  } catch (error: any) {
    console.error('[Zoho Fetch Details]', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
