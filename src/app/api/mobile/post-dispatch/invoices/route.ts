import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hasPostDispatchAccess } from '@/lib/post-dispatch-auth';
import { isConsumerCustomer } from '@/lib/post-dispatch-sync';
import { buildPostDispatchWhereClause } from '@/lib/post-dispatch-query';
import { computeAggregateInventoryStatus } from '@/lib/stock-deduction-service';
import { getEligibleZohoDispatchWarehouses } from '@/lib/post-dispatch-warehouse-service';

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
    // 1. Fetch only eligible Zoho Books warehouses (active, non-system, zohoLocationId mapped)
    const eligibleWarehouses = await getEligibleZohoDispatchWarehouses();
    const zohoWhMapByLocationId = new Map<string, { id: string; name: string }>();
    const zohoWhMapByName = new Map<string, { id: string; name: string }>();
    for (const w of eligibleWarehouses) {
      if (w.zohoLocationId) zohoWhMapByLocationId.set(w.zohoLocationId, w);
      zohoWhMapByName.set(w.name.toLowerCase(), w);
    }

    const selectedWh =
      warehouseFilter && warehouseFilter !== 'ALL'
        ? eligibleWarehouses.find(
            (w) =>
              w.name.toLowerCase() === warehouseFilter.toLowerCase() ||
              w.id === warehouseFilter ||
              (w.zohoLocationId && w.zohoLocationId === warehouseFilter)
          ) || null
        : null;

    const commonFilterParams = {
      search,
      statusFilter,
      warehouseFilter: selectedWh ? selectedWh.name : warehouseFilter,
      warehouseId: selectedWh?.id || null,
      warehouseLocationId: selectedWh?.zohoLocationId || null,
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
          lines: {
            select: { id: true },
          },
          stockDeductionAllocations: {
            select: { invoiceLineId: true, status: true },
          },
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
    ]);

    const activeWarehouses = eligibleWarehouses.map((w) => ({ id: w.id, name: w.name }));
    const availableWarehouses = eligibleWarehouses.map((w) => w.name);

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

      const zohoStatusLower = (inv.zohoStatus || '').toLowerCase();
      const isVoid = zohoStatusLower === 'void' || inv.erpSubStatus === 'Void';
      const receivingWf = inv.workflows.find((w) => w.workflowType === 'RECEIVING');
      const checkedWf = inv.workflows.find((w) => w.workflowType === 'CHECKED');
      const inventoryWf = inv.workflows.find((w) => w.workflowType === 'INVENTORY_DEDUCTION');

      // Aggregate Inventory Status derived from actual deduction status of lines
      const computedInventoryStatus = isVoid
        ? (inventoryWf?.status || 'PENDING')
        : computeAggregateInventoryStatus(inv.lines?.length || 0, inv.stockDeductionAllocations || []);

      const completedCount =
        (receivingWf?.status === 'COMPLETED' ? 1 : 0) +
        (checkedWf?.status === 'COMPLETED' ? 1 : 0) +
        (computedInventoryStatus === 'COMPLETED' ? 1 : 0);

      const isActionable =
        inv.erpStatus === 'Active' &&
        zohoStatusLower !== 'draft' &&
        !isVoid;

      const detailsJson = inv.zohoDetailsJson as any;
      let gstin: string | null = null;
      if (detailsJson?.gst_no && String(detailsJson.gst_no).trim()) {
        gstin = String(detailsJson.gst_no).trim();
      } else if (detailsJson?.shipping_gst_no && String(detailsJson.shipping_gst_no).trim()) {
        gstin = String(detailsJson.shipping_gst_no).trim();
      } else if (inv.customerId && customerGstMap.has(inv.customerId)) {
        gstin = customerGstMap.get(inv.customerId) || null;
      }

      const isConsumer = detailsJson?.gst_treatment
        ? isConsumerCustomer({ gstTreatment: detailsJson.gst_treatment, gstNumber: gstin })
        : false;

      const locId = detailsJson?.location_id ? String(detailsJson.location_id) : null;
      const canonicalWh = locId ? zohoWhMapByLocationId.get(locId) : null;

      const rawWhName = inv.dispatchWarehouse || (detailsJson?.location_name as string) || null;
      const warehouseName = inv.dispatchWarehouseId
        ? inv.dispatchWarehouse
        : (canonicalWh?.name || rawWhName);

      const rawOriginalWh = inv.originalWarehouse || rawWhName;
      const originalWarehouse = inv.dispatchWarehouseId
        ? (rawOriginalWh ? (zohoWhMapByName.get(rawOriginalWh.toLowerCase())?.name || rawOriginalWh) : warehouseName)
        : (canonicalWh?.name || warehouseName);

      const isReassigned = Boolean(
        inv.dispatchWarehouseId ||
        (originalWarehouse && warehouseName && originalWarehouse !== warehouseName)
      );

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        zohoInvoiceId: inv.zohoInvoiceId,
        customerId: inv.customerId,
        customerName: inv.customerName,
        gstin,
        warehouseName,
        dispatchWarehouse: warehouseName,
        originalWarehouse,
        dispatchWarehouseId: inv.dispatchWarehouseId || null,
        isReassigned,
        reassignedAt: inv.reassignedAt ? inv.reassignedAt.toISOString() : null,
        reassignedByName: inv.reassignedByName || null,
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
          inventoryStatus: computedInventoryStatus,
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

    const canForceArchive = session.role === 'ADMIN' || Boolean(session.dispatch_force_archive);

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
      activeWarehouses,
      canForceArchive,
    });
  } catch (error: any) {
    console.error('[PostDispatch Invoices API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}
