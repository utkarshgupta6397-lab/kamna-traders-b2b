-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ZohoProductSyncStatus" AS ENUM ('NEVER_SYNCED', 'SYNCING', 'SYNCED', 'SYNC_FAILED');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('INITIATED', 'PARTIALLY_DISPATCHED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED', 'MERGED', 'DISPATCHED_PARTIAL_CLOSED', 'SHORT_CLOSED');

-- CreateEnum
CREATE TYPE "DcrImportSource" AS ENUM ('ZOHO_SYNC', 'MANUAL');

-- CreateEnum
CREATE TYPE "SerialStatus" AS ENUM ('AVAILABLE', 'ALLOCATED', 'PARTIALLY_ALLOCATED', 'HOLD', 'READY_TO_ISSUE', 'ISSUED', 'RETURNED');

-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CommunicationDirection" AS ENUM ('OUTGOING', 'INCOMING');

-- CreateEnum
CREATE TYPE "CommunicationType" AS ENUM ('INVOICE', 'DCR', 'PAYMENT', 'ORDER', 'GENERAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CommunicationStatus" AS ENUM ('DRAFT', 'QUEUED', 'API_ACCEPTED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "pin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "canManageCarts" BOOLEAN NOT NULL DEFAULT false,
    "canAdjustInventory" BOOLEAN NOT NULL DEFAULT false,
    "canRunSkuSync" BOOLEAN NOT NULL DEFAULT false,
    "canManageZoneMappings" BOOLEAN NOT NULL DEFAULT false,
    "canManageUnlimitedSkus" BOOLEAN NOT NULL DEFAULT false,
    "canManageTransfers" BOOLEAN NOT NULL DEFAULT false,
    "canDeleteTransfers" BOOLEAN NOT NULL DEFAULT false,
    "accountsAccess" BOOLEAN NOT NULL DEFAULT false,
    "accounts_customer_statement" BOOLEAN NOT NULL DEFAULT false,
    "accounts_invoice_processor" BOOLEAN NOT NULL DEFAULT false,
    "accounts_transactions" BOOLEAN NOT NULL DEFAULT false,
    "accounts_summary_view" BOOLEAN NOT NULL DEFAULT false,
    "accounts_reports_salesman" BOOLEAN NOT NULL DEFAULT false,
    "stock_alerts_manage" BOOLEAN NOT NULL DEFAULT false,
    "accounts_recovery_manage" BOOLEAN NOT NULL DEFAULT false,
    "release_statement_queue" BOOLEAN NOT NULL DEFAULT false,
    "dcr_management" BOOLEAN NOT NULL DEFAULT false,
    "dcr_purchase_receive" BOOLEAN NOT NULL DEFAULT false,
    "dcr_purchase_dcr_receive" BOOLEAN NOT NULL DEFAULT false,
    "dcr_serial_search" BOOLEAN NOT NULL DEFAULT false,
    "dcr_serial_mapping_override" BOOLEAN NOT NULL DEFAULT false,
    "dcr_hold_release" BOOLEAN NOT NULL DEFAULT false,
    "dcr_issue_customer_dcr" BOOLEAN NOT NULL DEFAULT false,
    "solar_orders_view" BOOLEAN NOT NULL DEFAULT false,
    "solar_orders_create" BOOLEAN NOT NULL DEFAULT false,
    "solar_orders_approval" BOOLEAN NOT NULL DEFAULT false,
    "solar_orders_docs_progress" BOOLEAN NOT NULL DEFAULT false,
    "solar_orders_edit_order_date" BOOLEAN NOT NULL DEFAULT false,
    "solar_orders_master_edit" BOOLEAN NOT NULL DEFAULT false,
    "workflow_edits" BOOLEAN NOT NULL DEFAULT false,
    "communications_view" BOOLEAN NOT NULL DEFAULT false,
    "communications_templates" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_integration" BOOLEAN NOT NULL DEFAULT false,
    "holdQueueReviewEnabled" BOOLEAN NOT NULL DEFAULT false,
    "holdQueueReviewLimit" DOUBLE PRECISION,
    "catalog_product_attributes_create" BOOLEAN NOT NULL DEFAULT false,
    "catalog_product_attributes_modify" BOOLEAN NOT NULL DEFAULT false,
    "catalog_product_attributes_archive" BOOLEAN NOT NULL DEFAULT false,
    "catalog_brands_create" BOOLEAN NOT NULL DEFAULT false,
    "catalog_brands_modify" BOOLEAN NOT NULL DEFAULT false,
    "catalog_brands_approve" BOOLEAN NOT NULL DEFAULT false,
    "catalog_manufacturers_create" BOOLEAN NOT NULL DEFAULT false,
    "catalog_manufacturers_modify" BOOLEAN NOT NULL DEFAULT false,
    "catalog_manufacturers_approve" BOOLEAN NOT NULL DEFAULT false,
    "catalog_categories_create" BOOLEAN NOT NULL DEFAULT false,
    "catalog_categories_modify" BOOLEAN NOT NULL DEFAULT false,
    "catalog_categories_approve" BOOLEAN NOT NULL DEFAULT false,
    "catalog_taxrates_create" BOOLEAN NOT NULL DEFAULT false,
    "catalog_taxrates_modify" BOOLEAN NOT NULL DEFAULT false,
    "catalog_taxrates_approve" BOOLEAN NOT NULL DEFAULT false,
    "catalog_units_create" BOOLEAN NOT NULL DEFAULT false,
    "catalog_units_modify" BOOLEAN NOT NULL DEFAULT false,
    "catalog_units_approve" BOOLEAN NOT NULL DEFAULT false,
    "catalog_hsncodes_create" BOOLEAN NOT NULL DEFAULT false,
    "catalog_hsncodes_modify" BOOLEAN NOT NULL DEFAULT false,
    "catalog_hsncodes_approve" BOOLEAN NOT NULL DEFAULT false,
    "catalog_products_create" BOOLEAN NOT NULL DEFAULT false,
    "catalog_products_modify" BOOLEAN NOT NULL DEFAULT false,
    "catalog_products_approve" BOOLEAN NOT NULL DEFAULT false,
    "catalog_products_archive" BOOLEAN NOT NULL DEFAULT false,
    "system_productMigration" BOOLEAN NOT NULL DEFAULT false,
    "printerId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "printZonalSlips" BOOLEAN NOT NULL DEFAULT true,
    "isSystemWarehouse" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "remarks" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "remarks" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manufacturer" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "remarks" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "Manufacturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRate" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "zohoBooksIntraTaxId" TEXT,
    "zohoBooksInterTaxId" TEXT,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "taxType" TEXT NOT NULL DEFAULT 'GST',
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "remarks" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitOfMeasurement" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "abbreviation" TEXT,
    "zohoBooksUnitName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "remarks" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "UnitOfMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HsnCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultGstRateId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "remarks" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "HsnCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernmentHsnHelper" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "level" TEXT NOT NULL,

    CONSTRAINT "GovernmentHsnHelper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterDataHistory" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fieldName" TEXT,
    "previousValue" TEXT,
    "newValue" TEXT,
    "remarks" TEXT,
    "performedById" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "brandId" TEXT,
    "categoryId" TEXT,
    "manufacturerId" TEXT,
    "taxRateId" TEXT,
    "unitOfMeasurementId" TEXT,
    "hsnCodeId" TEXT,
    "productId" TEXT,
    "productAttributeId" TEXT,

    CONSTRAINT "MasterDataHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterDataSequence" (
    "entityName" TEXT NOT NULL,
    "nextVal" INTEGER NOT NULL DEFAULT 10000,

    CONSTRAINT "MasterDataSequence_pkey" PRIMARY KEY ("entityName")
);

-- CreateTable
CREATE TABLE "Sku" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandId" TEXT,
    "unit" TEXT,
    "moq" INTEGER NOT NULL DEFAULT 1,
    "stepQty" INTEGER NOT NULL DEFAULT 1,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "gstPercent" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "hsnCode" TEXT,
    "description" TEXT,
    "caseSize" INTEGER NOT NULL DEFAULT 1,
    "lastSyncedAt" TIMESTAMP(3),
    "zohoBookItemId" TEXT,
    "zohoBooksId2" TEXT,
    "categoryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isUnlimited" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,

    CONSTRAINT "Sku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'Goods',
    "brandId" TEXT,
    "manufacturerId" TEXT,
    "categoryId" TEXT,
    "hsnCodeId" TEXT,
    "taxRateId" TEXT,
    "unitId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "remarks" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "incentiveTag" TEXT,
    "thumbnailBase64" TEXT,
    "catalogType" TEXT NOT NULL DEFAULT 'PRODUCT',
    "isVariantProduct" BOOLEAN NOT NULL DEFAULT false,
    "parentProductId" TEXT,
    "variantAttributeId" TEXT,
    "variantAttributeValue" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantName" TEXT NOT NULL DEFAULT 'Default',
    "sku" TEXT NOT NULL,
    "purchasePrice" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "sellingPrice" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "trackSerials" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "zohoBookItemId" TEXT,
    "zohoSyncStatus" "ZohoProductSyncStatus" NOT NULL DEFAULT 'NEVER_SYNCED',
    "zohoLastSyncAt" TIMESTAMP(3),
    "zohoLastSyncError" TEXT,
    "zohoSyncHash" TEXT,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZohoProductSyncLog" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "zohoBooksItemId" TEXT,
    "action" TEXT NOT NULL,
    "triggerSource" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "timeline" JSONB,
    "apiError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZohoProductSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseInventory" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "isOos" BOOLEAN NOT NULL DEFAULT false,
    "zone" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "WarehouseInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "warehouseId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "notes" TEXT,
    "staffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dispatchSlipNumber" TEXT,
    "zohoSalesorderId" TEXT,
    "zohoSalesorderNumber" TEXT,
    "zohoSyncStatus" TEXT DEFAULT 'PENDING',
    "zohoSyncStep" TEXT DEFAULT 'INITIATED',
    "zohoSyncError" TEXT,
    "zohoLastSyncAt" TIMESTAMP(3),
    "zohoResponseTimeMs" INTEGER,
    "zohoPayload" JSONB,
    "zohoResponse" JSONB,
    "zohoExecutionTrace" JSONB,
    "deletedAt" TIMESTAMP(3),
    "heldAt" TIMESTAMP(3),
    "heldById" TEXT,
    "resumedAt" TIMESTAMP(3),
    "resumedById" TEXT,
    "holdReason" TEXT,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "originalQty" INTEGER,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerLead" (
    "id" TEXT NOT NULL,
    "cartId" TEXT,
    "items" TEXT NOT NULL,
    "sessionId" TEXT,
    "deviceMeta" TEXT,
    "sourceChannel" TEXT NOT NULL DEFAULT 'whatsapp',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchSequence" (
    "date" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DispatchSequence_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "SyncLock" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkuSyncLog" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "trigger" TEXT NOT NULL DEFAULT 'CRON',
    "syncLimit" INTEGER DEFAULT 0,
    "totalReceived" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "logs" JSONB,
    "executionTrace" JSONB,

    CONSTRAINT "SkuSyncLog_pkey" PRIMARY KEY ("id")
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
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scopeVersion" INTEGER NOT NULL DEFAULT 1,
    "grantedScopes" TEXT,
    "dataCenter" TEXT,
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

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "netOutstandingBalance" DOUBLE PRECISION,
    "balanceUpdatedAt" TIMESTAMP(3),
    "balanceSyncStatus" TEXT,
    "balanceSyncError" TEXT,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

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
    "outstandingAmount" DOUBLE PRECISION,
    "outstandingUpdatedAt" TIMESTAMP(3),
    "locationId" TEXT,
    "locationName" TEXT,
    "dcrStatus" TEXT NOT NULL DEFAULT 'NEW',
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "processingReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "importSource" "DcrImportSource" NOT NULL DEFAULT 'ZOHO_SYNC',
    "importedBy" TEXT,
    "importedAt" TIMESTAMP(3),

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
    "rate" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION,
    "description" TEXT,
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

-- CreateTable
CREATE TABLE "ZohoApiLog" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "userId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZohoApiLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DcrSerialAllocation" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allocatedBy" TEXT NOT NULL,

    CONSTRAINT "DcrSerialAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DcrSerial" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "skuId" TEXT,
    "serialSource" TEXT NOT NULL DEFAULT 'MANUAL_ENTRY',
    "status" "SerialStatus" NOT NULL DEFAULT 'AVAILABLE',
    "purchaseReceived" BOOLEAN NOT NULL DEFAULT false,
    "vendorName" TEXT,
    "billNumber" TEXT,
    "vendorDcrStatus" TEXT NOT NULL DEFAULT 'NOT_RECEIVED',
    "vendorDcrReceivedAt" TIMESTAMP(3),
    "vendorDcrReceivedBy" TEXT,
    "skuLocked" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deleteReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DcrSerial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerialTag" (
    "id" TEXT NOT NULL,
    "serialId" TEXT NOT NULL,
    "tag" VARCHAR(256) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SerialTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DcrSerialHistory" (
    "id" TEXT NOT NULL,
    "serialId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDescription" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "DcrSerialHistory_pkey" PRIMARY KEY ("id")
);

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
    "otherLeadSource" TEXT,
    "loanCustomer" BOOLEAN NOT NULL DEFAULT false,
    "totalOrderAmount" DOUBLE PRECISION NOT NULL,
    "receivedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fileChargePaid" BOOLEAN NOT NULL DEFAULT false,
    "fileChargeAmount" DOUBLE PRECISION,
    "pendingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "systemSize" DOUBLE PRECISION NOT NULL,
    "systemType" TEXT NOT NULL,
    "zohoBooksCustomerId" TEXT,
    "zohoBooksCustomerName" TEXT,
    "remarks" TEXT,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancellationReason" TEXT,
    "cancellationRemarks" TEXT,
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
    "wifiNotApplicableReason" TEXT,
    "wifiNotApplicableNotes" TEXT,
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

-- CreateTable
CREATE TABLE "SolarTask" (
    "id" TEXT NOT NULL,
    "solarOrderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedToId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "dueTime" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "latestUpdate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolarTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolarTaskFollowUp" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "nextFollowUpDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolarTaskFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolarDiscussion" (
    "id" TEXT NOT NULL,
    "solarOrderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolarDiscussion_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "ZohoCreatorConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "bearerToken" TEXT NOT NULL,
    "lastTokenGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZohoCreatorConfig_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "ProductAttribute" (
    "id" TEXT NOT NULL,
    "attributeCode" TEXT NOT NULL,
    "attributeName" TEXT NOT NULL,
    "description" TEXT,
    "dataType" TEXT NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "prefix" TEXT,
    "suffix" TEXT,
    "placeholder" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "options" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttributeCategory" (
    "id" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subcategoryId" TEXT,

    CONSTRAINT "ProductAttributeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttributeValue" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ProductAttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "leadTimeDays" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "safetyFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_mobile_key" ON "User"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_code_key" ON "Brand"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE INDEX "Brand_status_idx" ON "Brand"("status");

-- CreateIndex
CREATE INDEX "Brand_createdAt_idx" ON "Brand"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_code_key" ON "Category"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Category_status_idx" ON "Category"("status");

-- CreateIndex
CREATE INDEX "Category_createdAt_idx" ON "Category"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Manufacturer_code_key" ON "Manufacturer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Manufacturer_name_key" ON "Manufacturer"("name");

-- CreateIndex
CREATE INDEX "Manufacturer_status_idx" ON "Manufacturer"("status");

-- CreateIndex
CREATE INDEX "Manufacturer_createdAt_idx" ON "Manufacturer"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRate_code_key" ON "TaxRate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRate_name_key" ON "TaxRate"("name");

-- CreateIndex
CREATE INDEX "TaxRate_status_idx" ON "TaxRate"("status");

-- CreateIndex
CREATE INDEX "TaxRate_createdAt_idx" ON "TaxRate"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasurement_code_key" ON "UnitOfMeasurement"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasurement_name_key" ON "UnitOfMeasurement"("name");

-- CreateIndex
CREATE INDEX "UnitOfMeasurement_status_idx" ON "UnitOfMeasurement"("status");

-- CreateIndex
CREATE INDEX "UnitOfMeasurement_createdAt_idx" ON "UnitOfMeasurement"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HsnCode_code_key" ON "HsnCode"("code");

-- CreateIndex
CREATE INDEX "HsnCode_status_idx" ON "HsnCode"("status");

-- CreateIndex
CREATE INDEX "HsnCode_createdAt_idx" ON "HsnCode"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GovernmentHsnHelper_code_key" ON "GovernmentHsnHelper"("code");

-- CreateIndex
CREATE INDEX "GovernmentHsnHelper_code_idx" ON "GovernmentHsnHelper"("code");

-- CreateIndex
CREATE INDEX "MasterDataHistory_entityType_entityId_idx" ON "MasterDataHistory"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "MasterDataHistory_performedAt_idx" ON "MasterDataHistory"("performedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Sku_zohoBookItemId_key" ON "Sku"("zohoBookItemId");

-- CreateIndex
CREATE INDEX "Sku_categoryId_idx" ON "Sku"("categoryId");

-- CreateIndex
CREATE INDEX "Sku_brandId_idx" ON "Sku"("brandId");

-- CreateIndex
CREATE INDEX "Sku_createdAt_idx" ON "Sku"("createdAt");

-- CreateIndex
CREATE INDEX "Sku_zohoBookItemId_idx" ON "Sku"("zohoBookItemId");

-- CreateIndex
CREATE INDEX "Sku_zohoBooksId2_idx" ON "Sku"("zohoBooksId2");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

-- CreateIndex
CREATE INDEX "Product_type_idx" ON "Product"("type");

-- CreateIndex
CREATE INDEX "Product_catalogType_idx" ON "Product"("catalogType");

-- CreateIndex
CREATE INDEX "Product_parentProductId_idx" ON "Product"("parentProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_zohoBookItemId_key" ON "ProductVariant"("zohoBookItemId");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE INDEX "ProductVariant_sku_idx" ON "ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ProductVariant_zohoSyncStatus_idx" ON "ProductVariant"("zohoSyncStatus");

-- CreateIndex
CREATE INDEX "ZohoProductSyncLog_variantId_idx" ON "ZohoProductSyncLog"("variantId");

-- CreateIndex
CREATE INDEX "ZohoProductSyncLog_productId_idx" ON "ZohoProductSyncLog"("productId");

-- CreateIndex
CREATE INDEX "ZohoProductSyncLog_createdAt_idx" ON "ZohoProductSyncLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseInventory_warehouseId_skuId_key" ON "WarehouseInventory"("warehouseId", "skuId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_dispatchSlipNumber_key" ON "Cart"("dispatchSlipNumber");

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
CREATE UNIQUE INDEX "StockAlertThreshold_warehouseId_skuId_key" ON "StockAlertThreshold"("warehouseId", "skuId");

-- CreateIndex
CREATE INDEX "RecoveryInvoiceTask_invoiceId_idx" ON "RecoveryInvoiceTask"("invoiceId");

-- CreateIndex
CREATE INDEX "RecoveryInvoiceTask_customerId_idx" ON "RecoveryInvoiceTask"("customerId");

-- CreateIndex
CREATE INDEX "RecoveryInvoiceTask_status_idx" ON "RecoveryInvoiceTask"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DcrInvoice_zohoInvoiceId_key" ON "DcrInvoice"("zohoInvoiceId");

-- CreateIndex
CREATE INDEX "DcrInvoice_dcrStatus_idx" ON "DcrInvoice"("dcrStatus");

-- CreateIndex
CREATE INDEX "DcrInvoice_zohoInvoiceId_idx" ON "DcrInvoice"("zohoInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "DcrSerialAllocation_serialNumber_key" ON "DcrSerialAllocation"("serialNumber");

-- CreateIndex
CREATE INDEX "DcrSerialAllocation_invoiceId_idx" ON "DcrSerialAllocation"("invoiceId");

-- CreateIndex
CREATE INDEX "DcrSerialAllocation_skuId_idx" ON "DcrSerialAllocation"("skuId");

-- CreateIndex
CREATE INDEX "DcrSerialAllocation_serialNumber_idx" ON "DcrSerialAllocation"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DcrSerial_serialNumber_key" ON "DcrSerial"("serialNumber");

-- CreateIndex
CREATE INDEX "DcrSerial_skuId_idx" ON "DcrSerial"("skuId");

-- CreateIndex
CREATE UNIQUE INDEX "SerialTag_serialId_key" ON "SerialTag"("serialId");

-- CreateIndex
CREATE INDEX "SerialTag_serialId_idx" ON "SerialTag"("serialId");

-- CreateIndex
CREATE INDEX "DcrSerialHistory_serialId_idx" ON "DcrSerialHistory"("serialId");

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

-- CreateIndex
CREATE INDEX "SolarTask_solarOrderId_idx" ON "SolarTask"("solarOrderId");

-- CreateIndex
CREATE INDEX "SolarTask_assignedToId_idx" ON "SolarTask"("assignedToId");

-- CreateIndex
CREATE INDEX "SolarTask_status_idx" ON "SolarTask"("status");

-- CreateIndex
CREATE INDEX "SolarTaskFollowUp_taskId_idx" ON "SolarTaskFollowUp"("taskId");

-- CreateIndex
CREATE INDEX "SolarDiscussion_solarOrderId_idx" ON "SolarDiscussion"("solarOrderId");

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

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttribute_attributeCode_key" ON "ProductAttribute"("attributeCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttribute_attributeName_key" ON "ProductAttribute"("attributeName");

-- CreateIndex
CREATE INDEX "ProductAttribute_status_idx" ON "ProductAttribute"("status");

-- CreateIndex
CREATE INDEX "ProductAttribute_dataType_idx" ON "ProductAttribute"("dataType");

-- CreateIndex
CREATE INDEX "ProductAttributeCategory_attributeId_idx" ON "ProductAttributeCategory"("attributeId");

-- CreateIndex
CREATE INDEX "ProductAttributeCategory_categoryId_idx" ON "ProductAttributeCategory"("categoryId");

-- CreateIndex
CREATE INDEX "ProductAttributeValue_productId_idx" ON "ProductAttributeValue"("productId");

-- CreateIndex
CREATE INDEX "ProductAttributeValue_attributeId_idx" ON "ProductAttributeValue"("attributeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttributeValue_productId_attributeId_key" ON "ProductAttributeValue"("productId", "attributeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manufacturer" ADD CONSTRAINT "Manufacturer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manufacturer" ADD CONSTRAINT "Manufacturer_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manufacturer" ADD CONSTRAINT "Manufacturer_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitOfMeasurement" ADD CONSTRAINT "UnitOfMeasurement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitOfMeasurement" ADD CONSTRAINT "UnitOfMeasurement_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitOfMeasurement" ADD CONSTRAINT "UnitOfMeasurement_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HsnCode" ADD CONSTRAINT "HsnCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HsnCode" ADD CONSTRAINT "HsnCode_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HsnCode" ADD CONSTRAINT "HsnCode_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HsnCode" ADD CONSTRAINT "HsnCode_defaultGstRateId_fkey" FOREIGN KEY ("defaultGstRateId") REFERENCES "TaxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterDataHistory" ADD CONSTRAINT "MasterDataHistory_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterDataHistory" ADD CONSTRAINT "MasterDataHistory_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterDataHistory" ADD CONSTRAINT "MasterDataHistory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterDataHistory" ADD CONSTRAINT "MasterDataHistory_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterDataHistory" ADD CONSTRAINT "MasterDataHistory_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterDataHistory" ADD CONSTRAINT "MasterDataHistory_unitOfMeasurementId_fkey" FOREIGN KEY ("unitOfMeasurementId") REFERENCES "UnitOfMeasurement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterDataHistory" ADD CONSTRAINT "MasterDataHistory_hsnCodeId_fkey" FOREIGN KEY ("hsnCodeId") REFERENCES "HsnCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterDataHistory" ADD CONSTRAINT "MasterDataHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterDataHistory" ADD CONSTRAINT "MasterDataHistory_productAttributeId_fkey" FOREIGN KEY ("productAttributeId") REFERENCES "ProductAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_hsnCodeId_fkey" FOREIGN KEY ("hsnCodeId") REFERENCES "HsnCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_parentProductId_fkey" FOREIGN KEY ("parentProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_variantAttributeId_fkey" FOREIGN KEY ("variantAttributeId") REFERENCES "ProductAttribute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZohoProductSyncLog" ADD CONSTRAINT "ZohoProductSyncLog_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseInventory" ADD CONSTRAINT "WarehouseInventory_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseInventory" ADD CONSTRAINT "WarehouseInventory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseInventory" ADD CONSTRAINT "WarehouseInventory_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_heldById_fkey" FOREIGN KEY ("heldById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_resumedById_fkey" FOREIGN KEY ("resumedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "StockAlertThreshold" ADD CONSTRAINT "StockAlertThreshold_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAlertThreshold" ADD CONSTRAINT "StockAlertThreshold_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DcrInvoice" ADD CONSTRAINT "DcrInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DcrInvoiceItem" ADD CONSTRAINT "DcrInvoiceItem_dcrInvoiceId_fkey" FOREIGN KEY ("dcrInvoiceId") REFERENCES "DcrInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DcrSerialAllocation" ADD CONSTRAINT "DcrSerialAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "DcrInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DcrSerialAllocation" ADD CONSTRAINT "DcrSerialAllocation_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "DcrInvoiceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DcrSerialAllocation" ADD CONSTRAINT "DcrSerialAllocation_serialNumber_fkey" FOREIGN KEY ("serialNumber") REFERENCES "DcrSerial"("serialNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialTag" ADD CONSTRAINT "SerialTag_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "DcrSerial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DcrSerialHistory" ADD CONSTRAINT "DcrSerialHistory_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "DcrSerial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "SolarTask" ADD CONSTRAINT "SolarTask_solarOrderId_fkey" FOREIGN KEY ("solarOrderId") REFERENCES "SolarOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarTask" ADD CONSTRAINT "SolarTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarTask" ADD CONSTRAINT "SolarTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarTask" ADD CONSTRAINT "SolarTask_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarTaskFollowUp" ADD CONSTRAINT "SolarTaskFollowUp_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "SolarTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarTaskFollowUp" ADD CONSTRAINT "SolarTaskFollowUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarDiscussion" ADD CONSTRAINT "SolarDiscussion_solarOrderId_fkey" FOREIGN KEY ("solarOrderId") REFERENCES "SolarOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarDiscussion" ADD CONSTRAINT "SolarDiscussion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeCategory" ADD CONSTRAINT "ProductAttributeCategory_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "ProductAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeCategory" ADD CONSTRAINT "ProductAttributeCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "ProductAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

