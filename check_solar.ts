import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const products = await prisma.product.findMany({
    where: { category: { name: { contains: 'Solar Panel', mode: 'insensitive' } } },
    include: { variants: true }
  });
  products.forEach((p: any) => {
    console.log(`Product: ${p.name}`);
    console.log(`  CatalogType: ${p.catalogType}, IsVariant: ${p.isVariantProduct}, ParentID: ${p.parentProductId}`);
    p.variants.forEach((v: any) => {
      console.log(`  -> SKU: ${v.sku}`);
    });
  });
}
main().finally(() => prisma.$disconnect());
