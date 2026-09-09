import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canForceArchiveDispatch, dispatchForbiddenResponse } from '@/lib/dispatch-auth';
import { dispatchEventEmitter, DISPATCH_EVENTS } from '@/lib/dispatch-events';
import { recordDispatchWorkflowHistory } from '@/lib/dispatch-history';

export const dynamic = 'force-dynamic';

function getStageName(order: any): string {
  if (order.status === 'SENT_BACK_TO_OPS') return 'Sent Back to Ops';
  if (
    order.status === 'ARCHIVED' ||
    order.preDispatchWorkflow?.overallStatus === 'PRE_DISPATCH_COMPLETED' ||
    order.preDispatchWorkflow?.invoiceConfirmStatus === 'COMPLETED'
  ) {
    return 'Archived';
  }

  const wf = order.preDispatchWorkflow;
  if (!wf || wf.rateReviewStatus !== 'COMPLETED') return 'Rate Review';
  if (wf.paymentStatus !== 'COMPLETED') return 'Payment Verification';
  const isTruckRequired = (order.total ?? 0) > 50000;
  if (isTruckRequired && wf.truckDetailsStatus !== 'COMPLETED') return 'Truck Details';
  if (wf.readyForInvoiceStatus !== 'COMPLETED') return 'Ready for Invoice';
  return 'Invoice Confirmation';
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Pure permission check: Server-side independent enforcement
  if (!canForceArchiveDispatch(session)) {
    return NextResponse.json(
      dispatchForbiddenResponse('Force Archive'),
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    const order = await prisma.dispatchIncomingOrder.findUnique({
      where: { id },
      include: {
        preDispatchWorkflow: true,
        truckUpload: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status === 'ARCHIVED') {
      return NextResponse.json(
        { error: 'Order is already archived.' },
        { status: 400 }
      );
    }

    const currentStage = getStageName(order);
    const now = new Date();

    // Atomic transaction: Update order + workflow + append immutable history
    const [updatedWf, updatedOrder] = await prisma.$transaction(async (tx) => {
      // 1. Update or create workflow
      let wf;
      if (order.preDispatchWorkflow) {
        wf = await tx.preDispatchWorkflow.update({
          where: { id: order.preDispatchWorkflow.id },
          data: {
            overallStatus: 'PRE_DISPATCH_COMPLETED',
            updatedAt: now,
          },
        });
      } else {
        wf = await tx.preDispatchWorkflow.create({
          data: {
            dispatchOrderId: order.id,
            salesorderId: order.zohoSalesorderId,
            overallStatus: 'PRE_DISPATCH_COMPLETED',
          },
        });
      }

      // 2. Move order to ARCHIVED status
      const ord = await tx.dispatchIncomingOrder.update({
        where: { id: order.id },
        data: {
          status: 'ARCHIVED',
          updatedAt: now,
        },
        include: {
          preDispatchWorkflow: true,
          truckUpload: true,
        },
      });

      // 3. Immutably record audit event
      await recordDispatchWorkflowHistory(tx, {
        dispatchOrderId: order.id,
        userId: session.userId,
        userName: session.name,
        action: 'Force Archived',
        fromStage: currentStage,
        toStage: 'Archived',
        metadata: {
          reason: reason ? String(reason).trim() : 'Manual force archive by authorized user',
          previousStatus: order.status,
          archivedAt: now.toISOString(),
        },
      });

      return [wf, ord];
    });

    // Broadcast SSE update so queue updates immediately for all connected clients
    dispatchEventEmitter.emit(DISPATCH_EVENTS.UPDATE_INCOMING_ORDER, {
      ...updatedOrder,
      preDispatchWorkflow: updatedWf,
    });

    return NextResponse.json({
      success: true,
      status: 'SUCCESS',
      message: 'Order force archived successfully.',
      data: {
        order: updatedOrder,
        workflow: updatedWf,
      },
    });
  } catch (error: any) {
    console.error('[Force Archive API Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
