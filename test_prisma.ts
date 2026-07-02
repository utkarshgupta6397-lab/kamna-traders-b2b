import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const id = 'cmr3bqd3r003vuag4hn9x8ib6';
    const order = await prisma.solarOrder.findUnique({ where: { id } });
    if (!order) {
      console.log('Order not found');
      return;
    }

    const previousValue = order.fileChargePaid;
    const newValue = true;
    let fileChargeAmount = 2500;

    const result = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.solarOrder.update({
        where: { id },
        data: {
          fileChargePaid: newValue,
          fileChargeAmount: newValue ? fileChargeAmount : order.fileChargeAmount,
          lastEditedAt: new Date(),
          editCount: { increment: 1 }
        }
      });

      let logDescription = newValue 
        ? `Marked File Charge as Paid. Amount: ₹${fileChargeAmount?.toLocaleString('en-IN')}` 
        : `Marked File Charge as Not Paid.`;

      await tx.solarActivityLog.create({
        data: {
          solarOrderId: id,
          eventType: 'FILE_CHARGE_UPDATED',
          actorId: 'cmr08bh97000auau9id8rnk56',
          actorName: 'Unknown',
          description: logDescription,
          metadata: {
            field: 'fileChargePaid',
            oldValue: previousValue,
            newValue: newValue,
            fileChargeAmount: fileChargeAmount === undefined ? null : fileChargeAmount
          }
        }
      });

      return updatedOrder;
    });

    console.log('SUCCESS');
  } catch (error) {
    console.error('ERROR', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
