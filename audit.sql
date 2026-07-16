WITH InvoiceStats AS (
  SELECT 
    i.id,
    i."invoiceNumber",
    i."customerName",
    i."invoiceDate",
    i."dcrStatus",
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
    AND i.archived = false
  GROUP BY i.id, i."invoiceNumber", i."customerName", i."invoiceDate", i."dcrStatus"
)
SELECT 
  COUNT(*) as "Total Invoices",
  SUM(CASE WHEN "totalAllocated" = "totalRequired" THEN 1 ELSE 0 END) as "Fully Allocated",
  SUM(CASE WHEN "totalAllocated" > 0 AND "totalAllocated" < "totalRequired" THEN 1 ELSE 0 END) as "Partially Allocated",
  SUM(CASE WHEN "totalAllocated" = 0 THEN 1 ELSE 0 END) as "Zero Allocation",
  SUM(CASE WHEN "totalAllocated" < "totalRequired" THEN 1 ELSE 0 END) as "Pending Serials Count"
FROM InvoiceStats;
