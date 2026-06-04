-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dcr_management" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DcrInvoice" (
    "id" TEXT NOT NULL,
    "zohoInvoiceId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "invoiceStatus" TEXT NOT NULL,
    "invoiceTotal" DOUBLE PRECISION NOT NULL,
    "dcrStatus" TEXT NOT NULL DEFAULT 'NEW',
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DcrInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DcrInvoiceItem" (
    "id" TEXT NOT NULL,
    "dcrInvoiceId" TEXT NOT NULL,
    "itemId" TEXT,
    "itemName" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ZOHO',
    "selectedForDCR" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DcrInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DcrAuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DcrAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DcrInvoice_zohoInvoiceId_key" ON "DcrInvoice"("zohoInvoiceId");

-- AddForeignKey
ALTER TABLE "DcrInvoiceItem" ADD CONSTRAINT "DcrInvoiceItem_dcrInvoiceId_fkey" FOREIGN KEY ("dcrInvoiceId") REFERENCES "DcrInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
