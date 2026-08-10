const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tokenRecord = await prisma.zohoToken.findUnique({ where: { id: 'singleton' } });
  if (!tokenRecord) return console.log("No token found");
  const accessToken = tokenRecord.accessToken;
  const orgId = "60027595766";
  const apiBase = "https://www.zohoapis.in/books/v3";
  const headers = { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' };

  console.log('\n--- Test 3: Unscoped Endpoint (Bank Accounts) ---');
  const resBank = await fetch(`${apiBase}/bankaccounts?organization_id=${orgId}`, { 
    method: 'POST', headers, body: JSON.stringify({ account_name: "Test Bank" }) 
  });
  console.log(`Status: ${resBank.status}`);
  console.log(`Body: ${await resBank.text()}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
