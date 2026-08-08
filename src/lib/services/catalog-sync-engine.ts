import { prisma } from '@/lib/db';
import { getNextProductCode } from '@/lib/product-service';

export interface SyncPreviewRow {
  id: string;
  title: string;
  variantName?: string;
  sku?: string;
  zohoId?: string | null;
  action: 'Create' | 'Update' | 'Skip' | 'Error' | 'Conflict';
  details: string;
  suggestedAction?: string;
}

export interface SyncResult {
  recordsAnalysed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsFailed: number;
  errors: string[];
  durationMs: number;
  rows?: SyncPreviewRow[];
}

export class CatalogSyncEngine {
  
  // ─── Product -> SKU Synchronization ───────────────────────────────────────

  static async previewProductToSku(): Promise<SyncResult> {
    return this.runProductToSku(true);
  }

  static async executeProductToSku(): Promise<SyncResult> {
    return this.runProductToSku(false);
  }

  private static async runProductToSku(dryRun: boolean): Promise<SyncResult> {
    const start = Date.now();
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsSkipped = 0;
    let recordsFailed = 0;
    const errors: string[] = [];
    const rows: SyncPreviewRow[] = [];

    const variants = await prisma.productVariant.findMany({
      include: {
        product: true
      }
    });

    const skus = await prisma.sku.findMany();
    const skuMap = new Map(skus.map(s => [s.id, s]));
    
    // Check for duplicate Zoho IDs across all SKUs to avoid conflicts
    const zohoIdToSkuId = new Map<string, string>();
    for (const sku of skus) {
      const zId = sku.zohoBookItemId || sku.zohoBooksId2;
      if (zId) {
        zohoIdToSkuId.set(zId, sku.id);
      }
    }

    for (const variant of variants) {
      const product = variant.product;
      const skuId = variant.sku;
      const existingSku = skuMap.get(skuId);

      // Desired values mapped from Product/Variant
      const desiredName = variant.variantName === 'Default' ? product.name : `${product.name} - ${variant.variantName}`;
      const desiredBrandId = product.brandId;
      const desiredCategoryId = product.categoryId;
      const desiredPrice = variant.sellingPrice;
      const desiredIsActive = product.isActive && variant.isActive;
      const desiredZohoId = variant.zohoBookItemId;

      const rowInfo = {
        id: variant.id,
        title: product.name,
        variantName: variant.variantName,
        sku: skuId,
        zohoId: desiredZohoId
      };

      if (!existingSku) {
        // CREATE SKU
        // Conflict detection: Zoho ID duplicate
        if (desiredZohoId && zohoIdToSkuId.has(desiredZohoId) && zohoIdToSkuId.get(desiredZohoId) !== skuId) {
          rows.push({
            ...rowInfo,
            action: 'Conflict',
            details: `Zoho ID ${desiredZohoId} is already claimed by SKU ${zohoIdToSkuId.get(desiredZohoId)}`,
            suggestedAction: 'Resolve Zoho ID conflict manually before syncing'
          });
          recordsFailed++;
          errors.push(`Variant ${variant.id} has duplicate Zoho ID ${desiredZohoId}`);
          continue;
        }

        rows.push({ ...rowInfo, action: 'Create', details: `Create SKU ${skuId}` });
        if (!dryRun) {
          try {
            await prisma.sku.create({
              data: {
                id: skuId,
                name: desiredName,
                description: product.description,
                brandId: desiredBrandId,
                categoryId: desiredCategoryId,
                price: desiredPrice,
                isActive: desiredIsActive,
                zohoBookItemId: desiredZohoId,
                // defaults
                moq: 1,
                stepQty: 1,
                caseSize: 1,
              }
            });
            recordsCreated++;
          } catch (e: any) {
            rows[rows.length - 1].action = 'Error';
            rows[rows.length - 1].details = `Failed: ${e.message}`;
            recordsFailed++;
            errors.push(`Failed to create SKU ${skuId}: ${e.message}`);
          }
        } else {
          recordsCreated++;
        }
      } else {
        // UPDATE SKU
        const needsUpdate = 
          existingSku.name !== desiredName ||
          existingSku.brandId !== desiredBrandId ||
          existingSku.categoryId !== desiredCategoryId ||
          existingSku.price !== desiredPrice ||
          existingSku.isActive !== desiredIsActive ||
          (desiredZohoId && existingSku.zohoBookItemId !== desiredZohoId && existingSku.zohoBooksId2 !== desiredZohoId);

        if (needsUpdate) {
          // Conflict detection: Zoho ID duplicate
          if (desiredZohoId && zohoIdToSkuId.has(desiredZohoId) && zohoIdToSkuId.get(desiredZohoId) !== skuId) {
            rows.push({
              ...rowInfo,
              action: 'Conflict',
              details: `Zoho ID ${desiredZohoId} is already claimed by SKU ${zohoIdToSkuId.get(desiredZohoId)}`,
              suggestedAction: 'Resolve Zoho ID conflict manually before syncing'
            });
            recordsFailed++;
            errors.push(`Variant ${variant.id} has duplicate Zoho ID ${desiredZohoId}`);
            continue;
          }

          rows.push({ ...rowInfo, action: 'Update', details: `Update existing SKU ${skuId}` });
          if (!dryRun) {
            try {
              await prisma.sku.update({
                where: { id: skuId },
                data: {
                  name: desiredName,
                  description: product.description,
                  brandId: desiredBrandId,
                  categoryId: desiredCategoryId,
                  price: desiredPrice,
                  isActive: desiredIsActive,
                  zohoBookItemId: desiredZohoId || existingSku.zohoBookItemId
                }
              });
              recordsUpdated++;
            } catch (e: any) {
              rows[rows.length - 1].action = 'Error';
              rows[rows.length - 1].details = `Failed: ${e.message}`;
              recordsFailed++;
              errors.push(`Failed to update SKU ${skuId}: ${e.message}`);
            }
          } else {
            recordsUpdated++;
          }
        } else {
          rows.push({ ...rowInfo, action: 'Skip', details: `SKU ${skuId} is up to date` });
          recordsSkipped++;
        }
      }
    }

    return {
      recordsAnalysed: variants.length,
      recordsCreated,
      recordsUpdated,
      recordsSkipped,
      recordsFailed,
      errors,
      durationMs: Date.now() - start,
      rows: dryRun ? rows : undefined
    };
  }

  // ─── SKU -> Product Synchronization ───────────────────────────────────────

  static async previewSkuToProduct(): Promise<SyncResult> {
    return this.runSkuToProduct(true);
  }

  static async executeSkuToProduct(): Promise<SyncResult> {
    return this.runSkuToProduct(false);
  }

  private static async runSkuToProduct(dryRun: boolean): Promise<SyncResult> {
    const start = Date.now();
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsSkipped = 0;
    let recordsFailed = 0;
    const errors: string[] = [];
    const rows: SyncPreviewRow[] = [];

    const skus = await prisma.sku.findMany();
    const variants = await prisma.productVariant.findMany({ include: { product: true } });
    const variantMap = new Map(variants.map(v => [v.sku, v]));
    const variantZohoMap = new Map(variants.filter(v => v.zohoBookItemId).map(v => [v.zohoBookItemId, v.sku]));

    for (const sku of skus) {
      const variant = variantMap.get(sku.id);
      
      const skuZohoId = sku.zohoBookItemId || sku.zohoBooksId2;

      const rowInfo = {
        id: sku.id,
        title: variant?.product?.name || sku.name,
        variantName: variant?.variantName,
        sku: sku.id,
        zohoId: skuZohoId
      };

      if (!variant) {
        // SKU exists, Product missing -> Offer Product creation
        // Conflict detection: Zoho ID duplicate
        if (skuZohoId && variantZohoMap.has(skuZohoId) && variantZohoMap.get(skuZohoId) !== sku.id) {
          rows.push({
            ...rowInfo,
            action: 'Conflict',
            details: `Zoho ID ${skuZohoId} is already claimed by Variant with SKU ${variantZohoMap.get(skuZohoId)}`,
            suggestedAction: 'Resolve Zoho ID conflict manually before syncing'
          });
          recordsFailed++;
          errors.push(`SKU ${sku.id} has Zoho ID ${skuZohoId} claimed by another Variant`);
          continue;
        }

        rows.push({ ...rowInfo, action: 'Create', details: `Create missing Product & Variant for legacy SKU` });
        if (!dryRun) {
          try {
            await prisma.$transaction(async (tx) => {
              const pCode = await getNextProductCode();
              const p = await tx.product.create({
                data: {
                  code: pCode,
                  name: sku.name,
                  description: sku.description || `Auto-migrated from legacy SKU ${sku.id}`,
                  brandId: sku.brandId,
                  categoryId: sku.categoryId,
                  isActive: sku.isActive,
                  status: sku.isActive ? 'Active' : 'Draft'
                }
              });
              await tx.productVariant.create({
                data: {
                  productId: p.id,
                  sku: sku.id,
                  variantName: 'Default',
                  purchasePrice: sku.price,
                  sellingPrice: sku.price,
                  isActive: sku.isActive,
                  zohoBookItemId: skuZohoId
                }
              });
            });
            recordsCreated++;
          } catch (e: any) {
            rows[rows.length - 1].action = 'Error';
            rows[rows.length - 1].details = `Failed: ${e.message}`;
            recordsFailed++;
            errors.push(`Failed to create Product for SKU ${sku.id}: ${e.message}`);
          }
        } else {
          recordsCreated++;
        }
      } else {
        // Variant exists -> Update only Zoho-owned or approved sync fields
        // NEVER overwrite ERP-owned fields (Name, Brand, Category, Price)
        
        let needsUpdate = false;
        const updates: any = {};
        
        if (skuZohoId && variant.zohoBookItemId !== skuZohoId) {
          // Conflict detection before update
          if (variantZohoMap.has(skuZohoId) && variantZohoMap.get(skuZohoId) !== variant.sku) {
            rows.push({
              ...rowInfo,
              action: 'Conflict',
              details: `Zoho ID ${skuZohoId} is already claimed by Variant with SKU ${variantZohoMap.get(skuZohoId)}`,
              suggestedAction: 'Resolve Zoho ID conflict manually before syncing'
            });
            recordsFailed++;
            errors.push(`SKU ${sku.id} has Zoho ID ${skuZohoId} claimed by another Variant`);
            continue;
          }
          needsUpdate = true;
          updates.zohoBookItemId = skuZohoId;
        }

        // Active status sync (from Zoho to ERP if configured, but let's be careful. 
        // Prompt says "Active status" is an approved sync field from Zoho.)
        if (sku.isActive !== variant.isActive) {
          needsUpdate = true;
          updates.isActive = sku.isActive;
        }

        if (needsUpdate) {
          rows.push({ ...rowInfo, action: 'Update', details: `Sync Zoho metadata to Variant ${variant.id}` });
          if (!dryRun) {
            try {
              await prisma.productVariant.update({
                where: { id: variant.id },
                data: updates
              });
              // We also might want to update the Product isActive if it's the default variant, but we keep it simple.
              recordsUpdated++;
            } catch (e: any) {
              rows[rows.length - 1].action = 'Error';
              rows[rows.length - 1].details = `Failed: ${e.message}`;
              recordsFailed++;
              errors.push(`Failed to update Variant ${variant.id}: ${e.message}`);
            }
          } else {
            recordsUpdated++;
          }
        } else {
          rows.push({ ...rowInfo, action: 'Skip', details: `Variant is already synchronized` });
          recordsSkipped++;
        }
      }
    }

    return {
      recordsAnalysed: skus.length,
      recordsCreated,
      recordsUpdated,
      recordsSkipped,
      recordsFailed,
      errors,
      durationMs: Date.now() - start,
      rows: dryRun ? rows : undefined
    };
  }
}
