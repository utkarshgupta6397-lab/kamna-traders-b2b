import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  const customer = await prisma.customer.findFirst({
    where: { companyName: { contains: 'SUN POWER PHOTOVOLTAIC', mode: 'insensitive' } }
  });
  console.log("Customer found:", JSON.stringify(customer, null, 2));

  const tokenRecord = await prisma.zohoToken.findFirst({
    orderBy: { updatedAt: 'desc' }
  });
  console.log("Token expires at:", tokenRecord?.expiresAt);
}
test();
