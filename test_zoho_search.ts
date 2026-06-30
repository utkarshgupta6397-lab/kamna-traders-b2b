import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

async function main() {
  const query = 'M/S SUN POWER';
  const orgId = getZohoOrgId();
  const accessToken = await getZohoTokens();

  if (!orgId || !accessToken) {
    console.error('Missing orgId or accessToken');
    return;
  }

  const url = `${API_BASE_URL}/books/v3/contacts?organization_id=${orgId}&search_text=${encodeURIComponent(query)}`;
  console.log(`Fetching from: ${url}`);
  
  const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
  const data = await res.json();
  
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
