-- ==========================================================
-- PRODUCTION DATABASE SYNC SCRIPT
-- Kamna Traders B2B - May 13, 2026
-- ==========================================================

-- 1. ADD MISSING COLUMNS TO "User"
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='User' AND column_name='canManageCarts') THEN
        ALTER TABLE "User" ADD COLUMN "canManageCarts" BOOLEAN NOT NULL DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='User' AND column_name='canAdjustInventory') THEN
        ALTER TABLE "User" ADD COLUMN "canAdjustInventory" BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='User' AND column_name='canRunSkuSync') THEN
        ALTER TABLE "User" ADD COLUMN "canRunSkuSync" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- 2. ADD MISSING COLUMNS TO "Sku"
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Sku' AND column_name='zohoBooksId2') THEN
        ALTER TABLE "Sku" ADD COLUMN "zohoBooksId2" TEXT;
    END IF;
END $$;

-- 3. UPDATE "SkuSyncLog" TABLE (Forensic observability)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SkuSyncLog' AND column_name='trigger') THEN
        ALTER TABLE "SkuSyncLog" ADD COLUMN "trigger" TEXT NOT NULL DEFAULT 'CRON';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SkuSyncLog' AND column_name='syncLimit') THEN
        ALTER TABLE "SkuSyncLog" ADD COLUMN "syncLimit" INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SkuSyncLog' AND column_name='processedCount') THEN
        ALTER TABLE "SkuSyncLog" ADD COLUMN "processedCount" INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SkuSyncLog' AND column_name='skippedCount') THEN
        ALTER TABLE "SkuSyncLog" ADD COLUMN "skippedCount" INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SkuSyncLog' AND column_name='metadata') THEN
        ALTER TABLE "SkuSyncLog" ADD COLUMN "metadata" JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SkuSyncLog' AND column_name='executionTrace') THEN
        ALTER TABLE "SkuSyncLog" ADD COLUMN "executionTrace" JSONB;
    END IF;
END $$;

-- 4. CREATE "SyncLock" TABLE
CREATE TABLE IF NOT EXISTS "SyncLock" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "name" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SyncLock_name_key" ON "SyncLock"("name");

-- 5. CREATE "SkuIdentityRegistry" TABLE
CREATE TABLE IF NOT EXISTS "SkuIdentityRegistry" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "zohoBookItemId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "syncGeneration" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SkuIdentityRegistry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SkuIdentityRegistry_skuId_key" ON "SkuIdentityRegistry"("skuId");
CREATE UNIQUE INDEX IF NOT EXISTS "SkuIdentityRegistry_zohoBookItemId_key" ON "SkuIdentityRegistry"("zohoBookItemId");
CREATE INDEX IF NOT EXISTS "SkuIdentityRegistry_zohoBookItemId_idx" ON "SkuIdentityRegistry"("zohoBookItemId");
CREATE INDEX IF NOT EXISTS "SkuIdentityRegistry_skuId_idx" ON "SkuIdentityRegistry"("skuId");

-- 6. CREATE "InventoryHistory" TABLE
CREATE TABLE IF NOT EXISTS "InventoryHistory" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "beforeQty" INTEGER NOT NULL,
    "afterQty" INTEGER NOT NULL,
    "qtyChange" INTEGER NOT NULL,
    "remarks" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InventoryHistory_warehouseId_idx" ON "InventoryHistory"("warehouseId");
CREATE INDEX IF NOT EXISTS "InventoryHistory_skuId_idx" ON "InventoryHistory"("skuId");
CREATE INDEX IF NOT EXISTS "InventoryHistory_createdAt_idx" ON "InventoryHistory"("createdAt");

-- 7. CREATE "ZohoToken" TABLE
CREATE TABLE IF NOT EXISTS "ZohoToken" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZohoToken_pkey" PRIMARY KEY ("id")
);

-- 8. CREATE "ActiveSession" TABLE
CREATE TABLE IF NOT EXISTS "ActiveSession" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "ActiveSession_sessionToken_key" ON "ActiveSession"("sessionToken");
CREATE INDEX IF NOT EXISTS "ActiveSession_userId_idx" ON "ActiveSession"("userId");
CREATE INDEX IF NOT EXISTS "ActiveSession_sessionToken_idx" ON "ActiveSession"("sessionToken");
CREATE INDEX IF NOT EXISTS "ActiveSession_lastSeenAt_idx" ON "ActiveSession"("lastSeenAt");
CREATE INDEX IF NOT EXISTS "ActiveSession_userId_deviceType_idx" ON "ActiveSession"("userId", "deviceType");

-- 9. ADD FOREIGN KEYS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'InventoryHistory_createdBy_fkey') THEN
        ALTER TABLE "InventoryHistory" ADD CONSTRAINT "InventoryHistory_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'InventoryHistory_warehouseId_fkey') THEN
        ALTER TABLE "InventoryHistory" ADD CONSTRAINT "InventoryHistory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ActiveSession_userId_fkey') THEN
        ALTER TABLE "ActiveSession" ADD CONSTRAINT "ActiveSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
