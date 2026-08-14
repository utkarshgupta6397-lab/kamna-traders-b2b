import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const variantId = 'cmsq64uc7000bua5hb4fs9j57';
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: { include: { parentProduct: true } } }
  });
  console.log('Parent ID:', variant?.product?.parentProductId);
  console.log('Parent has thumbnail:', !!variant?.product?.parentProduct?.thumbnailBase64);
  console.log('Parent Incentive:', variant?.product?.parentProduct?.incentiveTag);
  await prisma.$disconnect();
}
main();
