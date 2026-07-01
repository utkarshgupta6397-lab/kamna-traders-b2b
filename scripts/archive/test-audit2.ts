import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

async function main() {
  const orgId = getZohoOrgId();
  const accessToken = await getZohoTokens();
  
  const url = `${API_BASE_URL}/books/v3/contacts?organization_id=${orgId}&company_name_contains=SUN POWER`;
  const response = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
  const data = await response.json();
  
  if (data.contacts) {
    const contact = data.contacts.find(c => c.gst_no === '09ADXPT2364G1ZU' || c.contact_name.includes('SUN POWER'));
    console.log('Found contact:', contact?.contact_id, contact?.contact_name, contact?.gst_no);
    
    if (contact) {
      // Let's get the full contact to see vendor_id
      const fullContactUrl = `${API_BASE_URL}/books/v3/contacts/${contact.contact_id}?organization_id=${orgId}`;
      const fRes = await fetch(fullContactUrl, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
      const fData = await fRes.json();
      console.log('Vendor Details:', fData.contact?.associated_vendor_details);
    }
  } else {
    console.log('No contacts found:', data);
  }
}
main().catch(console.error);
