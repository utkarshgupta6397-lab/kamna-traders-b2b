import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const q = "test";
    const serials = await prisma.dcrSerial.findMany({
      where: {
        OR: [
          { tag: { tag: { contains: q, mode: 'insensitive' } } }
        ]
      }
    });
    console.log("Success", serials.length);
  } catch (e) {
    console.error("Prisma error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
