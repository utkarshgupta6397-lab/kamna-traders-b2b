import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';

const API_BASE_URL = 'https://www.zohoapis.in';

async function test() {
  const orgId = getZohoOrgId() || process.env.ZOHO_BOOKS_ORG_ID;
  const accessToken = await getZohoTokens();
  
  const searchUrl = `${API_BASE_URL}/books/v3/contacts?organization_id=${orgId}&contact_name=SUN POWER`;
  const res = await fetch(searchUrl, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
  });
  const data = await res.json();
  const contacts = data.contacts || [];
  
  for (const c of contacts) {
    if (c.contact_name.includes('SUN POWER')) {
      console.log(`Found: ${c.contact_name} (ID: ${c.contact_id})`);
      
      const detailUrl = `${API_BASE_URL}/books/v3/contacts/${c.contact_id}?organization_id=${orgId}`;
      const dRes = await fetch(detailUrl, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
      });
      const dData = await dRes.json();
      const contact = dData.contact;
      
      console.log("=== HYBRID ACCOUNT INFO ===");
      console.log(`Customer ID: ${contact.contact_id}`);
      console.log(`Vendor ID: ${contact.associated_vendor_id}`);
      console.log(`Customer Name: ${contact.contact_name}`);
      console.log(`GST Number: ${contact.gst_no}`);
      
      if (contact.associated_vendor_id) {
        const url = `${API_BASE_URL}/books/v3/journals?organization_id=${orgId}&customer_id=${contact.contact_id}&page=1&per_page=100&sort_column=date&sort_order=D`;
        console.log(`\nFetching Journals: ${url}`);
        const response = await fetch(url, {
          headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
        });
        const jData = await response.json();
        console.log(`Response Code: ${jData.code}, Message: ${jData.message}`);
        
        if (jData.journals && jData.journals.length > 0) {
          console.log(`Found ${jData.journals.length} journals. Fetching details...`);
          for (const j of jData.journals.slice(0, 3)) {
            const jDetailUrl = `${API_BASE_URL}/books/v3/journals/${j.journal_id}?organization_id=${orgId}`;
            const jdRes = await fetch(jDetailUrl, {
              headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
            });
            const jdData = await jdRes.json();
            const journal = jdData.journal;
            console.log(`\n=== JOURNAL DETAIL: ${journal.journal_id} ===`);
            console.log(`entry_number: ${journal.entry_number}`);
            console.log(`reference_number: ${journal.reference_number}`);
            console.log(`journal_date: ${journal.journal_date}`);
            console.log(`status: ${journal.status}`);
            console.log(`notes: ${journal.notes}`);
            console.log(`total: ${journal.total}`);
            console.log(`line_items:`, JSON.stringify(journal.line_items, null, 2));
          }
        } else {
            console.log("No journals found or error:", jData);
        }
      }
    }
  }
}

test();
