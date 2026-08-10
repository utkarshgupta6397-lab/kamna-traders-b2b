const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tokenRecord = await prisma.zohoToken.findUnique({ where: { id: 'singleton' } });
  if (!tokenRecord) return console.log("No token found");
  
  const accessToken = tokenRecord.accessToken;
  const orgId = "60027595766";
  const apiBase = "https://www.zohoapis.in/books/v3";
  const headers = { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' };

  console.log('\n--- Test 10: PUT Items ---');
  // Use an existing item ID from the GET test
  const itemId = "1759923000000065026"; 
  const updatePayload = { rate: 900.01 };
  
  const resItems = await fetch(`${apiBase}/items/${itemId}?organization_id=${orgId}`, { 
    method: 'PUT', headers, body: JSON.stringify(updatePayload) 
  });
  console.log(`Status: ${resItems.status}`);
  console.log(`Body: ${await resItems.text()}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
