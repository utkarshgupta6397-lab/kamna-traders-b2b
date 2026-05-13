-- ==========================================
-- PRE-DEPLOYMENT SQL AUDIT (SKU SYNC DEBUGGER)
-- ==========================================

-- 1. Create ActiveSession table for controlled multi-device management
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

-- 2. Create SyncLock table for concurrency control
CREATE TABLE IF NOT EXISTS "SyncLock" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "name" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLock_pkey" PRIMARY KEY ("id")
);

-- 3. Update SkuSyncLog table with forensic observability columns
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

-- 4. Add uniqueness constraints to Brand and Category (Idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "Brand_name_key" ON "Brand"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Category_name_key" ON "Category"("name");

-- 5. Add unique index for SyncLock name and ActiveSession token
CREATE UNIQUE INDEX IF NOT EXISTS "SyncLock_name_key" ON "SyncLock"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "ActiveSession_sessionToken_key" ON "ActiveSession"("sessionToken");

-- 6. Add Foreign Key for ActiveSession
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ActiveSession_userId_fkey') THEN
        ALTER TABLE "ActiveSession" ADD CONSTRAINT "ActiveSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 7. Add performance indexes
CREATE INDEX IF NOT EXISTS "ActiveSession_userId_deviceType_idx" ON "ActiveSession"("userId", "deviceType");

-- ==========================================
-- ROLLBACK COMMENTS
-- =-- DROP TABLE "SyncLock";
-- =-- DROP TABLE "ActiveSession";
-- =-- ALTER TABLE "SkuSyncLog" DROP COLUMN "trigger", DROP COLUMN "syncLimit", DROP COLUMN "processedCount", DROP COLUMN "skippedCount", DROP COLUMN "metadata", DROP COLUMN "executionTrace";
-- ==========================================
