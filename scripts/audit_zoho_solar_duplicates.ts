const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting Audit for Zoho Customer Multiple Active Solar Orders...');

  // Active definition: Everything EXCEPT Completed, Cancelled, Rejected, Archived
  // We'll exclude those statuses
  const excludedStatuses = ['COMPLETED', 'CANCELLED', 'REJECTED', 'ARCHIVED'];

  const activeOrders = await prisma.solarOrder.findMany({
    where: {
      status: { notIn: excludedStatuses },
      zohoBooksCustomerId: { not: null }
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      orderDate: true,
      createdAt: true,
      zohoBooksCustomerId: true,
      zohoBooksCustomerName: true
    }
  });

  const grouped: Record<string, any[]> = {};
  for (const order of activeOrders) {
    const zid = order.zohoBooksCustomerId;
    if (!grouped[zid]) {
      grouped[zid] = [];
    }
    grouped[zid].push(order);
  }

  let duplicateCount = 0;

  for (const [zid, orders] of Object.entries(grouped)) {
    // Only check if > 1
    if ((orders as any[]).length > 1) {
      duplicateCount++;
      const customerName = (orders as any[])[0].zohoBooksCustomerName || 'Unknown';
      
      console.log('--------------------------------------------------');
      console.log(`Zoho Customer ID   : ${zid}`);
      console.log(`Customer Name      : ${customerName}`);
      console.log(`Total Active Orders: ${(orders as any[]).length}`);
      console.log('Orders:');
      for (const o of (orders as any[])) {
        console.log(`  - ${o.orderNumber} | Status: ${o.status} | Created: ${new Date(o.createdAt).toLocaleDateString()}`);
      }
    }
  }

  console.log('--------------------------------------------------');
  console.log(`Audit Complete. Found ${duplicateCount} customers with multiple active solar orders.`);
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
