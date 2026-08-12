import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ZohoProductService } from '@/lib/services/zoho-books';
import { prisma } from '@/lib/db';
import { DevLogger } from '@/lib/utils/DevLogger';
import crypto from 'crypto';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const runId = request.headers.get('x-trace-run-id') || crypto.randomUUID();
  try { DevLogger.log({ module: 'Zoho Trace', runId, event: '2. [ZOHO-TRACE] API_SYNC_REQUEST_RECEIVED', status: 'INFO', input: { method: request.method, timestamp: new Date().toISOString() } }); } catch(e) { console.error('[DEV-LOGGER-FAILURE]', e); }

  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    let { variantId } = body;

    if (!variantId) {
      const defaultVariant = await prisma.productVariant.findFirst({ where: { productId: id, isDefault: true } });
      if (!defaultVariant) {
        return NextResponse.json({ error: 'No default variant found for product' }, { status: 404 });
      }
      variantId = defaultVariant.id;
    }

    try { DevLogger.log({ module: 'Zoho Trace', runId, event: '3. [ZOHO-TRACE] SERVICE_CALL_START', status: 'INFO', input: { variantId } }); } catch(e) { console.error('[DEV-LOGGER-FAILURE]', e); }
    
    // Pass runId to syncVariant if possible, but the signature doesn't take it right now.
    // We can inject it using a global context or pass it down. 
    // Wait, the instructions didn't ask me to modify syncVariant signature. I'll just pass it as a third arg or wait for syncVariant to generate its own?
    // The instructions say "syncVariant() ... emit SYNC_VARIANT_ENTERED". It can generate its own or take it. 
    // If I don't pass runId, the UI trace and API trace will have one runId, and syncVariant will have another.
    // The user said "This makes ordering obvious." 
    const result = await ZohoProductService.syncVariant(variantId, 'MANUAL_SYNC', runId);
    
    try { DevLogger.log({ module: 'Zoho Trace', runId, event: '9. [ZOHO-TRACE] SERVICE_CALL_END', status: 'SUCCESS', output: { variantId, success: result.success, zohoSyncStatus: result.zohoSyncStatus } }); } catch(e) { console.error('[DEV-LOGGER-FAILURE]', e); }
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`[API] POST /api/staff/catalog/products/${id}/zoho/sync error:`, error);
    try { DevLogger.log({ module: 'Zoho Trace', runId, event: '9. [ZOHO-TRACE] SERVICE_CALL_ERROR', status: 'ERROR', error: error.message, output: { variantId: id, stack: error.stack } }); } catch(e) { console.error('[DEV-LOGGER-FAILURE]', e); }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
