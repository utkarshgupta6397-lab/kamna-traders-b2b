const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting DCR Regression Repair Script...');

  const affectedInvoices = await prisma.dcrInvoice.findMany({
    where: {
      dcrStatus: { in: ['PENDING_SERIALS', 'PARTIALLY_ALLOCATED'] },
      invoiceStatus: { not: 'void' },
    },
    include: {
      items: {
        where: { selectedForDCR: true },
        include: { serialAllocations: true }
      }
    }
  });

  console.log(`Found ${affectedInvoices.length} invoices to evaluate in PENDING_SERIALS / PARTIALLY_ALLOCATED.`);

  let repairedCount = 0;

  for (const invoice of affectedInvoices) {
    let totalRequired = 0;
    let totalAllocated = 0;

    invoice.items.forEach(item => {
      totalRequired += item.quantity;
      totalAllocated += item.serialAllocations.length;
    });

    if (totalRequired > 0 && totalAllocated >= totalRequired) {
      console.log(`\nEvaluating Invoice: ${invoice.invoiceNumber}`);
      console.log(`  Required: ${totalRequired}, Allocated: ${totalAllocated}`);
      console.log(`  Current Status: ${invoice.dcrStatus}`);

      const invSerialNumbers = invoice.items.flatMap(item => item.serialAllocations.map(a => a.serialNumber));
      const invSerials = await prisma.dcrSerial.findMany({
        where: { serialNumber: { in: invSerialNumbers } }
      });

      let anyVendorDcrPending = false;
      invSerials.forEach(s => {
        if (s.vendorDcrStatus === 'NOT_RECEIVED') {
          anyVendorDcrPending = true;
        }
      });

      const nextStatus = anyVendorDcrPending ? 'VENDOR_DCR_PENDING' : 'HOLD';

      if (nextStatus !== invoice.dcrStatus) {
        console.log(`  Fixing: Updating status to ${nextStatus}`);
        await prisma.dcrInvoice.update({
          where: { id: invoice.id },
          data: { dcrStatus: nextStatus }
        });
        repairedCount++;
      }
    }
  }

  console.log(`\nRepair completed. Fixed ${repairedCount} invoices.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
