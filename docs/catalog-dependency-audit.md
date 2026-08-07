# Product Catalog Architecture Migration - Phase 1 Audit

## 1. Current Architecture

The Kamna B2B ERP is currently in a transitional state between two master data architectures:
*   **Legacy Architecture**: Centered around a flat `Sku` model where every item is independent. This model currently drives all operational modules (Inventory, Sales, Purchase, Warehouse).
*   **New Architecture**: A hierarchical `Product` -> `ProductVariant` model designed to support complex catalog features (families, attributes). This is currently only used in the Catalog Management console.

The goal of this migration is to switch all operational modules to use `ProductVariant` as the primary entity and source of truth, eventually deprecating the operational use of the `Sku` model.

## 2. Dependency Graph & 3. Modules Using SKU

| Module | Purpose | Reads SKU? | Writes SKU? | Uses Product/Variant? |
| :--- | :--- | :--- | :--- | :--- |
| **Catalog Mgt** | Manage products and attributes | NO | NO | YES |
| **Catalog Sync**| Bridging/migrating data | YES | YES | YES |
| **Inventory** | Manage stock levels | YES | YES | NO |
| **Warehouse** | Manage inter-branch transfers | YES | YES | NO |
| **Sales (POS)** | Create carts and dispatch | YES | NO | NO |
| **Purchase (DCR)**| Receive stock and track serials | YES | YES | NO |
| **Reporting** | Alerts and inventory history | YES | NO | NO |
| **Zoho Sync** | Sync with Zoho Books | YES | YES | NO |
| **Frontend UI** | Store state for POS / Search | YES | NO | NO |

## 4. Modules Already Using Product (Category A)

*   **Catalog Management / Master Data**: The Prisma schema defines `Product`, `ProductVariant`, `ProductAttribute`, `ProductAttributeCategory`, and `ProductAttributeValue`. API routes under `api/staff/catalog` fully utilize these models for CRUD operations.

## 5. Modules with Mixed Usage (Category B)

*   **ProductLookupService (`src/lib/services/ProductLookupService.ts`)**: This is the primary bridge. It reads from the new `Product` / `ProductVariant` tables but normalizes the output into the flat legacy `Sku` structure for downstream consumption by UI components and POS.
*   **Catalog Sync (`catalog-sync.service.ts`)**: Reads legacy `Sku` records to generate and map new `Product` and `ProductVariant` records.

## 6. Modules using Legacy SKU (Category C) - Blockers & Dependencies

These modules are the highest priority for migration as they tightly couple operational logic to the `Sku` table.

### Inventory & Warehouse Blockers
*   `WarehouseInventory.skuId` (Foreign Key -> Sku.id)
*   `TransferItem.skuId' (Foreign Key -> Sku.id)
*   `InventoryHistory.skuId` (String reference, indexed)
*   `StockAlertThreshold.skuId` (Foreign Key -> Sku.id)

### Sales (Cart) Blockers
*   `CartItem.skuId` (Foreign Key -> Sku.id)
*   `useCartStore` (Frontend state expects `skuId`)

### Purchase (DCR) Blockers
*   `DcrInvoiceItem.sku` (String reference)
*   `DcrSerialAllocation.skuId` (Foreign Key -> DcrInvoiceItem.id, but semantically linked to SKU)
*   `DcrSerial.skuId` (String reference, heavily relied upon in logic)

### Zoho Sync Blockers
*   `SkuIdentityRegistry.skuId` (Unique constraint)
*   `Cart.zohoPayload` generation (`syncDispatchToZoho`) relies on `sku.zohoBooksId2`.
*   Incoming Zoho webhook scripts map directly to `Sku`.

## 7. Migration Target Mapping

For the migration, the following schema references must be updated:

| Current Field | Target Field |
| :--- | :--- |
| `WarehouseInventory.skuId` | `WarehouseInventory.productVariantId` |
| `TransferItem.skuId` | `TransferItem.productVariantId` |
| `InventoryHistory.skuId` | `InventoryHistory.productVariantId` |
| `StockAlertThreshold.skuId` | `StockAlertThreshold.productVariantId` |
| `CartItem.skuId` | `CartItem.productVariantId` |
| `DcrSerial.skuId` | `DcrSerial.productVariantId` |
| `DcrInvoiceItem.sku` | `DcrInvoiceItem.productVariantId` |

## 8. Compatibility Requirements (DO NOT REMOVE)

To ensure uninterrupted Zoho synchronization during and after the migration, the following fields must be preserved, at least as legacy identifiers:

*   **`ProductVariant.sku`**: Must continue storing the legacy string ID (e.g., "R0NQ7L1V") as it maps directly to external systems.
*   **`ProductVariant.zohoBookItemId`**: Exists in schema and must become the primary sync key.
*   **`SkuIdentityRegistry.skuId`**: May need to remain pointing to the string SKU code rather than the new CUID of the Variant, to avoid breaking existing webhook mappings until Zoho sync is fully refactored.

## 9. Migration Difficulty & Risk Assessment

| Module | Difficulty | Risk | Explanation |
| :--- | :--- | :--- | :--- |
| **Inventory** | Medium | High | Pure FK changes, but highly concurrent. Affects stock validation in every other module. |
| **Warehouse** | Medium | Medium | Standard CRUD and FK updates for transfers. |
| **Sales (POS)** | High | Very High | Deeply integrated with `useCartStore` and `useSkuStore` frontend state. Affects real-time billing and dispatch sync to Zoho. |
| **Purchase (DCR)** | Very High | Very High | Complex serial tracking, validation, and hold-queue logic. String matching on `skuId` is prevalent in API routes (e.g., `pending-serials`). |
| **Zoho Sync** | High | High | Requires safely shifting the sync target from `Sku` to `ProductVariant` without duplicating records or losing history. |

## 10. Recommended Migration Roadmap

To minimize risk and isolate breaking changes, the migration should be executed in a bottom-up sequence:

*   **Phase 2: Inventory & Warehouse (Data Layer)**
    *   Migrate `WarehouseInventory`, `TransferItem`, `StockAlertThreshold`, and `InventoryHistory`.
    *   Update backend logic (e.g., `admin/actions.ts`, `api/staff/transfers`) to query and update via `productVariantId`.
*   **Phase 3: Sales (Cart & POS)**
    *   Migrate `CartItem`.
    *   Refactor `ProductLookupService` to output variant IDs.
    *   Update `useCartStore` and `useSkuStore` on the frontend.
    *   Update `syncDispatchToZoho` to pull `zohoBookItemId` from `ProductVariant`.
*   **Phase 4: Purchase (DCR & Serials)**
    *   Migrate `DcrInvoiceItem`, `DcrSerialAllocation`, and `DcrSerial`.
    *   Rewrite serial matching logic in `purchase-receive` and `pending-serials` APIs.
*   **Phase 5: Zoho Synchronization**
    *   Point `sku-sync.ts` directly to `ProductVariant`.
    *   Migrate or deprecate `SkuIdentityRegistry`.
*   **Phase 6: Cleanup**
    *   Drop `Sku` table and associated legacy endpoints.

## 11. Estimated Effort

*   **Phase 2 (Inventory)**: 1-2 Days
*   **Phase 3 (Sales)**: 2-3 Days (Frontend heavy)
*   **Phase 4 (Purchase/DCR)**: 3-4 Days (Complex logic)
*   **Phase 5 (Zoho)**: 1-2 Days
*   **Total Estimated Effort**: 7-11 Working Days

## 12. Unsafe Operations to Avoid

*   **Do not drop the `Sku` table early.** It must coexist with `ProductVariant` until Phase 6.
*   **Do not change the string value of existing SKU codes.** They are hardcoded in physical labels and external Zoho systems. The `ProductVariant.sku` field must inherit the exact string from `Sku.id`.
*   **Do not modify `syncDispatchToZoho` until Cart is migrated.** Modifying payload generation early will break live billing.
