const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst();
  if (!admin) {
    console.log("No users found");
    return;
  }
  
  console.log('Seeding 40 orders...');
  for (let i = 1; i <= 40; i++) {
    await prisma.solarOrder.create({
      data: {
        orderNumber: `DUMMY-${Math.random().toString(36).substr(2, 5)}`,
        customerName: `Customer ${i}`,
        phoneNumber: '9999999999',
        leadSource: 'ONLINE',
        systemType: 'ON_GRID',
        status: 'APPROVED',
        systemSize: 5.0,
        totalOrderAmount: 100000,
        receivedAmount: 10000,
        pendingAmount: 90000,
        orderDate: new Date(),
        createdById: admin.id,
        submittedById: admin.id,
        workflowSteps: {
          create: [
            { stepKey: 'DOC_UPLOAD', workflowType: 'DOCUMENTATION', status: 'PENDING', stepIndex: 0 },
            { stepKey: 'DOC_REVIEW', workflowType: 'DOCUMENTATION', status: 'PENDING', stepIndex: 1 },
            { stepKey: 'INSTALL_PREP', workflowType: 'INSTALLATION', status: 'PENDING', stepIndex: 0 },
            { stepKey: 'INSTALL_EXEC', workflowType: 'INSTALLATION', status: 'PENDING', stepIndex: 1 },
          ]
        }
      }
    });
  }
  console.log('Done seeding.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
