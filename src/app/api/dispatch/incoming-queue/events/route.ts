import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { dispatchEventEmitter, DISPATCH_EVENTS, dispatchEmitterId } from '@/lib/dispatch-events';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  console.log(`[VOICE DEBUG] SSE connection opened (userId: ${session.userId}, role: ${session.role})`);
  console.log(`[VOICE DEBUG] authenticated session = true`);
  console.log(`[VOICE DEBUG] event emitter instance = ${dispatchEmitterId}`);

  const stream = new ReadableStream({
    start(controller) {
      const sendRaw = (text: string) => {
        try {
          controller.enqueue(new TextEncoder().encode(text));
        } catch (err) {
          console.error('[SSE] Error sending text', err);
        }
      };

      const sendEvent = (data: unknown) => {
        sendRaw(`data: ${JSON.stringify(data)}\n\n`);
      };

      // 1. Send SSE retry hint for browsers (10s retry)
      sendRaw('retry: 10000\n\n');

      // 2. Send 2KB initial comment padding to immediately force Nginx / reverse proxies
      // to flush response headers and stream chunks to the client without buffering.
      sendRaw(`: ${' '.repeat(2048)}\n\n`);

      // 3. Send initial connected event
      sendEvent({ type: 'connected' });

      // 4. Keep connection alive with heartbeat every 15s (prevents intermediate proxy timeouts)
      const heartbeat = setInterval(() => {
        sendRaw(': ping\n\n');
      }, 15000);

      // Listener for new orders
      const onNewOrder = (order: unknown) => {
        sendEvent({ type: 'new_order', order });
      };

      const onUpdateOrder = (order: unknown) => {
        sendEvent({ type: 'update_order', order });
      };

      const onTruckUpload = (data: unknown) => {
        sendEvent({ type: 'truck_upload', data });
      };

      const onInvoiceCreated = (data: unknown) => {
        const payload = (data || {}) as Record<string, unknown>;
        console.log(`[VOICE DEBUG] sending invoice_created event to client (userId: ${session.userId})`);
        console.log(`[VOICE DEBUG] eventId = ${payload.eventId}`);
        console.log(`[VOICE DEBUG] customerName = ${payload.customerName}`);
        sendEvent({ type: 'invoice_created', ...payload });
      };

      dispatchEventEmitter.on(DISPATCH_EVENTS.NEW_INCOMING_ORDER, onNewOrder);
      dispatchEventEmitter.on(DISPATCH_EVENTS.UPDATE_INCOMING_ORDER, onUpdateOrder);
      dispatchEventEmitter.on(DISPATCH_EVENTS.TRUCK_IMAGE_UPLOADED, onTruckUpload);
      dispatchEventEmitter.on(DISPATCH_EVENTS.INVOICE_CREATED, onInvoiceCreated);

      console.log(`[VOICE DEBUG] SSE subscribed to INVOICE_CREATED. Total listeners = ${dispatchEventEmitter.listenerCount(DISPATCH_EVENTS.INVOICE_CREATED)}`);

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        dispatchEventEmitter.off(DISPATCH_EVENTS.NEW_INCOMING_ORDER, onNewOrder);
        dispatchEventEmitter.off(DISPATCH_EVENTS.UPDATE_INCOMING_ORDER, onUpdateOrder);
        dispatchEventEmitter.off(DISPATCH_EVENTS.TRUCK_IMAGE_UPLOADED, onTruckUpload);
        dispatchEventEmitter.off(DISPATCH_EVENTS.INVOICE_CREATED, onInvoiceCreated);
        console.log(`[VOICE DEBUG] SSE connection closed (userId: ${session.userId}). Remaining listeners = ${dispatchEventEmitter.listenerCount(DISPATCH_EVENTS.INVOICE_CREATED)}`);
        controller.close();
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform, private',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disables proxy buffering in Nginx
    },
  });
}
