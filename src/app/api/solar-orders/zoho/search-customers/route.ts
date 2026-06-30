import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    
    if (!q || q.length < 2) {
      return NextResponse.json({ customers: [] });
    }

    const accessToken = await getZohoTokens();
    const orgId = getZohoOrgId();

    if (!accessToken || !orgId) {
      return NextResponse.json({ error: 'Zoho integration not configured' }, { status: 500 });
    }

    // Zoho Books API doesn't have a great global search for contacts that includes all these fields easily in one query.
    // We will do 3 concurrent queries and merge results by contact_id.
    const searchParam = encodeURIComponent(q);
    const urls = [
      `${API_BASE_URL}/books/v3/contacts?organization_id=${orgId}&status=active&contact_name_contains=${searchParam}`,
      `${API_BASE_URL}/books/v3/contacts?organization_id=${orgId}&status=active&phone_contains=${searchParam}`,
      `${API_BASE_URL}/books/v3/contacts?organization_id=${orgId}&status=active&email_contains=${searchParam}`
    ];

    const responses = await Promise.all(
      urls.map(url => fetch(url, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`
        }
      }))
    );

    const mergedCustomers = new Map();

    for (const res of responses) {
      if (res.ok) {
        const data = await res.json();
        if (data.contacts && Array.isArray(data.contacts)) {
          for (const contact of data.contacts) {
            if (!mergedCustomers.has(contact.contact_id)) {
              mergedCustomers.set(contact.contact_id, {
                contact_id: contact.contact_id,
                contact_name: contact.contact_name,
                company_name: contact.company_name,
                email: contact.email,
                phone: contact.phone,
                mobile: contact.mobile,
                gst_no: contact.gst_no,
                gst_treatment: contact.gst_treatment
              });
            }
          }
        }
      }
    }

    return NextResponse.json({ customers: Array.from(mergedCustomers.values()) });

  } catch (error) {
    console.error('[Zoho Search Customers Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
