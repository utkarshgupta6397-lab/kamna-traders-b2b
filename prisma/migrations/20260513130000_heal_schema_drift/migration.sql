-- HEALING MIGRATION: 2026-05-13
-- Resolves drift for tables present in schema but missing in migrations.
-- This script uses IF NOT EXISTS to prevent errors if some tables were already pushed.

-- 1. ActiveSession
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

-- 2. SkuIdentityRegistry
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

-- 3. InventoryHistory
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

-- 4. ZohoToken
CREATE TABLE IF NOT EXISTS "ZohoToken" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ZohoToken_pkey" PRIMARY KEY ("id")
);

-- 5. SyncLock
CREATE TABLE IF NOT EXISTS "SyncLock" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "name" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SyncLock_pkey" PRIMARY KEY ("id")
);

-- 6. DispatchSequence
CREATE TABLE IF NOT EXISTS "DispatchSequence" (
    "date" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DispatchSequence_pkey" PRIMARY KEY ("date")
);
