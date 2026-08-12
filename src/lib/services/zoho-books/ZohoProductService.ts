import { prisma } from '@/lib/db';
import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';
import { ZohoSyncLogger } from './ZohoSyncLogger';
import { DevLogger } from '@/lib/utils/DevLogger';
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

  static async syncVariant(variantId: string, triggerSource: TriggerSource, providedRunId?: string): Promise<SyncResult> {
    const startedAt = new Date();
    const runId = providedRunId || crypto.randomUUID();
    try { DevLogger.log({ module: 'Zoho Trace', runId, event: '4. [ZOHO-TRACE] SYNC_VARIANT_ENTERED', status: 'INFO', input: { variantId, triggerSource, timestamp: new Date().toISOString() } }); } catch(e) { console.error('[DEV-LOGGER-FAILURE]', e); }
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
              parentProduct: true,
            }
          }
        }
      });

      const startedAt = new Date();
      let timeline: Array<{ step: string; status: 'success' | 'error' | 'pending' | 'skipped'; details?: any; response?: any; error?: string }> = [];
      const addStep = (step: string, status: 'success' | 'error' | 'pending' | 'skipped', details?: any, response?: any, error?: string) => {
        timeline.push({ step, status, details, response, error });
        try { DevLogger.log({ module: 'Zoho Sync Step', runId, event: step, status: status === 'success' ? 'SUCCESS' : status === 'error' ? 'ERROR' : status === 'skipped' ? 'WARNING' : 'INFO', input: details, output: response, error }); } catch(e) {}
      };

      if (!variant || !variant.product) {
        addStep('Product Loaded', 'error');
        throw new Error('Variant or Product not found');
      }

      try { DevLogger.log({ module: 'Zoho Trace', runId, event: '5. VARIANT_LOADED', status: 'INFO', input: { variantId, hasProduct: !!variant.product, hasZohoItemId: !!variant.zohoBookItemId } }); } catch(e) {}
      
      const effective = this.resolveEffectiveZohoProductData(variant);

      try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] SYNC_SOURCE_STATE', status: 'INFO', input: { variantId, sku: variant.sku, incentiveTag: variant.product.incentiveTag, hasThumbnailBase64: !!variant.product.thumbnailBase64, thumbnailBase64Length: variant.product.thumbnailBase64?.length, zohoBookItemId: variant.zohoBookItemId, zohoSyncHash: variant.zohoSyncHash } }); } catch(e) {}

      // 1. Compute hash and check if dirty
      const newHash = this.computeSyncHash(variant);
      const [newDataHash, newImageHash] = newHash.split('|');
      const [oldDataHash, oldImageHash] = variant.zohoSyncHash ? variant.zohoSyncHash.split('|') : ['', ''];

      try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] EFFECTIVE_DATA_RESOLVED', status: 'INFO', input: { variantId, localIncentiveTag: variant.product.incentiveTag, parentIncentiveTag: variant.product.parentProduct?.incentiveTag, effectiveIncentiveTag: effective.incentiveTag, hasLocalImage: !!variant.product.thumbnailBase64, hasParentImage: !!variant.product.parentProduct?.thumbnailBase64, effectiveHasImage: !!effective.thumbnailBase64, oldDataHash, newDataHash, oldImageHash, newImageHash } }); } catch(e) {}
      try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] HASH_STATE', status: 'INFO', input: { variantId, triggerSource, oldSyncHash: variant.zohoSyncHash, newSyncHash: newHash, oldDataHash, newDataHash, oldImageHash, newImageHash, dataHashChanged: oldDataHash !== newDataHash, imageHashChanged: oldImageHash !== newImageHash } }); } catch(e) {}

      if (variant.zohoBookItemId && variant.zohoSyncHash === newHash && triggerSource === 'AUTO_SAVE') {
        try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] EARLY_RETURN', status: 'INFO', input: { reason: 'AUTO_SAVE hash match', variantId, triggerSource, isUpdate: true, zohoBookItemId: variant.zohoBookItemId } }); } catch(e) {}
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
      try { DevLogger.log({ module: 'Zoho Trace', runId, event: '6. [ZOHO-TRACE] TOKEN_RETRIEVED', status: 'INFO' }); } catch(e) { console.error('[DEV-LOGGER-FAILURE]', e); }
      addStep('OAuth Token Retrieved', 'success');

      let isUpdate = !!variant.zohoBookItemId;
      try { DevLogger.log({ module: 'Zoho Trace', runId, event: '7. [ZOHO-TRACE] CREATE_UPDATE_DECISION', status: 'INFO', input: { variantId, isUpdate, zohoBookItemId: variant.zohoBookItemId } }); } catch(e) { console.error('[DEV-LOGGER-FAILURE]', e); }

      // ─── STEP 1: Item Create/Update (core fields, NO custom_fields) ───
      if (isUpdate) {
        addStep('Create vs Update Decision', 'success', { decision: 'update', itemId: variant.zohoBookItemId });
        
        try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] UPDATE_BRANCH_EVALUATION', status: 'INFO', input: { oldDataHash, newDataHash, dataHashChanged: oldDataHash !== newDataHash, willCallZohoUpdate: oldDataHash !== newDataHash } }); } catch(e) {}

        if (oldDataHash === newDataHash) {
          try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] ITEM_UPDATE_SKIPPED', status: 'INFO', input: { reason: 'data hash unchanged', oldDataHash, newDataHash } }); } catch(e) {}
          addStep('Item Update', 'skipped', { reason: 'Data unchanged, item update skipped' });
          apiResult = { success: true, skipped: true };
        } else {
          payload = await this.buildPayload(variant);
          // Remove custom_fields from the main payload — handled separately
          delete payload.custom_fields;
          
          addStep('Item Update', 'pending', { payload });
          addStep('API Request Sent', 'success', { url: `${this.getApiBaseUrl()}/books/v3/items/${variant.zohoBookItemId}?organization_id=${getZohoOrgId()}` });
          try { DevLogger.log({ module: 'Zoho Trace', runId, event: '8. [ZOHO-TRACE] BEFORE_ZOHO_UPDATE', status: 'INFO', input: { variantId } }); } catch(e) { console.error('[DEV-LOGGER-FAILURE]', e); }
          try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] BEFORE_ZOHO_UPDATE', status: 'INFO', input: { itemId: variant.zohoBookItemId, method: 'PUT' } }); } catch(e) {}
          apiResult = await this.updateItem(variant.zohoBookItemId!, payload, accessToken);
          try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] AFTER_ZOHO_UPDATE', status: 'INFO', input: { success: apiResult.success, itemId: variant.zohoBookItemId, responseSummary: apiResult.success ? 'success' : apiResult.error } }); } catch(e) {}
          addStep('Item Update', apiResult.success ? 'success' : 'error', undefined, apiResult.raw, !apiResult.success ? apiResult.error : undefined);
        }
      } else {
        addStep('Create vs Update Decision', 'success', { decision: 'create' });
        DevLogger.log({ module: 'Zoho Sync', runId, event: '1. BEFORE buildPayload', status: 'INFO', output: { variantId, zohoBookItemId: variant.zohoBookItemId, incentiveTag: variant.product.incentiveTag, thumbnailExists: !!variant.product.thumbnailBase64, thumbnailLength: variant.product.thumbnailBase64?.length || 0, computedImageHash: newImageHash, computedDataHash: newDataHash } });
        payload = await this.buildPayload(variant);
        DevLogger.log({ module: 'Zoho Sync', runId, event: '2. AFTER buildPayload', status: 'INFO', output: { payload: { ...payload, custom_fields: payload.custom_fields }, custom_fields: payload.custom_fields, incentive_field: payload.custom_fields?.find((f: any) => f.api_name === 'cf_incentive_category'), hasImageData: !!payload.image || !!payload.image_name } });
        // Remove custom_fields from the main payload — handled separately after creation
        DevLogger.log({ module: 'Zoho Sync', runId, event: '3. BEFORE delete payload.custom_fields', status: 'INFO', output: { hasCustomFields: !!payload.custom_fields, incentiveValue: payload.custom_fields?.find((f: any) => f.api_name === 'cf_incentive_category')?.value } });
        delete payload.custom_fields;
        DevLogger.log({ module: 'Zoho Sync', runId, event: '4. AFTER delete payload.custom_fields', status: 'INFO', output: { hasCustomFields: !!payload.custom_fields, incentiveValue: payload.custom_fields?.find((f: any) => f.api_name === 'cf_incentive_category')?.value } });
        
        addStep('Item Create', 'pending', { payload });
        addStep('API Request Sent', 'success', { url: `${this.getApiBaseUrl()}/books/v3/items?organization_id=${getZohoOrgId()}` });
        DevLogger.log({ module: 'Zoho Sync', runId, event: '5. BEFORE Zoho CREATE POST', status: 'INFO', input: { exactPayload: payload, url: `${this.getApiBaseUrl()}/books/v3/items?organization_id=${getZohoOrgId()}`, method: 'POST' } });
        try { DevLogger.log({ module: 'Zoho Trace', runId, event: '8. [ZOHO-TRACE] BEFORE_ZOHO_CREATE', status: 'INFO', input: { variantId } }); } catch(e) { console.error('[DEV-LOGGER-FAILURE]', e); }
        apiResult = await this.createItem(payload, accessToken);
        DevLogger.log({ module: 'Zoho Sync', runId, event: '6. AFTER Zoho CREATE POST', status: apiResult.success ? 'SUCCESS' : 'ERROR', output: { success: apiResult.success, rawResponse: apiResult.raw, returnedItemId: apiResult.itemId } });
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
        try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] BEFORE_ZOHO_FETCH', status: 'INFO', input: { itemId: finalZohoItemId } }); } catch(e) {}
        zohoItem = await this.fetchItemWithToken(finalZohoItemId, accessToken);
        try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] AFTER_ZOHO_FETCH', status: 'INFO', input: { success: true, itemId: finalZohoItemId, image_name: zohoItem?.image_name, customFieldCount: zohoItem?.custom_fields?.length } }); } catch(e) {}
        addStep('Zoho Item Fetch', 'success', undefined, { 
          image_name: zohoItem?.image_name, 
          custom_fields_count: zohoItem?.custom_fields?.length,
          cf_incentive: zohoItem?.custom_fields?.find((c: any) => c.api_name === 'cf_incentive_category')?.value 
        });
      } catch (fetchErr: any) {
        try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] AFTER_ZOHO_FETCH', status: 'ERROR', input: { success: false, itemId: finalZohoItemId, error: fetchErr.message } }); } catch(e) {}
        addStep('Zoho Item Fetch', 'error', undefined, undefined, fetchErr.message);
        throw new Error(`Failed to fetch Zoho item after update: ${fetchErr.message}`);
      }

      // ─── STEP 3: Incentive Category custom field update ───
      const erpIncentiveTag = effective.incentiveTag || '';
      const zohoIncentiveField = zohoItem?.custom_fields?.find((c: any) => c.api_name === 'cf_incentive_category');
      const zohoIncentiveValue = zohoIncentiveField?.value || '';
      const zohoIncentiveFieldId = zohoIncentiveField?.customfield_id;

      try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] INCENTIVE_DECISION_FULL', status: 'INFO', input: { erpIncentiveTag, zohoIncentiveValue, zohoIncentiveFieldId, valuesMatch: erpIncentiveTag === zohoIncentiveValue, willUpdate: erpIncentiveTag !== zohoIncentiveValue, skipReason: erpIncentiveTag === zohoIncentiveValue ? 'Value already matches' : '' } }); } catch(e) {}

      if (erpIncentiveTag === zohoIncentiveValue) {
        try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] INCENTIVE_UPDATE_SKIPPED', status: 'INFO', input: { reason: 'Value already matches' } }); } catch(e) {}
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

        if (!isUpdate) DevLogger.log({ module: 'Zoho Sync', runId, event: '7. BEFORE Incentive Category dedicated PUT', status: 'INFO', input: { finalZohoItemId, customfield_id: zohoIncentiveFieldId, api_name: 'cf_incentive_category', value: erpIncentiveTag, exactPayload: cfPayload } });
        try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] BEFORE_INCENTIVE_UPDATE', status: 'INFO', input: { itemId: finalZohoItemId, customfield_id: zohoIncentiveFieldId, api_name: 'cf_incentive_category', value: erpIncentiveTag } }); } catch(e) {}
        const cfResult = await this.updateItem(finalZohoItemId, cfPayload, accessToken);
        try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] AFTER_INCENTIVE_UPDATE', status: 'INFO', input: { success: cfResult.success, responseSummary: cfResult.success ? 'success' : cfResult.error } }); } catch(e) {}
        if (!isUpdate) DevLogger.log({ module: 'Zoho Sync', runId, event: '8. AFTER Incentive Category PUT', status: cfResult.success ? 'SUCCESS' : 'ERROR', output: { success: cfResult.success, rawResponse: cfResult.raw } });
        if (!cfResult.success) {
          addStep('Custom Field: Incentive Category', 'error', undefined, cfResult.raw, cfResult.error);
          throw new Error(`Custom field update failed: ${cfResult.error}`);
        }
        addStep('Custom Field: Incentive Category', 'success', undefined, cfResult.raw);
      }

      // ─── STEP 4: Image upload ───
      const erpHasImage = !!effective.thumbnailBase64;
      const zohoHasImage = !!(zohoItem?.image_name);
      const imageHashChanged = oldImageHash !== newImageHash;
      
      const willUpload = erpHasImage && (!zohoHasImage || imageHashChanged);
      let skipReason = '';
      if (!erpHasImage) skipReason = 'No ERP image';
      else if (!willUpload) skipReason = 'Image unchanged and Zoho already has image';

      try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] IMAGE_DECISION_FULL', status: 'INFO', input: { erpHasImage, thumbnailBase64Length: effective.thumbnailBase64?.length || 0, oldImageHash, newImageHash, imageHashChanged, zohoImageName: zohoItem?.image_name, zohoHasImage, willUpload, skipReason } }); } catch(e) {}

      if (!erpHasImage) {
        try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] IMAGE_UPLOAD_SKIPPED', status: 'INFO', input: { reason: 'No ERP image' } }); } catch(e) {}
        addStep('Image Upload', 'skipped', { reason: 'No ERP image' });
      } else if (zohoHasImage && !imageHashChanged) {
        try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] IMAGE_UPLOAD_SKIPPED', status: 'INFO', input: { reason: 'Image unchanged and Zoho already has image' } }); } catch(e) {}
        addStep('Image Upload', 'skipped', { reason: 'Image unchanged and Zoho already has image' });
      } else {
        // Upload needed: either Zoho has no image, or image hash changed
        addStep('Image Upload', 'pending', { 
          reason: !zohoHasImage ? 'Zoho has no image' : 'Image changed',
          zohoHasImage, imageHashChanged 
        });
        if (!isUpdate) DevLogger.log({ module: 'Zoho Sync', runId, event: '9. BEFORE image upload', status: 'INFO', input: { finalZohoItemId, erpHasImage, newImageHash, oldImageHash, imageHashChanged, endpoint: `${this.getApiBaseUrl()}/books/v3/items/${finalZohoItemId}/image?organization_id=${getZohoOrgId()}`, contentType: 'multipart/form-data', imageLength: effective.thumbnailBase64?.length, isCallingUploadImage: true } });
        try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] BEFORE_IMAGE_UPLOAD', status: 'INFO', input: { itemId: finalZohoItemId, imageHashChanged, zohoHasImage } }); } catch(e) {}
        const uploadResult = await this.uploadImageInternal(effective.thumbnailBase64, finalZohoItemId, accessToken, false);
        try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] AFTER_IMAGE_UPLOAD', status: 'INFO', input: { success: uploadResult.success, warning: uploadResult.warning } }); } catch(e) {}
        if (!isUpdate) DevLogger.log({ module: 'Zoho Sync', runId, event: '10. AFTER image upload', status: uploadResult.success ? 'SUCCESS' : 'ERROR', output: { success: uploadResult.success, warning: uploadResult.warning } });
        if (!uploadResult.success) {
          addStep('Image Upload', 'error', undefined, undefined, uploadResult.warning);
          throw new Error(`Image upload failed: ${uploadResult.warning}`);
        }
        addStep('Image Upload', 'success');
      }

      // ─── STEP 5: Post-sync verification ───
      addStep('Post-Sync Verification', 'pending');
      let mismatches: string[] = [];
      let verifyItem: any;
      try {
        try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] BEFORE_VERIFICATION', status: 'INFO' }); } catch(e) {}
        verifyItem = await this.fetchItemWithToken(finalZohoItemId, accessToken);
        if (!isUpdate) DevLogger.log({ module: 'Zoho Sync', runId, event: '11. POST-CREATE GET', status: 'INFO', output: { item_id: verifyItem.item_id, custom_fields: verifyItem.custom_fields, image_name: verifyItem.image_name, image_document_id: verifyItem.image_document_id } });

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

        try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] AFTER_VERIFICATION', status: 'INFO', input: { mismatches, verifiedIncentiveValue: verifyIncentiveValue, verifiedImageName: verifyItem.image_name, verifiedSku: verifyItem.sku, verifiedRate: verifyItem.rate, verifiedPurchaseRate: verifyItem.purchase_rate } }); } catch(e) {}

        if (mismatches.length > 0) {
          addStep('Post-Sync Verification', 'error', undefined, { mismatches });
          throw new Error(`Sync verification failed: ${mismatches.join('; ')}`);
        }

        addStep('Post-Sync Verification', 'success', undefined, { 
          verified: ['name', 'sku', 'rate', 'purchase_rate', 'cf_incentive_category', 'image'] 
        });
      } catch (verifyErr: any) {
        if (!isUpdate) DevLogger.log({ module: 'Zoho Sync', runId, event: '12. FINAL SYNCED GATE (FAIL)', status: 'ERROR', error: verifyErr.message, output: { erpIncentiveTag, zohoIncentiveValue: verifyItem?.custom_fields?.find((c: any) => c.api_name === 'cf_incentive_category')?.value || '', erpHasImage, zohoImageName: verifyItem?.image_name, verificationMismatches: mismatches || [], reasonForSync: verifyErr.message } });
        if (verifyErr.message.startsWith('Sync verification failed')) {
          throw verifyErr;
        }
        addStep('Post-Sync Verification', 'error', undefined, undefined, verifyErr.message);
        throw new Error(`Post-sync verification error: ${verifyErr.message}`);
      }

      // ─── STEP 6: All operations succeeded — mark SYNCED ───
      if (!isUpdate) DevLogger.log({ module: 'Zoho Sync', runId, event: '12. FINAL SYNCED GATE (SUCCESS)', status: 'SUCCESS', output: { erpIncentiveTag, zohoIncentiveValue: verifyItem?.custom_fields?.find((c: any) => c.api_name === 'cf_incentive_category')?.value || '', erpHasImage, zohoImageName: verifyItem?.image_name, verificationMismatches: mismatches || [], reasonForSync: 'All checks passed, reached Step 6' } });
      addStep('Database Updated', 'success');
      try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] BEFORE_SYNCED_STATUS', status: 'INFO', input: { mismatches, allChecksPassed: mismatches.length === 0, zohoBookItemId: finalZohoItemId } }); } catch(e) {}
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
      try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] SYNCED_STATUS_WRITTEN', status: 'INFO' }); } catch(e) {}

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
      try { DevLogger.log({ module: 'Zoho Trace', runId, event: '[ZOHO-FORENSIC] SYNC_ERROR', status: 'ERROR', input: { error: error.message, stack: error.stack } }); } catch(e) {}
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
      include: { product: { include: { parentProduct: true } } }
    });
    const effective = this.resolveEffectiveZohoProductData(variant);
    if (!effective.thumbnailBase64) {
      return { success: false, warning: 'No image found' };
    }
    return this.uploadImageInternal(effective.thumbnailBase64, zohoBooksItemId, accessToken, false);
  }

  private static async uploadImageInternal(base64Data: string, itemId: string, accessToken: string, isCreate: boolean = false): Promise<{ success: boolean; warning?: string }> {
    try {
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      
      const formData = new FormData();
      formData.append('image', new Blob([buffer]), 'product_image.jpg');

      const orgId = getZohoOrgId();
      const url = `${this.getApiBaseUrl()}/books/v3/items/${itemId}/image?organization_id=${orgId}`;
      
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

  private static async buildPayload(variant: any) {
    const effective = this.resolveEffectiveZohoProductData(variant);

    const payload: any = {
      name: variant.product.name.substring(0, 100),
      sku: variant.sku || variant.product.code,
      description: variant.product.description || '',
      rate: variant.sellingPrice || 0,
      purchase_rate: variant.purchasePrice || 0,
      is_taxable: true,
      item_type: variant.product.type === 'Service' ? 'sales' : (variant.trackInventory ? 'inventory' : 'sales_and_purchases'),
      status: variant.product.status === 'Active' ? 'active' : 'inactive',
      product_type: variant.product.type === 'Service' ? 'service' : 'goods',
      
      custom_fields: []
    };

    if (effective.incentiveTag) {
      payload.custom_fields.push({
        api_name: 'cf_incentive_category',
        value: effective.incentiveTag
      });
    }

    if (variant.product.unit) {
      const zohoBooksUnitName = variant.product.unit.zohoBooksUnitName?.trim();
      payload.unit = zohoBooksUnitName || variant.product.unit.abbreviation;
    }

    if (variant.product.hsnCode) {
      payload.hsn_or_sac = variant.product.hsnCode.code;
    }

    if (variant.product.taxRate) {
      payload.tax_percentage = variant.product.taxRate.percentage;
      payload.item_tax_preferences = [
        { tax_id: variant.product.taxRate.zohoBooksIntraTaxId, tax_specification: 'intra' },
        { tax_id: variant.product.taxRate.zohoBooksInterTaxId, tax_specification: 'inter' }
      ];
    }

    return payload;
  }

  static async buildPartialPayload(variant: any, newHash: string): Promise<Partial<ZohoBooksItemPayload> | null> {
    if (variant.zohoSyncHash === newHash) return null;
    return this.buildPayload(variant);
  }

  private static resolveEffectiveZohoProductData(variant: any) {
    let thumbnailBase64 = variant.product.thumbnailBase64;
    let incentiveTag = variant.product.incentiveTag;

    if (!thumbnailBase64 && variant.product.parentProduct?.thumbnailBase64) {
      thumbnailBase64 = variant.product.parentProduct.thumbnailBase64;
    }
    if (!incentiveTag && variant.product.parentProduct?.incentiveTag) {
      incentiveTag = variant.product.parentProduct.incentiveTag;
    }

    return { thumbnailBase64, incentiveTag };
  }

  private static computeSyncHash(variant: any): string {
    const effective = this.resolveEffectiveZohoProductData(variant);
    
    const dataParts = [
      variant.product.name.substring(0, 100),
      variant.sku || variant.product.code,
      variant.product.description || '',
      (variant.sellingPrice || 0).toString(),
      (variant.purchasePrice || 0).toString(),
      variant.trackInventory ? 'true' : 'false',
      variant.product.type || '',
      variant.product.status || '',
      variant.product.hsnCode?.code || '',
      variant.product.taxRate?.id || '',
      (variant.product.taxRate?.percentage || 0).toString(),
      variant.product.brand?.name || '',
      variant.product.category?.name || '',
      variant.product.manufacturer?.name || '',
      effective.incentiveTag || '',
      variant.product.unit?.name || '',
      variant.product.unit?.abbreviation || '',
      variant.product.unit?.zohoBooksUnitName || ''
    ];
    
    const dataHash = crypto.createHash('sha256').update(dataParts.join('|')).digest('hex');
    const imageHash = effective.thumbnailBase64 ? 
      crypto.createHash('md5').update(effective.thumbnailBase64).digest('hex') : 
      'no_image';

    return `${dataHash}|${imageHash}`;
  }
}
