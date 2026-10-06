import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { syncCustomerPayments } from '@/lib/services/customer-payment-verification.service';
import {
  acquireSyncRunLock,
  releaseSyncRunLock,
  emitSyncEvent,
  getActiveSyncRunId,
  getSyncRun,
} from '@/lib/services/customer-payment-sync-events.service';

export const dynamic = 'force-dynamic';

/**
 * Allows authorized staff/admin to manually trigger a sync from Zoho Books with real-time SSE progress tracking.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (
    !session ||
    (session.role !== 'ADMIN' && !session.accounts_payment_verify_view)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const requestedSyncRunId = searchParams.get('syncRunId');

    const allowZohoWritesHeader = request.headers.get('x-allow-zoho-writes') === 'true';
    const allowZohoWritesQuery = searchParams.get('allowZohoWrites') === 'true';
    const allowZohoWrites = allowZohoWritesHeader || allowZohoWritesQuery;

    // Production safety: reject attempts to use allowZohoWrites outside development
    if (allowZohoWrites && process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: 'Zoho verification write override is strictly disallowed outside local development.' },
        { status: 403 }
      );
    }

    const syncRunId = requestedSyncRunId || `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Concurrency protection: prevent duplicate overlapping executions
    const lockResult = acquireSyncRunLock(syncRunId);
    if (!lockResult.acquired) {
      return NextResponse.json(
        {
          error: 'A Zoho sync operation is already in progress.',
          alreadyRunning: true,
          activeSyncRunId: lockResult.currentRunId,
        },
        { status: 409 }
      );
    }

    // Launch sync asynchronously so the response returns immediately to let SSE connect,
    // or run in background while events stream
    (async () => {
      try {
        await syncCustomerPayments({
          startDate,
          endDate,
          trigger: 'MANUAL',
          allowZohoWrites,
          syncRunId,
          onEvent: (event) => {
            emitSyncEvent(event);
          },
        });
      } catch (err: any) {
        console.error('[ManualPaymentSync Background Execution] Error:', err);
        emitSyncEvent({
          type: 'SYNC_FAILED',
          syncRunId,
          timestamp: new Date().toISOString(),
          stage: 'EXECUTION',
          error: err.message || 'Payment synchronization failed',
        });
      } finally {
        releaseSyncRunLock(syncRunId);
      }
    })();

    return NextResponse.json({
      success: true,
      syncRunId,
      message: 'Sync initiated successfully',
    });
  } catch (error: any) {
    console.error('[ManualPaymentSync] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Payment synchronization failed' },
      { status: 500 }
    );
  }
}

/**
 * GET checks status of a running sync or active lock
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (
    !session ||
    (session.role !== 'ADMIN' && !session.accounts_payment_verify_view)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const syncRunId = searchParams.get('syncRunId');

  if (syncRunId) {
    const run = getSyncRun(syncRunId);
    if (!run) {
      return NextResponse.json({ error: 'Sync run not found' }, { status: 404 });
    }
    return NextResponse.json({
      syncRunId: run.syncRunId,
      status: run.status,
      startedAt: run.startedAt,
      eventCount: run.events.length,
      result: run.result,
      error: run.error,
    });
  }

  const activeId = getActiveSyncRunId();
  return NextResponse.json({
    activeSyncRunId: activeId,
    isRunning: Boolean(activeId),
  });
}

