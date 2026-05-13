## Root Cause
The `SkuIdentityRegistry` model exists in the `schema.prisma` file and is actively utilized by the application's forensic sync engine, but it was never formally migrated to the production database. The existing migrations folder history stops at `phase3_sku_sync`, which only added the `SkuSyncLog` table. Furthermore, several other essential models—specifically `ActiveSession`, `InventoryHistory`, `ZohoToken`, and `SyncLock`—are completely missing from the migration history, indicating a significant divergence between the codebase and the production environment.

Additionally, a type mismatch was found in the `Sku` table where `zohoBookItemId` is currently defined as `BIGINT` in migrations (v0507), but the schema expects `String` to prevent JavaScript numeric precision corruption.

## Recommended Fix
Apply a non-destructive "Healing Migration" that idempotently creates the missing tables and aligns the data types. This approach preserves existing data while establishing the required infrastructure for authentication and forensic synchronization.

## Exact SQL / Command To Run

Execute the following SQL in the Supabase SQL Editor:

```sql
-- 1. Create SkuIdentityRegistry (Missing)
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

-- 2. Create ActiveSession (Missing from migrations)
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

-- 3. Fix Sku Type Mismatch (BIGINT -> TEXT)
-- This prevents JS precision corruption for large Zoho IDs
ALTER TABLE "Sku" ALTER COLUMN "zohoBookItemId" TYPE TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Sku_zohoBookItemId_key" ON "Sku"("zohoBookItemId");

-- 4. Create Support Tables
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

CREATE TABLE IF NOT EXISTS "ZohoToken" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ZohoToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SyncLock" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "name" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SyncLock_pkey" PRIMARY KEY ("id")
);
```

## Why This Is Safe
*   **Idempotent**: Uses `IF NOT EXISTS` for all table and index creations.
*   **Non-Destructive**: Does not use `DROP TABLE` or `TRUNCATE`.
*   **Type Compatibility**: PostgreSQL safely allows `ALTER TABLE ... TYPE TEXT` from `BIGINT` without data loss (it converts the numeric representation to a string).
*   **Zero Downtime**: Creating tables and adding indexes (especially `IF NOT EXISTS`) does not lock the database for existing operations on other tables.

## Rollback Plan
To revert the changes, run:
```sql
DROP TABLE "SkuIdentityRegistry";
DROP TABLE "InventoryHistory";
-- Note: Do NOT drop ActiveSession if users are currently logged in.
-- To revert Sku column type (only if necessary):
-- ALTER TABLE "Sku" ALTER COLUMN "zohoBookItemId" TYPE BIGINT USING "zohoBookItemId"::bigint;
```

## Additional Drift Found
*   **ActiveSession**: Completely missing from migration history despite being critical for authentication.
*   **InventoryHistory**: Used for SKU sync history but table is missing in production.
*   **ZohoToken/SyncLock**: Essential for automated background syncs, currently missing in production DB.
*   **Sku.zohoBookItemId**: Schema/DB type mismatch (String vs BigInt) which is the root cause of numeric corruption bugs.
