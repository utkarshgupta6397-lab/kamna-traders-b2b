import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.dispatchIncomingOrder.deleteMany({
    where: { zohoSalesorderId: '17599230002505211' }
  });
  console.log('Deleted test SO');
}
main().then(() => process.exit(0));
