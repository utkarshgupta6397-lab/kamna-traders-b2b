const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const serial = await prisma.dcrSerial.findFirst();
  console.log("Found serial:", serial.serialNumber);

  try {
    await prisma.$transaction(async (tx) => {
      // Just update DcrSerial and let cascade handle DcrSerialAllocation
      await tx.dcrSerial.update({
        where: { id: serial.id },
        data: { serialNumber: serial.serialNumber + 'X' }
      });
      console.log("DcrSerial updated successfully.");
      
      // Update it back
      await tx.dcrSerial.update({
        where: { id: serial.id },
        data: { serialNumber: serial.serialNumber }
      });
      console.log("DcrSerial reverted successfully.");
    });
  } catch(e) {
    console.error("TRANSACTION FAILED:", e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
