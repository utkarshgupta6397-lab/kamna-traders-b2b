# Product Dependency Map

## 1. Overview
The current system treats `Sku` as the core catalog model. As a result, references to `Sku` are deeply embedded across the entire stack, from API routes to UI pages and database relationships.

## 2. Database Dependencies (Prisma Schema)
Every module referencing `Sku`:
- **Inventory Management**: `WarehouseInventory`, `InventoryHistory`
- **Sales & Orders**: `CartItem`, `CartHistory`
- **Supply Chain**: `TransferItem` (Warehouse Transfers)
- **Serial Tracking**: `DcrSerial`, `DcrSerialAllocation` (Daily Call Report / Invoices)
- **Integrations**: `SkuIdentityRegistry`, `SkuSyncLog` (Zoho Books Sync)

## 3. Codebase Dependencies

### High-Impact API Routes
The following endpoints directly assume `Sku` is the root entity:
- `/api/admin/skus/route.ts` & `/export/route.ts` (Catalog management)
- `/api/admin/sku-sync/run/route.ts` (Zoho integration)
- `/api/staff/carts/[id]/route.ts` & `/api/staff/cart/route.ts` (Order creation)
- `/api/staff/unlimited-skus/route.ts` (Inventory bypassing logic)

### High-Impact UI Pages & Components
- `/app/admin/skus/page.tsx` (Admin catalog listing)
- `/app/admin/sku-sync/page.tsx` (Sync management)
- `/app/staff/dashboard/operations/current-stock/page.tsx` (Inventory views)
- `/app/staff/dashboard/accounts/dcr/*` (Various serial allocation and DCR queues deeply tied to SKU logic)

### Background Services & Cron Jobs
- `/api/cron/sku-sync/route.ts` (Background polling of Zoho items)

## 4. Architectural Assumptions
The biggest risk in the codebase is the **assumption that a salable item is completely flat**.
Modules assume they only need to fetch `Sku` to display the product name, brand, category, and price in a single query.
Introducing a `Product -> Variant` split will require these modules to fetch the parent `Product` relation to get the name, brand, and category, and query the `Variant` for the price, stock, and SKU code.

## 5. Impact Level
**Extremely High**. Moving to a Variant-based architecture will require migrating over 30 API endpoints and updating the fundamental data fetching patterns on nearly every operations and catalog page in the system.
