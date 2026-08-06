import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching products to patch...');
  
  // A product is a family if it is NOT a variant product (child), has no parent, 
  // and has no default variant (meaning it was created as a family).
  const products = await prisma.product.findMany({
    where: {
      isVariantProduct: false,
      parentProductId: null,
      catalogType: 'PRODUCT' // default value added by schema push
    },
    include: {
      variants: true
    }
  });

  let patchCount = 0;

  for (const product of products) {
    // If it has NO variants in the ProductVariant table, it's a family
    if (!product.variants || product.variants.length === 0) {
      await prisma.product.update({
        where: { id: product.id },
        data: { catalogType: 'PRODUCT_FAMILY' }
      });
      patchCount++;
    }
  }

  console.log(`Successfully patched ${patchCount} product families.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
