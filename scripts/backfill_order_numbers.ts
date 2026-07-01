const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting Order Number Backfill...');

  // 1. Fetch all orders that should have official order numbers
  const approvedStatuses = ['APPROVED', 'EXECUTION', 'COMPLETED', 'CANCELLED'];
  const approvedOrders = await prisma.solarOrder.findMany({
    where: {
      status: { in: approvedStatuses }
    },
    orderBy: [
      { orderDate: 'asc' },
      { approvedAt: 'asc' },
      { createdAt: 'asc' },
      { id: 'asc' }
    ]
  });

  console.log(`Found ${approvedOrders.length} approved/official orders.`);

  // 2. Group by YYMM (from orderDate)
  const groupedByYYMM: Record<string, any[]> = {};
  for (const order of approvedOrders) {
    const orderDateObj = new Date(order.orderDate);
    const currentYear = orderDateObj.getFullYear().toString().slice(2);
    const currentMonth = (orderDateObj.getMonth() + 1).toString().padStart(2, '0');
    const yearMonthStr = `${currentYear}${currentMonth}`;
    
    if (!groupedByYYMM[yearMonthStr]) {
      groupedByYYMM[yearMonthStr] = [];
    }
    groupedByYYMM[yearMonthStr].push(order);
  }

  // 3. Process each group
  let totalUpdated = 0;
  for (const [yymm, orders] of Object.entries(groupedByYYMM)) {
    console.log(`Processing ${yymm} with ${orders.length} orders...`);
    
    await prisma.$transaction(async (tx: any) => {
      // Reset sequence
      await tx.solarOrderSequence.upsert({
        where: { year: yymm },
        update: { sequence: orders.length },
        create: { year: yymm, sequence: orders.length }
      });

      // Update orders
      for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        const sequenceNum = (i + 1).toString().padStart(3, '0');
        const newOrderNumber = `OD-${yymm}-${sequenceNum}`;
        
        await tx.solarOrder.update({
          where: { id: order.id },
          data: { orderNumber: newOrderNumber }
        });
        totalUpdated++;
      }
    });
  }

  console.log(`Successfully re-numbered ${totalUpdated} official orders.`);

  // 4. Strip order numbers from pending/draft/rejected
  const pendingStatuses = ['DRAFT', 'PENDING_APPROVAL', 'REJECTED'];
  const pendingOrders = await prisma.solarOrder.findMany({
    where: {
      status: { in: pendingStatuses },
      orderNumber: { startsWith: 'OD-' } // Only change if it hasn't been changed yet
    }
  });

  console.log(`Found ${pendingOrders.length} pending/draft/rejected orders with OD- numbers.`);
  
  let pendingUpdated = 0;
  for (const order of pendingOrders) {
    const tempNum = `TEMP-${order.id.slice(0, 8).toUpperCase()}`;
    await prisma.solarOrder.update({
      where: { id: order.id },
      data: { orderNumber: tempNum }
    });
    pendingUpdated++;
  }

  console.log(`Successfully assigned TEMP numbers to ${pendingUpdated} pending orders.`);
  console.log('Backfill Complete.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
export {};
