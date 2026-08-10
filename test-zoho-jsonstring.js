const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

async function main() {
  const tokenRecord = await prisma.zohoToken.findUnique({ where: { id: 'singleton' } });
  if (!tokenRecord) return console.log("No token found");
  
  const accessToken = tokenRecord.accessToken;
  const orgId = "60027595766";
  const apiBase = "https://www.zohoapis.in/books/v3";
  
  const itemPayload = {
    name: "Test Form Item " + crypto.randomBytes(4).toString('hex'),
    rate: 100,
    item_type: "sales_and_purchases",
    sku: "TEST-FORM-" + crypto.randomBytes(4).toString('hex')
  };

  console.log('\n--- Test 11: POST Items (JSONString) ---');
  const res = await fetch(`${apiBase}/items?organization_id=${orgId}`, { 
    method: 'POST', 
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ JSONString: JSON.stringify(itemPayload) })
  });
  
  console.log(`Status: ${res.status}`);
  console.log(`Body: ${await res.text()}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
