import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canApproveStockApproval } from '@/lib/post-dispatch-auth';
import { recordPostDispatchHistory } from '@/lib/post-dispatch-history';
import { executeStockDeduction, checkInvoiceDeductionCompletion } from '@/lib/stock-deduction-service';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ allocationId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canApproveStockApproval(session)) {
    return NextResponse.json({ error: 'Forbidden: Stock Approval permission required' }, { status: 403 });
  }

  const { allocationId } = await params;
  const userId = (session.userId as string) || (session.id as string);
  const userName = (session.name as string) || 'Staff';

  let allocForCatch: any = null;

  try {
    const alloc = await prisma.stockDeductionAllocation.findUnique({
      where: { id: allocationId },
      include: {
        invoice: {
          select: { id: true, invoiceNumber: true, erpSubStatus: true, zohoStatus: true },
        },
      },
    });

    if (!alloc) {
      return NextResponse.json({ error: 'Allocation not found' }, { status: 404 });
    }
    allocForCatch = alloc;

    if (alloc.invoice.erpSubStatus === 'Void' || alloc.invoice.zohoStatus?.toLowerCase() === 'void') {
      return NextResponse.json({ error: 'Invoice Void — Action Blocked' }, { status: 400 });
    }

    // ── Idempotency Check: Already deducted allocations must not be deducted twice ──
    if (alloc.status === 'DEDUCTED') {
      return NextResponse.json({
        success: true,
        message: 'This allocation has already been deducted.',
        allocation: {
          ...alloc,
          expectedQty: parseFloat(alloc.expectedQty.toString()),
        },
      });
    }

    // Allow SUBMITTED_FOR_APPROVAL and existing APPROVED allocations to be deducted
    if (alloc.status !== 'SUBMITTED_FOR_APPROVAL' && alloc.status !== 'APPROVED') {
      return NextResponse.json({ error: `Cannot approve: allocation status is "${alloc.status}"` }, { status: 409 });
    }

    // ── Single Database Transaction: Validate + Lock + Deduct + History ────
    const result = await prisma.$transaction(async (tx) => {
      // 1. Re-check allocation state under transaction
      const currentAlloc = await tx.stockDeductionAllocation.findUnique({
        where: { id: alloc.id },
      });
      if (!currentAlloc) throw new Error('Allocation not found');
      if (currentAlloc.status === 'DEDUCTED') {
        return { allocation: currentAlloc, historyIds: [], isComplete: false, alreadyDeducted: true };
      }

      const entries = (currentAlloc.allocationData as any[]) || [];
      if (entries.length === 0) {
        throw new Error('No items allocated for deduction.');
      }

      // 2. Row locking, stock validation, decrement and InventoryHistory creation
      const historyIds = await executeStockDeduction(tx, {
        entries: entries.map((e) => ({
          skuId: e.skuId,
          skuName: e.skuName || '',
          warehouseId: e.warehouseId,
          warehouseName: e.warehouseName || '',
          qty: e.qty,
          uom: e.uom || '',
        })),
        invoiceId: alloc.invoiceId,
        invoiceNumber: alloc.invoice.invoiceNumber,
        invoiceLineId: alloc.invoiceLineId,
        allocationId: alloc.id,
        userId,
        userName,
      });

      // 3. Mark allocation DEDUCTED atomically
      const updated = await tx.stockDeductionAllocation.update({
        where: { id: alloc.id },
        data: {
          status: 'DEDUCTED',
          approvedById: userId,
          approvedByName: userName,
          approvedAt: currentAlloc.approvedAt || new Date(),
          deductedAt: new Date(),
          deductedById: userId,
          deductedByName: userName,
          inventoryHistoryIds: historyIds as any,
        },
      });

      // 4. Record PostDispatchHistory event with sequence audit
      await recordPostDispatchHistory(tx as any, {
        invoiceId: alloc.invoiceId,
        workflowType: 'INVENTORY_DEDUCTION',
        eventType: 'STOCK_DEDUCTED',
        userId,
        userName,
        submissionId: alloc.id,
        metadata: {
          lineId: alloc.invoiceLineId,
          invoiceNumber: alloc.invoice.invoiceNumber,
          approvedFrom: alloc.submittedById,
          entries,
          inventoryHistoryIds: historyIds,
          sequence: ['SUBMITTED', 'APPROVED', 'DEDUCTION_STARTED', 'DEDUCTED'],
        },
      });

      // 5. Check if entire invoice deduction is completed
      const isComplete = await checkInvoiceDeductionCompletion(tx, alloc.invoiceId, userId, userName);

      return { allocation: updated, historyIds, isComplete, alreadyDeducted: false };
    });

    return NextResponse.json({
      success: true,
      allocation: {
        ...result.allocation,
        expectedQty: parseFloat(result.allocation.expectedQty.toString()),
      },
      historyIds: result.historyIds,
      isComplete: result.isComplete,
    });
  } catch (err: any) {
    console.error('[StockApproval Approve]', err);
    try {
      if (allocForCatch) {
        await recordPostDispatchHistory(prisma, {
          invoiceId: allocForCatch.invoiceId,
          workflowType: 'INVENTORY_DEDUCTION',
          eventType: 'STOCK_DEDUCTION_FAILED',
          userId,
          userName,
          submissionId: allocForCatch.id,
          metadata: {
            lineId: allocForCatch.invoiceLineId,
            invoiceNumber: allocForCatch.invoice.invoiceNumber,
            sequence: ['SUBMITTED', 'APPROVED', 'DEDUCTION_FAILED'],
            failureReason: err.message,
          },
        });
      }
    } catch (auditErr) {
      console.error('[StockApproval Approve Audit Fail]', auditErr);
    }
    return NextResponse.json({ error: err.message || 'Approval and deduction failed' }, { status: 400 });
  }
}
