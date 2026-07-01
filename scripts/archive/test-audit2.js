const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.dcrInvoice.count();
  console.log(`Total invoices: ${count}`);
  const inv = await prisma.dcrInvoice.findFirst();
  console.log(`First invoice: ${inv?.invoiceNumber}`);
}
main().finally(() => prisma.$disconnect());
