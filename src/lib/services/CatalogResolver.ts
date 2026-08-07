import { prisma } from '@/lib/db';
import type { Prisma, Product, ProductVariant, Sku, Brand, Category } from '@prisma/client';

export interface CatalogItem {
  id: string | null;           // Alias for legacySku
  name: string | null;         // Alias for displayName
  price: number;               // Alias for sellingPrice
  productId: string | null;
  variantId: string | null;
  legacySku: string | null; // Sku.id
  displayName: string | null;
  productName: string | null;
  variantName: string | null;
  barcode: string | null;
  zohoItemId: string | null;
  zohoItemId2: string | null; // from Sku.zohoBooksId2
  category: string | null;
  categoryId: string | null;
  brand: string | null;
  brandId: string | null;
  status: string | null;
  isActive: boolean;
  trackInventory: boolean;
  trackSerials: boolean;
  isUnlimited: boolean; // from legacy sku
  unit: string | null;
  purchasePrice: number;
  sellingPrice: number;
  thumbnailBase64: string | null;
}

export interface SearchOptions {
  query?: string;
  categoryId?: string;
  brandId?: string;
  includeInactive?: boolean;
  onlyInventory?: boolean;
  onlySellable?: boolean;
  onlyPurchasable?: boolean;
  limit?: number;
}

export interface CatalogHealthReport {
  totalProducts: number;
  totalVariants: number;
  totalSkus: number;
  healthScore: number;
  issues: {
    duplicateSkus: { count: number; samples: string[] };
    duplicateZohoIds: { count: number; samples: string[] };
    duplicateBarcodes: { count: number; samples: string[] };
    productsWithoutVariant: { count: number; samples: string[] };
    variantsWithoutProduct: { count: number; samples: string[] };
    orphanSkus: { count: number; samples: string[] };
    orphanVariants: { count: number; samples: string[] };
    inactiveDefaultVariant: { count: number; samples: string[] };
    missingDefaultVariant: { count: number; samples: string[] };
    duplicateAttributes: { count: number; samples: string[] };
    brokenSkuMapping: { count: number; samples: string[] };
    missingZohoMapping: { count: number; samples: string[] };
  };
}

// In-Memory Cache
interface CacheEntry {
  value: any;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 2000;
const cache = new Map<string, CacheEntry>();

export class CatalogResolver {
  // --- CACHE MANAGEMENT ---
  private static getCache<T>(key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  private static setCache(key: string, value: any): void {
    if (cache.size >= MAX_CACHE_SIZE) {
      // Lightweight eviction: delete the first (oldest inserted) element
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    
    cache.set(key, {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  static invalidateCache(skuId?: string): void {
    if (!skuId) {
      cache.clear();
      return;
    }
    for (const key of cache.keys()) {
      if (key.includes(skuId)) {
        cache.delete(key);
      }
    }
  }

  // --- NORMALIZATION ---
  private static normalizeToCatalogItem(
    product: (Product & { brand?: Brand | null; category?: Category | null }) | null,
    variant: ProductVariant | null,
    sku: (Sku & { brand?: Brand | null; category?: Category | null }) | null
  ): CatalogItem {
    const pName = product?.name || sku?.name || null;
    const vName = variant?.variantName || null;
    
    let displayName = pName;
    if (vName && vName !== 'Default' && displayName) {
      displayName = `${displayName} — ${vName}`;
    }

    const legacySkuId = sku?.id || variant?.sku || null;
    const sellingPrice = variant?.sellingPrice ?? sku?.price ?? 0;

    return {
      id: legacySkuId,
      name: displayName,
      price: sellingPrice,
      productId: product?.id || null,
      variantId: variant?.id || null,
      legacySku: legacySkuId,
      displayName,
      productName: pName,
      variantName: vName,
      barcode: sku?.id || variant?.sku || null, // Using sku as barcode for now
      zohoItemId: variant?.zohoBookItemId || sku?.zohoBookItemId || null,
      zohoItemId2: sku?.zohoBooksId2 || null,
      category: product?.category?.name || sku?.category?.name || null,
      categoryId: product?.categoryId || sku?.categoryId || null,
      brand: product?.brand?.name || sku?.brand?.name || null,
      brandId: product?.brandId || sku?.brandId || null,
      status: product?.status || null,
      isActive: product?.isActive ?? sku?.isActive ?? variant?.isActive ?? false,
      trackInventory: variant?.trackInventory ?? (sku ? !sku.isUnlimited : true),
      trackSerials: variant?.trackSerials ?? false,
      isUnlimited: sku?.isUnlimited ?? false,
      unit: sku?.unit || null,
      purchasePrice: variant?.purchasePrice ?? 0,
      sellingPrice,
      thumbnailBase64: product?.thumbnailBase64 || null,
    };
  }

  // --- LOOKUP METHODS ---

  static async findBySku(skuId: string): Promise<CatalogItem | null> {
    if (!skuId) return null;
    const cacheKey = `findBySku:${skuId}`;
    const cached = this.getCache<CatalogItem | null>(cacheKey);
    if (cached !== null) return cached;

    const [sku, variant] = await Promise.all([
      prisma.sku.findUnique({
        where: { id: skuId },
        include: { brand: true, category: true },
      }),
      prisma.productVariant.findUnique({
        where: { sku: skuId },
        include: {
          product: {
            include: { brand: true, category: true },
          },
        },
      }),
    ]);

    if (!sku && !variant) {
      this.setCache(cacheKey, null);
      return null;
    }

    const result = this.normalizeToCatalogItem(variant?.product || null, variant, sku);
    this.setCache(cacheKey, result);
    return result;
  }

  static async findManyBySku(skuIds: string[]): Promise<Map<string, CatalogItem>> {
    const uniqueIds = Array.from(new Set(skuIds.filter(Boolean)));
    const resultMap = new Map<string, CatalogItem>();
    const missingIds: string[] = [];

    // Check cache
    for (const id of uniqueIds) {
      const cached = this.getCache<CatalogItem | null>(`findBySku:${id}`);
      if (cached) {
        resultMap.set(id, cached);
      } else {
        missingIds.push(id);
      }
    }

    if (missingIds.length === 0) return resultMap;

    const [skus, variants] = await Promise.all([
      prisma.sku.findMany({
        where: { id: { in: missingIds } },
        include: { brand: true, category: true },
      }),
      prisma.productVariant.findMany({
        where: { sku: { in: missingIds } },
        include: { product: { include: { brand: true, category: true } } },
      }),
    ]);

    const skuMap = new Map(skus.map((s) => [s.id, s]));
    const variantMap = new Map(variants.map((v) => [v.sku, v]));

    for (const id of missingIds) {
      const sku = skuMap.get(id) || null;
      const variant = variantMap.get(id) || null;
      
      if (sku || variant) {
        const item = this.normalizeToCatalogItem(variant?.product || null, variant, sku);
        resultMap.set(id, item);
        this.setCache(`findBySku:${id}`, item);
      } else {
        this.setCache(`findBySku:${id}`, null); // Cache misses too
      }
    }

    return resultMap;
  }

  static async findByVariantId(variantId: string): Promise<CatalogItem | null> {
    const cacheKey = `findByVariantId:${variantId}`;
    const cached = this.getCache<CatalogItem | null>(cacheKey);
    if (cached !== null) return cached;

    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: {
          include: { brand: true, category: true },
        },
      },
    });

    if (!variant) {
      this.setCache(cacheKey, null);
      return null;
    }

    const sku = await prisma.sku.findUnique({
      where: { id: variant.sku },
      include: { brand: true, category: true },
    });

    const result = this.normalizeToCatalogItem(variant.product, variant, sku);
    this.setCache(cacheKey, result);
    return result;
  }

  static async findByProductId(productId: string): Promise<CatalogItem[]> {
    const cacheKey = `findByProductId:${productId}`;
    const cached = this.getCache<CatalogItem[]>(cacheKey);
    if (cached !== null) return cached;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        brand: true,
        category: true,
        variants: true,
      },
    });

    if (!product) {
      this.setCache(cacheKey, []);
      return [];
    }

    const skus = await prisma.sku.findMany({
      where: {
        id: { in: product.variants.map((v) => v.sku) },
      },
      include: { brand: true, category: true },
    });

    const skuMap = new Map(skus.map((s) => [s.id, s]));

    const result = product.variants.map((variant) =>
      this.normalizeToCatalogItem(product, variant, skuMap.get(variant.sku) || null)
    );
    this.setCache(cacheKey, result);
    return result;
  }

  static async findByZohoItemId(zohoId: string): Promise<CatalogItem | null> {
    const cacheKey = `findByZohoItemId:${zohoId}`;
    const cached = this.getCache<CatalogItem | null>(cacheKey);
    if (cached !== null) return cached;

    // 1. Try resolving via Variant first
    const variant = await prisma.productVariant.findUnique({
      where: { zohoBookItemId: zohoId },
      include: {
        product: { include: { brand: true, category: true } },
      },
    });

    if (variant) {
      const sku = await prisma.sku.findUnique({
        where: { id: variant.sku },
        include: { brand: true, category: true },
      });
      const result = this.normalizeToCatalogItem(variant.product, variant, sku);
      this.setCache(cacheKey, result);
      return result;
    }

    // 2. Try resolving via Legacy Sku
    const sku = await prisma.sku.findFirst({
      where: {
        OR: [
          { zohoBooksId2: zohoId },
          { zohoBookItemId: zohoId }
        ]
      },
      include: { brand: true, category: true },
    });

    if (sku) {
      const variantFromSku = await prisma.productVariant.findUnique({
        where: { sku: sku.id },
        include: { product: { include: { brand: true, category: true } } },
      });
      const result = this.normalizeToCatalogItem(variantFromSku?.product || null, variantFromSku, sku);
      this.setCache(cacheKey, result);
      return result;
    }

    this.setCache(cacheKey, null);
    return null;
  }

  static async findByLegacySku(skuId: string): Promise<CatalogItem | null> {
    return this.findBySku(skuId);
  }

  static async findByBarcode(barcode: string): Promise<CatalogItem | null> {
    return this.resolveBarcode(barcode);
  }

  static async resolveBarcode(barcode: string): Promise<CatalogItem | null> {
    if (!barcode) return null;
    const cacheKey = `resolveBarcode:${barcode}`;
    const cached = this.getCache<CatalogItem | null>(cacheKey);
    if (cached !== null) return cached;

    // 1. Try ProductVariant.sku (which acts as barcode)
    // 2. Try Sku.id (same thing conceptually right now)
    const bySku = await this.findBySku(barcode);
    if (bySku) {
      this.setCache(cacheKey, bySku);
      return bySku;
    }

    // 3. Try ProductVariant.zohoBookItemId
    const variantByZoho = await prisma.productVariant.findUnique({
      where: { zohoBookItemId: barcode },
    });
    if (variantByZoho) {
      const result = await this.findByVariantId(variantByZoho.id);
      this.setCache(cacheKey, result);
      return result;
    }

    this.setCache(cacheKey, null);
    return null;
  }

  static async resolve(idOrQuery: string): Promise<CatalogItem | null> {
    if (!idOrQuery) return null;
    if (idOrQuery.startsWith('cl') || idOrQuery.length >= 25) { // CUID
      const variant = await this.findByVariantId(idOrQuery);
      if (variant) return variant;
    }
    
    const bySku = await this.findBySku(idOrQuery);
    if (bySku) return bySku;

    const product = await prisma.product.findUnique({
      where: { code: idOrQuery }
    });
    
    if (product) {
      const variants = await this.findByProductId(product.id);
      if (variants.length > 0) return variants[0]; // Return default/first variant
    }

    return null;
  }

  static async search(opts: SearchOptions): Promise<CatalogItem[]> {
    const limit = opts.limit || 50;
    
    const where: Prisma.ProductVariantWhereInput = {};
    const productWhere: Prisma.ProductWhereInput = {};

    let hasProductWhere = false;

    if (opts.query) {
      const q = opts.query.trim();
      where.OR = [
        { sku: { contains: q, mode: 'insensitive' } },
        { variantName: { contains: q, mode: 'insensitive' } },
        { zohoBookItemId: { equals: q } },
        { product: { code: { contains: q, mode: 'insensitive' } } },
        { product: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    if (opts.categoryId) {
      productWhere.categoryId = opts.categoryId;
      hasProductWhere = true;
    }

    if (opts.brandId) {
      productWhere.brandId = opts.brandId;
      hasProductWhere = true;
    }

    if (!opts.includeInactive) {
      where.isActive = true;
      productWhere.isActive = true;
      hasProductWhere = true;
    }

    if (opts.onlyInventory) {
      where.trackInventory = true;
    }

    if (opts.onlySellable || opts.onlyPurchasable) {
      productWhere.status = 'Active';
      hasProductWhere = true;
    }

    if (hasProductWhere) {
      where.product = productWhere;
    }

    const variants = await prisma.productVariant.findMany({
      where,
      take: limit,
      include: {
        product: {
          include: { brand: true, category: true }
        }
      }
    });

    const skuIds = variants.map(v => v.sku);
    const skus = await prisma.sku.findMany({
      where: { id: { in: skuIds } },
      include: { brand: true, category: true }
    });
    const skuMap = new Map(skus.map(s => [s.id, s]));

    return variants.map(v => this.normalizeToCatalogItem(v.product, v, skuMap.get(v.sku) || null));
  }

  static async getAllItems(): Promise<CatalogItem[]> {
    return this.search({ limit: 100000 });
  }

  static async getFamily(productId: string): Promise<CatalogItem[]> {
    return this.findByProductId(productId);
  }

  static async getVariants(productId: string): Promise<CatalogItem[]> {
    return this.findByProductId(productId);
  }

  static async getDefaultVariant(productId: string): Promise<CatalogItem | null> {
    const cacheKey = `getDefaultVariant:${productId}`;
    const cached = this.getCache<CatalogItem | null>(cacheKey);
    if (cached !== null) return cached;

    const variant = await prisma.productVariant.findFirst({
      where: { productId, isDefault: true },
    });

    if (!variant) {
      this.setCache(cacheKey, null);
      return null;
    }

    const result = await this.findByVariantId(variant.id);
    this.setCache(cacheKey, result);
    return result;
  }

  // --- DIAGNOSTICS ---
  static async getCatalogHealth(): Promise<CatalogHealthReport> {
    const [totalProducts, totalVariants, totalSkus] = await Promise.all([
      prisma.product.count(),
      prisma.productVariant.count(),
      prisma.sku.count(),
    ]);

    // Issues
    const dupSkus = await prisma.sku.groupBy({
      by: ['id'], _count: { id: true }, having: { id: { _count: { gt: 1 } } }
    });
    
    const dupZohoIds = await prisma.productVariant.groupBy({
      by: ['zohoBookItemId'], _count: { id: true }, having: { id: { _count: { gt: 1 } } }, where: { zohoBookItemId: { not: null } }
    });

    // Barcodes technically map to variants.sku in MVP
    const dupBarcodes = await prisma.productVariant.groupBy({
      by: ['sku'], _count: { id: true }, having: { id: { _count: { gt: 1 } } }
    });

    const productsWithoutDefault = await prisma.$queryRaw<any[]>`
      SELECT p.id, p.code FROM "Product" p 
      LEFT JOIN "ProductVariant" v ON p.id = v."productId" AND v."isDefault" = true
      WHERE v.id IS NULL
    `;

    const variantsWithoutProduct = await prisma.$queryRaw<any[]>`
      SELECT v.id, v.sku FROM "ProductVariant" v
      LEFT JOIN "Product" p ON v."productId" = p.id
      WHERE p.id IS NULL
    `;

    const orphanSkus = await prisma.sku.findMany({
      where: {
        AND: [
          { isActive: true },
          { id: { notIn: (await prisma.productVariant.findMany({ select: { sku: true } })).map(v => v.sku) } }
        ]
      },
      select: { id: true }
    });

    const orphanVariants: any[] = [];

    const productsMissingDefault = await prisma.product.findMany({
      where: {
        variants: { none: { isDefault: true } }
      },
      select: { code: true }
    });

    const brokenSkuMapping = await prisma.productVariant.findMany({
      where: {
        sku: { notIn: (await prisma.sku.findMany({ select: { id: true } })).map(s => s.id) }
      },
      select: { sku: true }
    });

    const missingZohoMapping = await prisma.productVariant.findMany({
      where: {
        OR: [
          { zohoBookItemId: null },
          { zohoBookItemId: '' }
        ]
      },
      select: { sku: true }
    });

    const duplicateAttributes = await prisma.productVariant.groupBy({
      by: ['productId', 'variantName'],
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } }
    });
    
    const missingZohoCount = await prisma.productVariant.count({
      where: { zohoBookItemId: null }
    });

    return {
      totalProducts,
      totalVariants,
      totalSkus,
      healthScore: 100, // naive for now
      issues: {
        duplicateSkus: { count: dupSkus.length, samples: dupSkus.slice(0, 5).map(x => x.id) },
        duplicateZohoIds: { count: dupZohoIds.length, samples: dupZohoIds.slice(0, 5).map(x => x.zohoBookItemId!) },
        duplicateBarcodes: { count: dupBarcodes.length, samples: dupBarcodes.slice(0, 5).map(x => x.sku) },
        productsWithoutVariant: { count: productsWithoutDefault.length, samples: productsWithoutDefault.slice(0, 5).map(x => x.code) },
        variantsWithoutProduct: { count: variantsWithoutProduct.length, samples: variantsWithoutProduct.slice(0, 5).map(x => x.sku) },
        orphanSkus: { count: orphanSkus.length, samples: orphanSkus.slice(0, 5).map(x => x.id) },
        orphanVariants: { count: orphanVariants.length, samples: orphanVariants.slice(0, 5).map(x => x.sku) },
        inactiveDefaultVariant: { count: 0, samples: [] },
        missingDefaultVariant: { count: productsMissingDefault.length, samples: productsMissingDefault.slice(0, 5).map(x => x.code) },
        duplicateAttributes: { count: duplicateAttributes.length, samples: duplicateAttributes.slice(0, 5).map(x => `${x.productId}-${x.variantName}`) },
        brokenSkuMapping: { count: brokenSkuMapping.length, samples: brokenSkuMapping.slice(0, 5).map(x => x.sku) },
        missingZohoMapping: { count: missingZohoMapping.length, samples: missingZohoMapping.slice(0, 5).map(x => x.sku) },
      }
    };
  }
}
