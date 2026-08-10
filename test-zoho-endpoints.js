const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
  
  // Test 1: Contacts
  console.log('\n--- Test 1: Contacts ---');
  const resContacts = await fetch(`${apiBase}/contacts?organization_id=${orgId}`, { headers });
  console.log(`Status: ${resContacts.status}`);
  console.log(`Body: ${await resContacts.text()}`);

  // Test 2: Items
  console.log('\n--- Test 2: Items ---');
  const resItems = await fetch(`${apiBase}/items?organization_id=${orgId}`, { headers });
  console.log(`Status: ${resItems.status}`);
  console.log(`Body: ${await resItems.text()}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
