import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';
const API_BASE_URL = 'https://www.zohoapis.in';

async function test() {
  const orgId = getZohoOrgId() || process.env.ZOHO_BOOKS_ORG_ID;
  const accessToken = await getZohoTokens();
  
  let page = 1;
  let hasMore = true;
  while(hasMore) {
    const searchUrl = `${API_BASE_URL}/books/v3/contacts?organization_id=${orgId}&page=${page}&per_page=200`;
    const res = await fetch(searchUrl, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
    });
    const data = await res.json();
    const contacts = data.contacts || [];
    
    for (const c of contacts) {
       if (c.contact_name.toUpperCase().includes('SUN POWER')) {
          console.log("FOUND SUN POWER!!!", c);
       }
    }
    
    if (contacts.length > 0) {
       console.log(`Page ${page}: ${contacts.length} contacts. First: ${contacts[0].contact_name}`);
    }
    
    hasMore = data.page_context?.has_more_page;
    page++;
    if (page > 5) break; // Limit
  }
}
test();
