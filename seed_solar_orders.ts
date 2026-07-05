import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ take: 3 });
  if (users.length === 0) {
    console.log('No users found in database to assign orders.');
    return;
  }
  
  const creatorId = users[0].id;
  const staff1 = users[0].id;
  const staff2 = users.length > 1 ? users[1].id : users[0].id;

  const statuses = ['PENDING_APPROVAL', 'APPROVED', 'EXECUTION', 'INSTALLATION_IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED'];
  const leadSources = ['CALLING_ACTIVITY', 'ONLINE', 'REFERRAL', 'WALK_IN', 'FRIENDS_AND_FAMILY', 'SUB_VENDOR'];
  const systemTypes = ['ON_GRID', 'OFF_GRID', 'HYBRID'];
  const customerNames = ['Acme Corp', 'Wayne Enterprises', 'Stark Industries', 'Globex', 'Soylent Corp', 'Initech', 'Umbrella Corp'];
  
  const docSteps = [
    { key: 'CUSTOMER_REGISTRATION', group: 'REGISTRATION' },
    { key: 'DOCUMENT_UPLOAD', group: 'REGISTRATION' },
    { key: 'VENDOR_PORTAL_REGISTRATION', group: 'REGISTRATION' },
    { key: 'SUBSIDY_APPLICATION', group: 'SUBSIDY' }
  ];
  
  const installSteps = [
    { key: 'SITE_INSPECTION', group: 'PRE_INSTALLATION' },
    { key: 'MATERIAL_DISPATCH', group: 'PRE_INSTALLATION' },
    { key: 'INSTALLATION_START', group: 'EXECUTION' },
    { key: 'SYSTEM_COMMISSIONING', group: 'EXECUTION' }
  ];

  for (let i = 0; i < 50; i++) {
    const status = statuses[i % statuses.length];
    const leadSource = leadSources[i % leadSources.length];
    
    let salesmanId = null;
    let callingExecutiveId = null;
    
    if (leadSource === 'CALLING_ACTIVITY') {
      callingExecutiveId = staff2;
      salesmanId = staff1;
    } else {
      salesmanId = staff1;
    }
    
    const amount = 100000 + (Math.floor(Math.random() * 50) * 10000);
    const hasOutstanding = i % 3 === 0;
    const pendingAmt = hasOutstanding ? amount * 0.2 : 0;
    const receivedAmt = amount - pendingAmt;

    // Create the order
    const order = await prisma.solarOrder.create({
      data: {
        orderNumber: `ORD-${3000 + i}`,
        orderDate: new Date(Date.now() - Math.random() * 10000000000),
        status,
        customerName: `${customerNames[i % customerNames.length]} ${i}`,
        phoneNumber: `98765432${i.toString().padStart(2, '0')}`,
        customerEmail: `contact${i}@example.com`,
        
        systemSize: (i % 10) + 1,
        systemType: systemTypes[i % systemTypes.length],
        
        totalOrderAmount: amount,
        receivedAmount: receivedAmt,
        pendingAmount: pendingAmt,
        
        leadSource,
        salesmanId,
        callingExecutiveId,
        
        createdById: creatorId,
        zohoBooksCustomerId: i % 2 === 0 ? `ZOHO-${1000 + i}` : null,
      }
    });

    // Create workflow steps for orders that are not PENDING_APPROVAL/REJECTED
    if (status !== 'PENDING_APPROVAL' && status !== 'REJECTED' && status !== 'CANCELLED') {
      
      let docIndex = 0;
      for (const step of docSteps) {
        await prisma.solarWorkflowStep.create({
          data: {
            solarOrderId: order.id,
            workflowType: 'DOCUMENTATION',
            stepKey: step.key,
            stepIndex: docIndex++,
            status: docIndex < 3 ? 'COMPLETED' : 'PENDING',
            startedAt: new Date(),
            completedAt: docIndex < 3 ? new Date() : null,
            completedById: docIndex < 3 ? staff1 : null
          }
        });
      }
      
      let instIndex = 0;
      for (const step of installSteps) {
        await prisma.solarWorkflowStep.create({
          data: {
            solarOrderId: order.id,
            workflowType: 'INSTALLATION',
            stepKey: step.key,
            stepIndex: instIndex++,
            status: status === 'INSTALLATION_IN_PROGRESS' && instIndex < 2 ? 'COMPLETED' : 'PENDING',
            startedAt: new Date(),
            completedAt: status === 'INSTALLATION_IN_PROGRESS' && instIndex < 2 ? new Date() : null,
            completedById: status === 'INSTALLATION_IN_PROGRESS' && instIndex < 2 ? staff2 : null
          }
        });
      }
    }
  }

  console.log('Successfully seeded 50 Solar Orders with varying states.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
