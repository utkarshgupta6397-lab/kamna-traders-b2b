import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Finding local Product Families...');

  // Find all products that have variants (Families)
  const families = await prisma.product.findMany({
    where: {
      variantProducts: {
        some: {}
      }
    },
    include: {
      variantProducts: true
    }
  });

  if (families.length === 0) {
    console.log('No product families found. Database is clean.');
    return;
  }

  console.log(`Found ${families.length} families to delete.`);

  for (const family of families) {
    console.log(`Deleting family: ${family.name} (${family.id}) with ${family.variantProducts.length} variants...`);

    // 1. Delete MasterDataHistory for child variants and family
    const productIds = [family.id, ...family.variantProducts.map(v => v.id)];
    await prisma.masterDataHistory.deleteMany({
      where: {
        productId: { in: productIds }
      }
    });

    // 2. Delete ProductAttributeValue for child variants and family
    await prisma.productAttributeValue.deleteMany({
      where: {
        productId: { in: productIds }
      }
    });

    // 3. Delete ProductVariant (the actual variant items mapping to the Product table)
    await prisma.productVariant.deleteMany({
      where: {
        productId: { in: productIds }
      }
    });

    // 4. Delete the child Products
    await prisma.product.deleteMany({
      where: {
        parentProductId: family.id
      }
    });

    // 5. Delete the parent Product (the Family)
    await prisma.product.delete({
      where: {
        id: family.id
      }
    });
    
    console.log(`Successfully deleted family ${family.name}`);
  }

  console.log('Cleanup complete.');
}

main()
  .catch((e) => {
    console.error('Error during cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
