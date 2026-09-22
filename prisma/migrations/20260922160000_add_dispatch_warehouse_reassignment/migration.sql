-- AlterTable PostDispatchInvoice
ALTER TABLE "PostDispatchInvoice" ADD COLUMN IF NOT EXISTS "originalWarehouse" TEXT;
ALTER TABLE "PostDispatchInvoice" ADD COLUMN IF NOT EXISTS "dispatchWarehouse" TEXT;
ALTER TABLE "PostDispatchInvoice" ADD COLUMN IF NOT EXISTS "dispatchWarehouseId" TEXT;
ALTER TABLE "PostDispatchInvoice" ADD COLUMN IF NOT EXISTS "reassignedAt" TIMESTAMP(3);
ALTER TABLE "PostDispatchInvoice" ADD COLUMN IF NOT EXISTS "reassignedById" TEXT;
ALTER TABLE "PostDispatchInvoice" ADD COLUMN IF NOT EXISTS "reassignedByName" TEXT;

-- CreateIndex on PostDispatchInvoice(dispatchWarehouse)
CREATE INDEX IF NOT EXISTS "PostDispatchInvoice_dispatchWarehouse_idx" ON "PostDispatchInvoice"("dispatchWarehouse");

-- CreateTable DispatchWarehouseAudit
CREATE TABLE IF NOT EXISTS "DispatchWarehouseAudit" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "originalWarehouse" TEXT NOT NULL,
    "previousDispatchWarehouse" TEXT NOT NULL,
    "newDispatchWarehouse" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "changedByUserName" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "workflowStageAtChange" TEXT NOT NULL,
    "inventoryDeductionStatusAtChange" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DispatchWarehouseAudit_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey safely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'DispatchWarehouseAudit_invoiceId_fkey'
    ) THEN
        ALTER TABLE "DispatchWarehouseAudit" ADD CONSTRAINT "DispatchWarehouseAudit_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PostDispatchInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DispatchWarehouseAudit_invoiceId_idx" ON "DispatchWarehouseAudit"("invoiceId");
CREATE INDEX IF NOT EXISTS "DispatchWarehouseAudit_changedAt_idx" ON "DispatchWarehouseAudit"("changedAt");

-- Data Backfill for existing PostDispatchInvoice records
UPDATE "PostDispatchInvoice"
SET "dispatchWarehouse" = COALESCE("zohoDetailsJson"->>'location_name', 'Not Assigned'),
    "originalWarehouse" = COALESCE("zohoDetailsJson"->>'location_name', 'Not Assigned')
WHERE "dispatchWarehouse" IS NULL;
