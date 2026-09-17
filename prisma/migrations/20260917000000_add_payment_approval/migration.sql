-- AlterTable
ALTER TABLE "PaymentRequest" ADD COLUMN "approvedById" TEXT,
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "rejectedById" TEXT,
ADD COLUMN "rejectedAt" TIMESTAMP(3),
ADD COLUMN "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "manage_payments_approve" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "manage_payments_reject" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "PaymentRequest_approvedById_idx" ON "PaymentRequest"("approvedById");

-- CreateIndex
CREATE INDEX "PaymentRequest_rejectedById_idx" ON "PaymentRequest"("rejectedById");

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
