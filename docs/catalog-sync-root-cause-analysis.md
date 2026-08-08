# Catalog Maintenance Sync Failures - Root Cause Analysis

## Executive Summary
The synchronization between the legacy `Sku` catalog and the new `Product`/`ProductVariant` catalog is failing due to unhandled unique constraint violations and overly simplistic matching logic. The `CatalogSyncEngine` attempts to naively match records exclusively by the `sku` string identifier. If a match is not found by SKU string, the engine attempts to create a new record. However, it fails to check if the `zohoBookItemId` (which is constrained as `@unique` in both the `Sku` and `ProductVariant` models) is already claimed by another record. This leads to Prisma `Unique Constraint Violations` (P2002) when attempting to create "missing" records, causing the sync to fail.

## Root Cause
The core issues reside in `src/lib/services/catalog-sync-engine.ts`:

1. **Flawed Decision Logic in `syncSkuToProduct`**:
   The engine maps variants strictly by SKU:
   ```typescript
   const variantMap = new Map(variants.map(v => [v.sku, v]));
   const variant = variantMap.get(sku.id);
   ```
   If a user creates a new ProductVariant with a new SKU but assigns it an existing Zoho Item ID, `variantMap.get(sku.id)` will return `undefined` for the old legacy SKU. The sync engine interprets this as "Variant missing" and attempts to **CREATE** a new `ProductVariant`. This `CREATE` operation crashes at the database level because `ProductVariant.zohoBookItemId` is enforced as `@unique`.

2. **Incomplete Conflict Resolution in `syncProductToSku`**:
   When syncing down to the legacy Sku table, the engine checks for duplicate Zoho IDs:
   ```typescript
   if (desiredZohoId && zohoIdToSkuId.has(desiredZohoId) && zohoIdToSkuId.get(desiredZohoId) !== skuId) {
       // Fails with Error: Duplicate Zoho ID
   }
   ```
   While this prevents database crashes, it simply skips the record and emits an error. It provides no mechanism to resolve the conflict (e.g., determining which record is the canonical owner of the Zoho ID).

## Sync Logic Analysis (Decision Tree Flaws)
The current decision tree in `CatalogSyncEngine.runSkuToProduct` is as follows:
- Does a `ProductVariant` exist where `variant.sku === sku.id`?
  - **YES**: Attempt **UPDATE** (Sync Zoho metadata to Variant).
  - **NO**: Attempt **CREATE** (Create missing Product & Variant).

**Where it breaks:**
The engine fails to check the secondary unique identifier: `zohoBookItemId`. 
If `variant.sku !== sku.id` BUT `variant.zohoBookItemId === sku.zohoBookItemId`, the engine will choose **CREATE** instead of **UPDATE** or **SKIP**, causing a fatal unique constraint violation.

## Unique Constraints Affecting Sync
The following Prisma schema constraints enforce uniqueness, which the sync engine currently violates during its CREATE operations:
- `Product.code` (`@unique`)
- `ProductVariant.sku` (`@unique`)
- `ProductVariant.zohoBookItemId` (`@unique`)
- `Sku.id` (`@id`)
- `Sku.zohoBookItemId` (`@unique`)

## Affected Records & Data Integrity
*(Note: Because the production database at `localhost:5432` is inaccessible from the current runtime environment, the exact lists must be extracted by running the provided diagnostics script below).*

### Duplicate Zoho IDs & Conflicting Variants
When multiple records claim the same Zoho Item ID, synchronization halts. This typically occurred during Phase 2/Phase 3 migrations when users manually recreated products but mapped them to existing Zoho items.

To extract the exact list of conflicting variants, run the following SQL against the database:
```sql
SELECT 
    v.id AS variant_id, 
    v.sku AS variant_sku, 
    v."zohoBookItemId", 
    s.id AS legacy_sku_id 
FROM "ProductVariant" v
JOIN "Sku" s ON v."zohoBookItemId" = s."zohoBookItemId"
WHERE v.sku != s.id;
```

### Broken Relationships
1. **Variants without Products**: Variants where `productId IS NULL` (Orphaned).
2. **SKUs without Variants**: Legacy SKUs that were completely skipped during migration and have no corresponding `ProductVariant` with a matching `sku`.
3. **Mismatched Zoho IDs**: SKUs whose `zohoBookItemId` is claimed by a Variant, but the `sku` ID strings do not match.

To extract these counts and lists, run:
```sql
-- SKUs without matching Variants (by SKU string)
SELECT id, name, "zohoBookItemId" FROM "Sku" 
WHERE id NOT IN (SELECT sku FROM "ProductVariant");

-- Variants without Products
SELECT id, sku FROM "ProductVariant" WHERE "productId" IS NULL;
```

## Recommended Fix (Implementation Plan)

1. **Enhance Mapping Strategy**:
   Modify `variantMap` in `runSkuToProduct` to index by BOTH `sku` and `zohoBookItemId`. 
   ```typescript
   const variantBySku = new Map(variants.map(v => [v.sku, v]));
   const variantByZoho = new Map(variants.filter(v => v.zohoBookItemId).map(v => [v.zohoBookItemId, v]));
   ```

2. **Fix Decision Tree**:
   When iterating over SKUs:
   - Match by `sku.id`. If found, **UPDATE**.
   - If not found by `sku.id`, check match by `zohoBookItemId`. 
   - If a match is found by `zohoBookItemId` (but SKU strings differ), **LOG CONFLICT** or **UPDATE** (depending on business rules for canonical SKU naming), but DO NOT **CREATE**.
   - Only **CREATE** if neither `sku.id` nor `zohoBookItemId` exist in the `ProductVariant` table.

3. **Canonical Ownership**:
   Establish a strict rule for resolving Zoho ID conflicts. If a new `ProductVariant` claims a `zohoBookItemId` that belongs to an old `Sku`, the system must either overwrite the old Sku's ID, merge them, or explicitly fail gracefully instead of crashing.

## Risk Assessment
Implementing these logic changes carries **low operational risk** provided we do not automatically overwrite `variant.sku` strings without user confirmation. The primary risk is data loss if the engine incorrectly assumes which record is the canonical owner of a duplicated Zoho ID. All conflict resolutions (where `sku.id != variant.sku` but Zoho IDs match) should ideally be flagged in a "Needs Manual Review" queue in the UI rather than automatically merged.
