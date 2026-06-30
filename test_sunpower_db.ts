import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function test() {
  const customers = await prisma.customer.findMany({ select: { id: true, name: true } });
  console.log("All Customers in DB:", customers);
}
test();
