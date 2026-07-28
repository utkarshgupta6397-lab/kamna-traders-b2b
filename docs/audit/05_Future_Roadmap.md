# Future Roadmap

## 1. Phase 1 (MVP)
**Goal:** Split the catalog logic without breaking current operations.
- Introduce `Product` and `ProductVariant` tables.
- Migrate `Sku` data.
- Refactor existing APIs and pages to support the new schema.
- Update Zoho Sync to populate both tables accurately.

## 2. Phase 2 (Enhancement)
**Goal:** Introduce true variant capabilities.
- **Attribute System:** Create `ProductAttribute` (e.g., Color, Capacity) and `ProductAttributeValue`.
- **Media Support:** Create `ProductImage` to allow shared images for products and specific images for variants.
- **Frontend Upgrades:** Update the catalog and admin dashboard to display products and let users select variants visually.

## 3. Phase 3 (Advanced Ecosystem)
**Goal:** Advanced inventory and pricing management.
- **Price History:** Introduce a `PriceBook` or `PriceHistory` table for time-based pricing.
- **Bundles / BOM:** Add support for Bill of Materials (grouping variants into kits).
- **Supplier Catalog:** Integrate multi-vendor purchasing natively against specific variants.
- **Advanced Serialization:** Transition `DcrSerial` to a generic `SerialNumber` module that tracks lifecycle across Purchases, Transfers, and Sales, independent of the DCR invoice scope.

## 4. Technical Debt to Address
- **Hardcoded References**: Many scripts and internal utilities reference `Sku` fields directly. These will need comprehensive auditing.
- **Cart & Transfer Complexity**: Updating `CartItem`, `TransferItem`, and `WarehouseInventory` will require large migrations, risking downtime if not handled properly.
- **Zoho Tight Coupling**: The system currently heavily relies on `zohoBookItemId` acting as the master switch. Decoupling this logic to handle internal items seamlessly will be critical.

## 5. Scalability Considerations
- **Indexing**: We will need composite indexes on `ProductVariant` for fast lookups by `productId` and `isActive`.
- **Large Table Scans**: Avoid loading all variants when only master product information is required.
- **Pagination**: Implement cursor-based pagination for Product endpoints once variants multiply the total number of catalog rows.
