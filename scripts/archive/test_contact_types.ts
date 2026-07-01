import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

async function main() {
  const contactIds = ['1759923000016495139', '1759923000021105908'];
  const orgId = getZohoOrgId();
  const accessToken = await getZohoTokens();

  if (!orgId || !accessToken) {
    console.error('Missing orgId or accessToken');
    return;
  }

  for (const id of contactIds) {
    const url = `${API_BASE_URL}/books/v3/contacts/${id}?organization_id=${orgId}`;
    const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
    const data = await res.json();
    const c = data.contact;

    if (c) {
      console.log(JSON.stringify({
        contact_id: c.contact_id,
        contact_name: c.contact_name,
        contact_type: c.contact_type,
        is_customer: c.is_customer,
        is_vendor: c.is_vendor,
        gst_no: c.gst_no,
        status: c.status
      }, null, 2));
    } else {
      console.log(`Contact ${id} not found.`);
    }
  }
}

main().catch(console.error);
