import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canDeductStock } from '@/lib/post-dispatch-auth';
import { classifyAllocation, executeStockDeduction, checkInvoiceDeductionCompletion } from '@/lib/stock-deduction-service';
import { recordPostDispatchHistory } from '@/lib/post-dispatch-history';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string; lineId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canDeductStock(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { invoiceId, lineId } = await params;
  const userId = (session.userId as string) || (session.id as string);
  const userName = (session.name as string) || 'Staff';

  try {
    const body = await request.json();
    const { allocationId } = body;

    const invoice = await prisma.postDispatchInvoice.findUnique({
      where: { id: invoiceId },
      select: { invoiceNumber: true, erpSubStatus: true, zohoStatus: true },
    });
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (invoice.erpSubStatus === 'Void' || invoice.zohoStatus?.toLowerCase() === 'void') {
      return NextResponse.json({ error: 'Invoice Void — Action Blocked' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const alloc = await tx.stockDeductionAllocation.findUnique({
        where: { id: allocationId },
      });

      if (!alloc) throw new Error('Allocation not found');
      if (alloc.invoiceLineId !== lineId || alloc.invoiceId !== invoiceId) {
        throw new Error('Allocation does not belong to this invoice line');
      }
      if (alloc.status === 'DEDUCTED') {
        throw new Error('This allocation has already been deducted.');
      }

      const entries = (alloc.allocationData as any[]) || [];
      const classResult = classifyAllocation({
        expectedSkuId: alloc.expectedSkuId,
        expectedWarehouseId: alloc.expectedWarehouseId,
        expectedQty: parseFloat(alloc.expectedQty.toString()),
        allocations: entries,
        isExploded: alloc.isExploded,
      });

      if (classResult.classification !== 'AUTO_APPROVED') {
        throw new Error(
          `Cannot deduct as-is: classification is "${classResult.classification}". Only AUTO_APPROVED allocations can be deducted directly.`
        );
      }

      const historyIds = await executeStockDeduction(tx, {
        entries: entries.map(e => ({
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
        allocationId,
        userId,
        userName,
      });

      const updatedAlloc = await tx.stockDeductionAllocation.update({
        where: { id: allocationId },
        data: {
          status: 'DEDUCTED',
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
        submissionId: allocationId,
        metadata: {
          lineId,
          invoiceNumber: invoice.invoiceNumber,
          entries,
          inventoryHistoryIds: historyIds,
          method: 'DEDUCT_AS_IS',
        },
      });

      const isComplete = await checkInvoiceDeductionCompletion(tx, invoiceId, userId, userName);

      return { allocation: { ...updatedAlloc, expectedQty: parseFloat(updatedAlloc.expectedQty.toString()) }, historyIds, isComplete };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[DeductAsIs]', err);
    return NextResponse.json({ error: err.message || 'Deduction failed' }, { status: 400 });
  }
}
