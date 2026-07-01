import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const customer = await prisma.customer.findFirst({
    where: { gstNumber: '09ADXPT2364G1ZU' }
  });
  console.log('Customer:', customer);
  
  if (!customer) {
     const customers = await prisma.customer.findMany({
       where: { name: { contains: 'SUN POWER PHOTOVOLTAIC' } }
     });
     console.log('Customers by name:', customers);
  }
}
main().finally(() => prisma.$disconnect());
