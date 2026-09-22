import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasDispatchAccess } from '@/lib/dispatch-auth';
import { getPreDispatchActiveOrders } from '@/lib/pre-dispatch-status';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasDispatchAccess(session)) {
    return NextResponse.json(
      { error: 'Forbidden. Dispatch access required.' },
      { status: 403 }
    );
  }

  try {
    const orders = await getPreDispatchActiveOrders();

    return NextResponse.json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error: any) {
    console.error('[Dashboard Pre-Dispatch Active API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active Pre-Dispatch orders' },
      { status: 500 }
    );
  }
}
