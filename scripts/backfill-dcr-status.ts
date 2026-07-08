import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runBackfill() {
  console.log('--- STARTING DCR STATUS BACKFILL ---');
  
  // Find all invoices that have items selected for DCR and are not void
  const invoices = await prisma.dcrInvoice.findMany({
    where: {
      invoiceStatus: { not: 'void' },
      items: {
        some: { selectedForDCR: true }
      }
    },
    include: {
      items: {
        where: { selectedForDCR: true },
        include: { serialAllocations: true }
      }
    }
  });

  console.log(`Found ${invoices.length} active DCR invoices to check...`);

  let updatedCount = 0;

  for (const inv of invoices) {
    let req = 0;
    let alloc = 0;
    
    inv.items.forEach(item => {
      req += item.quantity;
      alloc += item.serialAllocations.length;
    });

    const remaining = Math.max(0, req - alloc);
    
    let expectedStatus = inv.dcrStatus;
    
    if (remaining > 0) {
      expectedStatus = alloc > 0 ? 'PARTIALLY_ALLOCATED' : 'PENDING_SERIALS';
    } else {
      // If fully allocated, we only auto-promote if it was stuck in pending
      if (['PENDING_SERIALS', 'PARTIALLY_ALLOCATED'].includes(inv.dcrStatus)) {
        expectedStatus = 'READY_FOR_DCR';
      }
    }

    if (inv.dcrStatus !== expectedStatus) {
      console.log(`Invoice ${inv.invoiceNumber}: Updating status from ${inv.dcrStatus} -> ${expectedStatus} (req: ${req}, alloc: ${alloc}, remaining: ${remaining})`);
      
      await prisma.dcrInvoice.update({
        where: { id: inv.id },
        data: { dcrStatus: expectedStatus }
      });
      
      updatedCount++;
    }
  }

  console.log(`--- BACKFILL COMPLETE ---`);
  console.log(`Successfully updated ${updatedCount} invoices.`);
  
  await prisma.$disconnect();
}

runBackfill().catch(console.error);
