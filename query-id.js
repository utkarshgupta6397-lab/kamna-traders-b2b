const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const order = await prisma.dispatchIncomingOrder.findUnique({
    where: { zohoSalesorderId: '1759923000025052094' }
  });
  console.log('ID:', order?.id);
}
main().catch(console.error).finally(() => process.exit(0));
