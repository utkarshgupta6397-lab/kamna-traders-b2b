const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

async function main() {
  const tokenRecord = await prisma.zohoToken.findUnique({ where: { id: 'singleton' } });
  if (!tokenRecord) return console.log("No token found");
  
  const accessToken = tokenRecord.accessToken;
  const orgId = "60027595766";
  const apiBase = "https://www.zohoapis.in/books/v3";
  
  const headers = {
    'Authorization': `Zoho-oauthtoken ${accessToken}`,
    'Content-Type': 'application/json'
  };

  console.log(`Token: ${accessToken.slice(0, 15)}...`);
  
  // Test 1: POST Contacts
  console.log('\n--- Test 1: POST Contacts ---');
  const contactPayload = {
    contact_name: "Test Contact " + crypto.randomBytes(4).toString('hex'),
    company_name: "Test Company"
  };
  const resContacts = await fetch(`${apiBase}/contacts?organization_id=${orgId}`, { 
    method: 'POST', headers, body: JSON.stringify(contactPayload) 
  });
  console.log(`Status: ${resContacts.status}`);
  console.log(`Body: ${await resContacts.text()}`);

  // Test 2: POST Items
  console.log('\n--- Test 2: POST Items ---');
  const itemPayload = {
    name: "Test Item " + crypto.randomBytes(4).toString('hex'),
    rate: 100,
    item_type: "inventory",
    sku: "TEST-SKU-" + crypto.randomBytes(4).toString('hex')
  };
  const resItems = await fetch(`${apiBase}/items?organization_id=${orgId}`, { 
    method: 'POST', headers, body: JSON.stringify(itemPayload) 
  });
  console.log(`Status: ${resItems.status}`);
  console.log(`Body: ${await resItems.text()}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
