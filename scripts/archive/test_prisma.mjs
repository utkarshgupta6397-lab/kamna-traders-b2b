import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const invoice = await prisma.dcrInvoice.findFirst();
  console.log(invoice);
}
run();
