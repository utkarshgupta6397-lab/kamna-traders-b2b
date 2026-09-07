import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const orders = await prisma.dispatchIncomingOrder.findMany();
  console.log(orders);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
