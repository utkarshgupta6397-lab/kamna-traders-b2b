import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canApproveStockApproval } from '@/lib/post-dispatch-auth';
import { recordPostDispatchHistory } from '@/lib/post-dispatch-history';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
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

  try {
    const body = await request.json();
    const remarks = (body.remarks || '').trim();
    if (!remarks || remarks.length < 5) {
      return NextResponse.json({ error: 'Rejection remarks are mandatory (min 5 chars).' }, { status: 400 });
    }

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

    if (alloc.invoice.erpSubStatus === 'Void' || alloc.invoice.zohoStatus?.toLowerCase() === 'void') {
      return NextResponse.json({ error: 'Invoice Void — Action Blocked' }, { status: 400 });
    }

    if (alloc.status !== 'SUBMITTED_FOR_APPROVAL') {
      return NextResponse.json({ error: `Cannot reject: allocation status is "${alloc.status}"` }, { status: 409 });
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
      invoiceId: alloc.invoiceId,
      workflowType: 'INVENTORY_DEDUCTION',
      eventType: 'STOCK_REJECTED',
      userId,
      userName,
      submissionId: alloc.id,
      rejectionReason: remarks,
      metadata: {
        lineId: alloc.invoiceLineId,
        invoiceNumber: alloc.invoice.invoiceNumber,
        rejectedBy: userName,
        rejectedById: userId,
        rejectedAt: rejectedAt.toISOString(),
        rejectionReason: remarks,
        previousState: alloc.status,
        newState: 'REWORK_REQUIRED',
        rejectedFrom: alloc.submittedById,
      },
    });

    return NextResponse.json({
      success: true,
      allocation: {
        ...updated,
        expectedQty: parseFloat(updated.expectedQty.toString()),
      },
    });
  } catch (err: any) {
    console.error('[StockApproval Reject]', err);
    return NextResponse.json({ error: err.message || 'Rejection failed' }, { status: 500 });
  }
}
