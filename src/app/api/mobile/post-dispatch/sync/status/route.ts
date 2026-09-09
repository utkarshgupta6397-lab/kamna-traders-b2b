import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPostDispatchAccess } from '@/lib/post-dispatch-auth';
import { getTodayPostDispatchApiUsage } from '@/lib/post-dispatch-sync';

export const dynamic = 'force-dynamic';

export async function GET() {
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
    const usage = await getTodayPostDispatchApiUsage();
    return NextResponse.json({ usage });
  } catch (error: any) {
    console.error('[PostDispatch Sync Status API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve API usage' },
      { status: 500 }
    );
  }
}
