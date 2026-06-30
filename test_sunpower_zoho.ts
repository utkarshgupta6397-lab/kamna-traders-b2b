import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';
const API_BASE_URL = 'https://www.zohoapis.in';

async function test() {
  const orgId = getZohoOrgId() || process.env.ZOHO_BOOKS_ORG_ID;
  const accessToken = await getZohoTokens();
  
  const searchUrl = `${API_BASE_URL}/books/v3/contacts?organization_id=${orgId}&page=1&per_page=200`;
  const res = await fetch(searchUrl, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
  });
  const data = await res.json();
  const contacts = data.contacts || [];
  
  console.log("All contacts in Zoho:");
  contacts.forEach((c: any) => {
     if (c.contact_name.toUpperCase().includes('SUN')) {
       console.log(`- ${c.contact_name} (${c.contact_id})`);
     }
  });
  
  // Try to find EXACT
  const exact = contacts.find((c: any) => c.contact_name.toUpperCase().includes('SUN POWER'));
  if (exact) {
      console.log("Found EXACT:", exact);
  }
}
test();
