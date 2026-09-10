import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hasPostDispatchAccess } from '@/lib/post-dispatch-auth';
import { isConsumerCustomer } from '@/lib/post-dispatch-sync';
import { buildPostDispatchWhereClause } from '@/lib/post-dispatch-query';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get('tab') || 'all_pending';
  const search = (searchParams.get('search') || '').trim();
  const statusFilter = (searchParams.get('status') || '').trim();
  const warehouseFilter = (searchParams.get('warehouse') || '').trim();
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  // Pagination parameters
  const pageParam = searchParams.get('page');
  const pageSizeParam = searchParams.get('pageSize');
  const isAllPages = pageSizeParam === 'all';
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
  const pageSize = isAllPages ? undefined : Math.max(1, parseInt(pageSizeParam || '10', 10) || 10);

  try {
    const commonFilterParams = {
      search,
      statusFilter,
      warehouseFilter,
      startDate,
      endDate,
    };

    // Build the query where clause for the active tab
    const where = buildPostDispatchWhereClause({
      ...commonFilterParams,
      tab,
    });

    // Run paginated findMany and total count in parallel
    const [invoices, totalMatching] = await Promise.all([
      prisma.postDispatchInvoice.findMany({
        where,
        include: {
          workflows: {
            include: {
              submissions: {
                orderBy: { submissionNumber: 'desc' },
                take: 1,
              },
            },
          },
        },
        orderBy: { zohoCreatedTime: 'desc' },
        ...(isAllPages ? {} : { skip: (page - 1) * (pageSize as number), take: pageSize }),
      }),
      prisma.postDispatchInvoice.count({ where }),
    ]);

    // Also calculate dynamic tab counts across the complete filtered dataset
    const [
      allPendingCount,
      verificationCount,
      receivingCount,
      checkCount,
      inventoryCount,
      einvoiceCount,
      archivedCount,
      rawWarehouses,
    ] = await Promise.all([
      prisma.postDispatchInvoice.count({
        where: buildPostDispatchWhereClause({ ...commonFilterParams, tab: 'all_pending' }),
      }),
      prisma.postDispatchInvoice.count({
        where: buildPostDispatchWhereClause({ ...commonFilterParams, tab: 'verification_pending' }),
      }),
      prisma.postDispatchInvoice.count({
        where: buildPostDispatchWhereClause({ ...commonFilterParams, tab: 'receiving_pending' }),
      }),
      prisma.postDispatchInvoice.count({
        where: buildPostDispatchWhereClause({ ...commonFilterParams, tab: 'check_pending' }),
      }),
      prisma.postDispatchInvoice.count({
        where: buildPostDispatchWhereClause({ ...commonFilterParams, tab: 'inventory_pending' }),
      }),
      prisma.postDispatchInvoice.count({
        where: buildPostDispatchWhereClause({ ...commonFilterParams, tab: 'einvoice_pending' }),
      }),
      prisma.postDispatchInvoice.count({
        where: buildPostDispatchWhereClause({ ...commonFilterParams, tab: 'archived' }),
      }),
      prisma.$queryRaw<{ wh: string | null }[]>`
        SELECT DISTINCT "zohoDetailsJson"->>'location_name' as wh
        FROM "PostDispatchInvoice"
        WHERE "zohoDetailsJson" IS NOT NULL
          AND "zohoDetailsJson"->>'location_name' IS NOT NULL
        ORDER BY wh ASC
      `,
    ]);

    const availableWarehouses = rawWarehouses
      .map((w) => w.wh)
      .filter((wh): wh is string => Boolean(wh && wh.trim()));

    // Extract customer IDs to batch lookup local customer records for GSTIN if missing
    const customerIds = Array.from(
      new Set(
        invoices
          .map((inv) => inv.customerId)
          .filter((cid): cid is string => Boolean(cid))
      )
    );

    const localCustomers = customerIds.length > 0
      ? await (prisma as any).customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, gstNumber: true },
        })
      : [];

    const customerGstMap = new Map<string, string>();
    for (const c of localCustomers) {
      if (c.gstNumber && c.gstNumber !== 'NOT_AVAILABLE') {
        customerGstMap.set(c.id, c.gstNumber);
      }
    }

    const now = new Date();

    const formatted = invoices.map((inv) => {
      const startTime = new Date(inv.zohoCreatedTime).getTime();
      const endTime = inv.timerStoppedAt ? new Date(inv.timerStoppedAt).getTime() : now.getTime();
      const elapsedSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));

      const receivingWf = inv.workflows.find((w) => w.workflowType === 'RECEIVING');
      const checkedWf = inv.workflows.find((w) => w.workflowType === 'CHECKED');
      const inventoryWf = inv.workflows.find((w) => w.workflowType === 'INVENTORY_DEDUCTION');
      const completedCount = inv.workflows.filter((w) => w.status === 'COMPLETED').length;
      const isActionable = inv.zohoStatus.toLowerCase() === 'sent' && inv.erpStatus === 'Active';

      const detailsJson = inv.zohoDetailsJson as any;
      const isConsumer = detailsJson?.gst_treatment
        ? isConsumerCustomer({ gstTreatment: detailsJson.gst_treatment })
        : false;
      const warehouseName = (detailsJson?.location_name as string) || null;

      let gstin: string | null = null;
      if (detailsJson?.gst_no && String(detailsJson.gst_no).trim()) {
        gstin = String(detailsJson.gst_no).trim();
      } else if (detailsJson?.shipping_gst_no && String(detailsJson.shipping_gst_no).trim()) {
        gstin = String(detailsJson.shipping_gst_no).trim();
      } else if (inv.customerId && customerGstMap.has(inv.customerId)) {
        gstin = customerGstMap.get(inv.customerId) || null;
      }

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        zohoInvoiceId: inv.zohoInvoiceId,
        customerId: inv.customerId,
        customerName: inv.customerName,
        gstin,
        warehouseName,
        total: inv.total,
        currencyCode: inv.currencyCode,
        salesOrderId: inv.salesOrderId,
        salesOrderNumber: inv.salesOrderNumber,
        zohoStatus: inv.zohoStatus,
        erpStatus: inv.erpStatus,
        erpSubStatus: inv.erpSubStatus,
        isActionable,
        isConsumer,
        eInvoice: {
          generated: inv.eInvoiceGenerated,
          irn: inv.eInvoiceIrn,
          ackNo: inv.eInvoiceAckNo,
          ackDate: inv.eInvoiceAckDate,
          status: inv.eInvoiceStatus,
        },
        timer: {
          startedAt: inv.zohoCreatedTime,
          stoppedAt: inv.timerStoppedAt,
          elapsedSeconds,
          isStopped: !!inv.timerStoppedAt,
        },
        workflowSummary: {
          total: 3,
          completedCount,
          receivingStatus: receivingWf?.status || 'PENDING',
          checkedStatus: checkedWf?.status || 'PENDING',
          inventoryStatus: inventoryWf?.status || 'PENDING',
        },
      };
    });

    const totalPages = isAllPages ? 1 : Math.ceil(totalMatching / (pageSize as number)) || 1;

    const tabCounts = {
      all_pending: allPendingCount,
      verification_pending: verificationCount,
      receiving_pending: receivingCount,
      check_pending: checkCount,
      inventory_pending: inventoryCount,
      einvoice_pending: einvoiceCount,
      archived: archivedCount,
    };

    return NextResponse.json({
      invoices: formatted,
      data: formatted,
      pagination: {
        page: isAllPages ? 1 : page,
        pageSize: isAllPages ? totalMatching : pageSize,
        total: totalMatching,
        totalPages,
      },
      tabCounts,
      availableWarehouses,
    });
  } catch (error: any) {
    console.error('[PostDispatch Invoices API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}
