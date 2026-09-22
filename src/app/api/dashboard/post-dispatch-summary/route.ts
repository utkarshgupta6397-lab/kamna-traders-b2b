import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPostDispatchAccess } from '@/lib/post-dispatch-auth';
import { getPostDispatchDashboardSummary } from '@/lib/post-dispatch-summary';

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
    const summary = await getPostDispatchDashboardSummary();

    return NextResponse.json({
      success: true,
      totalSalesToday: summary.totalSalesToday,
      totalInvoiceToday: summary.totalInvoiceToday,
      pendingStockApprovals: summary.pendingStockApprovals,
      dateRange: summary.dateRange,
      salesTrend: summary.salesTrend,
    });
  } catch (error: any) {
    console.error('[Dashboard PostDispatch Summary API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Post-Dispatch summary' },
      { status: 500 }
    );
  }
}
