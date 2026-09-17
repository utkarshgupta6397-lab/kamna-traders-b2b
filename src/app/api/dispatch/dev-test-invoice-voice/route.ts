import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { dispatchEventEmitter, DISPATCH_EVENTS, dispatchEmitterId } from '@/lib/dispatch-events';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // DEV-only safety guard
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Endpoint only available in development' }, { status: 403 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const customerName = body.customerName?.trim() || 'Shri Sidbali Solar Systems';
    const invoiceNumber = body.invoiceNumber?.trim() || 'INV-TEST-001';
    const eventId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const listenerCount = dispatchEventEmitter.listenerCount(DISPATCH_EVENTS.INVOICE_CREATED);
    console.log(`[VOICE DEBUG] dev test endpoint called`);
    console.log(`[VOICE DEBUG] event emitter instance = ${dispatchEmitterId}`);
    console.log(`[VOICE DEBUG] publishing INVOICE_CREATED for: "${customerName}"`);
    console.log(`[VOICE DEBUG] eventId = ${eventId}`);
    console.log(`[VOICE DEBUG] SSE clients/listeners = ${listenerCount}`);

    // Broadcast realtime event across all connected ERP browser sessions
    dispatchEventEmitter.emit(DISPATCH_EVENTS.INVOICE_CREATED, {
      eventId,
      customerName,
      invoiceNumber,
      timestamp,
    });

    return NextResponse.json({
      success: true,
      message: 'Broadcasted dev test invoice voice event',
      eventId,
      customerName,
      invoiceNumber,
      timestamp,
      emitterId: dispatchEmitterId,
      listenerCount,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[VOICE DEBUG] dev test error:', errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
