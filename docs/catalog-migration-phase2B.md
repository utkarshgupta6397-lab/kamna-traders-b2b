# Catalog Architecture Phase 2B: Product as Master, SKU as Integration Layer

## Objective
This phase pivots the migration strategy from a "hard database migration" to a "Master Data architecture". The `Product` and `ProductVariant` entities become the absolute source of truth for the entire catalog. The legacy `Sku` table is repurposed as an automatically synchronized integration layer. This ensures Inventory, Sales, Purchase, DCR, and Zoho modules continue working natively without any breaking changes to their tables or queries.

## Architecture & Responsibilities

The `CatalogSyncEngine` (`src/lib/services/catalog-sync-engine.ts`) is the single entity responsible for maintaining this architecture.

### 1. Data Ownership
- **ERP Owns (Master Data)**: Product Name, Description, Brand, Category, Images, Attributes, Family, Variants, Approval Status, Pricing.
- **Zoho Owns (Integration Data)**: Zoho Item ID, Sync Timestamp, External Metadata, Sync Status, Legacy SKU mappings.

### 2. Primary Synchronization Direction: Product → SKU
Whenever a Product or Variant is modified (or during a manual trigger from the Catalog Sync UI), the engine automatically pushes updates to the `Sku` table.
- If a SKU doesn't exist for a variant, it is created.
- If a SKU exists, its ERP-owned fields are updated to perfectly mirror the Product catalog.
- Conflict detection actively prevents creating duplicate Zoho IDs.

### 3. Secondary Synchronization Direction: SKU → Product
When Zoho updates a SKU (via Webhook or API sync), the data must be merged safely into the Product Variant.
- Only approved synchronization fields (e.g. `zohoBookItemId`, active status) are copied from the SKU to the Variant.
- The sync engine will **never** overwrite ERP-owned fields like the product name or pricing with data coming back from the SKU.
- If a legacy SKU lacks a corresponding Product Variant entirely, a minimal Product stub is automatically generated.

## UI / Admin Experience
The **Catalog Maintenance Console** (`/admin/catalog-sync`) acts as the command center for these sync operations.
- **Preview First**: Every sync operation enforces a strict Preview → Review → Execute workflow to prevent unexpected writes.
- **Health Dashboard**: Visualizes the live sync state across the catalog, exposing orphaned records or duplicate mappings before they cause integration errors.

## Success Criteria & Future Outlook
- The transition allows all future feature development to consume `Product` and `ProductVariant` without worrying about the legacy system.
- Legacy modules will naturally be refactored to consume the Master Data over time, gradually obsoleting the `Sku` integration layer. No forced refactoring or schema migrations are required to unblock progress today.
