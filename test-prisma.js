const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const limit = 20;
    const skip = 0;
    const where = {};
    const orderBy = { orderDate: 'desc' };

    const ordersData = await prisma.solarOrder.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        salesman: { select: { name: true } },
        callingExecutive: { select: { name: true } },
        subVendor: { select: { name: true } },
        payments: { select: { amount: true } },
        workflowSteps: { select: { id: true, stepKey: true, status: true, updatedAt: true, startedAt: true, completedAt: true } },
        tasks: {
          where: { status: 'PENDING' },
          select: { id: true, dueDate: true }
        }
      }
    });
    console.log("Orders found:", ordersData.length);
  } catch (error) {
    console.error("Query failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
