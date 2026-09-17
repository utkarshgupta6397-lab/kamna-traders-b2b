-- AlterTable
ALTER TABLE "User" ADD COLUMN "manage_payments_view_own" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "manage_payments_create" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "manage_payments_view_all" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paymentDate" DATE NOT NULL,
    "paymentMode" TEXT NOT NULL DEFAULT 'POS',
    "photoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "idempotencyKey" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSequence" (
    "date" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PaymentSequence_pkey" PRIMARY KEY ("date")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_requestNumber_key" ON "PaymentRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_idempotencyKey_key" ON "PaymentRequest"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentRequest_createdById_idx" ON "PaymentRequest"("createdById");

-- CreateIndex
CREATE INDEX "PaymentRequest_customerId_idx" ON "PaymentRequest"("customerId");

-- CreateIndex
CREATE INDEX "PaymentRequest_status_idx" ON "PaymentRequest"("status");

-- CreateIndex
CREATE INDEX "PaymentRequest_paymentDate_idx" ON "PaymentRequest"("paymentDate");

-- CreateIndex
CREATE INDEX "PaymentRequest_createdAt_idx" ON "PaymentRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
