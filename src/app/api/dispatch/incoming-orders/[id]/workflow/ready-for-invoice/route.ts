import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { dispatchEventEmitter, DISPATCH_EVENTS } from '@/lib/dispatch-events';
import { canCompleteDispatchStep, dispatchForbiddenResponse } from '@/lib/dispatch-auth';
import { recordDispatchWorkflowHistory } from '@/lib/dispatch-history';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!canCompleteDispatchStep(session, 'ready-for-invoice')) {
    return NextResponse.json(dispatchForbiddenResponse('Ready for Invoice'), { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { billingVerified, shippingVerified, warehouseVerified } = body;

    if (!billingVerified || !shippingVerified || !warehouseVerified) {
      return NextResponse.json({ error: 'All fields must be verified' }, { status: 400 });
    }

    const order = await prisma.dispatchIncomingOrder.findUnique({
      where: { id },
      include: { preDispatchWorkflow: true }
    });

    if (!order || !order.preDispatchWorkflow) {
      return NextResponse.json({ error: 'Order/Workflow not found' }, { status: 404 });
    }

    const wf = order.preDispatchWorkflow;
    const isTruckRequired = (order.total ?? 0) > 50000;

    if (wf.rateReviewStatus !== 'COMPLETED' || wf.paymentStatus !== 'COMPLETED' || (isTruckRequired && wf.truckDetailsStatus !== 'COMPLETED')) {
      return NextResponse.json({ error: 'Previous steps including Truck Details must be completed' }, { status: 400 });
    }

    const completedAt = new Date();

    const [updatedWf, updatedOrder] = await prisma.$transaction(async (tx) => {
      const updatedW = await tx.preDispatchWorkflow.update({
        where: { id: wf.id },
        data: {
          readyForInvoiceStatus: 'COMPLETED',
          billingVerified,
          shippingVerified,
          warehouseVerified,
          readyCompletedBy: session.userId,
          readyCompletedAt: completedAt,
          currentStep: Math.max(wf.currentStep, 4)
        }
      });

      const updatedO = await tx.dispatchIncomingOrder.update({
        where: { id },
        data: {
          updatedAt: completedAt
        }
      });

      await recordDispatchWorkflowHistory(tx, {
        dispatchOrderId: id,
        userId: session.userId,
        userName: session.name,
        action: 'Completed Ready for Invoice',
        fromStage: 'Ready for Invoice',
        toStage: 'Invoice Confirmation',
        metadata: { billingVerified, shippingVerified, warehouseVerified }
      });

      return [updatedW, updatedO];
    });

    dispatchEventEmitter.emit(DISPATCH_EVENTS.UPDATE_INCOMING_ORDER, {
      ...updatedOrder,
      preDispatchWorkflow: updatedWf
    });

    return NextResponse.json({ success: true, data: updatedWf });

  } catch (error: any) {
    console.error('[Ready For Invoice Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
