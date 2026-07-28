# Variant Readiness Report

## 1. Current Readiness Score: **Low (2/10)**
The existing system is entirely single-dimensional. The database and application logic assume every catalog entry is an independent `Sku`. There is currently no concept of grouping similar SKUs together under a master product.

## 2. Missing Capabilities
- **Product Grouping**: No parent `Product` model exists to logically bind variants together.
- **Attribute System**: No generic tables (`ProductAttribute`, `ProductAttributeValue`) to define what makes a variant unique (e.g., Size, Color, Wattage).
- **Variant-Specific Media**: No `ProductImage` or media management. All identification relies on external Zoho links or text descriptions.
- **Price History & Tiering**: Pricing is a single flat `price` column on `Sku`, making historical tracking or complex pricing difficult without overriding the single value.

## 3. Migration Difficulty: **High**
To migrate from the current flattened architecture to a `Product -> Variant` architecture:
1. **Schema Surgery**: We have to create the new `Product` table and modify `Sku` (which becomes `ProductVariant`) to point to it.
2. **Data Deduplication**: A complex migration script must run to group existing `Sku` records that have identical names/brands into a single parent `Product` record.
3. **Application Rewrite**: Every API route and frontend component that currently fetches `Sku` and displays the product name will need to be updated to join the `Product` relation.

## 4. Risk Assessment
- **Inventory Discrepancies**: If inventory relations (`WarehouseInventory`) are not carefully migrated, it could lead to lost stock data.
- **Zoho Sync Breakage**: The `zohoBookItemId` is currently linked directly to `Sku`. If Zoho is the source of truth, the sync logic must be rewritten to handle the concept of Variants natively or group Zoho items logically.
- **DCR & Order Breaking Changes**: Carts, Transfers, and Invoices all rely on `Sku`. Ensuring smooth deployment without downtime will require a phased, dual-write approach rather than a single large PR.
