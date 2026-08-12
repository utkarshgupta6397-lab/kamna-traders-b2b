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
    const timeline: { step: string; status: 'pending' | 'success' | 'error'; timestamp: string; input?: any; output?: any; exception?: any }[] = [];
    const addStep = (step: string, status: 'pending' | 'success' | 'error', input?: any, output?: any, exception?: any) => {
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

      if (isUpdate) {
        addStep('Create vs Update Decision', 'success', { decision: 'update', itemId: variant.zohoBookItemId });
        payload = await this.buildPartialPayload(variant, newHash);
        
        if (!payload || Object.keys(payload).length === 0) {
          addStep('Payload Generated', 'success', { reason: 'No changes needed, sync skipped' });
          apiResult = { success: true, skipped: true };
        } else {
          addStep('Payload Generated', 'success', { payload });
          addStep('API Request Sent', 'success', { url: `${this.getApiBaseUrl()}/books/v3/items/${variant.zohoBookItemId}?organization_id=${getZohoOrgId()}` });
          apiResult = await this.updateItem(variant.zohoBookItemId!, payload, accessToken);
          addStep('API Response Received', apiResult.success ? 'success' : 'error', undefined, apiResult.raw, !apiResult.success ? apiResult.error : undefined);
        }
      } else {
        addStep('Create vs Update Decision', 'success', { decision: 'create' });
        payload = await this.buildPayload(variant);
        addStep('Payload Generated', 'success', { payload });
        
        addStep('API Request Sent', 'success', { url: `${this.getApiBaseUrl()}/books/v3/items?organization_id=${getZohoOrgId()}` });
        apiResult = await this.createItem(payload, accessToken);
        addStep('API Response Received', apiResult.success ? 'success' : 'error', undefined, apiResult.raw, !apiResult.success ? apiResult.error : undefined);
      }
      
      if (!apiResult.success) {
        throw new Error(apiResult.error || 'Zoho API Error');
      }

      const finalZohoItemId = isUpdate ? variant.zohoBookItemId! : apiResult.itemId!;

      if (variant.product.thumbnailBase64 && (!isUpdate || variant.zohoSyncHash !== newHash)) {
        addStep('Image Upload', 'pending');
        this.uploadImage(variantId, finalZohoItemId, accessToken, false).catch(e => {
          console.error('[ZohoProductService] Async image upload failed:', e);
        });
      }

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

      addStep('Synchronization Completed', 'success', { outcome: apiResult.skipped ? 'skipped' : 'success' });
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

    const orgId = getZohoOrgId();
    const url = `${this.getApiBaseUrl()}/books/v3/items/${itemId}?organization_id=${orgId}`;
    
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
    });

    if (res.status === 404) return null;
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

    if (product.incentiveTag) {
      payload.custom_fields = [{
        api_name: 'cf_incentive_category',
        value: product.incentiveTag
      }];
    }

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
      product.unit?.zohoBooksUnitName,
      product.thumbnailBase64 ? crypto.createHash('sha256').update(product.thumbnailBase64).digest('hex').substring(0, 64) : ''
    ].join('|');

    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
