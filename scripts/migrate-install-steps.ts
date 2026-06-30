import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const INSTALLATION_STEPS = [
  'Ready to Install',
  'Physical Installation Completed',
  'Installation Checklist',
  'Net Metering Done',
  'System Start Done',
  'System WiFi Setup Done',
  'Installation Completed'
];

async function migrate() {
  console.log('Starting migration...');
  
  // Find all orders that have any INSTALLATION workflow steps
  const allOrders = await prisma.solarOrder.findMany({
    where: {
      workflowSteps: {
        some: {
          workflowType: 'INSTALLATION'
        }
      }
    },
    include: {
      workflowSteps: {
        where: { workflowType: 'INSTALLATION' },
        orderBy: { stepIndex: 'asc' }
      }
    }
  });

  console.log(`Found ${allOrders.length} orders with INSTALLATION steps.`);

  let migratedCount = 0;

  for (const order of allOrders) {
    // Check if it already has the new steps (length 7, last step is Installation Completed)
    const isAlreadyMigrated = order.workflowSteps.length === 7 && (order.workflowSteps[6].metadata as any)?.name === 'Installation Completed';
    
    if (isAlreadyMigrated) {
      continue;
    }

    console.log(`Migrating order ${order.id} (had ${order.workflowSteps.length} steps)...`);
    
    // Check if 'Ready to Install' was completed
    const readyToInstallStep = order.workflowSteps.find(s => (s.metadata as any)?.name === 'Ready to Install');
    const wasStarted = readyToInstallStep?.status === 'COMPLETED';

    await prisma.$transaction(async (tx) => {
      // Delete old installation steps
      await tx.solarWorkflowStep.deleteMany({
        where: {
          solarOrderId: order.id,
          workflowType: 'INSTALLATION'
        }
      });

      // Create new steps
      await tx.solarWorkflowStep.createMany({
        data: INSTALLATION_STEPS.map((step, index) => {
          let status = 'BLOCKED';
          if (index === 0) {
            status = wasStarted ? 'COMPLETED' : 'PENDING';
          } else if (index === 1 && wasStarted) {
            status = 'PENDING';
          }

          return {
            solarOrderId: order.id,
            workflowType: 'INSTALLATION',
            stepKey: `INST_${index + 1}`,
            stepIndex: index + 1,
            status,
            metadata: { name: step },
            completedById: (index === 0 && wasStarted) ? readyToInstallStep?.completedById : undefined,
            completedAt: (index === 0 && wasStarted) ? readyToInstallStep?.completedAt : undefined,
          };
        })
      });
    });
    
    console.log(`Order ${order.id} migrated successfully.`);
    migratedCount++;
  }
  
  console.log(`Migration complete. Migrated ${migratedCount} orders.`);
}

migrate().catch(console.error).finally(() => prisma.$disconnect());
