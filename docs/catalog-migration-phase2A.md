# Catalog Migration Phase 2A: Compatibility Foundation

## Objective
This phase establishes the foundational layer required to migrate Kamna B2B ERP from the legacy `Sku` model to the new `Product`/`ProductVariant` architecture with **zero breaking changes**.

The ERP modules (Inventory, Sales, Purchase, Warehouse) continue using `skuId` natively. This phase introduces tools to measure compatibility and synchronize the data so that future phases can migrate individual modules safely.

## Architecture

The migration strategy follows a bottom-up approach:
1. **Compatibility Layer (Current Phase)**: Map every legacy `Sku` to a `ProductVariant` via a backfill. Implement Resolver services.
2. **Data Layer (Future)**: Migrate Inventory and Warehouse tables to use `productVariantId`.
3. **UX Layer (Future)**: Migrate Sales and Cart logic to use Product Variants.
4. **Integration Layer (Future)**: Migrate Zoho Sync logic to use Product Variants.

## Compatibility Layer Design

### `CatalogResolver`
Located in `src/lib/services/CatalogResolver.ts`, this service is the single abstraction layer for entity resolution.
It translates between the following identifiers:
- `Sku.id`
- `ProductVariant.id`
- `Product.id`
- `zohoItemId` / `zohoBooksId2`

**Output:** A normalized `ResolvedCatalogItem` containing all related entities (Product, Variant, Sku, Brand, Category, Images), ensuring downstream modules can extract whatever format they need.

### `CatalogValidator`
Located in `src/lib/services/catalog-validator.ts`, this service audits the integrity of the relationships. It checks for:
- SKUs without Variants
- Variants without SKUs
- Variants without Products
- Broken or duplicate Zoho mappings

## Migration Readiness

We track "Readiness" per module. A module is 100% ready when every `skuId` utilized within its operational tables (e.g., `WarehouseInventory`, `CartItem`, `DcrSerial`) has a corresponding `ProductVariant` mapped to it.

The Readiness API (`/api/admin/catalog-sync/readiness`) calculates these metrics in real-time.

## Backfill Logic

To achieve 100% readiness without modifying database schemas:
1. **Preview Backfill (`/preview-backfill`)**: Scans operational tables and identifies how many records "can map" to a variant.
2. **Execute Backfill (`/execute-backfill`)**: Generates missing `Product` and `ProductVariant` records for legacy `Sku` records that do not have them. It runs inside a Prisma transaction, ensures idempotency, and never overwrites existing populated fields.

## Future Phases

- **Phase 2B**: Migrate Inventory and Warehouse to `productVariantId`.
- **Phase 3**: Migrate Cart and Sales modules.
- **Phase 4**: Migrate Purchase and DCR modules.
- **Phase 5**: Update Zoho Sync logic.
- **Phase 6**: Deprecate the legacy `Sku` table.

## Rollback Strategy

Because no existing APIs, workflows, or foreign keys are modified during Phase 2A, there is no risk to live operations. The generated `Product` and `ProductVariant` records do not affect the legacy system's ability to operate. In the event of a critical failure during backfill execution, the Prisma transaction automatically rolls back all generated entities.
