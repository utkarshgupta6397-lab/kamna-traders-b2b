import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runSQL() {
  const allInvoices = await prisma.$queryRaw`
    SELECT * FROM "DcrInvoice" LIMIT 1;
  `;
  console.log(allInvoices);
  await prisma.$disconnect();
}

runSQL().catch(console.error);
