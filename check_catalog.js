const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCatalog() {
  const rootCategory = await prisma.category.findFirst({
    where: { name: 'Solar Panels' }
  });

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
    where: { categoryId: { in: validCategoryIds } },
    include: { variants: true }
  });

  for (const p of products) {
    console.log(`Product: ${p.name} | Type: ${p.catalogType} | isVariantProduct: ${p.isVariantProduct} | Variants: ${p.variants.length}`);
  }

  await prisma.$disconnect();
}

checkCatalog().catch(console.error);
