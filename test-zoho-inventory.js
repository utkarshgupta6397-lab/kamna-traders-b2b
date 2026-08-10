const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

async function main() {
  const tokenRecord = await prisma.zohoToken.findUnique({ where: { id: 'singleton' } });
  if (!tokenRecord) return console.log("No token found");
  
  const accessToken = tokenRecord.accessToken;
  const orgId = "60027595766";
  const apiBaseBooks = "https://www.zohoapis.in/books/v3";
  const apiBaseInventory = "https://www.zohoapis.in/inventory/v1";
  
  const headers = {
    'Authorization': `Zoho-oauthtoken ${accessToken}`,
    'Content-Type': 'application/json'
  };

  const itemPayload = {
    name: "Test Item " + crypto.randomBytes(4).toString('hex'),
    rate: 100,
    item_type: "inventory",
    sku: "TEST-SKU-" + crypto.randomBytes(4).toString('hex')
  };

  console.log('\n--- Test 5: Inventory Items ---');
  const resInv = await fetch(`${apiBaseInventory}/items?organization_id=${orgId}`, { 
    method: 'POST', headers, body: JSON.stringify(itemPayload) 
  });
  console.log(`Status: ${resInv.status}`);
  console.log(`Body: ${await resInv.text()}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
