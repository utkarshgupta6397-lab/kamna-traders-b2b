const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DOCUMENTATION_STEPS = [
  'Document Upload', 'Customer Registration', 'Vendor Portal Accepted', 'Review & Approval',
  'Notarised Pending', 'Customer Signature Pending', 'Review Pending', 'Authority Signature Pending',
  'Company Stamp Pending', 'DCR Certificate Pending', 'File Upload Approval Pending', 'File Upload Pending',
  'Customer Portal Final Submission', 'Electricity Department Submission', 'Central Subsidy Request',
  'Central Subsidy Claimed', 'Central Subsidy Received', 'State Subsidy Received'
];

const INSTALLATION_STEPS = [
  'Installation Pending', 'Installation Completed', 'Rooftop Photos Uploaded',
  'Inverter Number Entered', 'Wiring Completed', 'System Completed'
];

async function seed() {
  console.log('Seeding Solar Orders dummy data...');

  const users = await prisma.user.findMany({ take: 2 });
  if (users.length === 0) {
    console.log('No users found. Cannot seed data.');
    return;
  }
  const staff1 = users[0];
  const staff2 = users.length > 1 ? users[1] : users[0];

  const now = new Date();
  const currentYearStr = `${now.getFullYear()}-${(now.getFullYear() + 1).toString().slice(2)}`;

  // Ensure sequence exists
  const seqRecord = await prisma.solarOrderSequence.upsert({
    where: { year: currentYearStr },
    update: {},
    create: { year: currentYearStr, sequence: 0 },
  });

  let currentSeq = seqRecord.sequence;

  const dummyOrders = [
    { name: 'Ramesh Solar', size: 3, type: 'ON_GRID', amount: 150000, status: 'DRAFT' },
    { name: 'Kamla Enterprises', size: 5, type: 'HYBRID', amount: 350000, status: 'PENDING_APPROVAL' },
    { name: 'Sharma Residence', size: 10, type: 'ON_GRID', amount: 550000, status: 'EXECUTION', docCompleted: 3, instCompleted: 0 },
    { name: 'Patel Villa', size: 4, type: 'OFF_GRID', amount: 250000, status: 'EXECUTION', docCompleted: 8, instCompleted: 2 },
    { name: 'Gupta Traders', size: 20, type: 'ON_GRID', amount: 1200000, status: 'EXECUTION', docCompleted: 15, instCompleted: 6 },
    { name: 'Verma House', size: 2, type: 'HYBRID', amount: 180000, status: 'COMPLETED', docCompleted: 18, instCompleted: 6 },
  ];

  for (const order of dummyOrders) {
    // Check if we need to advance sequence to find an unused one
    let orderNumber;
    let orderExists = true;
    while(orderExists) {
      currentSeq++;
      orderNumber = `SOL-${currentYearStr}-${currentSeq.toString().padStart(3, '0')}`;
      const existing = await prisma.solarOrder.findUnique({ where: { orderNumber } });
      if (!existing) orderExists = false;
    }
    
    // Create Order
    const newOrder = await prisma.solarOrder.create({
      data: {
        orderNumber,
        customerName: order.name,
        phoneNumber: '9876543210',
        whatsappEnabled: true,
        leadSource: 'REFERRAL',
        callingExecutiveId: staff1.id,
        salesmanId: staff2.id,
        totalOrderAmount: order.amount,
        systemSize: order.size,
        systemType: order.type,
        status: order.status,
        createdById: staff1.id,
        approvedById: ['EXECUTION', 'COMPLETED'].includes(order.status) ? staff2.id : null,
        createdAt: new Date(Date.now() - Math.random() * 10000000000), // Random time in the past
      }
    });

    console.log(`Created Order: ${orderNumber} - ${order.status}`);

    // Create Activity Log
    await prisma.solarActivityLog.create({
      data: {
        solarOrderId: newOrder.id,
        actorId: staff1.id,
        actorName: staff1.name || 'Admin',
        eventType: 'ORDER_CREATED',
        description: `Created new solar order ${orderNumber}`,
      }
    });

    if (['EXECUTION', 'COMPLETED'].includes(order.status)) {
      // Initialize workflows
      const docSteps = await prisma.solarWorkflowStep.createMany({
        data: DOCUMENTATION_STEPS.map((step, index) => ({
          solarOrderId: newOrder.id,
          workflowType: 'DOCUMENTATION',
          stepKey: `DOC_${index + 1}`,
          stepIndex: index + 1,
          status: index < order.docCompleted ? 'COMPLETED' : (index === order.docCompleted ? (order.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS') : 'PENDING'),
          metadata: { name: step },
          completedById: index < order.docCompleted ? staff1.id : null,
          completedAt: index < order.docCompleted ? new Date() : null,
        }))
      });

      const instSteps = await prisma.solarWorkflowStep.createMany({
        data: INSTALLATION_STEPS.map((step, index) => ({
          solarOrderId: newOrder.id,
          workflowType: 'INSTALLATION',
          stepKey: `INST_${index + 1}`,
          stepIndex: index + 1,
          status: index < order.instCompleted ? 'COMPLETED' : (index === order.instCompleted ? (order.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING') : 'BLOCKED'),
          metadata: { name: step },
          completedById: index < order.instCompleted ? staff2.id : null,
          completedAt: index < order.instCompleted ? new Date() : null,
        }))
      });

      // Special update for Inverter S/N if completed
      if (order.instCompleted >= 4 || order.status === 'COMPLETED') {
         const invStep = await prisma.solarWorkflowStep.findFirst({
           where: { solarOrderId: newOrder.id, workflowType: 'INSTALLATION', stepIndex: 4 }
         });
         if (invStep) {
           await prisma.solarWorkflowStep.update({
             where: { id: invStep.id },
             data: { metadata: { name: 'Inverter Number Entered', inverterNumber: `SN-9988-${currentSeq}` } }
           });
         }
      }
    }
  }

  // Update sequence
  await prisma.solarOrderSequence.update({
    where: { year: currentYearStr },
    data: { sequence: currentSeq },
  });

  console.log('Seeding Complete!');
}

seed().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
