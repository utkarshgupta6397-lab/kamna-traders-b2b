import { prisma } from '@/lib/db';

export interface CatalogRelationshipReport {
  totalProducts: number;
  totalVariants: number;
  totalSkus: number;
  mappedVariants: number;
  unmappedVariants: number;
  mappedSkus: number;
  unmappedSkus: number;
  brokenRelationships: {
    missingVariant: number;
    missingSku: number;
    duplicateVariantMapping: number;
    variantWithoutProduct: number;
    skuWithoutVariant: number;
    brokenZohoMapping: number;
    duplicateZohoIds: number;
  };
}

export class CatalogValidator {
  /**
   * Verifies the Product -> Variant -> Sku relationships.
   */
  static async getRelationshipReport(): Promise<CatalogRelationshipReport> {
    const [totalProducts, totalVariants, totalSkus] = await Promise.all([
      prisma.product.count(),
      prisma.productVariant.count(),
      prisma.sku.count(),
    ]);

    // Variants mapped to Skus
    // Since ProductVariant.sku is unique, we check how many Sku.id exist for those ProductVariant.sku
    const variants = await prisma.productVariant.findMany({ select: { sku: true, productId: true, zohoBookItemId: true } });
    const skus = await prisma.sku.findMany({ select: { id: true, zohoBookItemId: true, zohoBooksId2: true } });
    const products = await prisma.product.findMany({ select: { id: true } });

    const skuIdSet = new Set(skus.map((s) => s.id));
    const variantSkuSet = new Set(variants.map((v) => v.sku));
    const productIdSet = new Set(products.map((p) => p.id));

    let mappedVariants = 0;
    let unmappedVariants = 0;
    let variantWithoutProduct = 0;
    let duplicateZohoIds = 0;
    let brokenZohoMapping = 0;

    const variantZohoIdSet = new Set<string>();

    for (const v of variants) {
      if (skuIdSet.has(v.sku)) {
        mappedVariants++;
      } else {
        unmappedVariants++;
      }

      if (!productIdSet.has(v.productId)) {
        variantWithoutProduct++;
      }

      if (v.zohoBookItemId) {
        if (variantZohoIdSet.has(v.zohoBookItemId)) {
          duplicateZohoIds++;
        }
        variantZohoIdSet.add(v.zohoBookItemId);
      }
    }

    let mappedSkus = 0;
    let unmappedSkus = 0; // Same as skuWithoutVariant
    const skuZohoIdSet = new Set<string>();

    for (const s of skus) {
      if (variantSkuSet.has(s.id)) {
        mappedSkus++;
      } else {
        unmappedSkus++;
      }

      const zohoId = s.zohoBooksId2 || s.zohoBookItemId;
      if (zohoId) {
        if (skuZohoIdSet.has(zohoId)) {
          duplicateZohoIds++;
        }
        skuZohoIdSet.add(zohoId);
      }
    }

    // Check duplicate variant mapping: Multiple variants pointing to same SKU
    // Schema enforced ProductVariant.sku as @unique, so this is 0 at DB level.
    const duplicateVariantMapping = 0;

    // Check broken Zoho Mapping: When Variant Zoho ID doesn't match SKU Zoho ID
    // or when one has it and the other doesn't but should.
    for (const v of variants) {
      if (skuIdSet.has(v.sku)) {
        const matchingSku = skus.find(s => s.id === v.sku);
        if (matchingSku) {
          const skuZohoId = matchingSku.zohoBooksId2 || matchingSku.zohoBookItemId;
          if (v.zohoBookItemId && skuZohoId && v.zohoBookItemId !== skuZohoId) {
            brokenZohoMapping++;
          }
        }
      }
    }

    return {
      totalProducts,
      totalVariants,
      totalSkus,
      mappedVariants,
      unmappedVariants,
      mappedSkus,
      unmappedSkus,
      brokenRelationships: {
        missingVariant: unmappedSkus,
        missingSku: unmappedVariants,
        duplicateVariantMapping,
        variantWithoutProduct,
        skuWithoutVariant: unmappedSkus,
        brokenZohoMapping,
        duplicateZohoIds,
      }
    };
  }
}
