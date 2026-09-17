-- AlterTable
ALTER TABLE "PaymentRequest" ADD COLUMN "zohoPaymentId" TEXT,
ADD COLUMN "zohoSyncStatus" TEXT NOT NULL DEFAULT 'NOT_SYNCED',
ADD COLUMN "zohoSyncedAt" TIMESTAMP(3),
ADD COLUMN "zohoSyncError" TEXT,
ADD COLUMN "zohoSyncAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastZohoSyncAttemptAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "PaymentRequest_zohoPaymentId_idx" ON "PaymentRequest"("zohoPaymentId");

-- CreateIndex
CREATE INDEX "PaymentRequest_zohoSyncStatus_idx" ON "PaymentRequest"("zohoSyncStatus");
