import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getOrCreateAuditRun,
  addAuditEventListener,
} from '@/lib/services/customer-payment-audit-events.service';
import { CustomerPaymentAuditEvent } from '@/lib/types/customer-payment-audit-events';

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
  const auditRunId = searchParams.get('auditRunId');

  if (!auditRunId) {
    return new Response(JSON.stringify({ error: 'auditRunId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  const run = getOrCreateAuditRun(auditRunId);

  let isClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event: CustomerPaymentAuditEvent) => {
        if (isClosed) return;
        try {
          const payload = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch (err) {
          console.error('[SSE Audit Stream Enqueue Error]', err);
        }
      };

      // 1. Replay historical events
      for (const pastEvent of run.events) {
        sendEvent(pastEvent);
      }

      // If already terminal, close stream immediately
      if (run.status === 'COMPLETED' || run.status === 'FAILED') {
        isClosed = true;
        controller.close();
        return;
      }

      // 2. Subscribe to live events
      const unsubscribe = addAuditEventListener(auditRunId, (event) => {
        sendEvent(event);

        if (event.type === 'AUDIT_COMPLETED' || event.type === 'AUDIT_FAILED') {
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

      // Keep-alive ping interval every 15s
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(pingInterval);
        }
      }, 15000);

      // Clean up on disconnect
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
    },
  });
}
