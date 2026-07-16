import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runAudit() {
  console.log('--- ACTUAL DB TRUTH (SQL) ---');
  const summaryResult = await prisma.$queryRaw`
    WITH InvoiceStats AS (
      SELECT 
        i.id,
        i."invoiceNumber",
        i."customerName",
        i."invoiceDate",
        i."dcrStatus",
        i."invoiceStatus",
        SUM(item.quantity) as "totalRequired",
        COALESCE(SUM(alloc.allocated_count), 0) as "totalAllocated"
      FROM "DcrInvoice" i
      JOIN "DcrInvoiceItem" item ON item."dcrInvoiceId" = i.id
      LEFT JOIN (
        SELECT "skuId", COUNT(*) as allocated_count 
        FROM "DcrSerialAllocation" 
        GROUP BY "skuId"
      ) alloc ON alloc."skuId" = item.id
      WHERE item."selectedForDCR" = true
        AND i."invoiceStatus" != 'void'
      GROUP BY i.id, i."invoiceNumber", i."customerName", i."invoiceDate", i."dcrStatus", i."invoiceStatus"
    )
    SELECT 
      COUNT(*)::int as "Total Invoices Requiring DCR",
      SUM(CASE WHEN "totalAllocated" = "totalRequired" THEN 1 ELSE 0 END)::int as "Fully Allocated",
      SUM(CASE WHEN "totalAllocated" > 0 AND "totalAllocated" < "totalRequired" THEN 1 ELSE 0 END)::int as "Partially Allocated",
      SUM(CASE WHEN "totalAllocated" = 0 THEN 1 ELSE 0 END)::int as "Zero Allocation",
      SUM(CASE WHEN "totalAllocated" < "totalRequired" THEN 1 ELSE 0 END)::int as "Total Pending Serials Invoices (allocated < required)"
    FROM InvoiceStats;
  `;
  console.log(summaryResult);

  const pendingList = await prisma.$queryRaw`
    WITH InvoiceStats AS (
      SELECT 
        i.id,
        i."invoiceNumber",
        i."customerName",
        i."invoiceDate",
        i."dcrStatus",
        i."invoiceStatus",
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
      GROUP BY i.id, i."invoiceNumber", i."customerName", i."invoiceDate", i."dcrStatus", i."invoiceStatus"
    )
    SELECT 
      "invoiceNumber", 
      "dcrStatus", 
      "invoiceStatus",
      "totalRequired", 
      "totalAllocated",
      ("totalRequired" - "totalAllocated") as "pendingCount"
    FROM InvoiceStats
    WHERE "totalAllocated" < "totalRequired"
    ORDER BY "invoiceDate" DESC;
  `;
  
  console.log('\n--- SQL Pending Invoices List ---');
  console.table(pendingList);
  
  await prisma.$disconnect();
}

runAudit().catch(console.error);
