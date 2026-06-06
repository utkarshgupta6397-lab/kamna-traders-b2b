import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- STARTING VOID INVOICE CLEANUP ---');

  try {
    const voidInvoices = await prisma.dcrInvoice.findMany({
      where: {
        OR: [
          { invoiceStatus: { equals: 'void', mode: 'insensitive' } },
          { invoiceStatus: { equals: 'voided', mode: 'insensitive' } },
        ]
      },
      include: {
        items: {
          include: {
            serialAllocations: true
          }
        }
      }
    });

    console.log(`Found ${voidInvoices.length} VOID invoices to clean up.`);

    let affectedItems = 0;
    let affectedAllocations = 0;

    for (const invoice of voidInvoices) {
      console.log(`Processing invoice: ${invoice.invoiceNumber} (ID: ${invoice.id})`);
      
      for (const item of invoice.items) {
        affectedItems++;
        if (item.serialAllocations.length > 0) {
          // Free the serials
          for (const alloc of item.serialAllocations) {
            affectedAllocations++;
            console.log(`  Removing allocation ${alloc.id} for serial ${alloc.serialNumber}`);
            
            // Revert serial status if it was locked to this allocation
            const serial = await prisma.dcrSerial.findUnique({ where: { serialNumber: alloc.serialNumber } });
            if (serial) {
               // Determine what status to revert to. Usually AVAILABLE.
               await prisma.dcrSerial.update({
                 where: { serialNumber: alloc.serialNumber },
                 data: { status: 'AVAILABLE' }
               });
            }

            await prisma.dcrSerialAllocation.delete({
              where: { id: alloc.id }
            });
          }
        }
      }

      console.log(`  Deleting items for invoice ${invoice.invoiceNumber}`);
      await prisma.dcrInvoiceItem.deleteMany({
        where: { dcrInvoiceId: invoice.id }
      });

      console.log(`  Deleting invoice ${invoice.invoiceNumber}`);
      await prisma.dcrInvoice.delete({
        where: { id: invoice.id }
      });
    }

    const report = {
      voidInvoicesFound: voidInvoices.length,
      affectedItems,
      affectedSerials: affectedAllocations
    };

    console.log('\n--- CLEANUP COMPLETE ---');
    console.log(JSON.stringify(report, null, 2));

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
