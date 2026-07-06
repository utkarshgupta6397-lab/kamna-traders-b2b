import { PrismaClient } from '@prisma/client';
import { fakerEN_IN as faker } from '@faker-js/faker';

const prisma = new PrismaClient();

const STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'EXECUTION', 'COMPLETED', 'CANCELLED'];
const LEAD_SOURCES = ['Walk-in', 'Referral', 'Friends & Family', 'Calling Activity', 'Online', 'Sub-Vendor', 'Other'];
const SYSTEM_TYPES = ['ON_GRID', 'OFF_GRID', 'HYBRID'];
const SYSTEM_SIZES = [1, 2, 3, 5, 10, 15];

const DOCUMENTATION_STEPS = [
  'Site Survey',
  'Capacity Approval',
  'Quotation',
  'Agreement',
  'Net Metering Application',
  'Net Metering Approval'
];

const INSTALLATION_STEPS = [
  'Material Dispatch',
  'Structure Installation',
  'Panel Installation',
  'Inverter Installation',
  'Wiring & Commissioning',
  'Net Meter Installation'
];

function getRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getWeightedRandom<T>(arr: { value: T, weight: number }[]): T {
  const totalWeight = arr.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  for (const item of arr) {
    if (random < item.weight) return item.value;
    random -= item.weight;
  }
  return arr[arr.length - 1].value;
}

async function main() {
  console.log('Cleaning up existing fake data (optional)...');
  // Be careful not to delete real users! We will just create new ones or fetch existing.

  console.log('Ensuring dummy staff exists...');
  
  // Create an admin to be the creator
  let admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        name: 'System Admin',
        mobile: '9999999999',
        role: 'ADMIN',
        active: true
      }
    });
  }

  // Create salesmen
  const salesmen = [];
  for (let i = 1; i <= 3; i++) {
    const s = await prisma.user.upsert({
      where: { mobile: `888888888${i}` },
      update: {},
      create: {
        name: faker.person.fullName(),
        mobile: `888888888${i}`,
        role: 'SALES_EXECUTIVE',
        active: true
      }
    });
    salesmen.push(s);
  }

  // Create calling execs
  const execs = [];
  for (let i = 1; i <= 3; i++) {
    const e = await prisma.user.upsert({
      where: { mobile: `777777777${i}` },
      update: {},
      create: {
        name: faker.person.fullName(),
        mobile: `777777777${i}`,
        role: 'CALLING_EXECUTIVE',
        active: true
      }
    });
    execs.push(e);
  }

  // Create sub-vendors
  const subVendors = [];
  for (let i = 1; i <= 3; i++) {
    let sv = await prisma.subVendor.findFirst({ where: { name: `SubVendor ${i}` } });
    if (!sv) {
      sv = await prisma.subVendor.create({
        data: {
          name: `SubVendor ${i}`
        }
      });
    }
    subVendors.push(sv);
  }

  console.log('Generating 450 Solar Orders...');
  let completed = 0;

  for (let i = 0; i < 450; i++) {
    const status = getWeightedRandom([
      { value: 'DRAFT', weight: 4 },
      { value: 'PENDING_APPROVAL', weight: 6 },
      { value: 'APPROVED', weight: 11 },
      { value: 'EXECUTION', weight: 44 },
      { value: 'COMPLETED', weight: 26 },
      { value: 'CANCELLED', weight: 6 }
    ]);

    const leadSource = getWeightedRandom([
      { value: 'Calling Activity', weight: 33 },
      { value: 'Referral', weight: 17 },
      { value: 'Online', weight: 15 },
      { value: 'Sub-Vendor', weight: 13 },
      { value: 'Walk-in', weight: 8 },
      { value: 'Friends & Family', weight: 6 },
      { value: 'Other', weight: 4 }
    ]);

    const systemType = getWeightedRandom([
      { value: 'ON_GRID', weight: 66 },
      { value: 'HYBRID', weight: 22 },
      { value: 'OFF_GRID', weight: 11 }
    ]);

    const systemSize = getWeightedRandom([
      { value: 1, weight: 5 },
      { value: 2, weight: 15 },
      { value: 3, weight: 30 },
      { value: 5, weight: 25 },
      { value: 10, weight: 15 },
      { value: 15, weight: 10 }
    ]);

    const isZohoLinked = Math.random() < 0.84; // 84% linked
    const amountWeight = Math.random();
    let totalOrderAmount = 0;
    if (amountWeight < 0.3) totalOrderAmount = faker.number.int({ min: 75000, max: 200000 });
    else if (amountWeight < 0.8) totalOrderAmount = faker.number.int({ min: 200000, max: 600000 });
    else totalOrderAmount = faker.number.int({ min: 600000, max: 1200000 });

    let pendingAmount = 0;
    let receivedAmount = 0;

    if (!isZohoLinked) {
      pendingAmount = totalOrderAmount;
      receivedAmount = 0;
    } else {
      const pScenario = Math.random();
      if (pScenario < 0.3) {
        pendingAmount = 0;
        receivedAmount = totalOrderAmount;
      } else if (pScenario < 0.5) {
        pendingAmount = totalOrderAmount;
        receivedAmount = 0;
      } else {
        receivedAmount = faker.number.int({ min: 10000, max: totalOrderAmount - 10000 });
        pendingAmount = totalOrderAmount - receivedAmount;
      }
    }

    const orderDate = faker.date.recent({ days: 180 });
    const sequence = await prisma.solarOrderSequence.upsert({
      where: { year: orderDate.getFullYear().toString() },
      update: { sequence: { increment: 1 } },
      create: { year: orderDate.getFullYear().toString(), sequence: 1 }
    });
    const orderNumber = `SO/${orderDate.getFullYear()}/${sequence.sequence.toString().padStart(4, '0')}`;

    const orderData: any = {
      orderNumber,
      orderDate,
      status,
      customerName: faker.person.fullName(),
      phoneNumber: faker.phone.number({ style: 'national' }).replace(/\D/g, '').substring(0, 10),
      whatsappEnabled: Math.random() > 0.5,
      leadSource,
      totalOrderAmount,
      receivedAmount,
      pendingAmount,
      systemSize,
      systemType,
      zohoBooksCustomerId: isZohoLinked ? `1000${faker.number.int({min:1000000, max:9999999})}` : null,
      zohoBooksCustomerName: isZohoLinked ? faker.company.name() : null,
      remarks: faker.lorem.sentence(),
      createdById: admin.id,
      salesmanId: getRandom(salesmen).id,
      callingExecutiveId: getRandom(execs).id
    };

    if (leadSource === 'Sub-Vendor') {
      orderData.subVendorId = getRandom(subVendors).id;
    }

    const createdOrder = await prisma.solarOrder.create({
      data: orderData
    });

    // Generate workflow steps
    let docSteps: any[] = [];
    let instSteps: any[] = [];
    
    // Logic for workflow completion
    // Draft/Pending -> No workflow
    // Execution -> Doc (100% or partial), Inst (partial)
    // Completed -> Doc 100%, Inst 100%
    if (['EXECUTION', 'COMPLETED', 'CANCELLED'].includes(status)) {
      const isCompleted = status === 'COMPLETED';
      let docCompletionRate = isCompleted ? 6 : faker.number.int({ min: 1, max: 6 });
      let instCompletionRate = isCompleted ? 6 : (docCompletionRate === 6 ? faker.number.int({ min: 0, max: 5 }) : 0);
      
      DOCUMENTATION_STEPS.forEach((step, idx) => {
        let stepStatus = 'PENDING';
        if (idx < docCompletionRate) stepStatus = 'COMPLETED';
        else if (idx === docCompletionRate) stepStatus = 'IN_PROGRESS';
        
        docSteps.push({
          solarOrderId: createdOrder.id,
          workflowType: 'DOCUMENTATION',
          stepKey: step,
          stepIndex: idx,
          status: stepStatus,
          completedById: stepStatus === 'COMPLETED' ? admin.id : null,
          completedAt: stepStatus === 'COMPLETED' ? faker.date.between({ from: orderDate, to: new Date() }) : null
        });
      });

      INSTALLATION_STEPS.forEach((step, idx) => {
        let stepStatus = 'PENDING';
        if (idx < instCompletionRate) stepStatus = 'COMPLETED';
        else if (idx === instCompletionRate && instCompletionRate > 0) stepStatus = 'IN_PROGRESS';
        
        instSteps.push({
          solarOrderId: createdOrder.id,
          workflowType: 'INSTALLATION',
          stepKey: step,
          stepIndex: idx,
          status: stepStatus,
          completedById: stepStatus === 'COMPLETED' ? admin.id : null,
          completedAt: stepStatus === 'COMPLETED' ? faker.date.between({ from: orderDate, to: new Date() }) : null
        });
      });

      await prisma.solarWorkflowStep.createMany({
        data: [...docSteps, ...instSteps]
      });
    }

    completed++;
    if (completed % 50 === 0) console.log(`Created ${completed}/450 orders...`);
  }

  console.log('Seed complete! ✨ Generated 450 highly realistic Solar Orders.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
