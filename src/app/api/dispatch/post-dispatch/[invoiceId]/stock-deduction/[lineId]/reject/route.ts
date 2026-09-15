import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canApproveStockDeduction } from '@/lib/post-dispatch-auth';
import { recordPostDispatchHistory } from '@/lib/post-dispatch-history';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string; lineId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canApproveStockDeduction(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { invoiceId, lineId } = await params;
  const userId = (session.userId as string) || (session.id as string);
  const userName = (session.name as string) || 'Staff';

  try {
    const body = await request.json();
    const remarks = (body.remarks || '').trim();
    if (!remarks || remarks.length < 5) {
      return NextResponse.json({ error: 'Rejection remarks are mandatory (min 5 chars).' }, { status: 400 });
    }

    const invoice = await prisma.postDispatchInvoice.findUnique({
      where: { id: invoiceId },
      select: { erpSubStatus: true, zohoStatus: true },
    });
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (invoice.erpSubStatus === 'Void' || invoice.zohoStatus?.toLowerCase() === 'void') {
      return NextResponse.json({ error: 'Invoice Void — Action Blocked' }, { status: 400 });
    }

    const alloc = await prisma.stockDeductionAllocation.findUnique({
      where: { invoiceLineId: lineId },
    });
    if (!alloc || alloc.invoiceId !== invoiceId) {
      return NextResponse.json({ error: 'Allocation not found' }, { status: 404 });
    }
    if (alloc.status !== 'SUBMITTED_FOR_APPROVAL') {
      return NextResponse.json({ error: 'Allocation is not pending approval' }, { status: 409 });
    }
    const rejectedAt = new Date();
    const existingHistory = Array.isArray(alloc.rejectionHistory) ? (alloc.rejectionHistory as any[]) : [];
    const newRejectionEntry = {
      cycle: existingHistory.length + 1,
      rejectedById: userId,
      rejectedByName: userName,
      rejectedAt: rejectedAt.toISOString(),
      rejectionRemarks: remarks,
      previousState: alloc.status,
      newState: 'REWORK_REQUIRED',
      submittedSnapshot: alloc.submittedSnapshot,
    };
    const updatedHistory = [...existingHistory, newRejectionEntry];

    const updated = await prisma.stockDeductionAllocation.update({
      where: { id: alloc.id },
      data: {
        status: 'REWORK_REQUIRED',
        rejectedById: userId,
        rejectedByName: userName,
        rejectedAt,
        rejectionRemarks: remarks,
        rejectionHistory: updatedHistory as any,
      },
    });

    await recordPostDispatchHistory(prisma, {
      invoiceId,
      workflowType: 'INVENTORY_DEDUCTION',
      eventType: 'STOCK_REJECTED',
      userId,
      userName,
      submissionId: alloc.id,
      rejectionReason: remarks,
      metadata: {
        lineId,
        rejectedBy: userName,
        rejectedById: userId,
        rejectedAt: rejectedAt.toISOString(),
        rejectionReason: remarks,
        previousState: alloc.status,
        newState: 'REWORK_REQUIRED',
        rejectedFrom: alloc.submittedById,
      },
    });

    return NextResponse.json({ success: true, allocation: { ...updated, expectedQty: parseFloat(updated.expectedQty.toString()) } });
  } catch (err: any) {
    console.error('[Reject]', err);
    return NextResponse.json({ error: err.message || 'Rejection failed' }, { status: 500 });
  }
}
