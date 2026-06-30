import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const query = 'SUN POWER';
  console.log('Searching for customers matching:', query);
  
  const customers = await prisma.customer.findMany({
    where: {
      name: {
        contains: query,
        mode: 'insensitive'
      }
    }
  });

  console.log(JSON.stringify(customers, null, 2));
  console.log(`Total customers found: ${customers.length}`);

  const activeCustomers = await prisma.customer.findMany({
    where: {
      name: {
        contains: query,
        mode: 'insensitive'
      },
      status: 'active'
    }
  });
  console.log(`Active customers found: ${activeCustomers.length}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
