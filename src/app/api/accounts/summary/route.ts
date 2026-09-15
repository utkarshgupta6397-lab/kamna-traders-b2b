import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    const hasAccess = session && (
      session.role === 'ADMIN' ||
      session.accounts_summary_view ||
      (session.mobile_accounts && session.mobile_accounts_summary_view)
    );
    if (!hasAccess) {
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

    const recoveryLock = await prisma.syncLock.findUnique({
      where: { name: 'RECOVERY_SYNC' },
    });
    const isFullSyncLocked = !!(
      recoveryLock?.isLocked &&
      recoveryLock.lockedAt &&
      Date.now() - recoveryLock.lockedAt.getTime() < 5 * 60 * 1000
    );

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
        isFullSyncLocked,
      },
    });
  } catch (error: any) {
    console.error('[Accounts Summary GET Error]', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
