import { NextResponse } from 'next/server';
import { executeDcrSync } from '@/lib/services/dcr-sync.service';

export const dynamic = 'force-dynamic';

/**
 * Scheduled Cron Endpoint for DCR Invoice Synchronization.
 * Hostinger VPS Deployment:
 * - Configured in Linux crontab / systemd to run every 30 minutes between 09:00 AM and 09:00 PM IST (25 runs/day).
 * - Requires CRON_SECRET authorization (via X-Cron-Secret, Authorization: Bearer <secret>, or ?secret=).
 * - Ingests via Zoho Books Listing API directly into DcrInvoice with zero individual detail calls.
 * - Prevents overlapping runs using the existing SyncLock table.
 */
async function handleCronSync(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret =
    searchParams.get('secret') ||
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace('Bearer ', '');
  const force = searchParams.get('force') === 'true';

  const expectedSecret = process.env.CRON_SECRET || 'local_dev_cron_secret';
  if (!secret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const startDate = searchParams.get('startDate') || searchParams.get('date_start') || undefined;
    const endDate = searchParams.get('endDate') || searchParams.get('date_end') || undefined;

    const result = await executeDcrSync({
      startDate,
      endDate,
      trigger: 'CRON',
      force,
    });

    if (result.status === 'SKIPPED') {
      return NextResponse.json(result, { status: 200 });
    }

    if (result.status === 'LOCKED') {
      return NextResponse.json(result, { status: 409 });
    }

    if (result.status === 'FAILED') {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Cron DcrSync] Unhandled error:', error);
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleCronSync(request);
}

export async function POST(request: Request) {
  return handleCronSync(request);
}
