import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    // Simplified auth check - wait, checking role or permissions based on layout check.
    // In admin layout, it checks session.role === 'ADMIN'.
    if (!session || (session.role !== 'ADMIN' && !session.accounts_summary_view)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const cache = await prisma.invoiceSummaryCache.findUnique({
      where: { id: 'singleton' },
    });

    if (!cache) {
      return NextResponse.json({
        success: true,
        data: null,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        generatedAt: cache.generatedAt,
        apiCallsUsed: cache.apiCallsUsed,
        refreshedBy: cache.refreshedBy,
        invoiceCount: cache.invoiceCount,
        summary: cache.summary,
        distributions: cache.distributions,
        rows: cache.rows,
      },
    });
  } catch (error: any) {
    console.error('[Accounts Summary GET Error]', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
