import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';
import { ensureCustomerExists } from '@/lib/dcr-customer-sync';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

async function searchZohoCustomer(query: string) {
  try {
    const orgId = getZohoOrgId();
    const accessToken = await getZohoTokens();
    if (!orgId || !accessToken) return [];


    // Zoho Books contact search (matches name, email, phone, etc.)
    const url = `${API_BASE_URL}/books/v3/contacts?organization_id=${orgId}&search_text=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
    if (!res.ok) return [];
    const data = await res.json();
    
    if (data.contacts && data.contacts.length > 0) {
      if (query === '1759923000016495139') {
        console.log('RAW ZOHO SEARCH PAYLOAD:', JSON.stringify(data.contacts[0], null, 2));
      }
      const topContacts = data.contacts.slice(0, 3);
      const syncedCustomers = [];
      
      for (const c of topContacts) {
        await ensureCustomerExists({
          customerId: c.contact_id,
          customerName: c.contact_name,
          gstNumber: 'NOT_AVAILABLE',
          status: c.status
        });
        const saved = await prisma.customer.findUnique({ where: { id: c.contact_id } });
        if (saved) syncedCustomers.push(saved);
      }
      
      return syncedCustomers;
    }
  } catch (e) {
    console.error('Zoho search fallback error:', e);
  }
  return [];
}

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && !session.accounts_customer_statement)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    
    if (!q || q.trim().length < 3) {
      return NextResponse.json({ error: 'Query requires at least 3 characters' }, { status: 400 });
    }

    const query = q.trim();
    const isDigitId = /^\d{15,20}$/.test(query);

    let customers = [];
    const orgId = getZohoOrgId();
    const accessToken = await getZohoTokens();

    if (orgId && accessToken) {
      if (isDigitId) {
        // Search by exact ID
        const url = `${API_BASE_URL}/books/v3/contacts/${query}?organization_id=${orgId}`;
        const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
        if (res.ok) {
          const data = await res.json();
          if (data.contact) {
            customers.push({
              id: data.contact.contact_id,
              name: data.contact.contact_name,
              gstNumber: data.contact.gst_no || 'NOT_AVAILABLE',
              status: data.contact.status || 'unknown'
            });
          }
        }
      } else {
        // Search by text
        const url = `${API_BASE_URL}/books/v3/contacts?organization_id=${orgId}&search_text=${encodeURIComponent(query)}`;
        const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
        if (res.ok) {
          const data = await res.json();
          if (data.contacts && data.contacts.length > 0) {
            const customerContacts = data.contacts.filter((c: any) => c.contact_type === 'customer' || c.is_customer === true);
            const topContacts = customerContacts.slice(0, 5);

            customers = topContacts.map((c: any) => ({
              id: c.contact_id,
              name: c.contact_name,
              gstNumber: c.gst_no || 'NOT_AVAILABLE',
              status: c.status || 'unknown'
            }));
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      customers
    });

  } catch (error: any) {
    console.error('[Customer Statement Search] Error:', error);
    return NextResponse.json({ error: 'Failed to search customers' }, { status: 500 });
  }
}
