import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';

async function test() {
  const orgId = getZohoOrgId();
  const token = await getZohoTokens();
  
  const res1 = await fetch(`https://www.zohoapis.in/books/v3/contacts?organization_id=${orgId}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` }
  });
  const data1 = await res1.json();
  const c1 = data1.contacts[0].contact_id;
  
  const res3 = await fetch(`https://www.zohoapis.in/books/v3/contacts?organization_id=${orgId}&contact_ids=${c1}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` }
  });
  const data3 = await res3.json();
  console.log(data3.contacts[0]);
}

test().catch(console.error);
