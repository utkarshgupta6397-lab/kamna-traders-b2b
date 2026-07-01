import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const warehouses = await prisma.warehouse.findMany();
  console.log('Warehouses:', warehouses.map(w => w.id));
  const staff = await prisma.user.findMany({ where: { role: 'STAFF' } });
  console.log('Staff IDs:', staff.map(s => s.id));
  const seq = await prisma.dispatchSequence.findFirst();
  console.log('DispatchSequence Sample:', seq);
}
main().catch(console.error).finally(() => prisma.$disconnect());
