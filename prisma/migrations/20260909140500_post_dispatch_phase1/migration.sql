-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mobile_dispatch_post_dispatch" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "mobile_dispatch_post_dispatch_checked_upload" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "mobile_dispatch_post_dispatch_checked_verify" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "mobile_dispatch_post_dispatch_receiving_upload" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "mobile_dispatch_post_dispatch_receiving_verify" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PostDispatchInvoice" (
    "id" TEXT NOT NULL,
    "zohoInvoiceId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "zohoStatus" TEXT NOT NULL,
    "erpStatus" TEXT NOT NULL DEFAULT 'Active',
    "erpSubStatus" TEXT,
    "zohoCreatedTime" TIMESTAMP(3) NOT NULL,
    "timerStoppedAt" TIMESTAMP(3),
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "salesOrderId" TEXT,
    "salesOrderNumber" TEXT,
    "eInvoiceGenerated" BOOLEAN NOT NULL DEFAULT false,
    "eInvoiceIrn" TEXT,
    "eInvoiceAckNo" TEXT,
    "eInvoiceAckDate" TEXT,
    "eInvoiceStatus" TEXT,
    "lastZohoSync" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "zohoDetailsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostDispatchInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PostDispatchInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "zohoLineItemId" TEXT,
    "itemId" TEXT,
    "itemName" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hsnCode" TEXT,
    "taxPercent" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostDispatchInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PostDispatchWorkflow" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "workflowType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "currentSubmissionId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostDispatchWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PostDispatchSubmission" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "submissionNumber" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_VERIFICATION',
    "receivingDetails" TEXT,
    "checkedBy" TEXT,
    "checkedAt" TIMESTAMP(3),
    "uploadedByUserId" TEXT NOT NULL,
    "uploadedByUserName" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedByUserId" TEXT,
    "verifiedByUserName" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostDispatchSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PostDispatchFile" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostDispatchFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PostDispatchHistory" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "workflowType" TEXT,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "submissionId" TEXT,
    "rejectionReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostDispatchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PostDispatchSyncLog" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "trigger" TEXT NOT NULL DEFAULT 'CRON',
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "invoicesDiscovered" INTEGER NOT NULL DEFAULT 0,
    "invoicesImported" INTEGER NOT NULL DEFAULT 0,
    "invoicesUpdated" INTEGER NOT NULL DEFAULT 0,
    "invoicesSkipped" INTEGER NOT NULL DEFAULT 0,
    "apiCallsTotal" INTEGER NOT NULL DEFAULT 0,
    "apiCallsInvoice" INTEGER NOT NULL DEFAULT 0,
    "apiCallsEInvoice" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostDispatchSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PostDispatchInvoice_zohoInvoiceId_key" ON "PostDispatchInvoice"("zohoInvoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostDispatchInvoice_zohoStatus_idx" ON "PostDispatchInvoice"("zohoStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostDispatchInvoice_erpStatus_idx" ON "PostDispatchInvoice"("erpStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostDispatchInvoice_invoiceNumber_idx" ON "PostDispatchInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostDispatchInvoice_zohoInvoiceId_idx" ON "PostDispatchInvoice"("zohoInvoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostDispatchInvoiceLine_invoiceId_idx" ON "PostDispatchInvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostDispatchWorkflow_invoiceId_idx" ON "PostDispatchWorkflow"("invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostDispatchWorkflow_workflowType_idx" ON "PostDispatchWorkflow"("workflowType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostDispatchWorkflow_status_idx" ON "PostDispatchWorkflow"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PostDispatchWorkflow_invoiceId_workflowType_key" ON "PostDispatchWorkflow"("invoiceId", "workflowType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostDispatchSubmission_workflowId_idx" ON "PostDispatchSubmission"("workflowId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostDispatchSubmission_status_idx" ON "PostDispatchSubmission"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostDispatchFile_submissionId_idx" ON "PostDispatchFile"("submissionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostDispatchHistory_invoiceId_idx" ON "PostDispatchHistory"("invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostDispatchHistory_createdAt_idx" ON "PostDispatchHistory"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostDispatchSyncLog_startedAt_idx" ON "PostDispatchSyncLog"("startedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostDispatchSyncLog_status_idx" ON "PostDispatchSyncLog"("status");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PostDispatchInvoiceLine_invoiceId_fkey') THEN
        ALTER TABLE "PostDispatchInvoiceLine" ADD CONSTRAINT "PostDispatchInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PostDispatchInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PostDispatchWorkflow_invoiceId_fkey') THEN
        ALTER TABLE "PostDispatchWorkflow" ADD CONSTRAINT "PostDispatchWorkflow_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PostDispatchInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PostDispatchSubmission_workflowId_fkey') THEN
        ALTER TABLE "PostDispatchSubmission" ADD CONSTRAINT "PostDispatchSubmission_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "PostDispatchWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PostDispatchFile_submissionId_fkey') THEN
        ALTER TABLE "PostDispatchFile" ADD CONSTRAINT "PostDispatchFile_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "PostDispatchSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PostDispatchHistory_invoiceId_fkey') THEN
        ALTER TABLE "PostDispatchHistory" ADD CONSTRAINT "PostDispatchHistory_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PostDispatchInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
