import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUI() {
  const allInvoices = await prisma.dcrInvoice.findMany({
    where: { 
      dcrStatus: { in: ['PENDING_SERIALS', 'PARTIALLY_ALLOCATED'] },
      invoiceStatus: { not: 'void' }
    },
    include: {
      items: {
        where: { selectedForDCR: true },
        include: {
          serialAllocations: true
        }
      },
      serialAllocations: true,
    }
  });
  
  console.log(`UI query found: ${allInvoices.length} invoices`);
  console.log(allInvoices.map(i => i.invoiceNumber));

  const allItems = await prisma.dcrInvoiceItem.count();
  console.log(`Total items in DB: ${allItems}`);
  
  const allInv = await prisma.dcrInvoice.count();
  console.log(`Total invoices in DB: ${allInv}`);
  
  const selectedItems = await prisma.dcrInvoiceItem.count({
    where: { selectedForDCR: true }
  });
  console.log(`Items with selectedForDCR=true: ${selectedItems}`);
  
  await prisma.$disconnect();
}

checkUI().catch(console.error);
