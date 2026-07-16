import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runAudit() {
  const full = await prisma.$queryRaw`
    WITH InvoiceStats AS (
      SELECT 
        i.id,
        i."invoiceNumber",
        i."dcrStatus",
        SUM(item.quantity)::int as "totalRequired",
        COALESCE(SUM(alloc.allocated_count), 0)::int as "totalAllocated"
      FROM "DcrInvoice" i
      JOIN "DcrInvoiceItem" item ON item."dcrInvoiceId" = i.id
      LEFT JOIN (
        SELECT "skuId", COUNT(*) as allocated_count 
        FROM "DcrSerialAllocation" 
        GROUP BY "skuId"
      ) alloc ON alloc."skuId" = item.id
      WHERE item."selectedForDCR" = true
        AND i."invoiceStatus" != 'void'
      GROUP BY i.id, i."invoiceNumber", i."dcrStatus"
    )
    SELECT *
    FROM InvoiceStats
    WHERE "totalAllocated" = "totalRequired";
  `;
  console.log('Fully allocated invoices:');
  console.log(full);
  await prisma.$disconnect();
}

runAudit().catch(console.error);
