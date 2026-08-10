const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tokenRecord = await prisma.zohoToken.findUnique({ where: { id: 'singleton' } });
  if (!tokenRecord) return console.log("No token found");
  const accessToken = tokenRecord.accessToken;
  const orgId = "60027595766";
  const apiBase = "https://www.zohoapis.in/books/v3";
  const headers = { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' };

  console.log('\n--- Test 4: Unscoped Endpoint (Projects) ---');
  const res = await fetch(`${apiBase}/projects?organization_id=${orgId}`, { 
    method: 'POST', headers, body: JSON.stringify({ project_name: "Test" }) 
  });
  console.log(`Status: ${res.status}`);
  console.log(`Body: ${await res.text()}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
