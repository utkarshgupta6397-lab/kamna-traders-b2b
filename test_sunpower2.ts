import { PrismaClient } from '@prisma/client';
import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';
import { getCustomerById } from './src/lib/zoho/customer-statement';

const prisma = new PrismaClient();
const API_BASE_URL = 'https://www.zohoapis.in';

async function test() {
  const customerRecord = await prisma.customer.findFirst({
    where: { name: { contains: 'SUN POWER', mode: 'insensitive' } }
  });
  console.log("Customer found:", JSON.stringify(customerRecord, null, 2));

  if (!customerRecord) return;
  const contactId = customerRecord.id;

  const orgId = getZohoOrgId() || process.env.ZOHO_BOOKS_ORG_ID;
  const accessToken = await getZohoTokens();
  
  // 1. Fetch from getCustomerById
  const customerResult = await getCustomerById(contactId);
  if (!customerResult.success) {
    console.log("Failed to fetch customer:", customerResult.error);
    return;
  }
  const c = customerResult.data;
  console.log("=== HYBRID ACCOUNT INFO ===");
  console.log(`Customer ID: ${c?.contactId}`);
  console.log(`Vendor ID: ${c?.associatedVendorId}`);
  console.log(`Customer Name: ${c?.contactName}`);
  console.log(`GST Number: ${c?.gstNo}`);
  
  // 2. Fetch Journals
  if (c?.associatedVendorId) {
    const url = `${API_BASE_URL}/books/v3/journals?organization_id=${orgId}&customer_id=${c.contactId}&page=1&per_page=100&sort_column=date&sort_order=D`;
    console.log(`\nFetching Journals: ${url}`);
    const response = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
    });
    const data = await response.json();
    console.log(`Response Code: ${data.code}, Message: ${data.message}`);
    
    if (data.journals && data.journals.length > 0) {
      console.log(`Found ${data.journals.length} journals. Fetching details...`);
      for (const j of data.journals.slice(0, 3)) {
        const detailUrl = `${API_BASE_URL}/books/v3/journals/${j.journal_id}?organization_id=${orgId}`;
        const dRes = await fetch(detailUrl, {
          headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
        });
        const dData = await dRes.json();
        const journal = dData.journal;
        console.log(`\n=== JOURNAL DETAIL: ${journal.journal_id} ===`);
        console.log(`entry_number: ${journal.entry_number}`);
        console.log(`reference_number: ${journal.reference_number}`);
        console.log(`journal_date: ${journal.journal_date}`);
        console.log(`status: ${journal.status}`);
        console.log(`notes: ${journal.notes}`);
        console.log(`total: ${journal.total}`);
        console.log(`line_items:`, JSON.stringify(journal.line_items, null, 2));
      }
    }
  }
}

test();
