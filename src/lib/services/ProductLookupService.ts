import { ProductRepository } from '../repositories/ProductRepository';
import { LegacyProductNormalizer } from './LegacyProductNormalizer';
import { Prisma } from '@prisma/client';

export type ProductSearchPurpose = 
  | 'inventory'
  | 'sales'
  | 'purchase'
  | 'warehouse'
  | 'dcr'
  | 'product-master'
  | 'autocomplete';

export interface ProductSearchOptions {
  warehouseId?: string;
  query?: string;
  skuIds?: string[];
  includeArchived?: boolean;
  includeInactive?: boolean;
}

export class ProductLookupService {
  /**
   * Centralized product search implementing purpose-based filtering rules.
   */
  static async search(purpose: ProductSearchPurpose, options: ProductSearchOptions = {}) {
    const where: Prisma.ProductWhereInput = {};

    // Base rules per purpose
    switch (purpose) {
      case 'inventory':
      case 'warehouse':
        where.status = 'Active';
        where.catalogType = { not: 'PRODUCT_FAMILY' };
        where.variants = { some: { trackInventory: true, isActive: true } };
        break;
      case 'dcr':
        where.status = 'Active';
        where.variants = { some: { trackInventory: true, trackSerials: true, isActive: true } };
        break;
      case 'sales':
      case 'purchase':
      case 'autocomplete':
        where.status = 'Active';
        break;
      case 'product-master':
        // Product master can see draft, approval_pending, etc. 
        // Only filters on query.
        break;
    }

    // Explicit overrides
    if (!options.includeInactive) {
      where.isActive = true;
    }
    
    // Status overrides for product-master (if they don't want archived)
    if (!options.includeArchived && purpose === 'product-master') {
      where.status = { not: 'Archived' };
    }

    if (options.skuIds && options.skuIds.length > 0) {
      where.variants = {
        ...where.variants,
        some: {
          ...where.variants?.some,
          sku: { in: options.skuIds }
        }
      };
    }

    // Text search matching
    if (options.query) {
      const q = options.query.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { variants: { some: { sku: { contains: q, mode: 'insensitive' } } } }
      ];
    }

    // Execute optimal database query
    const rawProducts = await ProductRepository.searchProducts(where);

    // Extract all unique SKUs from variants for bulk inventory fetching
    const skuIds = rawProducts.flatMap(p => p.variants.map(v => v.sku));
    
    // Fetch inventory in a single query
    const inventoryList = await ProductRepository.getInventoryForSkus(skuIds, options.warehouseId);
    
    // Map inventory by SKU
    const inventoryMap = new Map<string, any[]>();
    inventoryList.forEach(inv => {
      const existing = inventoryMap.get(inv.skuId) || [];
      existing.push(inv);
      inventoryMap.set(inv.skuId, existing);
    });

    // Normalize and Map response
    const results: any[] = [];

    rawProducts.forEach(prod => {
      const normalized = LegacyProductNormalizer.normalizeProduct(prod, options.warehouseId, inventoryMap);
      
      // Each variant is treated as an individual selectable item in legacy workflows
      prod.variants.forEach(variant => {
        // Enforce variant-level rules if needed (e.g. inventory tracked for inventory purpose)
        if (purpose === 'inventory' || purpose === 'warehouse' || purpose === 'dcr') {
          if (!variant.trackInventory) return;
        }
        if (purpose === 'dcr' && !variant.trackSerials) return;
        if (!options.includeInactive && !variant.isActive) return;

        results.push(
          LegacyProductNormalizer.mapToLegacySkuStructure(normalized, variant, inventoryMap, options.warehouseId)
        );
      });
    });

    return results;
  }
}
