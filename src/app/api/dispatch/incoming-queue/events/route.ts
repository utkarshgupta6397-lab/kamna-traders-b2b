import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { dispatchEventEmitter, DISPATCH_EVENTS } from '@/lib/dispatch-events';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  
  if (!session || (session.role !== 'ADMIN' && !session.dispatch_view)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (data: any) => {
        try {
          const payload = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(new TextEncoder().encode(payload));
        } catch (err) {
          console.error('[SSE] Error sending event', err);
        }
      };

      // Send initial connection heartbeat
      sendEvent({ type: 'connected' });

      // Keep connection alive with heartbeat every 30s
      const heartbeat = setInterval(() => {
        sendEvent({ type: 'ping' });
      }, 30000);

      // Listener for new orders
      const onNewOrder = (order: any) => {
        sendEvent({ type: 'new_order', order });
      };

      const onUpdateOrder = (order: any) => {
        sendEvent({ type: 'update_order', order });
      };

      dispatchEventEmitter.on(DISPATCH_EVENTS.NEW_INCOMING_ORDER, onNewOrder);
      dispatchEventEmitter.on(DISPATCH_EVENTS.UPDATE_INCOMING_ORDER, onUpdateOrder);

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        dispatchEventEmitter.off(DISPATCH_EVENTS.NEW_INCOMING_ORDER, onNewOrder);
        dispatchEventEmitter.off(DISPATCH_EVENTS.UPDATE_INCOMING_ORDER, onUpdateOrder);
        controller.close();
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
