import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPostDispatchAccess } from '@/lib/post-dispatch-auth';
import { runPostDispatchSync } from '@/lib/post-dispatch-sync';

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

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const forceFullSync = Boolean(body?.forceFullSync);

    const result = await runPostDispatchSync({
      trigger: 'MANUAL',
      userId: session.userId || session.id,
      forceFullSync,
    });

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

    return NextResponse.json({
      success: true,
      message: 'Invoices synchronized successfully.',
      result,
    });
  } catch (error: any) {
    console.error('[PostDispatch Sync API] Error:', error);
    return NextResponse.json(
      { error: 'Unable to synchronize invoices. Please try again.' },
      { status: 500 }
    );
  }
}
