# Kamna ERP - Catalog Architecture Phase 3 Verification Report

## 1. Executive Summary

This report provides a comprehensive, read-only audit of the Phase 3 CatalogResolver implementation. The goal of this phase was to verify whether the ERP operational modules successfully transitioned to using `Product` and `ProductVariant` as the master catalog layer via the `CatalogResolver` abstraction, leaving `Sku` strictly as an integration/compatibility layer.

**Conclusion**: The implementation establishes a solid foundation for the abstraction but is **NOT production-ready**. While several critical read paths in modules like DCR and Transfers were migrated, significant gaps remain. Unbounded caching without invalidation introduces a major memory leak and stale data risk. Furthermore, structural mismatches between the legacy `Sku` object and the new `CatalogItem` object break compatibility for any unmigrated codebase expecting strict field parity.

**MVP Readiness Verdict**: **FAIL (Not Production Ready)**
**Overall Completion Score**: **45 / 100**

---

## 2. Remaining Direct Prisma Lookups

Despite the migration, several operational modules still directly query the `Prisma.Sku` table. Below is the list of remaining direct queries outside of the catalog management and synchronization services.

| File | Line | Purpose | Category | Should Migrate? |
| :--- | :--- | :--- | :--- | :--- |
| `src/app/admin/inventory/page.tsx` | 35 | Fetching all active SKUs for the Inventory dashboard filter dropdowns. (`prisma.sku.findMany`) | B. Should migrate | YES |
| `src/app/api/staff/unlimited-skus/route.ts` | 54, 55, 76, 77 | Fetching and paginating SKUs to manage unlimited flags. (`prisma.sku.findMany`, `prisma.sku.count`) | B. Should migrate | YES |
| `src/app/api/staff/zone-mapping/route.ts` | 28 | Fetching SKUs to map warehouse zones. (`prisma.sku.findMany`) | B. Should migrate | YES |
| `src/app/api/admin/zoho/test-sales-order/route.ts` | 24 | Fetching SKUs for test sales order generation. (`prisma.sku.findMany`) | C. Legacy leftover | YES |

*Note: The `WarehouseInventory` Prisma model is tightly coupled to `Sku` via foreign keys, meaning any `prisma.warehouseInventory.findMany({ include: { sku: true } })` implicitly continues to rely on the legacy schema rather than the resolver.*

---

## 3. Module Adoption Matrix

| Module | Uses CatalogResolver? | Direct Sku Queries? | Risk Level | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Inventory** | NO | YES | HIGH | Relies heavily on `WarehouseInventory.sku` relations. |
| **Warehouse (Zones)** | NO | YES | HIGH | Fetches SKUs directly for zone mapping. |
| **Transfers** | YES | NO | LOW | Successfully migrated read paths. |
| **Bulk Import** | YES | NO | LOW | Validation layer migrated. |
| **DCR** | YES | NO | LOW | Purchase and Registry migrated. |
| **Admin Dashboard** | YES | NO | LOW | Stats use Resolver Health API. |
| **Unlimited SKUs** | NO | YES | MEDIUM | Legacy API still paginating raw SKUs. |

---

## 4. Resolver Consistency Audit

The `CatalogResolver` correctly returns a normalized `CatalogItem` across all its read methods (`findBySku`, `findManyBySku`, `search`, etc.). 

However, the `CatalogItem` contract has the following inconsistencies compared to the legacy `Sku` model:

- **Missing Fields**: `CatalogItem` lacks an `id` field (it uses `legacySku`, `productId`, `variantId`). Legacy modules expecting `sku.id` will fail.
- **Inconsistent Names**: Legacy `name` maps to `displayName`, `productName`, or `variantName`. Legacy `price` maps to `sellingPrice`.
- **Nullable Mismatches**: Legacy `price` is `Float @default(0)`, but `CatalogItem.sellingPrice` is strictly `number`. `sku.name` is strictly `String`, while `CatalogItem.displayName` is `string | null`.

---

## 5. Cache Audit

The `CatalogResolver` uses an in-memory Map for caching (`cache = new Map<string, CacheEntry>()`).

- **TTL**: 5 Minutes (Implemented correctly on read checks).
- **Memory Growth**: **UNBOUNDED**. There is no maximum limit on the `Map` size. High-volume searches or bulk imports will cause silent memory leaks.
- **Cleanup**: Passive cleanup only. Expired keys are deleted only when explicitly requested again.
- **Cache Invalidation**: **MISSING**. The `invalidateCache` method exists but is **never invoked** anywhere in the application (e.g., in `src/app/api/staff/catalog/[entity]/[id]/route.ts`).
  - *Risk*: Product edits, variant edits, approvals, or synchronization events will leave stale data in the cache for up to 5 minutes, leading to immediate operational desyncs in inventory and pricing.

---

## 6. Search Capability Matrix

The `CatalogResolver.search()` method implements basic querying against the `ProductVariant` table.

| Search Field | Status | Implementation Detail |
| :--- | :--- | :--- |
| Product Name | Supported | Uses `product: { name: { contains: q } }` |
| Variant Name | Supported | Uses `variantName: { contains: q } }` |
| SKU | Supported | Uses `sku: { contains: q } }` |
| Barcode | Supported | Mapped intrinsically to SKU in MVP |
| Product Code | Supported | Uses `product: { code: { contains: q } }` |
| Zoho Item ID | Supported | Uses `zohoBookItemId: { equals: q }` |
| Legacy SKU ID | Supported | Mapped to `sku` field on Variant |
| Manufacturer Part Number | **Not Supported** | Missing from query logic |
| Aliases | **Not Supported** | Missing from query logic |

---

## 7. Resolver Health Coverage

The `CatalogResolver.getCatalogHealth()` method provides foundational diagnostics but misses several requested constraints.

| Check | Supported? | Notes |
| :--- | :--- | :--- |
| Duplicate SKU | YES | Checked via `prisma.sku.groupBy` |
| Duplicate Barcode | YES | Mirrored from Duplicate SKU logic for now |
| Duplicate Zoho IDs | YES | Checked via `prisma.productVariant.groupBy` |
| Missing Product | YES | Variants with `productId: null` |
| Missing Variant | YES | Products without relations in `variants` |
| Missing SKU | YES | Variants pointing to non-existent SKUs |
| Broken Mapping | YES | Covered by Missing SKU logic |
| Orphan Variant | **NO** | Not explicitly tracked (overlaps partially with Missing Product) |
| Orphan SKU | YES | SKUs that no variant points to |
| Missing Default Variant | **NO** | Not checked in the health aggregator |
| Duplicate Attributes | **NO** | Not checked in the health aggregator |

---

## 8. Compatibility Verification

Does a legacy module expecting `Sku` receive the same data shape from `CatalogItem`? **NO.**

| Legacy `Sku` Field | New `CatalogItem` Field | Compatibility Status |
| :--- | :--- | :--- |
| `id` | `legacySku` | ❌ **BREAKING** (Property renamed) |
| `name` | `displayName` | ❌ **BREAKING** (Property renamed) |
| `price` | `sellingPrice` | ❌ **BREAKING** (Property renamed) |
| `isUnlimited` | `isUnlimited` | ✅ OK |
| `unit` | `unit` | ✅ OK |
| `isActive` | `isActive` | ✅ OK |
| `brandId` / `categoryId` | `brandId` / `categoryId` | ✅ OK |

Because of these structural renaming decisions, `CatalogItem` is **NOT** a drop-in replacement for `Sku`. Any module that is migrated to use the Resolver must have its internal variable access explicitly updated (e.g., `item.name` -> `item.displayName`), dramatically increasing the cost and risk of the migration.

---

## 9. Risks & Technical Debt

1. **Unbounded Memory Leak**: The in-memory Map in `CatalogResolver` will grow indefinitely during heavy use.
2. **Stale Data (No Invalidation)**: Because `invalidateCache` is never called by the mutation routes (Catalog creation, editing, synchronization), the ERP will frequently serve stale prices, names, and limits to critical modules like POS and Sales.
3. **Database Schema Coupling**: `WarehouseInventory`, `TransferItem`, and `OrderItem` still rely on foreign keys directly pointing to the `Sku` table. Until the schema is actually migrated to point to `ProductVariant`, the `Sku` table cannot truly become just an integration layer.

---

## 10. Recommended Fixes (For Next Phase)

1. **Implement Cache Invalidation**: Hook `CatalogResolver.invalidateCache()` into all mutation endpoints inside `src/app/api/staff/catalog`.
2. **Cap Cache Size**: Use an LRU (Least Recently Used) cache strategy (e.g., `lru-cache` library) instead of a raw Map to prevent memory exhaustion.
3. **Bridge the `CatalogItem` gap**: If drop-in replacement is desired, alias `id`, `name`, and `price` as getter properties on the `CatalogItem` object to prevent widespread refactoring in legacy UI components.
4. **Migrate Remaining Ops**: Shift `Inventory`, `Unlimited SKUs`, and `Zone Mapping` off direct `Prisma.Sku` queries.
