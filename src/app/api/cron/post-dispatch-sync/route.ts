import { NextResponse } from 'next/server';
import { runPostDispatchSync, isWithinIstWorkingHours } from '@/lib/post-dispatch-sync';

export const dynamic = 'force-dynamic';

/**
 * Scheduled Cron Endpoint for POST DISPATCH Invoice Synchronization.
 *
 * Rules:
 * - Requires CRON_SECRET authorization.
 * - Automatic synchronization: Every 15 minutes.
 * - ONLY during 09:00 AM IST -> 08:00 PM IST.
 * - Does NOT run outside working hours unless explicit bypass param 'force=true' is passed.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret') || request.headers.get('x-cron-secret');
  const force = searchParams.get('force') === 'true';

  const expectedSecret = process.env.CRON_SECRET || 'local_dev_cron_secret';
  if (!secret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check IST working hours: 09:00 AM - 08:00 PM IST
  if (!force && !isWithinIstWorkingHours()) {
    return NextResponse.json({
      status: 'SKIPPED',
      message: 'Outside automatic sync window (09:00 AM - 08:00 PM IST).',
      skipped: true,
    });
  }

  try {
    const result = await runPostDispatchSync({
      trigger: 'CRON',
      forceFullSync: searchParams.get('full') === 'true',
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Cron PostDispatchSync] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    );
  }
}
