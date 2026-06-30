import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Solar Pending Amount Population...');
  
  const orders = await prisma.solarOrder.findMany({
    include: { payments: true }
  });
  
  let count = 0;
  for (const order of orders) {
    const totalReceived = order.payments ? order.payments.reduce((acc, p) => acc + p.amount, 0) : 0;
    const pendingAmount = order.totalOrderAmount - totalReceived;
    
    await prisma.solarOrder.update({
      where: { id: order.id },
      data: {
        receivedAmount: totalReceived,
        pendingAmount: pendingAmount,
      }
    });
    count++;
  }
  
  console.log(`Updated ${count} orders successfully!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
