-- AlterTable
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "callPriority" TEXT NOT NULL DEFAULT 'NO_CALL_NEEDED';
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "callPriorityUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "callPriorityUpdatedById" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Customer_callPriority_idx" ON "Customer"("callPriority");
