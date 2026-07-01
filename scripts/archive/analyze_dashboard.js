const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { DOCUMENTATION_STEPS } = require('./src/lib/solar-workflow-config.ts'); // if we can't require TS, I'll just hardcode 18

async function main() {
  const totalOrders = await prisma.solarOrder.count();
  
  const totalDocWorkflowsCount = await prisma.solarOrder.count({
    where: {
      workflowSteps: {
        some: { workflowType: 'DOCUMENTATION' }
      }
    }
  });
  
  const totalWorkflowSteps = await prisma.solarWorkflowStep.count();
  
  // Dashboard query logic
  const dashboardOrders = await prisma.solarOrder.findMany({
    where: {
      status: 'EXECUTION'
    }
  });
  
  console.log(`- total Solar Orders: ${totalOrders}`);
  console.log(`- total Documentation Workflows: ${totalDocWorkflowsCount}`);
  console.log(`- total Workflow Steps: ${totalWorkflowSteps}`);
  console.log(`- number of rows returned by the dashboard query: ${dashboardOrders.length}`);
  
  console.log(`- exact reason each excluded order was filtered out:`);
  
  const allOrders = await prisma.solarOrder.findMany({
    include: {
      workflowSteps: {
        where: { workflowType: 'DOCUMENTATION' }
      }
    }
  });
  
  for (const order of allOrders) {
    const isReturnedByDashboardQuery = order.status === 'EXECUTION';
    
    let isFullyCompleted = false;
    if (order.workflowSteps.length > 0) {
       const completedSteps = order.workflowSteps.filter(s => s.status === 'COMPLETED').length;
       isFullyCompleted = (completedSteps === 18 && order.workflowSteps.length === 18);
    }
    
    // User definition of what SHOULD be in dashboard:
    // Every order whose documentation workflow is NOT fully completed.
    let shouldBeIncluded = !isFullyCompleted;
    
    if (shouldBeIncluded && !isReturnedByDashboardQuery) {
       console.log(`  - ${order.customerName} (${order.orderNumber}): Filtered out because its status is '${order.status}', but dashboard query strictly required 'EXECUTION'.`);
    } else if (!shouldBeIncluded && isReturnedByDashboardQuery) {
       console.log(`  - ${order.customerName} (${order.orderNumber}): Included incorrectly because its status is 'EXECUTION', even though its documentation is fully completed.`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
