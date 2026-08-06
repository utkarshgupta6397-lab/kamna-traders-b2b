import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const families = await prisma.product.findMany({ where: { isVariantProduct: false, variantProducts: { some: {} } }, include: { variantProducts: true } });
  for (const f of families) {
    const ids = [f.id, ...f.variantProducts.map(v => v.id)];
    await prisma.masterDataHistory.deleteMany({ where: { productId: { in: ids } } });
    await prisma.productAttributeValue.deleteMany({ where: { productId: { in: ids } } });
    await prisma.productVariant.deleteMany({ where: { productId: { in: ids } } });
    await prisma.product.deleteMany({ where: { parentProductId: f.id } });
    await prisma.product.delete({ where: { id: f.id } });
  }
  console.log('done');
}
main().finally(()=>prisma.$disconnect());
