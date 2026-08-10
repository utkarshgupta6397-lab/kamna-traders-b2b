const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

async function main() {
  const tokenRecord = await prisma.zohoToken.findUnique({ where: { id: 'singleton' } });
  if (!tokenRecord) return console.log("No token found");
  
  const accessToken = tokenRecord.accessToken;
  const orgId = "60027595766";
  const apiBase = "https://www.zohoapis.in/books/v3";
  const headers = { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' };

  console.log('\n--- Test 7: POST Items (Sales / Non-Inventory) ---');
  const itemPayload = {
    name: "Test Sales Item " + crypto.randomBytes(4).toString('hex'),
    rate: 100,
    item_type: "sales_and_purchases", // Or 'sales', depending on Zoho
    is_combo_product: false
  };
  
  const resItems = await fetch(`${apiBase}/items?organization_id=${orgId}`, { 
    method: 'POST', headers, body: JSON.stringify(itemPayload) 
  });
  console.log(`Status: ${resItems.status}`);
  console.log(`Body: ${await resItems.text()}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
