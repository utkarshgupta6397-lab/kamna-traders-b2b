import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';
import { PrismaClient } from '@prisma/client';
import { getCustomerById, getHybridJournals } from './src/lib/zoho/customer-statement';

const prisma = new PrismaClient();
const API_BASE_URL = 'https://www.zohoapis.in';

async function test() {
  const customerRecord = await prisma.customer.findFirst({
    where: { name: { contains: 'SUN POWER', mode: 'insensitive' } }
  });
  
  if (!customerRecord) {
    console.log("No DB customer found.");
    return;
  }
  
  const contactId = customerRecord.id;
  const orgId = getZohoOrgId() || process.env.ZOHO_BOOKS_ORG_ID;
  const accessToken = await getZohoTokens();
  
  const customerResult = await getCustomerById(contactId);
  if (!customerResult.success) {
    console.log("Failed to fetch from Zoho:", customerResult.error);
    return;
  }
  const c = customerResult.data;
  
  console.log("=== HYBRID ACCOUNT INFO ===");
  console.log(`Customer ID: ${c?.contactId}`);
  console.log(`Vendor ID: ${c?.associatedVendorId}`);
  console.log(`Customer Name: ${c?.contactName}`);
  console.log(`GST Number: ${c?.gstNo}`);
  
  if (c?.associatedVendorId) {
    console.log("\n=== TESTING getHybridJournals ===");
    const jRes = await getHybridJournals(contactId, c.associatedVendorId);
    console.log("Success:", jRes.success);
    if (!jRes.success) {
       console.log("Error:", jRes.error);
       console.log("Raw:", JSON.stringify(jRes.raw, null, 2));
       return;
    }
    
    console.log(`Found ${jRes.data?.length} journals via getHybridJournals.`);
    console.log(JSON.stringify(jRes.data, null, 2));
    
    // Now let's just get the raw response for the first journal to log the details requested
    if (jRes.raw && jRes.raw.journals && jRes.raw.journals.length > 0) {
      const firstJournalId = jRes.raw.journals[0].journal_id;
      const jDetailUrl = `${API_BASE_URL}/books/v3/journals/${firstJournalId}?organization_id=${orgId}`;
      const jdRes = await fetch(jDetailUrl, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
      });
      const jdData = await jdRes.json();
      console.log(`\n=== RAW JOURNAL DETAIL: ${firstJournalId} ===`);
      console.log(JSON.stringify(jdData.journal, null, 2));
    }
  } else {
    console.log("Not a hybrid account!");
  }
}
test();
