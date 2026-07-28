# MVP Recommendation

## 1. Minimum Schema Needed (Phase 1)
To achieve a basic Product and Variant system, we must split the `Sku` model into two distinct Prisma models.

```prisma
model Product {
  id          String   @id @default(cuid())
  name        String
  description String?
  categoryId  String?
  brandId     String?
  hsnCode     String?
  gstPercent  Float    @default(0.0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  variants    ProductVariant[]
  category    Category?        @relation(fields: [categoryId], references: [id])
  brand       Brand?           @relation(fields: [brandId], references: [id])
}

model ProductVariant {
  id             String   @id @default(cuid()) // Can keep the existing Sku IDs for data continuity
  productId      String
  sku            String   @unique // Previously the Sku name/id
  price          Float    @default(0.0)
  unit           String?
  moq            Int      @default(1)
  stepQty        Int      @default(1)
  caseSize       Int      @default(1)
  zohoBookItemId String?  @unique
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  product        Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  // Keep all existing Sku relations here (CartItem, TransferItem, WarehouseInventory, etc.)
}
```

## 2. Fields to Keep
- Keep all foreign key relations (`CartItem`, `TransferItem`, `WarehouseInventory`, `DcrSerial`) pointing to `ProductVariant` (formerly `Sku`).
- Keep Zoho sync metadata (`zohoBookItemId`) on the Variant.

## 3. Fields to Move
- `name`, `description`, `categoryId`, `brandId`, `hsnCode`, `gstPercent` must be moved from the old `Sku` table to the new `Product` table.

## 4. Fields to Remove
- The old `Sku` model concept should be completely replaced by `ProductVariant`. Any fields that track redundant data or deprecated flags should be removed during the migration.

## 5. Implementation Sequence (No Implementation Required Now)
1. **Schema Update**: Define `Product` and rename `Sku` to `ProductVariant` in `schema.prisma`.
2. **Database Migration Scripts**: Write raw SQL to create the `Product` table and populate it by grouping distinct `ProductVariant` (formerly Sku) records.
3. **API & UI Refactoring**: Update all code currently importing `Sku` to import `ProductVariant` and adjust `include` statements to fetch the nested `Product` relationship for display names.
4. **Zoho Sync Update**: Update the sync job to create both a `Product` and `ProductVariant` when a new item is detected in Zoho.
