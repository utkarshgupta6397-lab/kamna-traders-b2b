import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';

async function test() {
  const orgId = getZohoOrgId();
  const token = await getZohoTokens();
  
  // test fetching 2 contacts
  // Find some contact IDs
  const res1 = await fetch(`https://www.zohoapis.in/books/v3/contacts?organization_id=${orgId}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` }
  });
  const data1 = await res1.json();
  const c1 = data1.contacts[0].contact_id;
  const c2 = data1.contacts[1].contact_id;
  
  console.log('Testing contact_id_in...');
  const res2 = await fetch(`https://www.zohoapis.in/books/v3/contacts?organization_id=${orgId}&contact_id=${c1},${c2}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` }
  });
  const data2 = await res2.json();
  console.log(`Results with contact_id=${c1},${c2}:`, data2.contacts?.length);
  
  console.log('Testing contact_ids...');
  const res3 = await fetch(`https://www.zohoapis.in/books/v3/contacts?organization_id=${orgId}&contact_ids=${c1},${c2}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` }
  });
  const data3 = await res3.json();
  console.log(`Results with contact_ids=${c1},${c2}:`, data3.contacts?.length);
}

test().catch(console.error);
