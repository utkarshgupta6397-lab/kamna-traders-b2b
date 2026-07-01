const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const serial = await prisma.dcrSerial.findFirst();
  console.log("Found serial:", serial.serialNumber);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.dcrSerialAllocation.updateMany({
        where: { serialNumber: serial.serialNumber },
        data: { serialNumber: serial.serialNumber + 'X' }
      });

      await tx.dcrSerial.update({
        where: { id: serial.id },
        data: { serialNumber: serial.serialNumber + 'X' }
      });
      
      // We also had history logic
      await tx.dcrSerialHistory.create({
        data: {
          serialId: serial.id,
          eventType: `CORRECTION_CHANGE_SERIAL`,
          eventDescription: JSON.stringify({
            correctionType: 'CHANGE_SERIAL',
            oldValues: { serialNumber: serial.serialNumber },
            newValues: { serialNumber: serial.serialNumber + 'X' },
            reason: 'Testing',
            changedBy: 'Admin',
            changedOn: new Date().toISOString(),
          }),
          userId: 'cmq5iw2pf0006uayijzmi9g5u',
        }
      });
    });
  } catch(e) {
    console.error("TRANSACTION FAILED:", e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
