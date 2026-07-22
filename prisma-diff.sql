-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CommunicationDirection" AS ENUM ('OUTGOING', 'INCOMING');

-- CreateEnum
CREATE TYPE "CommunicationType" AS ENUM ('INVOICE', 'DCR', 'PAYMENT', 'ORDER', 'GENERAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CommunicationStatus" AS ENUM ('DRAFT', 'QUEUED', 'API_ACCEPTED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accounts_reports_salesman" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "communications_templates" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "communications_view" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "holdQueueReviewEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "holdQueueReviewLimit" DOUBLE PRECISION,
ADD COLUMN     "whatsapp_integration" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Communication" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT,
    "solarOrderId" TEXT,
    "invoiceId" TEXT,
    "dcrInvoiceId" TEXT,
    "relatedRecord" TEXT,
    "channel" "CommunicationChannel" NOT NULL,
    "direction" "CommunicationDirection" NOT NULL,
    "type" "CommunicationType" NOT NULL,
    "status" "CommunicationStatus" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "fromAddress" TEXT,
    "fromName" TEXT,
    "toAddress" TEXT,
    "templateId" TEXT,
    "templateName" TEXT,
    "templateLanguage" TEXT,
    "templateCategory" TEXT,
    "variablesJson" JSONB,
    "headerType" TEXT,
    "headerMediaUrl" TEXT,
    "footer" TEXT,
    "buttonsJson" JSONB,
    "providerName" TEXT,
    "providerMessageId" TEXT,
    "conversationId" TEXT,
    "pricingCategory" TEXT,
    "pricingCost" DOUBLE PRECISION,
    "errorCode" TEXT,
    "providerResponse" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdById" TEXT NOT NULL,
    "assignedToUserId" TEXT,
    "relatedRecordType" TEXT,
    "relatedRecordId" TEXT,
    "apiAcceptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationAttachment" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomingWebhook" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "headers" JSONB NOT NULL,
    "body" JSONB NOT NULL,
    "signature" TEXT,
    "ipAddress" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processingResult" TEXT,
    "matchedMessageId" TEXT,

    CONSTRAINT "IncomingWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationTimeline" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "providerResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppConfiguration" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "appId" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "businessAccountId" TEXT NOT NULL,
    "apiVersion" TEXT NOT NULL,
    "webhookVerifyToken" TEXT NOT NULL,
    "integrationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "businessName" TEXT,
    "displayPhoneNumber" TEXT,
    "verifiedName" TEXT,
    "connectionStatus" TEXT NOT NULL DEFAULT 'NOT_TESTED',
    "lastConnectionTest" TIMESTAMP(3),
    "testPhoneNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessageLog" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "messageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "responseJson" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppMessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL,
    "metaTemplateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "headerType" TEXT,
    "header" TEXT,
    "body" TEXT NOT NULL,
    "footer" TEXT,
    "buttons" JSONB,
    "variables" JSONB,
    "qualityRating" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppTestLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "variablesUsed" JSONB,
    "mediaGenerated" BOOLEAN NOT NULL DEFAULT false,
    "metaMessageId" TEXT,
    "status" TEXT NOT NULL,
    "response" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppTestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatewayConfiguration" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "gatewayUrl" TEXT NOT NULL,
    "apiToken" TEXT NOT NULL,
    "connectionStatus" TEXT NOT NULL DEFAULT 'NOT_TESTED',
    "lastConnectionTest" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GatewayConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatewayMessageLog" (
    "id" TEXT NOT NULL,
    "gatewayMessageId" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "providerStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GatewayMessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Communication_customerId_idx" ON "Communication"("customerId");

-- CreateIndex
CREATE INDEX "Communication_status_idx" ON "Communication"("status");

-- CreateIndex
CREATE INDEX "Communication_type_idx" ON "Communication"("type");

-- CreateIndex
CREATE INDEX "Communication_channel_idx" ON "Communication"("channel");

-- CreateIndex
CREATE INDEX "Communication_createdById_idx" ON "Communication"("createdById");

-- CreateIndex
CREATE INDEX "CommunicationAttachment_communicationId_idx" ON "CommunicationAttachment"("communicationId");

-- CreateIndex
CREATE INDEX "IncomingWebhook_receivedAt_idx" ON "IncomingWebhook"("receivedAt");

-- CreateIndex
CREATE INDEX "IncomingWebhook_matchedMessageId_idx" ON "IncomingWebhook"("matchedMessageId");

-- CreateIndex
CREATE INDEX "CommunicationTimeline_communicationId_idx" ON "CommunicationTimeline"("communicationId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppTemplate_metaTemplateId_key" ON "WhatsAppTemplate"("metaTemplateId");

-- CreateIndex
CREATE INDEX "WhatsAppTestLog_templateId_idx" ON "WhatsAppTestLog"("templateId");

-- CreateIndex
CREATE INDEX "WhatsAppTestLog_adminUserId_idx" ON "WhatsAppTestLog"("adminUserId");

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationAttachment" ADD CONSTRAINT "CommunicationAttachment_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationTimeline" ADD CONSTRAINT "CommunicationTimeline_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppTestLog" ADD CONSTRAINT "WhatsAppTestLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

