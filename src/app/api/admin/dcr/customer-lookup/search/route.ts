import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';
import { trackZohoApiCall } from '@/lib/zoho-api-meter';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

async function searchZohoCustomer(query: string) {
  try {
    const orgId = getZohoOrgId();
    const accessToken = await getZohoTokens();
    if (!orgId || !accessToken) return null;

    trackZohoApiCall('Customer Search');

    // Zoho Books contact search (matches name, email, phone, etc.)
    const url = `${API_BASE_URL}/books/v3/contacts?organization_id=${orgId}&search_text=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.contacts && data.contacts.length > 0) {
      const c = data.contacts[0]; // Take top match
      // Persist locally
      const localCustomer = await prisma.customer.upsert({
        where: { id: c.contact_id },
        update: {
          name: c.contact_name,
        },
        create: {
          id: c.contact_id,
          name: c.contact_name,
          gstNumber: 'NOT_AVAILABLE'
        }
      });
      return localCustomer;
    }
  } catch (e) {
    console.error('Zoho search fallback error:', e);
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    
    if (!q || q.trim() === '') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const query = q.trim();
    let customer = null;

    // 1. Exact Customer ID match
    if (/^\d{15,20}$/.test(query)) {
      customer = await prisma.customer.findUnique({ where: { id: query } });
    }

    // 2. GST Match
    if (!customer) {
      customer = await prisma.customer.findFirst({ where: { gstNumber: query } });
    }

    // 3. Name match (case-insensitive partial)
    if (!customer) {
      customer = await prisma.customer.findFirst({
        where: { name: { contains: query, mode: 'insensitive' } }
      });
    }

    // 4. Zoho Search Fallback
    if (!customer) {
      customer = await searchZohoCustomer(query);
    }

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      customer
    });

  } catch (error: any) {
    console.error('[Customer Lookup Search] Error:', error);
    return NextResponse.json({ error: 'Failed to search customer' }, { status: 500 });
  }
}
