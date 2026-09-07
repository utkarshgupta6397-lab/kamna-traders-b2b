import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function resetIncomingOrders() {
  console.log("==================================================");
  console.log("   KAMNA ERP - INCOMING ORDERS RESET SCRIPT");
  console.log("==================================================");
  console.log("WARNING: This will permanently delete all ERP incoming orders data.");
  console.log("Zoho Books data will NOT be modified.\n");

  try {
    const workflows = await prisma.preDispatchWorkflow.findMany({
      where: {
        truckPhotoUrl: { not: null }
      },
      select: { truckPhotoUrl: true }
    });

    let deletedPhotosCount = 0;
    
    for (const wf of workflows) {
      if (wf.truckPhotoUrl && wf.truckPhotoUrl.startsWith('/uploads/')) {
        const filePath = path.join(process.cwd(), 'public', wf.truckPhotoUrl);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          deletedPhotosCount++;
        }
      }
    }
    
    console.log(`[x] Deleted ${deletedPhotosCount} physical truck photo files.`);

    const result = await prisma.$transaction(async (tx) => {
      const wfDelete = await tx.preDispatchWorkflow.deleteMany({});
      const soDelete = await tx.dispatchIncomingOrder.deleteMany({});
      const soReqDelete = await tx.incomingSoRequest.deleteMany({});

      return {
        workflowsDeleted: wfDelete.count,
        ordersDeleted: soDelete.count,
        requestsDeleted: soReqDelete.count
      };
    });

    console.log(`[x] Deleted ${result.workflowsDeleted} Pre-Dispatch workflow records.`);
    console.log(`[x] Deleted ${result.ordersDeleted} Dispatch Incoming Order records.`);
    console.log(`[x] Deleted ${result.requestsDeleted} Webhook Request Log records.`);
    
    console.log("\n✅ Reset completed successfully. You can now push fresh Sales Orders from Zoho Books.");
    process.exit(0);

  } catch (error) {
    console.error("❌ Reset failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetIncomingOrders();
