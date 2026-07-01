import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

async function main() {
  const orgId = getZohoOrgId();
  const accessToken = await getZohoTokens();
  
  const fullContactUrl = `${API_BASE_URL}/books/v3/contacts/1759923000018641237?organization_id=${orgId}`;
  const fRes = await fetch(fullContactUrl, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
  const fData = await fRes.json();
  
  console.log('contact_type:', fData.contact?.contact_type);
  console.log('associated_vendor_details:', fData.contact?.associated_vendor_details);
  console.log('associated_customer_details:', fData.contact?.associated_customer_details);
  
  // If it's the wrong one, maybe there's a VENDOR with this name
  const vendorUrl = `${API_BASE_URL}/books/v3/contacts?organization_id=${orgId}&company_name_contains=SUN POWER&contact_type=vendor`;
  const vRes = await fetch(vendorUrl, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
  const vData = await vRes.json();
  if (vData.contacts && vData.contacts.length > 0) {
    console.log('Vendors:', vData.contacts.map(c => ({ id: c.contact_id, name: c.contact_name, type: c.contact_type })));
  }
}
main().catch(console.error);
