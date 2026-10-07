import { NextResponse } from 'next/server';
import { auditVerifiedPaymentIntegrity } from '@/lib/services/customer-payment-integrity-audit.service';
import {
  acquireAuditRunLock,
  releaseAuditRunLock,
} from '@/lib/services/customer-payment-audit-events.service';

export const dynamic = 'force-dynamic';

/**
 * Scheduled Cron Endpoint for Customer Payment Integrity Audit.
 *
 * Rules:
 * - Requires CRON_SECRET authorization via ?secret=, X-Cron-Secret header, or Authorization: Bearer <secret>.
 * - Runs automatically (e.g. hourly cron).
 * - Enforces concurrency protection: skips if another audit is currently running.
 * - Records operation execution with trigger='AUTOMATIC' for last-run tracking.
 */
async function handleCronIntegrityAudit(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret =
    searchParams.get('secret') ||
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace('Bearer ', '');

  const expectedSecret = process.env.CRON_SECRET || 'local_dev_cron_secret';
  if (!secret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const auditRunId = `cron_audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Concurrency check: acquire lock
  const lockResult = acquireAuditRunLock(auditRunId);
  if (!lockResult.acquired) {
    return NextResponse.json(
      {
        status: 'SKIPPED',
        message: 'An integrity audit is already in progress.',
        alreadyRunning: true,
        activeAuditRunId: lockResult.currentRunId,
      },
      { status: 409 }
    );
  }

  try {
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const forceFullAudit = searchParams.get('forceFullAudit') === 'true';

    const allowZohoWritesHeader = request.headers.get('x-allow-zoho-writes') === 'true';
    const allowZohoWritesQuery = searchParams.get('allowZohoWrites') === 'true';
    const allowZohoWrites = allowZohoWritesHeader || allowZohoWritesQuery;
    // In development, staff can test with manual override.
    // In production, writes are strictly governed server-side by ZOHO_VERIFICATION_WRITES_ENABLED.
    const effectiveAllowZohoWrites = process.env.NODE_ENV === 'development' ? allowZohoWrites : false;

    const result = await auditVerifiedPaymentIntegrity({
      startDate,
      endDate,
      trigger: 'AUTOMATIC',
      allowZohoWrites: effectiveAllowZohoWrites,
      auditRunId,
      forceFullAudit,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Cron CustomerPaymentIntegrityAudit] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Customer payment integrity audit failed' },
      { status: 500 }
    );
  } finally {
    releaseAuditRunLock(auditRunId);
  }
}

export async function GET(request: Request) {
  return handleCronIntegrityAudit(request);
}

export async function POST(request: Request) {
  return handleCronIntegrityAudit(request);
}
