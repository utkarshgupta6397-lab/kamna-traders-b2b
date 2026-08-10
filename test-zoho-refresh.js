const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tokenRecord = await prisma.zohoToken.findUnique({ where: { id: 'singleton' } });
  if (!tokenRecord) return console.log("No token found");
  
  const CLIENT_ID = process.env.ZOHO_CLIENT_ID;
  const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
  
  console.log('--- Test 6: Force Token Refresh ---');
  const response = await fetch(`https://accounts.zoho.in/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: tokenRecord.refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token'
    })
  });
  
  const data = await response.json();
  console.log('Refresh Response Scope:');
  console.log(data.scope);
  
  const scopes = data.scope ? data.scope.split(' ') : [];
  console.log(`Contains items.CREATE? ${scopes.includes('ZohoBooks.items.CREATE')}`);
  console.log(`Contains items.UPDATE? ${scopes.includes('ZohoBooks.items.UPDATE')}`);
  console.log(`Contains contacts.CREATE? ${scopes.includes('ZohoBooks.contacts.CREATE')}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
