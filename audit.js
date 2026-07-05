const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const where = { status: { in: ['APPROVED', 'EXECUTION', 'COMPLETED'] } };
  
  const ordersForKpis = await prisma.solarOrder.findMany({
    where,
    select: {
      id: true,
      workflowSteps: {
        where: { workflowType: 'DOCUMENTATION' },
        select: { stepKey: true, status: true, updatedAt: true, startedAt: true, metadata: true },
        orderBy: { stepIndex: 'asc' }
      }
    },
    orderBy: { orderDate: 'asc' }
  });
  
  console.log("STEP 1 - Prisma matching orders:", ordersForKpis.length);

  const { resolveWorkflowState, DOCUMENTATION_STEPS } = require('./src/lib/solar-workflow-config');
  
  const transformedItems = ordersForKpis.map(order => {
    const state = resolveWorkflowState(order.workflowSteps, 'DOCUMENTATION');
    if (state.isCompleted) return null;
    return { id: order.id, currentStage: state.currentStage };
  });

  console.log("STEP 2 - transformedItems (before filter):", transformedItems.length);
  
  const validItems = transformedItems.filter(item => item !== null);
  console.log("STEP 3 - validItems (after removing completed):", validItems.length);
  
  let skip = 0;
  let limit = 1000;
  const paginatedIds = validItems.slice(skip, skip + limit).map(item => item.id);
  console.log("STEP 4 - paginatedIds:", paginatedIds.length);
  
  const fullItemsQuery = await prisma.solarOrder.findMany({
    where: { id: { in: paginatedIds } },
    select: { id: true }
  });
  
  console.log("STEP 5 - fullItemsQuery length:", fullItemsQuery.length);
}
run();
