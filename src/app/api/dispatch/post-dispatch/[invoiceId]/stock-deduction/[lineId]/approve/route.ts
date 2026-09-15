import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canApproveStockDeduction } from '@/lib/post-dispatch-auth';
import { recordPostDispatchHistory } from '@/lib/post-dispatch-history';
import { executeStockDeduction, checkInvoiceDeductionCompletion } from '@/lib/stock-deduction-service';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string; lineId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canApproveStockDeduction(session)) return NextResponse.json({ error: 'Forbidden: Stock Deduction Approval permission required' }, { status: 403 });

  const { invoiceId, lineId } = await params;
  const userId = (session.userId as string) || (session.id as string);
  const userName = (session.name as string) || 'Staff';

  let allocForCatch: any = null;
  let invoiceNumberForCatch: string = '';

  try {
    const invoice = await prisma.postDispatchInvoice.findUnique({
      where: { id: invoiceId },
      select: { invoiceNumber: true, erpSubStatus: true, zohoStatus: true },
    });
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (invoice.erpSubStatus === 'Void' || invoice.zohoStatus?.toLowerCase() === 'void') {
      return NextResponse.json({ error: 'Invoice Void — Action Blocked' }, { status: 400 });
    }
    invoiceNumberForCatch = invoice.invoiceNumber;

    const alloc = await prisma.stockDeductionAllocation.findUnique({
      where: { invoiceLineId: lineId },
    });
    if (!alloc || alloc.invoiceId !== invoiceId) {
      return NextResponse.json({ error: 'Allocation not found' }, { status: 404 });
    }
    allocForCatch = alloc;

    // Idempotency: If already deducted, return success without mutating stock
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

    if (alloc.status !== 'SUBMITTED_FOR_APPROVAL' && alloc.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Allocation is not pending approval' }, { status: 409 });
    }

    // ── Single Database Transaction: Validate + Lock + Deduct + History ────
    const result = await prisma.$transaction(async (tx) => {
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

      const historyIds = await executeStockDeduction(tx, {
        entries: entries.map((e) => ({
          skuId: e.skuId,
          skuName: e.skuName || '',
          warehouseId: e.warehouseId,
          warehouseName: e.warehouseName || '',
          qty: e.qty,
          uom: e.uom || '',
        })),
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        invoiceLineId: lineId,
        allocationId: alloc.id,
        userId,
        userName,
      });

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

      await recordPostDispatchHistory(tx as any, {
        invoiceId,
        workflowType: 'INVENTORY_DEDUCTION',
        eventType: 'STOCK_DEDUCTED',
        userId,
        userName,
        submissionId: alloc.id,
        metadata: {
          lineId,
          invoiceNumber: invoice.invoiceNumber,
          approvedFrom: alloc.submittedById,
          entries,
          inventoryHistoryIds: historyIds,
          sequence: ['SUBMITTED', 'APPROVED', 'DEDUCTION_STARTED', 'DEDUCTED'],
        },
      });

      const isComplete = await checkInvoiceDeductionCompletion(tx, invoiceId, userId, userName);

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
    console.error('[Approve]', err);
    try {
      if (allocForCatch) {
        await recordPostDispatchHistory(prisma, {
          invoiceId,
          workflowType: 'INVENTORY_DEDUCTION',
          eventType: 'STOCK_DEDUCTION_FAILED',
          userId,
          userName,
          submissionId: allocForCatch.id,
          metadata: {
            lineId,
            invoiceNumber: invoiceNumberForCatch,
            sequence: ['SUBMITTED', 'APPROVED', 'DEDUCTION_FAILED'],
            failureReason: err.message,
          },
        });
      }
    } catch (auditErr) {
      console.error('[Approve Audit Fail]', auditErr);
    }
    return NextResponse.json({ error: err.message || 'Approval failed' }, { status: 400 });
  }
}
