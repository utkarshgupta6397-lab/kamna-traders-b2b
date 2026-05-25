/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[zohoBookItemId]` on the table `Sku` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('INITIATED', 'PARTIALLY_DISPATCHED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED', 'MERGED', 'DISPATCHED_PARTIAL_CLOSED', 'SHORT_CLOSED');

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "heldAt" TIMESTAMP(3),
ADD COLUMN     "heldById" TEXT,
ADD COLUMN     "holdReason" TEXT,
ADD COLUMN     "resumedAt" TIMESTAMP(3),
ADD COLUMN     "resumedById" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN     "zohoExecutionTrace" JSONB,
ADD COLUMN     "zohoLastSyncAt" TIMESTAMP(3),
ADD COLUMN     "zohoPayload" JSONB,
ADD COLUMN     "zohoResponse" JSONB,
ADD COLUMN     "zohoResponseTimeMs" INTEGER,
ADD COLUMN     "zohoSalesorderId" TEXT,
ADD COLUMN     "zohoSalesorderNumber" TEXT,
ADD COLUMN     "zohoSyncError" TEXT,
ADD COLUMN     "zohoSyncStatus" TEXT DEFAULT 'PENDING',
ADD COLUMN     "zohoSyncStep" TEXT DEFAULT 'INITIATED';

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "originalQty" INTEGER;

-- AlterTable
ALTER TABLE "Sku" ADD COLUMN     "isUnlimited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedById" TEXT,
ADD COLUMN     "zohoBooksId2" TEXT,
ALTER COLUMN "zohoBookItemId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "SkuSyncLog" ADD COLUMN     "executionTrace" JSONB,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "processedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "skippedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "syncLimit" INTEGER DEFAULT 0,
ADD COLUMN     "trigger" TEXT NOT NULL DEFAULT 'CRON';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountsAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "accounts_customer_statement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "accounts_transactions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canAdjustInventory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canDeleteTransfers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageCarts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageTransfers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageUnlimitedSkus" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageZoneMappings" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canRunSkuSync" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "printerId" TEXT;

-- AlterTable
ALTER TABLE "Warehouse" ADD COLUMN     "isSystemWarehouse" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "printZonalSlips" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "WarehouseInventory" ADD COLUMN     "updatedById" TEXT;

-- CreateTable
CREATE TABLE "SyncLock" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "name" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkuIdentityRegistry" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "zohoBookItemId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "syncGeneration" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SkuIdentityRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryHistory" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "beforeQty" INTEGER NOT NULL,
    "afterQty" INTEGER NOT NULL,
    "qtyChange" INTEGER NOT NULL,
    "remarks" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartHistory" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "remarks" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZohoToken" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZohoToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "deviceName" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "sourceWarehouseId" TEXT NOT NULL,
    "destinationWarehouseId" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'INITIATED',
    "responsiblePerson" TEXT NOT NULL,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "dispatchedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),
    "mergedIntoTransferId" TEXT,
    "parentTransferId" TEXT,
    "isAutoGenerated" BOOLEAN NOT NULL DEFAULT false,
    "receivedById" TEXT,
    "receivedAt" TIMESTAMP(3),

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferItem" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "requestedQty" INTEGER NOT NULL,
    "dispatchedQty" INTEGER NOT NULL,
    "balanceQty" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "shortQty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferHistory" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" TEXT,
    "performedBy" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Printer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 9100,
    "printerType" TEXT NOT NULL DEFAULT 'ESC_POS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Printer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QzCertificate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publicCert" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QzCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncLock_name_key" ON "SyncLock"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SkuIdentityRegistry_skuId_key" ON "SkuIdentityRegistry"("skuId");

-- CreateIndex
CREATE UNIQUE INDEX "SkuIdentityRegistry_zohoBookItemId_key" ON "SkuIdentityRegistry"("zohoBookItemId");

-- CreateIndex
CREATE INDEX "SkuIdentityRegistry_zohoBookItemId_idx" ON "SkuIdentityRegistry"("zohoBookItemId");

-- CreateIndex
CREATE INDEX "SkuIdentityRegistry_skuId_idx" ON "SkuIdentityRegistry"("skuId");

-- CreateIndex
CREATE INDEX "InventoryHistory_warehouseId_idx" ON "InventoryHistory"("warehouseId");

-- CreateIndex
CREATE INDEX "InventoryHistory_skuId_idx" ON "InventoryHistory"("skuId");

-- CreateIndex
CREATE INDEX "CartHistory_cartId_idx" ON "CartHistory"("cartId");

-- CreateIndex
CREATE INDEX "CartHistory_createdAt_idx" ON "CartHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActiveSession_sessionToken_key" ON "ActiveSession"("sessionToken");

-- CreateIndex
CREATE INDEX "ActiveSession_userId_idx" ON "ActiveSession"("userId");

-- CreateIndex
CREATE INDEX "ActiveSession_sessionToken_idx" ON "ActiveSession"("sessionToken");

-- CreateIndex
CREATE INDEX "ActiveSession_lastSeenAt_idx" ON "ActiveSession"("lastSeenAt");

-- CreateIndex
CREATE INDEX "ActiveSession_userId_deviceType_idx" ON "ActiveSession"("userId", "deviceType");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_transferNumber_key" ON "Transfer"("transferNumber");

-- CreateIndex
CREATE UNIQUE INDEX "QzCertificate_userId_key" ON "QzCertificate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Sku_zohoBookItemId_key" ON "Sku"("zohoBookItemId");

-- CreateIndex
CREATE INDEX "Sku_zohoBooksId2_idx" ON "Sku"("zohoBooksId2");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseInventory" ADD CONSTRAINT "WarehouseInventory_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_heldById_fkey" FOREIGN KEY ("heldById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_resumedById_fkey" FOREIGN KEY ("resumedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryHistory" ADD CONSTRAINT "InventoryHistory_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryHistory" ADD CONSTRAINT "InventoryHistory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartHistory" ADD CONSTRAINT "CartHistory_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartHistory" ADD CONSTRAINT "CartHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveSession" ADD CONSTRAINT "ActiveSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_dispatchedById_fkey" FOREIGN KEY ("dispatchedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_mergedIntoTransferId_fkey" FOREIGN KEY ("mergedIntoTransferId") REFERENCES "Transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_parentTransferId_fkey" FOREIGN KEY ("parentTransferId") REFERENCES "Transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferItem" ADD CONSTRAINT "TransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferItem" ADD CONSTRAINT "TransferItem_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferHistory" ADD CONSTRAINT "TransferHistory_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QzCertificate" ADD CONSTRAINT "QzCertificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
