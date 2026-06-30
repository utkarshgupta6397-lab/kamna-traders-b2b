import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getZohoTokens, getZohoOrgId, getZohoAuthStatus } from '@/lib/zoho-auth';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const order = await prisma.solarOrder.findUnique({ where: { id } });

    if (!order?.zohoBooksCustomerId) {
      return NextResponse.json({ error: 'Customer not mapped' }, { status: 400 });
    }

    const authStatus = await getZohoAuthStatus();
    if (!authStatus.isConfigured) {
      return NextResponse.json({ error: 'Zoho integration not configured' }, { status: 500 });
    }
    if (authStatus.isScopeMismatch) {
      return NextResponse.json({ error: 'zoho_reauth_required', message: 'Zoho authorization needs to be refreshed because new permissions are required.' }, { status: 403 });
    }

    const accessToken = await getZohoTokens();
    const orgId = getZohoOrgId();

    if (!accessToken || !orgId) {
      return NextResponse.json({ error: 'Zoho integration not configured' }, { status: 500 });
    }

    // Verify Customer existence first
    const contactRes = await fetch(`${API_BASE_URL}/books/v3/contacts/${order.zohoBooksCustomerId}?organization_id=${orgId}`, {
      headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
    });
    if (!contactRes.ok) {
      return NextResponse.json({ error: 'Customer mapping invalid or stale' }, { status: 400 });
    }

    const url = `${API_BASE_URL}/books/v3/customerpayments?organization_id=${orgId}&customer_id=${order.zohoBooksCustomerId}&sort_column=date&sort_order=D`;
    
    const res = await fetch(url, {
      headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Zoho Fetch Payments Error]', errText);
      try {
        const errJson = JSON.parse(errText);
        if (errJson.code === 57) {
          return NextResponse.json({ error: 'Missing OAuth scopes or Payments module disabled' }, { status: 403 });
        }
        return NextResponse.json({ error: errJson.message || 'Failed to fetch payments' }, { status: res.status });
      } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch payments from Zoho' }, { status: res.status });
      }
    }

    const data = await res.json();
    return NextResponse.json({ payments: data.customerpayments || [] });

  } catch (error) {
    console.error('[Zoho Fetch Payments Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
