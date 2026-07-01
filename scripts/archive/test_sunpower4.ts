import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';

const API_BASE_URL = 'https://www.zohoapis.in';

async function test() {
  const orgId = getZohoOrgId() || process.env.ZOHO_BOOKS_ORG_ID;
  const accessToken = await getZohoTokens();
  
  const searchUrl = `${API_BASE_URL}/books/v3/contacts?organization_id=${orgId}&contact_name=SUN%20POWER`;
  const res = await fetch(searchUrl, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
  });
  const data = await res.json();
  console.log("Contacts API response:", JSON.stringify(data, null, 2));
}

test();
