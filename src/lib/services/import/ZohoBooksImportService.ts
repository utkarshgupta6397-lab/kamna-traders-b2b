import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';
import { prisma } from '@/lib/db';
import { createProductWithDefaultVariant } from '@/lib/product-service';

export class ZohoBooksImportService {
  private static getApiBaseUrl() {
    return process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';
  }

  static async searchItems(field: string, term: string) {
    const accessToken = await getZohoTokens();
    if (!accessToken) throw new Error('Zoho Books not connected');

    const orgId = getZohoOrgId();
    let queryParams = new URLSearchParams();
    queryParams.append('organization_id', orgId);
    queryParams.append('status', 'active');
    
    if (field === 'SKU') {
      queryParams.append('sku_contains', term);
    } else if (field === 'NAME') {
      queryParams.append('name_contains', term);
    }

    if (field === 'ZOHO_ID') {
      const res = await fetch(`${this.getApiBaseUrl()}/books/v3/items/${term}?organization_id=${orgId}`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.item && data.item.status === 'active') {
          return [this.mapZohoSearchItem(data.item)];
        }
      }
      return [];
    } else {
      const res = await fetch(`${this.getApiBaseUrl()}/books/v3/items?${queryParams.toString()}`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
      });
      if (!res.ok) throw new Error('Failed to search Zoho Books');
      const data = await res.json();
      return (data.items || []).map(this.mapZohoSearchItem);
    }
  }

  private static mapZohoSearchItem(item: any) {
    return {
      remoteId: item.item_id,
      name: item.name,
      sku: item.sku || '-',
      price: item.rate,
      status: item.status,
      imageUrl: item.image_document_id ? `${process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in'}/books/v3/items/${item.item_id}/image?organization_id=${getZohoOrgId()}` : undefined
    };
  }

  static async previewItem(remoteId: string) {
    const accessToken = await getZohoTokens();
    if (!accessToken) throw new Error('Zoho Books not connected');

    const orgId = getZohoOrgId();
    const res = await fetch(`${this.getApiBaseUrl()}/books/v3/items/${remoteId}?organization_id=${orgId}`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
    });

    if (!res.ok) throw new Error('Failed to fetch Zoho Books item');
    const data = await res.json();
    const item = data.item;

    // Map to ERP schema
    const productData = {
      name: item.name,
      code: item.sku,
      description: item.description,
      type: item.item_type === 'inventory' || item.item_type === 'sales_and_purchases' ? 'Goods' : 'Service',
      purchasePrice: item.purchase_rate,
      sellingPrice: item.rate,
      zohoItemName: item.name,
      unit: item.unit,
      brand: item.brand,
      manufacturer: item.manufacturer,
      category: item.category_name,
      hsnCode: item.hsn_or_sac,
      taxPercentage: item.tax_percentage,
    };

    // Duplicate Checks
    let duplicateOf = null;
    
    // 1. By Zoho ID
    const byZohoId = await prisma.productVariant.findUnique({
      where: { zohoBookItemId: remoteId },
      include: { product: true }
    });
    if (byZohoId) {
      duplicateOf = { type: 'ZOHO_ID', productId: byZohoId.productId, sku: byZohoId.sku, zohoBookItemId: remoteId };
    } else {
      // 2. By SKU
      if (item.sku) {
        const bySku = await prisma.productVariant.findFirst({
          where: { sku: item.sku },
          include: { product: true }
        });
        if (bySku) {
          duplicateOf = { type: 'SKU', productId: bySku.productId, sku: bySku.sku, zohoBookItemId: bySku.zohoBookItemId };
        }
      }
      
      // 3. By Name (case-insensitive)
      if (!duplicateOf) {
        const byName = await prisma.product.findFirst({
          where: { name: { equals: item.name, mode: 'insensitive' } },
          include: { variants: true }
        });
        if (byName) {
          duplicateOf = { type: 'NAME', productId: byName.id, sku: byName.code, zohoBookItemId: byName.variants?.[0]?.zohoBookItemId };
        }
      }
    }

    return { product: productData, duplicateOf, rawZohoItem: item };
  }

  static async importItem(remoteId: string, userId: string): Promise<any> {
    console.log('[1] Request received for importItem', { remoteId, userId });

    let preview;
    try {
      console.log('[2] Fetching item from Zoho and checking preview/duplicates');
      preview = await this.previewItem(remoteId);
      console.log('[3] Zoho item fetched successfully');
    } catch (err: any) {
      return { success: false, step: 'Fetching item from Zoho', error: err.message, stack: err.stack };
    }

    if (preview.duplicateOf) {
      console.log('[4] Duplicate check failed. Duplicate exists:', preview.duplicateOf);
      return { 
        success: false, 
        status: 409, 
        step: 'Duplicate Check', 
        error: `Product already exists as ${preview.duplicateOf.sku}`,
        duplicateOf: preview.duplicateOf
      };
    }
    console.log('[4] Duplicate check passed');

    const { product, rawZohoItem } = preview;

    let categoryId = undefined;
    let brandId = undefined;
    let manufacturerId = undefined;
    let unitId = undefined;
    let hsnCodeId = undefined;
    let taxRateId = undefined;

    try {
      console.log('[5] Mapping ERP fields (Relations)');
      if (product.category) {
        const cat = await prisma.category.findFirst({ where: { name: { equals: product.category, mode: 'insensitive' } } });
        if (cat) categoryId = cat.id;
      }
      if (product.brand) {
        const brand = await prisma.brand.findFirst({ where: { name: { equals: product.brand, mode: 'insensitive' } } });
        if (brand) brandId = brand.id;
      }
      if (product.manufacturer) {
        const mfr = await prisma.manufacturer.findFirst({ where: { name: { equals: product.manufacturer, mode: 'insensitive' } } });
        if (mfr) manufacturerId = mfr.id;
      }
      if (product.unit) {
        const unit = await prisma.unitOfMeasurement.findFirst({ where: { OR: [{ name: { equals: product.unit, mode: 'insensitive' } }, { abbreviation: { equals: product.unit, mode: 'insensitive' } }] } });
        if (unit) unitId = unit.id;
      }
      if (product.hsnCode) {
        const hsn = await prisma.hsnCode.findFirst({ where: { code: product.hsnCode } });
        if (hsn) hsnCodeId = hsn.id;
      }
      if (product.taxPercentage !== undefined && product.taxPercentage !== null) {
        const tax = await prisma.taxRate.findFirst({ where: { percentage: product.taxPercentage, status: 'Active' } });
        if (tax) taxRateId = tax.id;
      }
      console.log('[6] ERP fields mapped successfully');
    } catch (err: any) {
      return { success: false, step: 'Mapping ERP fields', error: err.message, stack: err.stack };
    }

    const finalMappedObject = {
      name: product.name,
      code: product.code, // SKU
      description: product.description,
      type: product.type,
      categoryId,
      brandId,
      manufacturerId,
      unitId,
      hsnCodeId,
      taxRateId,
      purchasePrice: product.purchasePrice || 0,
      sellingPrice: product.sellingPrice || 0,
      trackInventory: rawZohoItem.inventory_account_id ? true : false,
      userId,
      status: 'Active',
      zohoItemName: product.zohoItemName,
      zohoBookItemId: remoteId
    };

    console.log('[7] Final mapped object prepared:', JSON.stringify(finalMappedObject, null, 2));

    try {
      console.log('[8] Starting Prisma Transaction');
      const result = await prisma.$transaction(async (tx) => {
        let createdProduct;
        try {
          console.log('[9] Creating Product');
          createdProduct = await tx.product.create({
            data: {
              name: finalMappedObject.name,
              code: finalMappedObject.code,
              description: finalMappedObject.description,
              type: finalMappedObject.type,
              brandId: finalMappedObject.brandId,
              manufacturerId: finalMappedObject.manufacturerId,
              categoryId: finalMappedObject.categoryId,
              hsnCodeId: finalMappedObject.hsnCodeId,
              taxRateId: finalMappedObject.taxRateId,
              unitId: finalMappedObject.unitId,
              status: finalMappedObject.status,
              createdById: finalMappedObject.userId,
              updatedById: finalMappedObject.userId,
              approvedById: finalMappedObject.userId,
              approvedAt: new Date(),
              catalogType: 'PRODUCT',
            }
          });
          console.log('[9] Product created successfully:', createdProduct.id);
        } catch (err: any) {
          console.error('[9] Error Creating Product:', err);
          throw new Error(JSON.stringify({ step: 'Creating Product', error: err.message, stack: err.stack }));
        }

        let createdVariant;
        try {
          console.log('[10] Creating Variant');
          createdVariant = await tx.productVariant.create({
            data: {
              productId: createdProduct.id,
              variantName: 'Default',
              sku: finalMappedObject.code,
              purchasePrice: finalMappedObject.purchasePrice,
              sellingPrice: finalMappedObject.sellingPrice,
              trackInventory: finalMappedObject.trackInventory,
              trackSerials: false,
              isDefault: true,
              zohoBookItemId: finalMappedObject.zohoBookItemId,
              zohoSyncStatus: 'SYNCED',
              zohoSyncHash: 'IMPORTED'
            }
          });
          console.log('[10] Variant created successfully:', createdVariant.id);
        } catch (err: any) {
          console.error('[10] Error Creating Variant:', err);
          throw new Error(JSON.stringify({ step: 'Creating Variant', error: err.message, stack: err.stack }));
        }

        try {
          console.log('[11] Creating Master Audit Log');
          await tx.masterDataHistory.create({
            data: {
              entityType: 'Product',
              entityId: createdProduct.id,
              action: 'CREATED',
              newValue: JSON.stringify({ name: createdProduct.name, code: createdProduct.code, status: createdProduct.status }),
              remarks: 'Imported from Zoho Books',
              performedById: finalMappedObject.userId,
              productId: createdProduct.id,
            }
          });
          console.log('[11] Master Audit Log created successfully');
        } catch (err: any) {
          console.error('[11] Error Creating Master Audit Log:', err);
          throw new Error(JSON.stringify({ step: 'Creating Master Audit Log', error: err.message, stack: err.stack }));
        }

        console.log('[12] Transaction commit pending');
        return { productId: createdProduct.id, variantId: createdVariant.id, zohoItemId: remoteId };
      });

      console.log('[13] Transaction committed successfully');
      return { success: true, ...result };
    } catch (err: any) {
      console.error('Transaction rolled back due to error:', err);
      try {
        const parsedError = JSON.parse(err.message);
        return { success: false, ...parsedError };
      } catch (parseErr) {
        return { success: false, step: 'Transaction Execution', error: err.message, stack: err.stack };
      }
    }
  }
}
