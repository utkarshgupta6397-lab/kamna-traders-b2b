import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canEditStockAllocation } from '@/lib/post-dispatch-auth';
import { classifyAllocation, validateAllocationsStock } from '@/lib/stock-deduction-service';
import { recordPostDispatchHistory } from '@/lib/post-dispatch-history';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string; lineId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canEditStockAllocation(session)) return NextResponse.json({ error: 'Forbidden: Stock allocation submission permission required' }, { status: 403 });

  const { invoiceId, lineId } = await params;
  const userId = (session.userId as string) || (session.id as string);
  const userName = (session.name as string) || 'Staff';

  try {
    const alloc = await prisma.stockDeductionAllocation.findUnique({
      where: { invoiceLineId: lineId },
    });
    if (!alloc || alloc.invoiceId !== invoiceId) {
      return NextResponse.json({ error: 'Allocation not found' }, { status: 404 });
    }
    if (alloc.status === 'DEDUCTED') {
      return NextResponse.json({ error: 'Already deducted' }, { status: 409 });
    }
    if (alloc.status === 'SUBMITTED_FOR_APPROVAL') {
      return NextResponse.json({ error: 'Already submitted for approval' }, { status: 409 });
    }

    const entries = (alloc.allocationData as any[]) || [];
    if (entries.length === 0) {
      return NextResponse.json({ error: 'Cannot submit empty allocation for approval.' }, { status: 400 });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // LEVEL 1 STOCK VALIDATION: Insufficient stock NEVER enters approval
    // ──────────────────────────────────────────────────────────────────────────
    const stockCheck = await validateAllocationsStock(prisma, entries);
    if (!stockCheck.valid) {
      return NextResponse.json({
        error: `Cannot submit for approval: ${stockCheck.error}`,
      }, { status: 400 });
    }

    const classResult = classifyAllocation({
      expectedSkuId: alloc.expectedSkuId,
      expectedWarehouseId: alloc.expectedWarehouseId,
      expectedQty: parseFloat(alloc.expectedQty.toString()),
      allocations: entries,
      isExploded: alloc.isExploded,
    });

    if (classResult.classification === 'INVALID' || classResult.classification === 'NOT_ALLOCATED') {
      return NextResponse.json({ error: `Cannot submit: allocation has invalid entries.` }, { status: 400 });
    }

    const snapshot = {
      allocations: entries,
      isExploded: alloc.isExploded,
      expectedSkuId: alloc.expectedSkuId,
      expectedWarehouseId: alloc.expectedWarehouseId,
      expectedQty: parseFloat(alloc.expectedQty.toString()),
      expectedUom: alloc.expectedUom,
      classification: classResult.classification,
      deviationReasons: classResult.deviationReasons,
      snapshotAt: new Date().toISOString(),
    };

    const updated = await prisma.stockDeductionAllocation.update({
      where: { id: alloc.id },
      data: {
        status: 'SUBMITTED_FOR_APPROVAL',
        submittedById: userId,
        submittedByName: userName,
        submittedAt: new Date(),
        submittedSnapshot: snapshot,
        rejectedById: null,
        rejectedByName: null,
        rejectedAt: null,
        rejectionRemarks: null,
      },
    });

    await recordPostDispatchHistory(prisma, {
      invoiceId,
      workflowType: 'INVENTORY_DEDUCTION',
      eventType: 'STOCK_SUBMITTED_FOR_APPROVAL',
      userId,
      userName,
      submissionId: alloc.id,
      metadata: {
        lineId,
        classification: classResult.classification,
        deviationReasons: classResult.deviationReasons,
        snapshotRef: alloc.id,
      },
    });

    return NextResponse.json({ success: true, allocation: { ...updated, expectedQty: parseFloat(updated.expectedQty.toString()) } });
  } catch (err: any) {
    console.error('[Submit]', err);
    return NextResponse.json({ error: err.message || 'Submit failed' }, { status: 500 });
  }
}
