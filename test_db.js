const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.solarOrder.findMany({
    where: { status: { in: ['APPROVED', 'EXECUTION', 'COMPLETED'] } },
    select: {
      id: true,
      workflowSteps: {
        where: { workflowType: 'DOCUMENTATION' },
        select: { stepKey: true, status: true, updatedAt: true, startedAt: true, metadata: true, stepIndex: true },
        orderBy: { stepIndex: 'asc' }
      }
    },
    orderBy: { orderDate: 'asc' }
  });
  console.log(`ordersForKpis length: ${orders.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
