import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canViewStockApproval } from '@/lib/post-dispatch-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canViewStockApproval(session)) {
    return NextResponse.json({ error: 'Forbidden: Stock Approval view permission required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'ALL'; // ALL | SUBMITTED_FOR_APPROVAL | APPROVED | REJECTED | DEDUCTED
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const warehouseId = searchParams.get('warehouseId') || '';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';

  try {
    // 1. Calculate summary counts
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pendingCount, approvedTodayCount, rejectedTodayCount, deductedTodayCount] = await Promise.all([
      prisma.stockDeductionAllocation.count({
        where: { status: 'SUBMITTED_FOR_APPROVAL' },
      }),
      prisma.stockDeductionAllocation.count({
        where: {
          status: 'APPROVED',
          approvedAt: { gte: today },
        },
      }),
      prisma.stockDeductionAllocation.count({
        where: {
          status: { in: ['REWORK_REQUIRED', 'REJECTED'] },
          rejectedAt: { gte: today },
        },
      }),
      prisma.stockDeductionAllocation.count({
        where: {
          status: 'DEDUCTED',
          classification: { not: 'AUTO_APPROVED' },
          deductedAt: { gte: today },
        },
      }),
    ]);

    // 2. Fetch active warehouses for filter
    const warehouses = await prisma.warehouse.findMany({
      where: { active: true, isSystemWarehouse: false },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    // 3. Build where clause: Show ONLY deviation requests submitted for approval
    const where: any = {
      // Exclude unallocated lines
      status: { notIn: ['NOT_ALLOCATED', 'DRAFT'] },
      // Exclude exact match auto-approved deductions (they do not belong to deviation approval queue)
      classification: { not: 'AUTO_APPROVED' },
    };

    if (status && status !== 'ALL') {
      if (status === 'REWORK_REQUIRED' || status === 'REJECTED') {
        where.status = { in: ['REWORK_REQUIRED', 'REJECTED'] };
      } else {
        where.status = status;
      }
    }

    if (warehouseId) {
      where.expectedWarehouseId = warehouseId;
    }

    if (from || to) {
      const dateFilter: any = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.lte = toDate;
      }
      where.updatedAt = dateFilter;
    }

    // 4. Query allocations with invoice & line
    const allocations = await prisma.stockDeductionAllocation.findMany({
      where,
      orderBy: [
        { status: 'asc' }, // SUBMITTED_FOR_APPROVAL first if alphabetical, or handle in sorting
        { updatedAt: 'desc' },
      ],
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            customerName: true,
            zohoCreatedTime: true,
            zohoStatus: true,
            erpSubStatus: true,
            zohoDetailsJson: true,
          },
        },
        invoiceLine: {
          select: {
            id: true,
            itemName: true,
            quantity: true,
            hsnCode: true,
            rate: true,
            amount: true,
          },
        },
      },
    });

    // Batch resolve ERP catalog prices for all SKUs in allocations
    const allSkuIds = new Set<string>();
    for (const a of allocations) {
      if (a.expectedSkuId) allSkuIds.add(a.expectedSkuId);
      const entries = (a.allocationData as any[]) || [];
      for (const e of entries) {
        if (e.skuId) allSkuIds.add(e.skuId);
      }
    }

    const skuIdList = Array.from(allSkuIds);
    const [skus, variants] = await Promise.all([
      prisma.sku.findMany({
        where: { id: { in: skuIdList } },
        select: { id: true, price: true, unit: true, name: true },
      }),
      prisma.productVariant.findMany({
        where: { sku: { in: skuIdList } },
        select: { sku: true, sellingPrice: true, purchasePrice: true },
      }),
    ]);

    const priceMap = new Map<string, number>();
    for (const s of skus) {
      if (typeof s.price === 'number') priceMap.set(s.id, s.price);
    }
    for (const v of variants) {
      if (v.sku && !priceMap.has(v.sku)) {
        priceMap.set(v.sku, v.sellingPrice || v.purchasePrice || 0);
      }
    }

    // Filter by search query if present
    const filtered = q
      ? allocations.filter(a => {
          const invNum = (a.invoice?.invoiceNumber || '').toLowerCase();
          const custName = (a.invoice?.customerName || '').toLowerCase();
          const sku = (a.expectedSkuId || '').toLowerCase();
          const item = (a.expectedItemName || a.invoiceLine?.itemName || '').toLowerCase();
          return invNum.includes(q) || custName.includes(q) || sku.includes(q) || item.includes(q);
        })
      : allocations;

    // Prioritize pending approval first
    const sorted = filtered.sort((a, b) => {
      if (a.status === 'SUBMITTED_FOR_APPROVAL' && b.status !== 'SUBMITTED_FOR_APPROVAL') return -1;
      if (a.status !== 'SUBMITTED_FOR_APPROVAL' && b.status === 'SUBMITTED_FOR_APPROVAL') return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    const parsedAllocations = sorted.map(a => {
      const zohoDetails = a.invoice?.zohoDetailsJson as any;
      const rawLines = Array.isArray(zohoDetails?.line_items) ? zohoDetails.line_items : [];
      const rawLine = rawLines.find((li: any) => li.line_item_id === a.invoiceLineId || li.name === a.invoiceLine?.itemName);
      const uom = rawLine?.unit || a.expectedUom || 'Units';
      const invoiceDateStr = zohoDetails?.date || (a.invoice?.zohoCreatedTime ? new Date(a.invoice.zohoCreatedTime).toISOString().split('T')[0] : '');

      const rawEntries = (a.allocationData as any[]) || [];
      const enrichedAllocationData = rawEntries.map((e: any) => {
        const unitPrice = priceMap.get(e.skuId) ?? 0;
        const qty = parseFloat(String(e.qty || 0));
        return {
          ...e,
          qty,
          unitPrice,
          lineValue: Math.round(qty * unitPrice * 100) / 100,
        };
      });

      return {
        id: a.id,
        invoiceId: a.invoiceId,
        invoiceLineId: a.invoiceLineId,
        invoiceNumber: a.invoice.invoiceNumber,
        customerName: a.invoice.customerName,
        invoiceDate: invoiceDateStr,
        zohoStatus: a.invoice.zohoStatus,
        erpSubStatus: a.invoice.erpSubStatus,
        isVoid: a.invoice.erpSubStatus === 'Void' || a.invoice.zohoStatus?.toLowerCase() === 'void',
        expectedSkuId: a.expectedSkuId,
        expectedItemName: a.expectedItemName || a.invoiceLine?.itemName,
        expectedWarehouseId: a.expectedWarehouseId,
        expectedQty: parseFloat(a.expectedQty.toString()),
        expectedUom: uom,
        sourceUnitPrice: Number(a.invoiceLine?.rate || 0),
        sourceAmount: Number(a.invoiceLine?.amount || 0),
        allocationData: enrichedAllocationData,
        isExploded: a.isExploded,
        status: a.status,
        classification: a.classification,
        deviationReasons: a.deviationReasons,
        submittedById: a.submittedById,
        submittedByName: a.submittedByName,
        submittedAt: a.submittedAt,
        submittedSnapshot: a.submittedSnapshot,
        approvedById: a.approvedById,
        approvedByName: a.approvedByName,
        approvedAt: a.approvedAt,
        rejectedById: a.rejectedById,
        rejectedByName: a.rejectedByName,
        rejectedAt: a.rejectedAt,
        rejectionRemarks: a.rejectionRemarks,
        rejectionHistory: a.rejectionHistory,
        deductedAt: a.deductedAt,
        deductedById: a.deductedById,
        deductedByName: a.deductedByName,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      };
    });

    return NextResponse.json({
      allocations: parsedAllocations,
      stats: {
        pending: pendingCount,
        approvedToday: approvedTodayCount,
        rejectedToday: rejectedTodayCount,
        deductedToday: deductedTodayCount,
      },
      warehouses,
    });
  } catch (err: any) {
    console.error('[StockApproval Queue GET]', err);
    return NextResponse.json({ error: 'Failed to load stock approval queue' }, { status: 500 });
  }
}
