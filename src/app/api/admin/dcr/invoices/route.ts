import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') || 'active';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const skip = (page - 1) * limit;
    
    const whereClause: any = { invoiceStatus: { not: 'void' } };
    if (view === 'active') {
      whereClause.archived = false;
      whereClause.dcrStatus = { in: ['NEW', 'UNDER_REVIEW'] };
    } else {
      // archived
      whereClause.OR = [
        { archived: true },
        { dcrStatus: { in: ['NO_DCR_REQUIRED', 'PENDING_SERIALS', 'READY_TO_ISSUE', 'ISSUED'] } }
      ];
    }

    const [invoices, totalInvoices] = await Promise.all([
      prisma.dcrInvoice.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
        include: {
          _count: {
            select: { items: true },
          },
        },
      }),
      prisma.dcrInvoice.count({
        where: whereClause,
      })
    ]);

    const lastSyncLog = await prisma.dcrAuditLog.findFirst({
      where: {
        action: {
          in: ['SYNC_CREATE_FROM_ZOHO', 'SYNC_UPDATE_FROM_ZOHO', 'SYNC_CREATE_AUTO_SKIPPED', 'AUTO_LOW_VALUE_BACKFILL'],
        }
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    // Global KPIs
    const [totalImported, newCount, underReviewCount] = await Promise.all([
      prisma.dcrInvoice.count({
        where: { invoiceStatus: { not: 'void' } }
      }),
      prisma.dcrInvoice.count({
        where: { archived: false, dcrStatus: 'NEW', invoiceStatus: { not: 'void' } }
      }),
      prisma.dcrInvoice.count({
        where: { archived: false, dcrStatus: 'UNDER_REVIEW', invoiceStatus: { not: 'void' } }
      })
    ]);

    // Zoho API Logs for today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [apiLogs, recentLogs, lastSyncRun] = await Promise.all([
      prisma.zohoApiLog.groupBy({
        by: ['endpoint'],
        where: { timestamp: { gte: startOfToday } },
        _count: true,
      }),
      prisma.zohoApiLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: 20,
        select: {
          timestamp: true,
          endpoint: true,
        }
      }),
      prisma.dcrAuditLog.findFirst({
        where: { entityType: 'SYNC_RUN' },
        orderBy: { createdAt: 'desc' },
      })
    ]);

    let syncCalls = 0;
    let detailCalls = 0;

    apiLogs.forEach(l => {
      if (l.endpoint === 'FETCH_INVOICES') syncCalls += l._count;
      if (l.endpoint === 'FETCH_INVOICE_DETAILS') detailCalls += l._count;
    });

    const totalApiCalls = syncCalls + detailCalls;
    const limitMax = 2000;
    const remainingCalls = Math.max(0, limitMax - totalApiCalls);
    let health = 'Healthy';
    if (totalApiCalls >= limitMax) {
      health = 'Error';
    } else if (totalApiCalls > limitMax * 0.9) {
      health = 'Warning';
    }

    const runMetadata = lastSyncRun?.metadata as any;
    const lastSyncDetails = {
      lastSyncTime: lastSyncRun?.createdAt || lastSyncLog?.createdAt || null,
      syncRange: runMetadata?.startDate && runMetadata?.endDate 
        ? `${runMetadata.startDate} to ${runMetadata.endDate}` 
        : (lastSyncLog ? 'Today' : 'N/A'),
      invoicesImported: runMetadata ? (runMetadata.created + runMetadata.updated) : 0,
    };

    const recentCalls = recentLogs.map(log => ({
      timestamp: log.timestamp,
      endpoint: log.endpoint,
      status: 'SUCCESS'
    }));

    return NextResponse.json({ 
      invoices,
      total: totalInvoices,
      page,
      limit,
      lastSyncTime: lastSyncDetails.lastSyncTime,
      kpis: {
        totalImported,
        newCount,
        totalReviewPending: newCount + underReviewCount
      },
      apiUsage: {
        syncCalls,
        detailCalls,
        customerCalls: 0,
        itemCalls: 0,
        totalCalls: totalApiCalls,
        lastUpdated: new Date(),
        rateLimit: {
          used: totalApiCalls,
          remaining: remainingCalls,
          health
        },
        lastSyncDetails,
        recentCalls
      }
    });
  } catch (error: any) {
    console.error('[DCR Invoices GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch DCR invoices' }, { status: 500 });
  }
}
