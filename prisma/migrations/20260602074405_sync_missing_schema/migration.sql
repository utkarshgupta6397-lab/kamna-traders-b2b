-- AlterTable
ALTER TABLE "SyncLock" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accounts_recovery_manage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "accounts_summary_view" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "release_statement_queue" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stock_alerts_manage" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ZohoToken" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "InvoiceSummaryCache" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "apiCallsUsed" INTEGER NOT NULL,
    "refreshedBy" TEXT NOT NULL,
    "invoiceCount" INTEGER NOT NULL,
    "summary" JSONB NOT NULL,
    "distributions" JSONB NOT NULL,
    "rows" JSONB NOT NULL,

    CONSTRAINT "InvoiceSummaryCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerStatementTask" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "flaggedByUserId" TEXT NOT NULL,
    "flaggedByName" TEXT NOT NULL,
    "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedByUserId" TEXT,
    "releasedByName" TEXT,
    "releasedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerStatementTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAlertThreshold" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "minimumQty" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockAlertThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryInvoiceTask" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requiresReminder" BOOLEAN NOT NULL DEFAULT false,
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "reminderSentAt" TIMESTAMP(3),
    "reminderSentById" TEXT,
    "reminderSentByName" TEXT,
    "flagCount" INTEGER NOT NULL DEFAULT 1,
    "flaggedByUserId" TEXT NOT NULL,
    "flaggedByName" TEXT NOT NULL,
    "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedByUserId" TEXT,
    "releasedByName" TEXT,
    "releasedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolvedByName" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedReason" TEXT,
    "lastKnownPendingAmount" DOUBLE PRECISION,
    "lastKnownInvoiceStatus" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryInvoiceTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockAlertThreshold_warehouseId_skuId_key" ON "StockAlertThreshold"("warehouseId", "skuId");

-- CreateIndex
CREATE INDEX "RecoveryInvoiceTask_invoiceId_idx" ON "RecoveryInvoiceTask"("invoiceId");

-- CreateIndex
CREATE INDEX "RecoveryInvoiceTask_customerId_idx" ON "RecoveryInvoiceTask"("customerId");

-- CreateIndex
CREATE INDEX "RecoveryInvoiceTask_status_idx" ON "RecoveryInvoiceTask"("status");

-- AddForeignKey
ALTER TABLE "StockAlertThreshold" ADD CONSTRAINT "StockAlertThreshold_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAlertThreshold" ADD CONSTRAINT "StockAlertThreshold_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
