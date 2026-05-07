import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const warehouses = await prisma.warehouse.findMany();
  console.log('Warehouses:', warehouses.map(w => w.id));
  const staff = await prisma.user.findMany({ where: { role: 'STAFF' } });
  console.log('Staff IDs:', staff.map(s => s.id));
  const skus = await prisma.sku.findMany();
  console.log('SKU IDs:', skus.map(s => s.id));
}
main().catch(console.error).finally(() => prisma.$disconnect());
