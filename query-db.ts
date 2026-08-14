import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const variantId = 'cmsq64uc7000bua5hb4fs9j57';
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: { include: { parentProduct: true } } }
  });
  console.log('--- DB STATE ---');
  console.log('Has Variant Image:', !!variant?.product?.thumbnailBase64);
  console.log('Has Parent Image:', !!variant?.product?.parentProduct?.thumbnailBase64);
  console.log('Variant IncentiveTag:', variant?.product?.incentiveTag);
  console.log('Parent IncentiveTag:', variant?.product?.parentProduct?.incentiveTag);
  await prisma.$disconnect();
}
main();
