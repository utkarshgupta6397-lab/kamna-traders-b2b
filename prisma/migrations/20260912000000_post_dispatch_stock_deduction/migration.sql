-- Migration: post_dispatch_stock_deduction
-- Adds: Warehouse.zohoLocationId, User.dispatch_post_dispatch_inventory_approve
-- Changes: WarehouseInventory.qty Int -> Decimal(10,4)
-- Changes: InventoryHistory qty fields Int -> Decimal(10,4)
-- Adds: StockDeductionAllocation table

-- 1. Add Zoho Location ID to Warehouse
ALTER TABLE "Warehouse" ADD COLUMN "zohoLocationId" TEXT;
CREATE UNIQUE INDEX "Warehouse_zohoLocationId_key" ON "Warehouse"("zohoLocationId");

-- 2. Add approval permission to User
ALTER TABLE "User" ADD COLUMN "dispatch_post_dispatch_inventory_approve" BOOLEAN NOT NULL DEFAULT false;

-- 3. Change WarehouseInventory.qty from INTEGER to NUMERIC(10,4)
ALTER TABLE "WarehouseInventory" ALTER COLUMN "qty" TYPE DECIMAL(10,4) USING qty::DECIMAL(10,4);

-- 4. Change InventoryHistory qty fields from INTEGER to NUMERIC(10,4)
ALTER TABLE "InventoryHistory" ALTER COLUMN "beforeQty" TYPE DECIMAL(10,4) USING "beforeQty"::DECIMAL(10,4);
ALTER TABLE "InventoryHistory" ALTER COLUMN "afterQty" TYPE DECIMAL(10,4) USING "afterQty"::DECIMAL(10,4);
ALTER TABLE "InventoryHistory" ALTER COLUMN "qtyChange" TYPE DECIMAL(10,4) USING "qtyChange"::DECIMAL(10,4);

-- 5. Create StockDeductionAllocation table
CREATE TABLE "StockDeductionAllocation" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "invoiceLineId" TEXT NOT NULL,
    "expectedItemId" TEXT,
    "expectedItemName" TEXT,
    "expectedSkuId" TEXT,
    "expectedWarehouseId" TEXT,
    "expectedQty" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "expectedUom" TEXT,
    "allocationData" JSONB,
    "isExploded" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'NOT_ALLOCATED',
    "classification" TEXT NOT NULL DEFAULT 'NOT_ALLOCATED',
    "deviationReasons" JSONB,
    "submittedById" TEXT,
    "submittedByName" TEXT,
    "submittedAt" TIMESTAMP(3),
    "submittedSnapshot" JSONB,
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedByName" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionRemarks" TEXT,
    "deductedAt" TIMESTAMP(3),
    "deductedById" TEXT,
    "deductedByName" TEXT,
    "inventoryHistoryIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockDeductionAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockDeductionAllocation_invoiceLineId_key" ON "StockDeductionAllocation"("invoiceLineId");
CREATE INDEX "StockDeductionAllocation_invoiceId_idx" ON "StockDeductionAllocation"("invoiceId");
CREATE INDEX "StockDeductionAllocation_status_idx" ON "StockDeductionAllocation"("status");
CREATE INDEX "StockDeductionAllocation_classification_idx" ON "StockDeductionAllocation"("classification");

ALTER TABLE "StockDeductionAllocation" ADD CONSTRAINT "StockDeductionAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PostDispatchInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockDeductionAllocation" ADD CONSTRAINT "StockDeductionAllocation_invoiceLineId_fkey" FOREIGN KEY ("invoiceLineId") REFERENCES "PostDispatchInvoiceLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
