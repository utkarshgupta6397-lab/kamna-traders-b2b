import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

async function test() {
  const query = 'M/S SUN POWER';
  const orgId = getZohoOrgId();
  const accessToken = await getZohoTokens();

  const url = `${API_BASE_URL}/books/v3/contacts?organization_id=${orgId}&search_text=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
  
  if (res.ok) {
    const data = await res.json();
    if (data.contacts && data.contacts.length > 0) {
      const customerContacts = data.contacts.filter((c: any) => c.contact_type === 'customer' || c.is_customer === true);
      const topContacts = customerContacts.slice(0, 5);

      const customers = topContacts.map((c: any) => ({
        id: c.contact_id,
        name: c.contact_name,
        gstNumber: c.gst_no || 'NOT_AVAILABLE',
        status: c.status || 'unknown'
      }));
      console.log(customers);
    }
  }
}

test().catch(console.error);
