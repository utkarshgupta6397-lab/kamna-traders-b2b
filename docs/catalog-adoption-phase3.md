# Kamna ERP - Product Catalog Architecture
## Phase 3: ERP Catalog Adoption (Resolver-Based Architecture)

### Objective

The Phase 3 adoption shifts the ERP away from directly interacting with `Prisma.Sku` or `Prisma.Product` towards a unified resolution layer called `CatalogResolver`.

**Goal**: Every ERP module must consume catalog data ONLY through the `CatalogResolver`.

This phase has been designed to introduce ZERO breaking changes to schema, business workflows, foreign keys, or the UI. The ERP continues functioning identically, but with all legacy direct Prisma SKU lookups replaced by the resolver abstraction.

---

### Architecture Overview

```text
ERP Modules
    ↓
CatalogResolver (In-Memory Cache)
    ↓
Master Entities (Product / ProductVariant)
    ↓
Legacy SKU (Compatibility Layer)
```

By abstracting queries via the `CatalogResolver`, we effectively decouple operational modules (e.g., Sales, Inventory, Warehouse) from schema complexities. ERP modules no longer depend on knowing whether a specific piece of data comes from `Product`, `ProductVariant`, or `Sku`. 

All resolver methods return a fully hydrated and normalized `CatalogItem` model.

---

### Key Implementations

#### 1. CatalogResolver & CatalogItem
The `CatalogResolver` class (`src/lib/services/CatalogResolver.ts`) was rewritten to become the universal catalog access point. 

- **Methods Introduced**:
  - `findBySku(skuId: string): Promise<CatalogItem | null>`
  - `findManyBySku(skuIds: string[]): Promise<Map<string, CatalogItem>>`
  - `resolveBarcode(barcode: string): Promise<CatalogItem | null>`
  - `search(query: string, options?: SearchOptions): Promise<CatalogItem[]>`
  - `getCatalogHealth(): Promise<CatalogHealthReport>`

- **Caching**: The resolver implements a 5-minute TTL in-memory map cache for improved lookup performance in high-volume areas like bulk imports and dashboard aggregates.

- **Normalization**: Returns the unified `CatalogItem` interface representing data securely aggregated across Master tables and the legacy SKU table (such as `isUnlimited` and `unit`).

#### 2. Replacements in ERP Modules
Legacy direct `prisma.sku.findUnique` and `prisma.sku.findMany` lookups were replaced with resolver methods across 9 modules:
1. `src/app/api/staff/current-stock/sku-insights/route.ts`
2. `src/app/api/admin/inventory/bulk-import/validate/route.ts`
3. `src/app/api/admin/dcr/serial-registry/[serialNumber]/route.ts`
4. `src/app/api/admin/dcr/purchase-dcr-received/route.ts`
5. `src/app/api/admin/dcr/serial-corrections/route.ts`
6. `src/app/api/staff/transfers/route.ts`
7. `src/app/api/staff/transfers/[id]/route.ts`
8. `src/app/admin/page.tsx`

*Note: Mutations (Create, Update, Delete) still interact with the native schema, but read queries are transitioned.*

#### 3. Resolver Health Dashboard
A new "Resolver Health" tab was introduced to the Catalog Maintenance Console (`/admin/catalog-sync`).
Powered by the new `api/admin/catalog-resolver/health/route.ts` endpoint, it provides live diagnostics of the `CatalogResolver` cache and reporting on any mapping gaps between Master Entities and Legacy SKUs.

### Impact
- **Decoupled Business Logic**: Inventory and Sales modules no longer break if schema properties move between Master tables.
- **Improved Performance**: Bulk operations automatically benefit from the resolver's in-memory caching mechanism.
- **Backwards Compatibility**: Maintained existing interfaces without requiring schema migrations or affecting Zoho integration logic.
