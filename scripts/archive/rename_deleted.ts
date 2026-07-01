import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const deletedSerials = await prisma.dcrSerial.findMany({
      where: {
        isDeleted: true,
        NOT: {
          serialNumber: {
            contains: '_DEL_'
          }
        }
      }
    });

    console.log(`Found ${deletedSerials.length} deleted serials to rename.`);

    for (const serial of deletedSerials) {
      await prisma.dcrSerial.update({
        where: { id: serial.id },
        data: {
          serialNumber: `${serial.serialNumber}_DEL_${Date.now()}_${Math.floor(Math.random() * 1000)}`
        }
      });
    }

    console.log("Done renaming.");
  } catch (e) {
    console.error("Prisma error:", e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
