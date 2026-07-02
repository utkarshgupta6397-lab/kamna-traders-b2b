-- AlterTable
ALTER TABLE "User" ADD COLUMN     "solar_orders_approval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "solar_orders_create" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "solar_orders_docs_progress" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "solar_orders_edit_order_date" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "solar_orders_master_edit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "solar_orders_view" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "workflow_edits" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ZohoToken" ADD COLUMN     "dataCenter" TEXT,
ADD COLUMN     "grantedScopes" TEXT,
ADD COLUMN     "scopeVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "SubVendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolarOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applicationNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "customerName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "leadSource" TEXT NOT NULL,
    "referralCustomerId" TEXT,
    "referralName" TEXT,
    "callingExecutiveId" TEXT,
    "salesmanId" TEXT,
    "subVendorId" TEXT,
    "loanCustomer" BOOLEAN NOT NULL DEFAULT false,
    "totalOrderAmount" DOUBLE PRECISION NOT NULL,
    "receivedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "systemSize" DOUBLE PRECISION NOT NULL,
    "systemType" TEXT NOT NULL,
    "zohoBooksCustomerId" TEXT,
    "zohoBooksCustomerName" TEXT,
    "remarks" TEXT,
    "cancellationReason" TEXT,
    "floorNumber" INTEGER,
    "customerEmail" TEXT,
    "loanAnnualIncome" DOUBLE PRECISION,
    "loanQuotationAmount" DOUBLE PRECISION,
    "loanApplicationNumber" TEXT,
    "editCount" INTEGER NOT NULL DEFAULT 0,
    "lastEditedAt" TIMESTAMP(3),
    "lastEditedBy" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "lastPaymentSyncAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionRemarks" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "installationDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolarOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolarWorkflowStep" (
    "id" TEXT NOT NULL,
    "solarOrderId" TEXT NOT NULL,
    "workflowType" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "blockedReason" TEXT,
    "notes" TEXT,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "wifiSsid" TEXT,
    "wifiPassword" TEXT,
    "editCount" INTEGER NOT NULL DEFAULT 0,
    "lastEditedAt" TIMESTAMP(3),
    "lastEditedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolarWorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolarOrderFile" (
    "id" TEXT NOT NULL,
    "solarOrderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER,
    "fileCategory" TEXT NOT NULL,
    "documentType" TEXT,
    "metadata" JSONB,
    "uploadedById" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolarOrderFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolarActivityLog" (
    "id" TEXT NOT NULL,
    "solarOrderId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolarActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolarOrderPanel" (
    "id" TEXT NOT NULL,
    "solarOrderId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "SolarOrderPanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolarOrderInverter" (
    "id" TEXT NOT NULL,
    "solarOrderId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "SolarOrderInverter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolarOrderSequence" (
    "year" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SolarOrderSequence_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolarOrderPayment" (
    "id" TEXT NOT NULL,
    "solarOrderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMode" TEXT NOT NULL,
    "referenceNo" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolarOrderPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectChatMessage" (
    "id" TEXT NOT NULL,
    "solarOrderId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubVendor_name_key" ON "SubVendor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SolarOrder_orderNumber_key" ON "SolarOrder"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SolarOrder_applicationNumber_key" ON "SolarOrder"("applicationNumber");

-- CreateIndex
CREATE INDEX "SolarOrder_status_idx" ON "SolarOrder"("status");

-- CreateIndex
CREATE INDEX "SolarOrder_createdById_idx" ON "SolarOrder"("createdById");

-- CreateIndex
CREATE INDEX "SolarOrder_orderDate_idx" ON "SolarOrder"("orderDate");

-- CreateIndex
CREATE INDEX "SolarOrder_zohoBooksCustomerId_idx" ON "SolarOrder"("zohoBooksCustomerId");

-- CreateIndex
CREATE INDEX "SolarOrder_orderNumber_idx" ON "SolarOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "SolarOrder_subVendorId_idx" ON "SolarOrder"("subVendorId");

-- CreateIndex
CREATE INDEX "SolarOrder_installationDate_idx" ON "SolarOrder"("installationDate");

-- CreateIndex
CREATE INDEX "SolarOrder_leadSource_idx" ON "SolarOrder"("leadSource");

-- CreateIndex
CREATE INDEX "SolarOrder_salesmanId_idx" ON "SolarOrder"("salesmanId");

-- CreateIndex
CREATE INDEX "SolarOrder_callingExecutiveId_idx" ON "SolarOrder"("callingExecutiveId");

-- CreateIndex
CREATE INDEX "SolarWorkflowStep_solarOrderId_idx" ON "SolarWorkflowStep"("solarOrderId");

-- CreateIndex
CREATE INDEX "SolarWorkflowStep_workflowType_idx" ON "SolarWorkflowStep"("workflowType");

-- CreateIndex
CREATE INDEX "SolarWorkflowStep_status_idx" ON "SolarWorkflowStep"("status");

-- CreateIndex
CREATE INDEX "SolarWorkflowStep_stepKey_idx" ON "SolarWorkflowStep"("stepKey");

-- CreateIndex
CREATE UNIQUE INDEX "SolarWorkflowStep_solarOrderId_stepKey_key" ON "SolarWorkflowStep"("solarOrderId", "stepKey");

-- CreateIndex
CREATE INDEX "SolarOrderFile_solarOrderId_idx" ON "SolarOrderFile"("solarOrderId");

-- CreateIndex
CREATE INDEX "SolarOrderFile_fileCategory_idx" ON "SolarOrderFile"("fileCategory");

-- CreateIndex
CREATE INDEX "SolarActivityLog_solarOrderId_idx" ON "SolarActivityLog"("solarOrderId");

-- CreateIndex
CREATE INDEX "SolarActivityLog_eventType_idx" ON "SolarActivityLog"("eventType");

-- CreateIndex
CREATE INDEX "SolarActivityLog_createdAt_idx" ON "SolarActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "SolarOrderPanel_solarOrderId_idx" ON "SolarOrderPanel"("solarOrderId");

-- CreateIndex
CREATE INDEX "SolarOrderInverter_solarOrderId_idx" ON "SolarOrderInverter"("solarOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "City_name_key" ON "City"("name");

-- CreateIndex
CREATE INDEX "SolarOrderPayment_solarOrderId_idx" ON "SolarOrderPayment"("solarOrderId");

-- CreateIndex
CREATE INDEX "SolarOrderPayment_paymentDate_idx" ON "SolarOrderPayment"("paymentDate");

-- CreateIndex
CREATE INDEX "ProjectChatMessage_solarOrderId_idx" ON "ProjectChatMessage"("solarOrderId");

-- CreateIndex
CREATE INDEX "ProjectChatMessage_createdAt_idx" ON "ProjectChatMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "SolarOrder" ADD CONSTRAINT "SolarOrder_subVendorId_fkey" FOREIGN KEY ("subVendorId") REFERENCES "SubVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarOrder" ADD CONSTRAINT "SolarOrder_callingExecutiveId_fkey" FOREIGN KEY ("callingExecutiveId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarOrder" ADD CONSTRAINT "SolarOrder_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarOrder" ADD CONSTRAINT "SolarOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarOrder" ADD CONSTRAINT "SolarOrder_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarOrder" ADD CONSTRAINT "SolarOrder_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarOrder" ADD CONSTRAINT "SolarOrder_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarOrder" ADD CONSTRAINT "SolarOrder_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarWorkflowStep" ADD CONSTRAINT "SolarWorkflowStep_solarOrderId_fkey" FOREIGN KEY ("solarOrderId") REFERENCES "SolarOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarWorkflowStep" ADD CONSTRAINT "SolarWorkflowStep_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarOrderFile" ADD CONSTRAINT "SolarOrderFile_solarOrderId_fkey" FOREIGN KEY ("solarOrderId") REFERENCES "SolarOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarOrderFile" ADD CONSTRAINT "SolarOrderFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarOrderFile" ADD CONSTRAINT "SolarOrderFile_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarActivityLog" ADD CONSTRAINT "SolarActivityLog_solarOrderId_fkey" FOREIGN KEY ("solarOrderId") REFERENCES "SolarOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarActivityLog" ADD CONSTRAINT "SolarActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarOrderPanel" ADD CONSTRAINT "SolarOrderPanel_solarOrderId_fkey" FOREIGN KEY ("solarOrderId") REFERENCES "SolarOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarOrderInverter" ADD CONSTRAINT "SolarOrderInverter_solarOrderId_fkey" FOREIGN KEY ("solarOrderId") REFERENCES "SolarOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarOrderPayment" ADD CONSTRAINT "SolarOrderPayment_solarOrderId_fkey" FOREIGN KEY ("solarOrderId") REFERENCES "SolarOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChatMessage" ADD CONSTRAINT "ProjectChatMessage_solarOrderId_fkey" FOREIGN KEY ("solarOrderId") REFERENCES "SolarOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChatMessage" ADD CONSTRAINT "ProjectChatMessage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

