/**
 * CatalogSyncService
 *
 * Single source of truth for all Catalog Maintenance Console operations.
 * No business logic lives in API routes.
 *
 * Rules enforced here:
 *  - Every write is inside a Prisma transaction.
 *  - Every write is idempotent (check-before-insert).
 *  - Nothing is deleted automatically.
 *  - No ERP-managed fields are overwritten.
 *  - No Zoho sync logic is touched.
 */

import { prisma } from '@/lib/db';
import { getNextProductCode } from '@/lib/product-service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CatalogHealth {
  totalProducts: number;
  totalFamilies: number;
  standaloneProducts: number;
  totalVariants: number;
  totalSkus: number;
  draftProducts: number;
  pendingApproval: number;
  inactiveProducts: number;
  missingImages: number;
  missingDefaultVariants: number;
  duplicateAttributeSets: number;
  brokenReferences: number;
}

export type ValidationSeverity = 'Error' | 'Warning' | 'Info';

export interface ValidationIssue {
  check: string;
  severity: ValidationSeverity;
  count: number;
  samples: string[]; // IDs or codes of affected records
}

export interface ValidationReport {
  checks: ValidationIssue[];
  totalErrors: number;
  totalWarnings: number;
  totalInfo: number;
  isHealthy: boolean;
}

export interface AnalysisReport {
  skusWithoutVariantMapping: number;
  productsWithoutDefaultVariant: number;
  variantsWithoutSkuMapping: number;
  sampleOrphanSkus: string[];
  sampleMissingVariantProducts: string[];
  sampleOrphanVariants: string[];
}

// Preview row types
export interface ImportPreviewRow {
  skuId: string;
  productName: string;
  brand: string | null;
  category: string | null;
  isActive: boolean;
  action: 'Create' | 'Skip';
}

export interface VariantRepairPreviewRow {
  productId: string;
  productCode: string;
  productName: string;
  currentVariantCount: number;
  hasMissingDefault: boolean;
  proposedAction: string;
}

export interface SkuRepairPreviewRow {
  variantId: string;
  variantSku: string;
  productName: string;
  hasExistingSkuMapping: boolean;
  status: 'OK' | 'Missing';
  proposedAction: string;
}

// Execute result
export interface ExecuteResult {
  action: string;
  dryRun: boolean;
  recordsAnalysed: number;
  recordsCreated: number;
  recordsSkipped: number;
  recordsFailed: number;
  errors: string[];
  durationMs: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class CatalogSyncService {
  // ── 1. Health Dashboard ───────────────────────────────────────────────────

  async getHealth(): Promise<CatalogHealth> {
    const [
      totalProducts,
      totalFamilies,
      totalVariants,
      totalSkus,
      draftProducts,
      pendingApproval,
      inactiveProducts,
      missingImages,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { catalogType: 'PRODUCT_FAMILY' } }),
      prisma.productVariant.count(),
      prisma.sku.count(),
      prisma.product.count({ where: { status: 'Draft' } }),
      prisma.product.count({ where: { status: 'Approval Pending' } }),
      prisma.product.count({ where: { isActive: false } }),
      prisma.product.count({ where: { thumbnailBase64: null } }),
    ]);

    // Products that have no default variant
    const productsWithDefaultVariant = await prisma.productVariant.findMany({
      where: { isDefault: true },
      select: { productId: true },
      distinct: ['productId'],
    });
    const productIdsWithDefault = new Set(productsWithDefaultVariant.map((v) => v.productId));
    const allProductIds = await prisma.product.findMany({ select: { id: true } });
    const missingDefaultVariants = allProductIds.filter((p) => !productIdsWithDefault.has(p.id)).length;

    // Duplicate attribute combinations: ProductVariants sharing same productId + sku prefix pattern
    // We proxy this as variants where multiple share same productId and variantName
    const duplicateGroups = await prisma.productVariant.groupBy({
      by: ['productId', 'variantName'],
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } },
    });
    const duplicateAttributeSets = duplicateGroups.length;

    // Broken references: products referencing non-existent brand/category/taxRate/unit/hsnCode
    const brokenBrands = await prisma.product.count({
      where: { brandId: { not: null }, brand: null },
    });
    const brokenCategories = await prisma.product.count({
      where: { categoryId: { not: null }, category: null },
    });
    const brokenReferences = brokenBrands + brokenCategories;

    return {
      totalProducts,
      totalFamilies,
      standaloneProducts: totalProducts - totalFamilies,
      totalVariants,
      totalSkus,
      draftProducts,
      pendingApproval,
      inactiveProducts,
      missingImages,
      missingDefaultVariants,
      duplicateAttributeSets,
      brokenReferences,
    };
  }

  // ── 2. Analyze Catalog ────────────────────────────────────────────────────

  async analyzeCatalog(): Promise<AnalysisReport> {
    // SKUs whose id does not appear in any ProductVariant.sku
    const allVariantSkus = await prisma.productVariant.findMany({ select: { sku: true } });
    const variantSkuSet = new Set(allVariantSkus.map((v) => v.sku));

    const allSkus = await prisma.sku.findMany({ select: { id: true } });
    const orphanSkus = allSkus.filter((s) => !variantSkuSet.has(s.id));

    // Products with no default variant
    const productsWithDefault = await prisma.productVariant.findMany({
      where: { isDefault: true },
      select: { productId: true },
      distinct: ['productId'],
    });
    const productIdsWithDefault = new Set(productsWithDefault.map((v) => v.productId));
    const allProducts = await prisma.product.findMany({ select: { id: true, code: true } });
    const productsWithoutDefault = allProducts.filter((p) => !productIdsWithDefault.has(p.id));

    // ProductVariants whose sku does not match any Sku.id
    const allSkuIds = new Set(allSkus.map((s) => s.id));
    const allVariants = await prisma.productVariant.findMany({ select: { id: true, sku: true } });
    const orphanVariants = allVariants.filter((v) => !allSkuIds.has(v.sku));

    return {
      skusWithoutVariantMapping: orphanSkus.length,
      productsWithoutDefaultVariant: productsWithoutDefault.length,
      variantsWithoutSkuMapping: orphanVariants.length,
      sampleOrphanSkus: orphanSkus.slice(0, 5).map((s) => s.id),
      sampleMissingVariantProducts: productsWithoutDefault.slice(0, 5).map((p) => p.code),
      sampleOrphanVariants: orphanVariants.slice(0, 5).map((v) => v.sku),
    };
  }

  // ── 3. Validate Catalog ───────────────────────────────────────────────────

  async validateCatalog(): Promise<ValidationReport> {
    const issues: ValidationIssue[] = [];

    // Check 1: Duplicate Product Names
    const dupNames = await prisma.product.groupBy({
      by: ['name'],
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } },
    });
    issues.push({ check: 'Duplicate Product Names', severity: 'Warning', count: dupNames.length, samples: dupNames.slice(0, 3).map((r) => r.name) });

    // Check 2: Duplicate Product Codes
    const dupCodes = await prisma.product.groupBy({
      by: ['code'],
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } },
    });
    issues.push({ check: 'Duplicate Product Codes', severity: 'Error', count: dupCodes.length, samples: dupCodes.slice(0, 3).map((r) => r.code) });

    // Check 3: Duplicate Variant Names inside Family
    const dupVariantNames = await prisma.productVariant.groupBy({
      by: ['productId', 'variantName'],
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } },
    });
    issues.push({ check: 'Duplicate Variant Names inside Family', severity: 'Warning', count: dupVariantNames.length, samples: dupVariantNames.slice(0, 3).map((r) => r.productId) });

    // Check 4: Duplicate Variant Attribute Combinations (same sku in multiple variants)
    const dupVariantSkus = await prisma.productVariant.groupBy({
      by: ['sku'],
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } },
    });
    issues.push({ check: 'Duplicate Variant Attribute Combinations', severity: 'Error', count: dupVariantSkus.length, samples: dupVariantSkus.slice(0, 3).map((r) => r.sku) });

    // Check 5: Duplicate SKU Codes
    const dupSkuCodes = await prisma.sku.groupBy({
      by: ['id'],
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } },
    });
    issues.push({ check: 'Duplicate SKU Codes', severity: 'Error', count: dupSkuCodes.length, samples: dupSkuCodes.slice(0, 3).map((r) => r.id) });

    // Check 6: Duplicate Zoho Item IDs
    const dupZohoVariants = await prisma.productVariant.groupBy({
      by: ['zohoBookItemId'],
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } },
      where: { zohoBookItemId: { not: null } },
    });
    issues.push({ check: 'Duplicate Zoho Item IDs (Variants)', severity: 'Error', count: dupZohoVariants.length, samples: dupZohoVariants.slice(0, 3).map((r) => r.zohoBookItemId ?? '') });

    // Check 7: Missing Category
    const missingCategory = await prisma.product.count({ where: { categoryId: null } });
    issues.push({ check: 'Missing Category', severity: 'Warning', count: missingCategory, samples: [] });

    // Check 8: Missing Brand
    const missingBrand = await prisma.product.count({ where: { brandId: null } });
    issues.push({ check: 'Missing Brand', severity: 'Warning', count: missingBrand, samples: [] });

    // Check 9: Missing Tax Rate
    const missingTax = await prisma.product.count({ where: { taxRateId: null } });
    issues.push({ check: 'Missing Tax Rate', severity: 'Warning', count: missingTax, samples: [] });

    // Check 10: Missing Unit
    const missingUnit = await prisma.product.count({ where: { unitId: null } });
    issues.push({ check: 'Missing Unit', severity: 'Warning', count: missingUnit, samples: [] });

    // Check 11: Missing Default Variant
    const productsWithDefault = await prisma.productVariant.findMany({
      where: { isDefault: true },
      select: { productId: true },
      distinct: ['productId'],
    });
    const productIdsWithDefault = new Set(productsWithDefault.map((v) => v.productId));
    const allProductsForCheck = await prisma.product.findMany({ select: { id: true, code: true } });
    const missingDefaultVariant = allProductsForCheck.filter((p) => !productIdsWithDefault.has(p.id));
    issues.push({
      check: 'Missing Default Variant',
      severity: 'Error',
      count: missingDefaultVariant.length,
      samples: missingDefaultVariant.slice(0, 3).map((p) => p.code),
    });

    // Check 12: Broken Parent Product Reference
    const variantProductsWithParent = await prisma.product.findMany({
      where: { parentProductId: { not: null } },
      select: { id: true, code: true, parentProductId: true },
    });
    const allProductIdSet = new Set(allProductsForCheck.map((p) => p.id));
    const brokenParent = variantProductsWithParent.filter((p) => p.parentProductId && !allProductIdSet.has(p.parentProductId));
    issues.push({ check: 'Broken Parent Product Reference', severity: 'Error', count: brokenParent.length, samples: brokenParent.slice(0, 3).map((p) => p.code) });

    // Check 13: Broken Variant References (variants referencing non-existent product)
    const allProductIdsInDB = new Set((await prisma.product.findMany({ select: { id: true } })).map((p) => p.id));
    const allVariants = await prisma.productVariant.findMany({ select: { id: true, sku: true, productId: true } });
    const brokenVariants = allVariants.filter((v) => !allProductIdsInDB.has(v.productId));
    issues.push({ check: 'Broken Variant References', severity: 'Error', count: brokenVariants.length, samples: brokenVariants.slice(0, 3).map((v) => v.sku) });

    // Check 14: Orphan SKUs (id not in any ProductVariant.sku)
    const variantSkuSet = new Set(allVariants.map((v) => v.sku));
    const allSkus = await prisma.sku.findMany({ select: { id: true } });
    const orphanSkus = allSkus.filter((s) => !variantSkuSet.has(s.id));
    issues.push({ check: 'Orphan SKUs (no variant mapping)', severity: 'Warning', count: orphanSkus.length, samples: orphanSkus.slice(0, 3).map((s) => s.id) });

    // Check 15: Missing Images
    const missingImages = await prisma.product.count({ where: { thumbnailBase64: null } });
    issues.push({ check: 'Missing Product Images', severity: 'Info', count: missingImages, samples: [] });

    // Check 16: Inactive Parent with Active Variants
    const inactiveParents = await prisma.product.findMany({
      where: { isActive: false, variants: { some: { isActive: true } } },
      select: { code: true },
    });
    issues.push({ check: 'Inactive Parent with Active Variants', severity: 'Warning', count: inactiveParents.length, samples: inactiveParents.slice(0, 3).map((p) => p.code) });

    // Check 17: Variants without Families (isVariantProduct=true but no parentProductId)
    const variantsWithoutFamily = await prisma.product.count({
      where: { isVariantProduct: true, parentProductId: null },
    });
    issues.push({ check: 'Variant Products without Parent Family', severity: 'Error', count: variantsWithoutFamily, samples: [] });

    // Check 18: Products without Approval Status
    const noApproval = await prisma.product.count({
      where: { status: 'Draft', approvedAt: null },
    });
    issues.push({ check: 'Products without Approval (Draft, no approvedAt)', severity: 'Info', count: noApproval, samples: [] });

    const totalErrors = issues.filter((i) => i.severity === 'Error').reduce((s, i) => s + i.count, 0);
    const totalWarnings = issues.filter((i) => i.severity === 'Warning').reduce((s, i) => s + i.count, 0);
    const totalInfo = issues.filter((i) => i.severity === 'Info').reduce((s, i) => s + i.count, 0);

    return { checks: issues, totalErrors, totalWarnings, totalInfo, isHealthy: totalErrors === 0 };
  }

  // ── 4. Preview Import ─────────────────────────────────────────────────────

  async previewImport(): Promise<ImportPreviewRow[]> {
    const allVariantSkus = await prisma.productVariant.findMany({ select: { sku: true } });
    const variantSkuSet = new Set(allVariantSkus.map((v) => v.sku));

    const eligibleSkus = await prisma.sku.findMany({
      include: { brand: { select: { name: true } }, category: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return eligibleSkus.map((sku) => ({
      skuId: sku.id,
      productName: sku.name,
      brand: sku.brand?.name ?? null,
      category: sku.category?.name ?? null,
      isActive: sku.isActive,
      action: variantSkuSet.has(sku.id) ? 'Skip' : 'Create',
    }));
  }

  // ── 5. Import Products (Execute) ──────────────────────────────────────────

  async importProducts(userId: string): Promise<ExecuteResult> {
    const startMs = Date.now();
    const allVariantSkus = await prisma.productVariant.findMany({ select: { sku: true } });
    const variantSkuSet = new Set(allVariantSkus.map((v) => v.sku));

    const eligibleSkus = await prisma.sku.findMany({
      where: { id: { notIn: Array.from(variantSkuSet) } },
      orderBy: { createdAt: 'asc' },
    });

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const sku of eligibleSkus) {
      try {
        // Double-check idempotency inside loop (concurrent run guard)
        const existing = await prisma.productVariant.findFirst({ where: { sku: sku.id } });
        if (existing) {
          skipped++;
          continue;
        }

        const productCode = await getNextProductCode();

        await prisma.$transaction(async (tx) => {
          const product = await tx.product.create({
            data: {
              code: productCode,
              name: sku.name,
              description: sku.description,
              brandId: sku.brandId,
              categoryId: sku.categoryId,
              status: 'Active',
              isActive: sku.isActive,
              createdById: userId,
              updatedById: userId,
              approvedById: userId,
              createdAt: sku.createdAt,
              updatedAt: sku.updatedAt,
              approvedAt: new Date(),
              catalogType: 'PRODUCT',
              variants: {
                create: {
                  variantName: 'Default',
                  sku: sku.id,
                  purchasePrice: 0,
                  sellingPrice: sku.price,
                  trackInventory: !sku.isUnlimited,
                  trackSerials: false,
                  isDefault: true,
                  isActive: sku.isActive,
                  zohoBookItemId: sku.zohoBookItemId,
                },
              },
            },
          });

          await tx.masterDataHistory.create({
            data: {
              entityType: 'Product',
              entityId: product.id,
              action: 'CREATED',
              newValue: JSON.stringify({ name: product.name, code: product.code, source: 'CatalogMaintenance' }),
              remarks: 'Imported via Catalog Maintenance Console',
              performedById: userId,
              productId: product.id,
            },
          });
        });

        created++;
      } catch (err: any) {
        failed++;
        errors.push(`SKU ${sku.id}: ${err?.message ?? 'Unknown error'}`);
      }
    }

    return {
      action: 'importProducts',
      dryRun: false,
      recordsAnalysed: eligibleSkus.length,
      recordsCreated: created,
      recordsSkipped: skipped,
      recordsFailed: failed,
      errors: errors.slice(0, 10),
      durationMs: Date.now() - startMs,
    };
  }

  // ── 6. Preview Variant Repair ─────────────────────────────────────────────

  async previewVariantRepair(): Promise<VariantRepairPreviewRow[]> {
    const allProducts = await prisma.product.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        variants: { select: { id: true, isDefault: true } },
      },
    });

    return allProducts
      .filter((p) => !p.variants.some((v) => v.isDefault))
      .map((p) => ({
        productId: p.id,
        productCode: p.code,
        productName: p.name,
        currentVariantCount: p.variants.length,
        hasMissingDefault: true,
        proposedAction: p.variants.length > 0
          ? 'Mark first variant as default'
          : 'Create default variant with sku = product.code + V1',
      }));
  }

  // ── 7. Repair Variants (Execute) ──────────────────────────────────────────

  async repairVariants(userId: string): Promise<ExecuteResult> {
    const startMs = Date.now();
    const preview = await this.previewVariantRepair();

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of preview) {
      try {
        // Re-check idempotency
        const existingDefault = await prisma.productVariant.findFirst({
          where: { productId: row.productId, isDefault: true },
        });
        if (existingDefault) {
          skipped++;
          continue;
        }

        const existingVariant = await prisma.productVariant.findFirst({
          where: { productId: row.productId },
          orderBy: { createdAt: 'asc' },
        });

        await prisma.$transaction(async (tx) => {
          if (existingVariant) {
            // Mark the first existing variant as default
            await tx.productVariant.update({
              where: { id: existingVariant.id },
              data: { isDefault: true },
            });
          } else {
            // Create a new default variant
            await tx.productVariant.create({
              data: {
                productId: row.productId,
                variantName: 'Default',
                sku: `${row.productCode}V1`,
                purchasePrice: 0,
                sellingPrice: 0,
                trackInventory: true,
                isDefault: true,
                isActive: true,
              },
            });
          }
        });

        created++;
      } catch (err: any) {
        failed++;
        errors.push(`Product ${row.productCode}: ${err?.message ?? 'Unknown error'}`);
      }
    }

    return {
      action: 'repairVariants',
      dryRun: false,
      recordsAnalysed: preview.length,
      recordsCreated: created,
      recordsSkipped: skipped,
      recordsFailed: failed,
      errors: errors.slice(0, 10),
      durationMs: Date.now() - startMs,
    };
  }

  // ── 8. Preview SKU Repair ─────────────────────────────────────────────────

  async previewSkuRepair(): Promise<SkuRepairPreviewRow[]> {
    const allSkuIds = new Set((await prisma.sku.findMany({ select: { id: true } })).map((s) => s.id));

    const variants = await prisma.productVariant.findMany({
      select: {
        id: true,
        sku: true,
        product: { select: { name: true, code: true } },
      },
    });

    return variants.map((v) => {
      const hasMapping = allSkuIds.has(v.sku);
      return {
        variantId: v.id,
        variantSku: v.sku,
        productName: v.product.name,
        hasExistingSkuMapping: hasMapping,
        status: hasMapping ? 'OK' : 'Missing',
        proposedAction: hasMapping ? 'No action needed' : 'Preview only — create Sku manually or via import',
      };
    });
  }

  // ── 9. Repair SKU Mappings (Preview-only in Phase 1) ─────────────────────
  //
  // Phase 1 restriction: this is intentionally read-only.
  // Creating a Sku row requires fields (name, price, gstPercent) that cannot
  // be reliably inferred from a ProductVariant alone without admin input.
  // The preview identifies orphaned variants so the admin can handle them manually.

  async repairSkuMappings(_userId: string): Promise<ExecuteResult> {
    const startMs = Date.now();
    const preview = await this.previewSkuRepair();
    const orphans = preview.filter((r) => r.status === 'Missing');

    return {
      action: 'repairSkuMappings',
      dryRun: true, // intentionally read-only in Phase 1
      recordsAnalysed: preview.length,
      recordsCreated: 0,
      recordsSkipped: orphans.length,
      recordsFailed: 0,
      errors: orphans.length > 0
        ? [`${orphans.length} orphaned variant(s) identified. Use Import Products to create matching Sku entries.`]
        : [],
      durationMs: Date.now() - startMs,
    };
  }
}

export const catalogSyncService = new CatalogSyncService();
