import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';

const API_BASE_URL = 'https://www.zohoapis.in';

async function test() {
  const token = await getZohoTokens();
  const org = getZohoOrgId() || process.env.ZOHO_BOOKS_ORG_ID;
  
  const res = await fetch(`${API_BASE_URL}/books/v3/journals?organization_id=${org}&page=1`, { 
    headers: { Authorization: `Zoho-oauthtoken ${token}` }
  });
  
  const data = await res.json();
  console.log("=== JOURNALS LIST ===");
  if (data.journals && data.journals.length > 0) {
    console.log(JSON.stringify(data.journals.slice(0, 1), null, 2));

    const journalId = data.journals[0].journal_id;
    console.log(`\n=== JOURNAL DETAIL: ${journalId} ===`);
    const res2 = await fetch(`${API_BASE_URL}/books/v3/journals/${journalId}?organization_id=${org}`, { 
      headers: { Authorization: `Zoho-oauthtoken ${token}` }
    });
    const data2 = await res2.json();
    if (data2.journal && data2.journal.line_items) {
      console.log(JSON.stringify(data2.journal.line_items.slice(0, 2), null, 2));
    }
  } else {
    console.log(data);
  }
}
test();
