import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getOrCreateSyncRun,
  addSyncEventListener,
} from '@/lib/services/customer-payment-sync-events.service';
import { CustomerPaymentSyncEvent } from '@/lib/types/customer-payment-sync-events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (
    !session ||
    (session.role !== 'ADMIN' && !session.accounts_payment_verify_view)
  ) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { searchParams } = new URL(request.url);
  const syncRunId = searchParams.get('syncRunId');

  if (!syncRunId) {
    return new Response(JSON.stringify({ error: 'syncRunId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  const run = getOrCreateSyncRun(syncRunId);

  let isClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Helper to enqueue formatted SSE data
      const sendEvent = (event: CustomerPaymentSyncEvent) => {
        if (isClosed) return;
        try {
          const payload = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch (err) {
          console.error('[SSE Stream Enqueue Error]', err);
        }
      };

      // 1. Replay any historical events that were already recorded for this run
      for (const pastEvent of run.events) {
        sendEvent(pastEvent);
      }

      // If already completed or failed, close the stream after replaying
      if (run.status === 'COMPLETED' || run.status === 'FAILED') {
        isClosed = true;
        controller.close();
        return;
      }

      // 2. Subscribe to real-time events as they occur
      const unsubscribe = addSyncEventListener(syncRunId, (event) => {
        sendEvent(event);

        if (event.type === 'SYNC_COMPLETED' || event.type === 'SYNC_FAILED') {
          // Allow final packet to flush before closing stream
          setTimeout(() => {
            if (!isClosed) {
              isClosed = true;
              try {
                controller.close();
              } catch {
                // Ignore if already closed
              }
            }
          }, 100);
        }
      });

      // Keep-alive ping interval every 15s to keep connection alive through proxies
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(pingInterval);
        }
      }, 15000);

      // Clean up on client disconnect or abort
      request.signal.addEventListener('abort', () => {
        clearInterval(pingInterval);
        unsubscribe();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering in Nginx if applicable
    },
  });
}
