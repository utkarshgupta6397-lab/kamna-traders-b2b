const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log("Seeding diverse orders...");
  const statuses = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'EXECUTION', 'INSTALLATION_IN_PROGRESS', 'COMPLETED'];
  
  await prisma.solarWorkflowStep.deleteMany({});
  await prisma.solarOrder.deleteMany({});
  
  for (let i = 0; i < 50; i++) {
    const status = statuses[i % statuses.length];
    
    const order = await prisma.solarOrder.create({
      data: {
        orderNumber: `DB-TEST-${(i + 1).toString().padStart(3, '0')}`,
        customerName: `Customer ${i + 1}`,
        phoneNumber: `99999${i.toString().padStart(5, '0')}`,
        status,
        totalOrderAmount: 100000,
        amountPaid: 0,
        installationDate: status === 'INSTALLATION_IN_PROGRESS' ? new Date() : null,
        leadSource: 'DIRECT',
        systemSize: 5.0,
      }
    });

    if (i % 5 === 1) {
      await prisma.solarWorkflowStep.create({
        data: { solarOrderId: order.id, workflowType: 'DOCUMENTATION', stepIndex: 0, stepKey: 'document_upload', status: 'COMPLETED' }
      });
      await prisma.solarWorkflowStep.create({
        data: { solarOrderId: order.id, workflowType: 'DOCUMENTATION', stepIndex: 1, stepKey: 'customer_registration', status: 'IN_PROGRESS' }
      });
    } else if (i % 5 === 2) {
      const steps = ['document_upload', 'customer_registration', 'vendor_portal', 'notarised_pending', 'customer_signature', 'documentation_review'];
      for (let j = 0; j < steps.length; j++) {
        await prisma.solarWorkflowStep.create({
          data: { solarOrderId: order.id, workflowType: 'DOCUMENTATION', stepIndex: j, stepKey: steps[j], status: 'COMPLETED' }
        });
      }
    } else if (i % 5 === 3) {
      await prisma.solarWorkflowStep.create({
        data: { solarOrderId: order.id, workflowType: 'INSTALLATION', stepIndex: 0, stepKey: 'Ready to Install', status: 'COMPLETED' }
      });
    } else if (i % 5 === 4) {
      await prisma.solarWorkflowStep.create({
        data: { solarOrderId: order.id, workflowType: 'DOCUMENTATION', stepIndex: 0, stepKey: 'document_upload', status: 'PENDING' }
      });
      await prisma.solarWorkflowStep.create({
        data: { solarOrderId: order.id, workflowType: 'INSTALLATION', stepIndex: 0, stepKey: 'Ready to Install', status: 'PENDING' }
      });
    }
  }
  
  console.log("Seeding complete.");
}
run().catch(console.error).finally(() => prisma.$disconnect());
