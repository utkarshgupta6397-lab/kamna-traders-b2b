import { prisma } from '@/lib/db';

export interface LogSyncParams {
  variantId: string;
  productId: string;
  zohoBooksItemId?: string | null;
  action: 'CREATE_ITEM' | 'UPDATE_ITEM' | 'UPLOAD_IMAGE' | 'FETCH_ITEM' | 'IMPORT_FROM_ZOHO';
  triggerSource: 'AUTO_SAVE' | 'MANUAL_SYNC' | 'IMPORT_FROM_ZOHO';
  status: 'SUCCESS' | 'FAILED' | 'WARNING';
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  requestPayload?: any;
  responsePayload?: any;
  timeline?: any;
  apiError?: string;
}

export class ZohoSyncLogger {
  static async log(params: LogSyncParams): Promise<void> {
    try {
      await prisma.zohoProductSyncLog.create({
        data: {
          variantId: params.variantId,
          productId: params.productId,
          zohoBooksItemId: params.zohoBooksItemId,
          action: params.action,
          triggerSource: params.triggerSource,
          status: params.status,
          startedAt: params.startedAt,
          completedAt: params.completedAt || new Date(),
          durationMs: params.durationMs,
          requestPayload: params.requestPayload ? JSON.parse(JSON.stringify(params.requestPayload)) : undefined,
          responsePayload: params.responsePayload ? JSON.parse(JSON.stringify(params.responsePayload)) : undefined,
          timeline: params.timeline ? JSON.parse(JSON.stringify(params.timeline)) : undefined,
          apiError: params.apiError,
        },
      });
    } catch (error) {
      console.error('[ZohoSyncLogger] Failed to write sync log:', error);
    }
  }
}
