import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { buildPostDispatchWhereClause } from '@/lib/post-dispatch-query';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Strict server-side authorization check: Admin OR dispatch_force_archive
  const canForceArchive = session.role === 'ADMIN' || Boolean(session.dispatch_force_archive);
  if (!canForceArchive) {
    return NextResponse.json(
      { error: 'Forbidden. dispatch_force_archive permission required to execute Archive All.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const filters = body?.filters || {};
    const reason = (body?.reason || '').trim() || 'Bulk administrative force archive';

    const tab = filters.tab || 'all_pending';

    // Disallow running Archive All on the 'archived' tab itself
    if (tab === 'archived') {
      return NextResponse.json(
        { error: 'Cannot archive invoices that are already in the Archived tab.', count: 0 },
        { status: 400 }
      );
    }

    // Reconstruct the exact matching where clause using the shared query builder
    const baseWhere = buildPostDispatchWhereClause({
      tab,
      search: filters.search,
      statusFilter: filters.statusFilter,
      warehouseFilter: filters.warehouseFilter,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });

    // Ensure we only select non-archived invoices (do not re-process already archived records)
    const where = {
      ...baseWhere,
      erpStatus: { not: 'Archived' },
    };

    // Find all matching invoices to archive
    const matchingInvoices = await prisma.postDispatchInvoice.findMany({
      where,
      select: {
        id: true,
        invoiceNumber: true,
        erpStatus: true,
        erpSubStatus: true,
        timerStoppedAt: true,
      },
    });

    const totalMatching = matchingInvoices.length;
    if (totalMatching === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active matching invoices found to archive.',
        count: 0,
      });
    }

    const now = new Date();
    const userId = session.userId || session.id || null;
    const userName = session.name || 'Admin';

    // Process in controlled batches of 100 to avoid database transaction timeouts
    const BATCH_SIZE = 100;
    let archivedCount = 0;

    for (let i = 0; i < matchingInvoices.length; i += BATCH_SIZE) {
      const batch = matchingInvoices.slice(i, i + BATCH_SIZE);
      const batchIds = batch.map((inv) => inv.id);

      await prisma.$transaction(async (tx) => {
        // 1. Bulk update status to Archived with Force Archived sub-status and freeze timer
        await tx.postDispatchInvoice.updateMany({
          where: { id: { in: batchIds } },
          data: {
            erpStatus: 'Archived',
            erpSubStatus: 'Force Archived',
            timerStoppedAt: now,
          },
        });

        // 2. Create immutable audit history entries for each invoice in batch
        const historyData = batch.map((inv) => ({
          invoiceId: inv.id,
          eventType: 'INVOICE_FORCE_ARCHIVED',
          userId,
          userName,
          metadata: {
            previousErpStatus: inv.erpStatus,
            previousSubStatus: inv.erpSubStatus,
            reason,
            batchArchive: true,
            filterContext: {
              tab,
              warehouse: filters.warehouseFilter || 'ALL',
              search: filters.search || null,
              dateRange: filters.startDate || filters.endDate ? { start: filters.startDate, end: filters.endDate } : null,
            },
            forceArchivedAt: now.toISOString(),
          },
        }));

        await tx.postDispatchHistory.createMany({
          data: historyData,
        });
      });

      archivedCount += batch.length;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully archived ${archivedCount} invoice(s).`,
      count: archivedCount,
    });
  } catch (error: any) {
    console.error('[Archive All API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to execute bulk archive' },
      { status: 500 }
    );
  }
}
