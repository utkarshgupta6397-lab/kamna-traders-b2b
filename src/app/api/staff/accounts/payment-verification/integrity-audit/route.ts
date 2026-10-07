import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { auditVerifiedPaymentIntegrity } from '@/lib/services/customer-payment-integrity-audit.service';
import {
  acquireAuditRunLock,
  releaseAuditRunLock,
  emitAuditEvent,
} from '@/lib/services/customer-payment-audit-events.service';

export const dynamic = 'force-dynamic';

/**
 * Initiates an integrity audit of verified customer payments.
 * Audits whether amount or date changed in Zoho Books; if so, invalidates verification.
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
    const requestedAuditRunId = searchParams.get('auditRunId');
    const forceFullAudit = searchParams.get('forceFullAudit') === 'true';

    const allowZohoWritesHeader = request.headers.get('x-allow-zoho-writes') === 'true';
    const allowZohoWritesQuery = searchParams.get('allowZohoWrites') === 'true';
    const allowZohoWrites = allowZohoWritesHeader || allowZohoWritesQuery;

    // In development, staff can explicitly opt into Zoho writes via header/query parameter.
    // In production, writes are strictly governed server-side by ZOHO_VERIFICATION_WRITES_ENABLED (client toggle ignored).
    const effectiveAllowZohoWrites = process.env.NODE_ENV === 'development' ? allowZohoWrites : false;

    const auditRunId = requestedAuditRunId || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Concurrency protection: prevent duplicate overlapping audits
    const lockResult = acquireAuditRunLock(auditRunId);
    if (!lockResult.acquired) {
      return NextResponse.json(
        {
          error: 'An integrity audit is already in progress.',
          alreadyRunning: true,
          activeAuditRunId: lockResult.currentRunId,
        },
        { status: 409 }
      );
    }

    // Launch audit in background so HTTP response returns immediately for SSE client
    (async () => {
      try {
        await auditVerifiedPaymentIntegrity({
          startDate,
          endDate,
          trigger: 'MANUAL',
          allowZohoWrites: effectiveAllowZohoWrites,
          auditRunId,
          forceFullAudit,
          onEvent: (event) => {
            emitAuditEvent(event);
          },
        });
      } catch (err: any) {
        console.error('[ManualPaymentAudit Background Execution] Error:', err);
        emitAuditEvent({
          type: 'AUDIT_FAILED',
          auditRunId,
          timestamp: new Date().toISOString(),
          stage: 'BACKGROUND_EXECUTION',
          error: err.message || 'Payment integrity audit failed',
        });
      } finally {
        releaseAuditRunLock(auditRunId);
      }
    })();

    return NextResponse.json({
      success: true,
      auditRunId,
      message: 'Payment integrity audit initiated successfully',
    });
  } catch (error: any) {
    console.error('[ManualPaymentAudit] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Payment integrity audit failed' },
      { status: 500 }
    );
  }
}
