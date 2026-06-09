import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const serials = await prisma.dcrSerial.findMany({
      where: {},
      orderBy: { createdAt: 'desc' },
      include: {
        tag: true
      },
      take: 1
    });
    console.log(serials);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
