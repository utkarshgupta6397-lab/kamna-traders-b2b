# Product Model Audit

## 1. Current Schema Analysis

The current database architecture uses a flattened `Sku` model to represent both the high-level Product and its individual salable Variant.

**Core "Product/Variant" Model (currently `Sku`)**:
- Holds both master product data (`name`, `description`, `brandId`, `categoryId`) and transactional/variant data (`moq`, `stepQty`, `price`, `unit`).
- Uses a `String` (presumably CUID or UUID) for the Primary Key.
- Has Foreign Keys to `Brand`, `Category`, and `User` (for updates).

**Inventory & Warehousing**:
- `WarehouseInventory` maps `Sku` directly to a `Warehouse`.
- `InventoryHistory` tracks changes per `Sku`.

**Serial Numbers**:
- `DcrSerial` tracks individual item serials mapping to an `skuId`.
- Serial logic is closely tied to DCR workflows rather than a generic serial tracking module.

## 2. Strengths
- **Simplicity**: Extremely easy to query for the frontend. No JOINs required to fetch an item's price and its name.
- **Performance**: Flattened data means faster reads for stock listing and catalog views.
- **Direct Integration**: The model maps 1:1 with Zoho Books items (`zohoBookItemId`), which is often how accounting software views inventory items.

## 3. Weaknesses
- **No Variant Support**: Cannot represent a product with multiple variations (e.g., a Solar Panel in 300W and 400W) without creating two completely disconnected `Sku` entries that duplicate the brand, category, and description.
- **Data Duplication**: Updating a product's description requires updating every single `Sku` that logically belongs to it.
- **No Attribute System**: There is no dynamic way to handle specifications (color, wattage, size) other than appending them to the name string.

## 4. Unused & Deprecated Fields
- `printZonalSlips` in the `Warehouse` model is explicitly marked as deprecated.
- Some audit tracking fields (`updatedById` in `Sku`) appear specialized (`SkuUnlimitedUpdatedBy`), which might be better served by a unified audit log.

## 5. Recommended Field Ownership (Target Architecture)

### Move to `Product` Model
- `name` (Base product name)
- `description`
- `brandId`
- `categoryId`
- `hsnCode`
- `gstPercent` (Usually standard across variants of the same product)

### Keep on `Variant` (or new `ProductVariant`) Model
- `sku` (The actual stock keeping unit code)
- `price`
- `unit`
- `moq`
- `stepQty`
- `caseSize`
- `zohoBookItemId` (Each variant is a distinct item in Zoho)
- `isActive`
- `isUnlimited`
