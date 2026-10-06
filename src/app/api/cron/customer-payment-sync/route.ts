import { NextResponse } from 'next/server';
import {
  syncCustomerPayments,
  isWithinPaymentSyncHours,
} from '@/lib/services/customer-payment-verification.service';

export const dynamic = 'force-dynamic';

/**
 * Scheduled Cron Endpoint for Customer Payment Verification Sync.
 *
 * Rules:
 * - Requires CRON_SECRET authorization.
 * - Runs every 30 minutes.
 * - Active between 09:00 AM IST to 09:00 PM IST.
 * - Does NOT run outside working hours unless explicit bypass param 'force=true' is passed.
 */
async function handleCronSync(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret') || request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace('Bearer ', '');
  const force = searchParams.get('force') === 'true';

  const expectedSecret = process.env.CRON_SECRET || 'local_dev_cron_secret';
  if (!secret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check IST working hours: 09:00 AM - 09:00 PM IST
  if (!force && !isWithinPaymentSyncHours()) {
    return NextResponse.json({
      status: 'SKIPPED',
      message: 'Outside automatic sync window (09:00 AM - 09:00 PM IST).',
      skipped: true,
    });
  }

  try {
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

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

    const result = await syncCustomerPayments({
      startDate,
      endDate,
      trigger: 'CRON',
      allowZohoWrites,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Cron CustomerPaymentSync] Error:', error);
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

