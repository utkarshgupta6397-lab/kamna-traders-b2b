import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';
const API_BASE_URL = 'https://www.zohoapis.in';

async function test() {
  const orgId = getZohoOrgId() || process.env.ZOHO_BOOKS_ORG_ID;
  const accessToken = await getZohoTokens();
  
  const searchUrl3 = `${API_BASE_URL}/books/v3/contacts?organization_id=${orgId}&contact_name=M/S%20SUN%20POWER%20PHOTOVOLTAIC`;
  const res3 = await fetch(searchUrl3, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
  });
  const data3 = await res3.json();
  const contacts3 = data3.contacts || [];
  
  if (contacts3.length > 0) {
     for (const c of contacts3) {
        console.log(`Found exact: ${c.contact_name} (ID: ${c.contact_id})`);
        
        const detailUrl = `${API_BASE_URL}/books/v3/contacts/${c.contact_id}?organization_id=${orgId}`;
        const dRes = await fetch(detailUrl, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
        const dData = await dRes.json();
        const contact = dData.contact;
        
        console.log(`Customer ID: ${contact.contact_id}`);
        console.log(`Vendor ID: ${contact.associated_vendor_id}`);
        console.log(`Customer Name: ${contact.contact_name}`);
        console.log(`GST Number: ${contact.gst_no}`);
        
        // Let's get journals
        const url = `${API_BASE_URL}/books/v3/journals?organization_id=${orgId}&customer_id=${c.contact_id}&page=1&per_page=100&sort_column=date&sort_order=D`;
        console.log(`\nFetching Journals: ${url}`);
        const response = await fetch(url, {
          headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
        });
        const jData = await response.json();
        console.log(`Response Code: ${jData.code}, Message: ${jData.message}`);
        if (jData.journals && jData.journals.length > 0) {
            console.log(`Journals found: ${jData.journals.length}`);
            for (const j of jData.journals) {
                console.log("Journal:", j.journal_id, j.entry_number);
                
                const dRes2 = await fetch(`${API_BASE_URL}/books/v3/journals/${j.journal_id}?organization_id=${orgId}`, {
                    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
                });
                const dData2 = await dRes2.json();
                console.log(JSON.stringify(dData2.journal, null, 2));
            }
        } else {
            console.log("No journals found or error:", jData);
        }
     }
  } else {
     console.log("Not found exact M/S SUN POWER PHOTOVOLTAIC");
  }
}
test();
