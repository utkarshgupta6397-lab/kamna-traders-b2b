import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPostDispatchAccess } from '@/lib/post-dispatch-auth';
import {
  runPostDispatchSync,
  getUserManualSyncCooldown,
  recordUserManualSyncCooldown,
} from '@/lib/post-dispatch-sync';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPostDispatchAccess(session)) {
    return NextResponse.json(
      { error: 'Forbidden. Post-Dispatch access required.' },
      { status: 403 }
    );
  }

  const userId = session.userId || session.id;

  // 1. SERVER-SIDE USER COOLDOWN CHECK
  if (userId) {
    const cooldown = await getUserManualSyncCooldown(userId);
    if (cooldown.inCooldown) {
      return NextResponse.json(
        {
          success: false,
          reason: 'MANUAL_SYNC_COOLDOWN',
          retry_after_seconds: cooldown.remainingSeconds,
          message: `Please wait ${cooldown.remainingSeconds} seconds before starting another manual sync.`,
        },
        { status: 429 }
      );
    }
  }

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const forceFullSync = Boolean(body?.forceFullSync);

    const result = await runPostDispatchSync({
      trigger: 'MANUAL',
      userId,
      forceFullSync,
    });

    // If sync was skipped because another sync is already in progress,
    // do NOT consume the user's 60-second cooldown!
    if (!result.success && result.skippedReason) {
      return NextResponse.json(
        { success: false, message: result.skippedReason, inProgress: true },
        { status: 409 }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.errorMessage || 'Unable to synchronize invoices. Please try again.' },
        { status: 500 }
      );
    }

    // 2. Sync was ACCEPTED and executed successfully -> Start 60-second cooldown
    if (userId) {
      await recordUserManualSyncCooldown(userId);
    }

    return NextResponse.json({
      success: true,
      message: 'Invoices synchronized successfully.',
      result,
      cooldown_seconds: 60,
    });
  } catch (error: any) {
    console.error('[PostDispatch Sync API] Error:', error);
    return NextResponse.json(
      { error: 'Unable to synchronize invoices. Please try again.' },
      { status: 500 }
    );
  }
}

