import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hasPostDispatchAccess } from '@/lib/post-dispatch-auth';
import { getIstTodayRange } from '@/lib/post-dispatch-sync';
import { buildPostDispatchWhereClause } from '@/lib/post-dispatch-query';

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
    // 1. Authoritative business date range: TODAY in IST (UTC+5:30)
    const { start, end } = getIstTodayRange();

    // 2. Authoritative Post-Dispatch query where clause matching 'all_pending' tab
    const where = buildPostDispatchWhereClause({
      tab: 'all_pending',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });

    // 3. Server-side aggregate sum and count
    const [aggregateResult, totalInvoiceToday] = await Promise.all([
      prisma.postDispatchInvoice.aggregate({
        _sum: { total: true },
        where,
      }),
      prisma.postDispatchInvoice.count({ where }),
    ]);

    const totalSalesToday = aggregateResult._sum.total ?? 0;

    return NextResponse.json({
      success: true,
      totalSalesToday,
      totalInvoiceToday,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Dashboard PostDispatch Summary API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Post-Dispatch summary' },
      { status: 500 }
    );
  }
}
