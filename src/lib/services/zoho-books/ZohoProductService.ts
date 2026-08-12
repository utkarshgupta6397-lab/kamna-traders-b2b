import { prisma } from '@/lib/db';
import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';
import { ZohoSyncLogger } from './ZohoSyncLogger';
import crypto from 'crypto';

export type TriggerSource = 'AUTO_SAVE' | 'MANUAL_SYNC' | 'IMPORT_FROM_ZOHO';

export interface SyncResult {
  success: boolean;
  zohoSyncStatus: 'SYNCED' | 'SYNC_FAILED';
  zohoBooksItemId?: string;
  error?: string;
  timeline?: any;
  durationMs?: number;
}

export type ZohoBooksItemPayload = any;
export type ZohoBooksItem = any;

export class ZohoProductService {
  private static getApiBaseUrl() {
    return process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';
  }

  static async syncVariant(variantId: string, triggerSource: TriggerSource): Promise<SyncResult> {
    const startedAt = new Date();
    const timeline: { step: string; status: 'pending' | 'success' | 'error' | 'skipped'; timestamp: string; input?: any; output?: any; exception?: any }[] = [];
    const addStep = (step: string, status: 'pending' | 'success' | 'error' | 'skipped', input?: any, output?: any, exception?: any) => {
      timeline.push({ step, status, timestamp: new Date().toISOString(), input, output, exception });
    };

    let variant: any;
    let payload: any;
    let apiResult: any;

    try {
      variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        include: {
          product: {
            include: {
              brand: true,
              manufacturer: true,
              category: true,
              hsnCode: true,
              taxRate: true,
              unit: true,
            }
          }
        }
      });

      if (!variant || !variant.product) {
        addStep('Product Loaded', 'error');
        throw new Error('Variant or Product not found');
      }
      addStep('Product Loaded', 'success');
      addStep('Variant Loaded', 'success');

      // 1. Compute hash and check if dirty
      const newHash = this.computeSyncHash(variant);
      const [newDataHash, newImageHash] = newHash.split('|');
      const [oldDataHash, oldImageHash] = variant.zohoSyncHash ? variant.zohoSyncHash.split('|') : ['', ''];

      if (variant.zohoBookItemId && variant.zohoSyncHash === newHash && triggerSource === 'AUTO_SAVE') {
        const durationMs = Date.now() - startedAt.getTime();
        return { success: true, zohoSyncStatus: 'SYNCED', zohoBooksItemId: variant.zohoBookItemId, timeline, durationMs };
      }

      // 2. Set status to SYNCING
      await prisma.productVariant.update({
        where: { id: variantId },
        data: { zohoSyncStatus: 'SYNCING' }
      });

      const accessToken = await getZohoTokens();
      if (!accessToken) {
        addStep('OAuth Token Retrieved', 'error');
        throw new Error('Zoho Books not connected or token expired');
      }
      addStep('OAuth Token Retrieved', 'success');

      let isUpdate = !!variant.zohoBookItemId;

      // ─── STEP 1: Item Create/Update (core fields, NO custom_fields) ───
      if (isUpdate) {
        addStep('Create vs Update Decision', 'success', { decision: 'update', itemId: variant.zohoBookItemId });
        
        if (oldDataHash === newDataHash) {
          addStep('Item Update', 'skipped', { reason: 'Data unchanged, item update skipped' });
          apiResult = { success: true, skipped: true };
        } else {
          payload = await this.buildPayload(variant);
          // Remove custom_fields from the main payload — handled separately
          delete payload.custom_fields;
          
          addStep('Item Update', 'pending', { payload });
          addStep('API Request Sent', 'success', { url: `${this.getApiBaseUrl()}/books/v3/items/${variant.zohoBookItemId}?organization_id=${getZohoOrgId()}` });
          apiResult = await this.updateItem(variant.zohoBookItemId!, payload, accessToken);
          addStep('Item Update', apiResult.success ? 'success' : 'error', undefined, apiResult.raw, !apiResult.success ? apiResult.error : undefined);
        }
      } else {
        addStep('Create vs Update Decision', 'success', { decision: 'create' });
        payload = await this.buildPayload(variant);
        // Remove custom_fields from the main payload — handled separately after creation
        delete payload.custom_fields;
        
        addStep('Item Create', 'pending', { payload });
        addStep('API Request Sent', 'success', { url: `${this.getApiBaseUrl()}/books/v3/items?organization_id=${getZohoOrgId()}` });
        apiResult = await this.createItem(payload, accessToken);
        addStep('Item Create', apiResult.success ? 'success' : 'error', undefined, apiResult.raw, !apiResult.success ? apiResult.error : undefined);
      }
      
      if (!apiResult.success) {
        throw new Error(apiResult.error || 'Zoho API Error');
      }

      const finalZohoItemId = isUpdate ? variant.zohoBookItemId! : apiResult.itemId!;

      // ─── STEP 2: Fetch Zoho item to check current state ───
      addStep('Zoho Item Fetch', 'pending');
      let zohoItem: any;
      try {
        zohoItem = await this.fetchItemWithToken(finalZohoItemId, accessToken);
        addStep('Zoho Item Fetch', 'success', undefined, { 
          image_name: zohoItem?.image_name, 
          custom_fields_count: zohoItem?.custom_fields?.length,
          cf_incentive: zohoItem?.custom_fields?.find((c: any) => c.api_name === 'cf_incentive_category')?.value 
        });
      } catch (fetchErr: any) {
        addStep('Zoho Item Fetch', 'error', undefined, undefined, fetchErr.message);
        throw new Error(`Failed to fetch Zoho item after update: ${fetchErr.message}`);
      }

      // ─── STEP 3: Incentive Category custom field update ───
      const erpIncentiveTag = variant.product.incentiveTag || '';
      const zohoIncentiveField = zohoItem?.custom_fields?.find((c: any) => c.api_name === 'cf_incentive_category');
      const zohoIncentiveValue = zohoIncentiveField?.value || '';
      const zohoIncentiveFieldId = zohoIncentiveField?.customfield_id;

      if (erpIncentiveTag === zohoIncentiveValue) {
        addStep('Custom Field: Incentive Category', 'skipped', { 
          reason: 'Value already matches', 
          erpValue: erpIncentiveTag, 
          zohoValue: zohoIncentiveValue 
        });
      } else {
        addStep('Custom Field: Incentive Category', 'pending', { 
          erpValue: erpIncentiveTag, 
          zohoValue: zohoIncentiveValue,
          customfield_id: zohoIncentiveFieldId
        });

        // Build custom field update payload using customfield_id if available
        const cfPayload: any = {
          custom_fields: [{
            ...(zohoIncentiveFieldId ? { customfield_id: zohoIncentiveFieldId } : {}),
            api_name: 'cf_incentive_category',
            value: erpIncentiveTag
          }]
        };

        const cfResult = await this.updateItem(finalZohoItemId, cfPayload, accessToken);
        if (!cfResult.success) {
          addStep('Custom Field: Incentive Category', 'error', undefined, cfResult.raw, cfResult.error);
          throw new Error(`Custom field update failed: ${cfResult.error}`);
        }
        addStep('Custom Field: Incentive Category', 'success', undefined, cfResult.raw);
      }

      // ─── STEP 4: Image upload ───
      const erpHasImage = !!variant.product.thumbnailBase64;
      const zohoHasImage = !!(zohoItem?.image_name);
      const imageHashChanged = oldImageHash !== newImageHash;

      if (!erpHasImage) {
        addStep('Image Upload', 'skipped', { reason: 'No ERP image' });
      } else if (zohoHasImage && !imageHashChanged) {
        addStep('Image Upload', 'skipped', { reason: 'Image unchanged and Zoho already has image' });
      } else {
        // Upload needed: either Zoho has no image, or image hash changed
        addStep('Image Upload', 'pending', { 
          reason: !zohoHasImage ? 'Zoho has no image' : 'Image changed',
          zohoHasImage, imageHashChanged 
        });
        const uploadResult = await this.uploadImage(variantId, finalZohoItemId, accessToken, false);
        if (!uploadResult.success) {
          addStep('Image Upload', 'error', undefined, undefined, uploadResult.warning);
          throw new Error(`Image upload failed: ${uploadResult.warning}`);
        }
        addStep('Image Upload', 'success');
      }

      // ─── STEP 5: Post-sync verification ───
      addStep('Post-Sync Verification', 'pending');
      try {
        const verifyItem = await this.fetchItemWithToken(finalZohoItemId, accessToken);
        const mismatches: string[] = [];

        // Verify name
        const expectedName = variant.product.name.substring(0, 100);
        if (verifyItem.name !== expectedName) {
          mismatches.push(`name: expected '${expectedName}', got '${verifyItem.name}'`);
        }

        // Verify SKU
        const expectedSku = variant.sku || variant.product.code;
        if (verifyItem.sku !== expectedSku) {
          mismatches.push(`sku: expected '${expectedSku}', got '${verifyItem.sku}'`);
        }

        // Verify rate
        const expectedRate = variant.sellingPrice || 0;
        if (Math.abs(parseFloat(verifyItem.rate) - expectedRate) > 0.01) {
          mismatches.push(`rate: expected ${expectedRate}, got ${verifyItem.rate}`);
        }

        // Verify purchase_rate
        const expectedPurchaseRate = variant.purchasePrice || 0;
        if (Math.abs(parseFloat(verifyItem.purchase_rate) - expectedPurchaseRate) > 0.01) {
          mismatches.push(`purchase_rate: expected ${expectedPurchaseRate}, got ${verifyItem.purchase_rate}`);
        }

        // Verify incentive category custom field
        const verifyCf = verifyItem.custom_fields?.find((c: any) => c.api_name === 'cf_incentive_category');
        const verifyIncentiveValue = verifyCf?.value || '';
        if (verifyIncentiveValue !== erpIncentiveTag) {
          mismatches.push(`cf_incentive_category: expected '${erpIncentiveTag}', got '${verifyIncentiveValue}'`);
        }

        // Verify image presence
        if (erpHasImage && !verifyItem.image_name) {
          mismatches.push(`image: ERP has image but Zoho image_name is empty`);
        }

        if (mismatches.length > 0) {
          addStep('Post-Sync Verification', 'error', undefined, { mismatches });
          throw new Error(`Sync verification failed: ${mismatches.join('; ')}`);
        }

        addStep('Post-Sync Verification', 'success', undefined, { 
          verified: ['name', 'sku', 'rate', 'purchase_rate', 'cf_incentive_category', 'image'] 
        });
      } catch (verifyErr: any) {
        if (verifyErr.message.startsWith('Sync verification failed')) {
          throw verifyErr;
        }
        addStep('Post-Sync Verification', 'error', undefined, undefined, verifyErr.message);
        throw new Error(`Post-sync verification error: ${verifyErr.message}`);
      }

      // ─── STEP 6: All operations succeeded — mark SYNCED ───
      addStep('Database Updated', 'success');
      await prisma.productVariant.update({
        where: { id: variantId },
        data: {
          zohoSyncStatus: 'SYNCED',
          zohoLastSyncAt: new Date(),
          zohoLastSyncError: null,
          zohoSyncHash: newHash,
          zohoBookItemId: finalZohoItemId,
        }
      });

      addStep('Synchronization Completed', 'success', { outcome: apiResult.skipped ? 'data_skipped' : 'success' });
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      await ZohoSyncLogger.log({
        variantId,
        productId: variant.productId,
        zohoBooksItemId: finalZohoItemId,
        action: isUpdate ? 'UPDATE_ITEM' : 'CREATE_ITEM',
        triggerSource,
        status: 'SUCCESS',
        startedAt,
        completedAt,
        durationMs,
        requestPayload: { 
          payload, 
          method: isUpdate ? 'PUT' : 'POST', 
          orgId: getZohoOrgId(),
          _unitMapping: variant.product?.unit ? {
            erpUnitId: variant.product.unit.id,
            erpUnitName: variant.product.unit.name,
            erpAbbreviation: variant.product.unit.abbreviation,
            zohoBooksUnitName: variant.product.unit.zohoBooksUnitName,
            mappingFound: !!variant.product.unit.zohoBooksUnitName?.trim(),
            finalUnitSent: payload?.unit,
            origin: variant.product.unit.zohoBooksUnitName?.trim() ? 'Zoho Mapping' : 'Default Fallback',
            reason: variant.product.unit.zohoBooksUnitName?.trim() ? 'Using configured Zoho Books Unit Name' : 'No Zoho mapping configured, using ERP abbreviation'
          } : undefined
        },
        responsePayload: apiResult.raw,
        timeline,
      });

      return { success: true, zohoSyncStatus: 'SYNCED', zohoBooksItemId: finalZohoItemId, timeline, durationMs };
    } catch (error: any) {
      const existingSyncCompleted = timeline.find(t => t.step === 'Synchronization Completed');
      if (existingSyncCompleted) {
        existingSyncCompleted.status = 'error';
        existingSyncCompleted.exception = error.message;
        existingSyncCompleted.output = undefined;
      } else {
        addStep('Synchronization Completed', 'error', undefined, undefined, error.message);
      }
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();
      console.error('[ZohoProductService] Sync failed:', error);
      
      await prisma.productVariant.update({
        where: { id: variantId },
        data: {
          zohoSyncStatus: 'SYNC_FAILED',
          zohoLastSyncError: error.message,
          zohoLastSyncAt: new Date(),
        }
      });

      await ZohoSyncLogger.log({
        variantId,
        productId: variant?.productId || 'UNKNOWN_PRODUCT',
        action: triggerSource === 'AUTO_SAVE' ? 'UPDATE_ITEM' : 'CREATE_ITEM',
        triggerSource,
        status: 'FAILED',
        startedAt,
        completedAt,
        durationMs,
        apiError: error.message,
        requestPayload: { 
          payload, 
          method: variant?.zohoBookItemId ? 'PUT' : 'POST', 
          orgId: getZohoOrgId(),
          _unitMapping: variant?.product?.unit ? {
            erpUnitId: variant.product.unit.id,
            erpUnitName: variant.product.unit.name,
            erpAbbreviation: variant.product.unit.abbreviation,
            zohoBooksUnitName: variant.product.unit.zohoBooksUnitName,
            mappingFound: !!variant.product.unit.zohoBooksUnitName?.trim(),
            finalUnitSent: payload?.unit,
            origin: variant.product.unit.zohoBooksUnitName?.trim() ? 'Zoho Mapping' : 'Default Fallback',
            reason: variant.product.unit.zohoBooksUnitName?.trim() ? 'Using configured Zoho Books Unit Name' : 'No Zoho mapping configured, using ERP abbreviation'
          } : undefined
        },
        responsePayload: apiResult?.raw,
        timeline,
      });

      return { success: false, zohoSyncStatus: 'SYNC_FAILED', error: error.message, timeline, durationMs };
    }
  }

  static async createItem(payload: any, accessToken: string): Promise<{ success: boolean; itemId?: string; error?: string; raw?: any }> {
    const orgId = getZohoOrgId();
    const url = `${this.getApiBaseUrl()}/books/v3/items?organization_id=${orgId}`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || data.code !== 0) {
      let errorMessage = data.message || `HTTP ${res.status}`;
      
      // Enrich dropdown validation error
      if (data.code === 120124 && payload.custom_fields) {
        const incentiveField = payload.custom_fields.find((f: any) => f.api_name === 'cf_incentive_category');
        if (incentiveField && errorMessage.includes(incentiveField.value)) {
          errorMessage = `Dropdown mismatch: Zoho Books rejected Incentive Category '${incentiveField.value}'. Please ensure the ERP value exactly matches the options defined in Zoho Books.`;
        }
      }

      return { success: false, error: errorMessage, raw: data };
    }
    return { success: true, itemId: data.item.item_id, raw: data };
  }

  static async updateItem(itemId: string, payload: any, accessToken: string): Promise<{ success: boolean; error?: string; raw?: any }> {
    const orgId = getZohoOrgId();
    const url = `${this.getApiBaseUrl()}/books/v3/items/${itemId}?organization_id=${orgId}`;
    
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || data.code !== 0) {
      let errorMessage = data.message || `HTTP ${res.status}`;
      
      // Enrich dropdown validation error
      if (data.code === 120124 && payload.custom_fields) {
        const incentiveField = payload.custom_fields.find((f: any) => f.api_name === 'cf_incentive_category');
        if (incentiveField && errorMessage.includes(incentiveField.value)) {
          errorMessage = `Dropdown mismatch: Zoho Books rejected Incentive Category '${incentiveField.value}'. Please ensure the ERP value exactly matches the options defined in Zoho Books.`;
        }
      }

      return { success: false, error: errorMessage, raw: data };
    }
    return { success: true, raw: data };
  }

  static async fetchItem(itemId: string): Promise<any | null> {
    const accessToken = await getZohoTokens();
    if (!accessToken) throw new Error('Zoho token not found');
    try {
      return await this.fetchItemWithToken(itemId, accessToken);
    } catch (e: any) {
      if (e.message?.includes('not found')) return null;
      throw e;
    }
  }

  static async fetchItemWithToken(itemId: string, accessToken: string): Promise<any> {
    const orgId = getZohoOrgId();
    const url = `${this.getApiBaseUrl()}/books/v3/items/${itemId}?organization_id=${orgId}`;
    
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
    });

    if (res.status === 404) throw new Error(`Item ${itemId} not found in Zoho Books`);
    const data = await res.json();
    if (!res.ok || data.code !== 0) throw new Error(data.message || `HTTP ${res.status}`);
    
    return data.item;
  }

  static async importItem(variantId: string, zohoBooksItemId: string, userId: string): Promise<{ success: boolean; updatedFields?: Record<string, any>; error?: string }> {
    try {
      const item = await this.fetchItem(zohoBooksItemId);
      if (!item) return { success: false, error: 'Item not found in Zoho Books' };

      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        include: { product: true }
      });
      if (!variant) return { success: false, error: 'Variant not found' };

      let hsnCodeId = variant.product.hsnCodeId;
      if (item.hsn_or_sac) {
        const hsn = await prisma.hsnCode.findUnique({ where: { code: item.hsn_or_sac } });
        if (hsn) hsnCodeId = hsn.id;
      }

      let incentiveTag = variant.product.incentiveTag;
      if (item.custom_fields) {
        const cf = item.custom_fields.find((c: any) => c.api_name === 'cf_incentive_category');
        if (cf && cf.value) incentiveTag = cf.value;
      }

      await prisma.$transaction([
        prisma.product.update({
          where: { id: variant.productId },
          data: {
            name: item.name,
            description: item.description,
            type: item.product_type === 'service' ? 'Service' : 'Goods',
            status: item.status === 'active' ? 'Active' : 'Draft',
            hsnCodeId,
            incentiveTag,
            updatedById: userId
          }
        }),
        prisma.productVariant.update({
          where: { id: variantId },
          data: {
            sellingPrice: parseFloat(item.rate) || 0,
            purchasePrice: parseFloat(item.purchase_rate) || 0,
            zohoBookItemId: zohoBooksItemId,
            zohoSyncStatus: 'SYNCED',
            zohoLastSyncAt: new Date(),
            zohoLastSyncError: null
          }
        })
      ]);

      const updatedVariant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        include: {
          product: { include: { brand: true, manufacturer: true, category: true, hsnCode: true, taxRate: true, unit: true } }
        }
      });
      
      if (updatedVariant) {
        const newHash = this.computeSyncHash(updatedVariant);
        await prisma.productVariant.update({ where: { id: variantId }, data: { zohoSyncHash: newHash } });
      }

      await ZohoSyncLogger.log({
        variantId,
        productId: variant.productId,
        zohoBooksItemId,
        action: 'IMPORT_FROM_ZOHO',
        triggerSource: 'IMPORT_FROM_ZOHO',
        status: 'SUCCESS',
        startedAt: new Date(),
        responsePayload: item
      });

      return { 
        success: true, 
        updatedFields: { 
          name: item.name, 
          sellingPrice: item.rate, 
          purchasePrice: item.purchase_rate 
        } 
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  static async uploadImage(variantId: string, zohoBooksItemId: string, accessToken: string, force?: boolean): Promise<{ success: boolean; warning?: string }> {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true }
    });
    if (!variant || !variant.product.thumbnailBase64) {
      return { success: false, warning: 'No image found' };
    }

    try {
      const base64Data = variant.product.thumbnailBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      const formData = new FormData();
      formData.append('image', new Blob([buffer]), 'product_image.jpg');

      const orgId = getZohoOrgId();
      const url = `${this.getApiBaseUrl()}/books/v3/items/${zohoBooksItemId}/image?organization_id=${orgId}`;
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` },
        body: formData as any
      });

      const data = await res.json();
      if (!res.ok || data.code !== 0) {
        return { success: false, warning: data.message };
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, warning: e.message };
    }
  }

  static async buildPayload(variant: any): Promise<ZohoBooksItemPayload> {
    const product = variant.product;
    const isGoods = product.type !== 'Service';
    
    let item_type = 'sales_and_purchases';
    if (variant.trackInventory) {
      item_type = 'inventory';
    } else if (!isGoods) {
      item_type = 'service';
    } else if (variant.sellingPrice > 0 && variant.purchasePrice > 0) {
      item_type = 'sales_and_purchases';
    } else if (variant.sellingPrice > 0) {
      item_type = 'sales';
    } else if (variant.purchasePrice > 0) {
      item_type = 'purchases';
    }

    const payload: any = {
      name: product.name.substring(0, 100),
      sku: variant.sku || product.code,
      description: product.description ? product.description.substring(0, 2000) : '',
      product_type: isGoods ? 'goods' : 'service',
      item_type,
      rate: variant.sellingPrice || 0,
      purchase_rate: variant.purchasePrice || 0,
      is_taxable: !!product.taxRate,
      status: product.status === 'Active' ? 'active' : 'inactive',
    };

    if (product.unit) {
      const zohoBooksUnitName = product.unit.zohoBooksUnitName?.trim();
      payload.unit = zohoBooksUnitName || product.unit.abbreviation;
    }

    if (product.hsnCode) {
      payload.hsn_or_sac = product.hsnCode.code;
    }

    if (product.taxRate) {
      if (!product.taxRate.zohoBooksIntraTaxId || !product.taxRate.zohoBooksInterTaxId) {
        throw new Error(`Tax Rate '${product.taxRate.name}' is missing Zoho Books Intra/Inter Tax IDs.`);
      }
      
      payload.tax_percentage = product.taxRate.percentage;
      payload.item_tax_preferences = [
        {
          tax_id: product.taxRate.zohoBooksIntraTaxId,
          tax_specification: 'intra'
        },
        {
          tax_id: product.taxRate.zohoBooksInterTaxId,
          tax_specification: 'inter'
        }
      ];
    }

    payload.custom_fields = [{
      api_name: 'cf_incentive_category',
      value: product.incentiveTag || ''
    }];

    return payload;
  }

  static async buildPartialPayload(variant: any, newHash: string): Promise<Partial<ZohoBooksItemPayload> | null> {
    if (variant.zohoSyncHash === newHash) return null;
    // For safety in partial update, we just build the full payload.
    // In a strict implementation we would diff with the previous payload, 
    // but building the full payload works for PUT /items as Zoho ignores unchanged fields.
    return this.buildPayload(variant);
  }

  static computeSyncHash(variant: any): string {
    const product = variant.product;
    if (!product) return '';
    
    const data = [
      product.name,
      variant.sku,
      product.description,
      variant.sellingPrice,
      variant.purchasePrice,
      variant.trackInventory,
      product.type,
      product.status,
      product.hsnCode?.code,
      product.taxRate?.id,
      product.taxRate?.percentage,
      product.brand?.name,
      product.category?.name,
      product.manufacturer?.name,
      product.incentiveTag,
      product.unit?.name,
      product.unit?.abbreviation,
      product.unit?.zohoBooksUnitName
    ].join('|');

    const dataHash = crypto.createHash('sha256').update(data).digest('hex');
    const imageHash = product.thumbnailBase64 ? crypto.createHash('sha256').update(product.thumbnailBase64).digest('hex').substring(0, 64) : 'no_image';

    return `${dataHash}|${imageHash}`;
  }
}
