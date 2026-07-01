import { prisma } from './src/lib/db';
import { DOCUMENTATION_STEPS } from './src/lib/solar-workflow-config';

async function run() {
  const where = { status: 'EXECUTION' };
  const orders = await prisma.solarOrder.findMany({
    where,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      status: true,
      workflowSteps: {
        where: { workflowType: 'DOCUMENTATION' },
        select: {
          stepKey: true,
          status: true,
          metadata: true
        }
      }
    }
  });

  console.log("Found orders:", orders.length);
  orders.forEach(o => console.log(o.customerName, o.status, o.workflowSteps.length));
}

run().catch(console.error).finally(() => prisma.$disconnect());
