import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const order = await prisma.solarOrder.findFirst({
    where: { orderNumber: 'OD-2607-002' },
    include: {
      workflowSteps: {
        where: { workflowType: 'DOCUMENTATION' },
        orderBy: { stepIndex: 'asc' }
      },
      files: {
        where: { fileCategory: 'DOCUMENTATION' }
      }
    }
  });

  if (!order) {
    console.log("Order not found");
    return;
  }

  console.log(JSON.stringify(order, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
