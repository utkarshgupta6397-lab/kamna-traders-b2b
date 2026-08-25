import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCategories() {
  const products = await prisma.product.findMany({
    where: {
      category: {
        name: { contains: 'Solar Panel', mode: 'insensitive' }
      }
    },
    include: {
      category: true
    },
    take: 5
  });
  console.log('Sample products with category containing "Solar Panel":');
  console.log(products.map((p: any) => ({
    name: p.name,
    categoryName: p.category?.name
  })));

  const count = await prisma.product.count({
    where: {
      category: {
        name: { contains: 'Solar Panel', mode: 'insensitive' }
      }
    }
  });
  console.log(`Total count: ${count}`);
  
  await prisma.$disconnect();
}

checkCategories().catch(console.error);
