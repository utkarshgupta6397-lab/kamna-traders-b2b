const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

async function main() {
  const tokenRecord = await prisma.zohoToken.findUnique({ where: { id: 'singleton' } });
  if (!tokenRecord) {
    console.log("No token found");
    return;
  }
  const accessToken = tokenRecord.accessToken;
  const orgId = "60027595766";
  const url = `https://www.zohoapis.in/books/v3/items?organization_id=${orgId}`;
  
  console.log(`URL: ${url}`);
  console.log(`Token: ${accessToken.slice(0, 10)}...`);

  // Try creating a dummy item to see what error we get
  const payload = {
    name: "Test Sync Debug " + crypto.randomBytes(4).toString('hex'),
    rate: 100,
    item_type: "inventory",
    sku: "TEST-SYNC-" + crypto.randomBytes(4).toString('hex')
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  console.log(`Status: ${res.status}`);
  const data = await res.text();
  console.log(`Body: ${data}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
