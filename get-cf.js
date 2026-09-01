const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const account = await prisma.zohoAccount.findFirst();
  
  // We can just construct the token manually if we have it or let's just write the backend logic in `src/lib/enrich-so.ts` which is executed dynamically anyway.
  console.log(account.accessToken.substring(0, 10));
}
run();
