import { DcrEligibilityService } from './DcrEligibilityService';

export class LegacyProductNormalizer {
  /**
   * Normalizes legacy products, providing safe defaults for missing metadata.
   */
  static normalizeProduct(product: any, warehouseId?: string, inventoryMap?: Map<string, any[]>) {
    // Legacy products might be missing type; default to 'Goods' if inventory tracked
    const hasInventoryTrackedVariant = product.variants?.some((v: any) => v.trackInventory);
    const type = product.type || (hasInventoryTrackedVariant ? 'Goods' : 'Goods');
    
    return {
      ...product,
      type
    };
  }

  /**
   * Maps a Product and its variants to the legacy flat SKU structure expected by existing UI components.
   */
  static mapToLegacySkuStructure(product: any, variant: any, inventoryMap?: Map<string, any[]>, warehouseId?: string, skuMap?: Map<string, any>) {
    const skuInventory = inventoryMap ? (inventoryMap.get(variant.sku) || []) : [];
    
    const targetInv = warehouseId ? skuInventory.find(inv => inv.warehouseId === warehouseId) : null;
    const inventoryQty = targetInv ? targetInv.qty : skuInventory.reduce((s, inv) => s + inv.qty, 0);
    const isUnlimited = !variant.trackInventory;

    const isOos = isUnlimited 
      ? false 
      : targetInv
        ? targetInv.isOos || targetInv.qty <= 0
        : skuInventory.length > 0 
          ? skuInventory.some(inv => inv.isOos) || inventoryQty <= 0
          : false;

    // Build the warehouse dictionary for matrix components (like Current Stock)
    const inventoryDict: Record<string, { qty: number, isOos: boolean }> = {};
    skuInventory.forEach(inv => {
      inventoryDict[inv.warehouseId] = {
        qty: inv.qty,
        isOos: inv.isOos
      };
    });

    return {
      // Legacy SKU mapping
      id: variant.sku, // variant.sku was traditionally used as the SKU id in UI lookups
      name: product.name,
      brand: product.brand?.name ?? null,
      brandId: product.brandId ?? null,
      unit: product.unit?.name ?? null,
      unitShort: product.unit?.abbreviation || product.unit?.code || null,
      moq: skuMap?.get(variant.sku)?.moq ?? 1,
      stepQty: skuMap?.get(variant.sku)?.stepQty ?? 1,
      price: variant.sellingPrice || 0,
      caseSize: skuMap?.get(variant.sku)?.caseSize ?? 1,
      categoryId: product.categoryId,
      categoryName: product.category?.name ?? null,
      inventoryQty,
      isOos,
      isUnlimited,
      isActive: product.isActive && variant.isActive,
      zohoBooksId2: variant.zohoBookItemId || null,

      // New properties requested in response contract
      sku: variant.sku,
      code: product.code,
      trackInventory: variant.trackInventory,
      trackSerialNumbers: variant.trackSerials,
      status: product.status,
      image: product.thumbnailBase64 || null,
      isOutOfStock: isOos,

      // UI matrix compatibility
      inventory: inventoryDict,
      isDcrEligible: DcrEligibilityService.evaluateProduct(product),
      wattage: product.attributeValues?.find((av: any) => av.attribute?.attributeName === 'Wattage')?.value ?? null,
      parentProductId: product.parentProductId ?? null,
      parentProductName: product.parentProduct?.name ?? null,
      
      // Wire & Cable attributes
      wireWidth: (product.attributeValues || []).find((av: any) => ['wire width (sqmm)', 'wire width', 'width (sqmm)'].includes(av.attribute?.attributeName?.toLowerCase().trim()))?.value ?? null,
      wireColor: (product.attributeValues || []).find((av: any) => ['wire color', 'color'].includes(av.attribute?.attributeName?.toLowerCase().trim()))?.value ?? null,
      bundleLength: (product.attributeValues || []).find((av: any) => ['bundle length', 'bundle size', 'length'].includes(av.attribute?.attributeName?.toLowerCase().trim()))?.value ?? null,
    };
  }
}
