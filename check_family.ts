import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const family = await prisma.product.findUnique({
    where: { id: 'cmsh5y7d7001quamyr4cd2ast' }
  });
  console.log(family);
}
main().finally(() => prisma.$disconnect());
