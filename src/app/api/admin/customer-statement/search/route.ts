import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';
import { trackZohoApiCall } from '@/lib/zoho-api-meter';
import { ensureCustomerExists } from '@/lib/dcr-customer-sync';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

async function searchZohoCustomer(query: string) {
  try {
    const orgId = getZohoOrgId();
    const accessToken = await getZohoTokens();
    if (!orgId || !accessToken) return [];

    trackZohoApiCall('Customer Lookup');

    // Zoho Books contact search (matches name, email, phone, etc.)
    const url = `${API_BASE_URL}/books/v3/contacts?organization_id=${orgId}&search_text=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
    if (!res.ok) return [];
    const data = await res.json();
    
    if (data.contacts && data.contacts.length > 0) {
      const topContacts = data.contacts.slice(0, 3);
      const syncedCustomers = [];
      
      let activeCustomersReturned = 0;
      let inactiveCustomersFiltered = 0;

      for (const c of topContacts) {
        if (c.status !== 'active') {
          inactiveCustomersFiltered++;
          continue;
        }

        activeCustomersReturned++;
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

    let customers = await prisma.customer.findMany({
      where: {
        status: 'active',
        OR: [
          ...(isDigitId ? [{ id: query }] : []),
          { gstNumber: query },
          { name: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 10,
      select: { id: true, name: true, gstNumber: true }
    });

    // Fallback to Zoho API if no local matches found
    if (customers.length === 0) {
      const zohoResults = await searchZohoCustomer(query);
      if (zohoResults.length > 0) {
        customers = zohoResults.map(c => ({ id: c.id, name: c.name, gstNumber: c.gstNumber }));
      }
    }

    // Temporary debug logging
    console.log('[CUSTOMER_SEARCH_DEBUG]', {
      query,
      totalCustomersFound: customers.length,
      // Zoho fallback already filtered internally, local Prisma query filters via where clause.
    });

    return NextResponse.json({
      success: true,
      customers
    });

  } catch (error: any) {
    console.error('[Customer Statement Search] Error:', error);
    return NextResponse.json({ error: 'Failed to search customers' }, { status: 500 });
  }
}
