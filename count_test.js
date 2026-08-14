const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCounts() {
  const rootCategory = await prisma.category.findFirst({
    where: { name: 'Solar Panels' }
  });

  if (!rootCategory) {
    console.log('Solar Panels category not found');
    process.exit(1);
  }

  const allCategories = await prisma.category.findMany({ select: { id: true, parentId: true } });
  const categoryIds = new Set();
  const findDescendants = (parentId) => {
    categoryIds.add(parentId);
    for (const cat of allCategories) {
      if (cat.parentId === parentId) findDescendants(cat.id);
    }
  };
  findDescendants(rootCategory.id);
  const validCategoryIds = Array.from(categoryIds);

  const products = await prisma.product.findMany({
    where: { categoryId: { in: validCategoryIds }, catalogType: 'PRODUCT' },
    include: { variants: true }
  });

  let totalCount = 0;
  let activeCount = 0;
  let inactiveCount = 0;

  for (const p of products) {
    if (p.variants && p.variants.length > 0) {
      for (const v of p.variants) {
        totalCount++;
        if (p.status === 'Active' && v.isActive) {
          activeCount++;
        } else {
          inactiveCount++;
        }
      }
    } else {
      totalCount++;
      if (p.status === 'Active') {
        activeCount++;
      } else {
        inactiveCount++;
      }
    }
  }

  console.log(`Database Expected Total Count: ${totalCount}`);
  console.log(`Database Expected Active Count: ${activeCount}`);
  console.log(`Database Expected Inactive Count: ${inactiveCount}`);

  await prisma.$disconnect();
}

checkCounts().catch(console.error);
