
-- CreateEnum
CREATE TYPE "ZohoProductSyncStatus" AS ENUM ('NEVER_SYNCED', 'SYNCING', 'SYNCED', 'SYNC_FAILED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "catalog_brands_approve" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_brands_create" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_brands_modify" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_categories_approve" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_categories_create" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_categories_modify" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_hsncodes_approve" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_hsncodes_create" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_hsncodes_modify" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_manufacturers_approve" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_manufacturers_create" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_manufacturers_modify" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_product_attributes_archive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_product_attributes_create" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_product_attributes_modify" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_products_approve" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_products_archive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_products_create" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_products_modify" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_taxrates_approve" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_taxrates_create" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_taxrates_modify" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_units_approve" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_units_create" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalog_units_modify" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "system_productMigration" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Draft',
ADD COLUMN     "updatedById" TEXT;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Draft',
ADD COLUMN     "updatedById" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Manufacturer" (
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

    CONSTRAINT "Manufacturer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Manufacturer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;,
    CONSTRAINT "Manufacturer_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;,
    CONSTRAINT "Manufacturer_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TaxRate" (
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

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TaxRate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;,
    CONSTRAINT "TaxRate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;,
    CONSTRAINT "TaxRate_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UnitOfMeasurement" (
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

    CONSTRAINT "UnitOfMeasurement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UnitOfMeasurement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;,
    CONSTRAINT "UnitOfMeasurement_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;,
    CONSTRAINT "UnitOfMeasurement_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "HsnCode" (
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

    CONSTRAINT "HsnCode_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HsnCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;,
    CONSTRAINT "HsnCode_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;,
    CONSTRAINT "HsnCode_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;,
    CONSTRAINT "HsnCode_defaultGstRateId_fkey" FOREIGN KEY ("defaultGstRateId") REFERENCES "TaxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GovernmentHsnHelper" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "level" TEXT NOT NULL,

    CONSTRAINT "GovernmentHsnHelper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MasterDataHistory" (
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

    CONSTRAINT "MasterDataHistory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MasterDataHistory_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;,
    CONSTRAINT "MasterDataHistory_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;,
    CONSTRAINT "MasterDataHistory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;,
    CONSTRAINT "MasterDataHistory_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;,
    CONSTRAINT "MasterDataHistory_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id") ON DELETE CASCADE ON UPDATE CASCADE;,
    CONSTRAINT "MasterDataHistory_unitOfMeasurementId_fkey" FOREIGN KEY ("unitOfMeasurementId") REFERENCES "UnitOfMeasurement"("id") ON DELETE CASCADE ON UPDATE CASCADE;,
    CONSTRAINT "MasterDataHistory_hsnCodeId_fkey" FOREIGN KEY ("hsnCodeId") REFERENCES "HsnCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;,
    CONSTRAINT "MasterDataHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;,
    CONSTRAINT "MasterDataHistory_productAttributeId_fkey" FOREIGN KEY ("productAttributeId") REFERENCES "ProductAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MasterDataSequence" (
    "entityName" TEXT NOT NULL,
    "nextVal" INTEGER NOT NULL DEFAULT 10000,

    CONSTRAINT "MasterDataSequence_pkey" PRIMARY KEY ("entityName")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Product" (
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

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;,
    CONSTRAINT "Product_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE SET NULL ON UPDATE CASCADE;,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;,
    CONSTRAINT "Product_hsnCodeId_fkey" FOREIGN KEY ("hsnCodeId") REFERENCES "HsnCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;,
    CONSTRAINT "Product_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;,
    CONSTRAINT "Product_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;,
    CONSTRAINT "Product_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;,
    CONSTRAINT "Product_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;,
    CONSTRAINT "Product_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;,
    CONSTRAINT "Product_parentProductId_fkey" FOREIGN KEY ("parentProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;,
    CONSTRAINT "Product_variantAttributeId_fkey" FOREIGN KEY ("variantAttributeId") REFERENCES "ProductAttribute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProductVariant" (
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

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ZohoProductSyncLog" (
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

    CONSTRAINT "ZohoProductSyncLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ZohoProductSyncLog_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProductAttribute" (
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

    CONSTRAINT "ProductAttribute_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductAttribute_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;,
    CONSTRAINT "ProductAttribute_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProductAttributeCategory" (
    "id" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subcategoryId" TEXT,

    CONSTRAINT "ProductAttributeCategory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductAttributeCategory_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "ProductAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;,
    CONSTRAINT "ProductAttributeCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProductAttributeValue" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ProductAttributeValue_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductAttributeValue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;,
    CONSTRAINT "ProductAttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "ProductAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InventoryConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "leadTimeDays" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "safetyFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Manufacturer_code_key" ON "Manufacturer"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Manufacturer_name_key" ON "Manufacturer"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Manufacturer_status_idx" ON "Manufacturer"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Manufacturer_createdAt_idx" ON "Manufacturer"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TaxRate_code_key" ON "TaxRate"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TaxRate_name_key" ON "TaxRate"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaxRate_status_idx" ON "TaxRate"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaxRate_createdAt_idx" ON "TaxRate"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UnitOfMeasurement_code_key" ON "UnitOfMeasurement"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UnitOfMeasurement_name_key" ON "UnitOfMeasurement"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UnitOfMeasurement_status_idx" ON "UnitOfMeasurement"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UnitOfMeasurement_createdAt_idx" ON "UnitOfMeasurement"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "HsnCode_code_key" ON "HsnCode"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HsnCode_status_idx" ON "HsnCode"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HsnCode_createdAt_idx" ON "HsnCode"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GovernmentHsnHelper_code_key" ON "GovernmentHsnHelper"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GovernmentHsnHelper_code_idx" ON "GovernmentHsnHelper"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MasterDataHistory_entityType_entityId_idx" ON "MasterDataHistory"("entityType", "entityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MasterDataHistory_performedAt_idx" ON "MasterDataHistory"("performedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_brandId_idx" ON "Product"("brandId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_createdAt_idx" ON "Product"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_zohoBookItemId_key" ON "ProductVariant"("zohoBookItemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductVariant_sku_idx" ON "ProductVariant"("sku");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductVariant_zohoSyncStatus_idx" ON "ProductVariant"("zohoSyncStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ZohoProductSyncLog_variantId_idx" ON "ZohoProductSyncLog"("variantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ZohoProductSyncLog_productId_idx" ON "ZohoProductSyncLog"("productId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ZohoProductSyncLog_createdAt_idx" ON "ZohoProductSyncLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProductAttribute_attributeCode_key" ON "ProductAttribute"("attributeCode");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProductAttribute_attributeName_key" ON "ProductAttribute"("attributeName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductAttribute_status_idx" ON "ProductAttribute"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductAttribute_dataType_idx" ON "ProductAttribute"("dataType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductAttributeCategory_attributeId_idx" ON "ProductAttributeCategory"("attributeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductAttributeCategory_categoryId_idx" ON "ProductAttributeCategory"("categoryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductAttributeValue_productId_idx" ON "ProductAttributeValue"("productId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductAttributeValue_attributeId_idx" ON "ProductAttributeValue"("attributeId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProductAttributeValue_productId_attributeId_key" ON "ProductAttributeValue"("productId", "attributeId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Brand_code_key" ON "Brand"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Brand_status_idx" ON "Brand"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Brand_createdAt_idx" ON "Brand"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Category_code_key" ON "Category"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Category_status_idx" ON "Category"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Category_createdAt_idx" ON "Category"("createdAt");

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

