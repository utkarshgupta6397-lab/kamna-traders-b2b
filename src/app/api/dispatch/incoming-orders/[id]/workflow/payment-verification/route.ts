import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { dispatchEventEmitter, DISPATCH_EVENTS } from '@/lib/dispatch-events';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const { decision, note, audit } = body;

    const order = await prisma.dispatchIncomingOrder.findUnique({
      where: { id },
      include: { preDispatchWorkflow: true }
    });

    if (!order || !order.preDispatchWorkflow) {
      return NextResponse.json({ error: 'Order/Workflow not found' }, { status: 404 });
    }

    if (order.preDispatchWorkflow.rateReviewStatus !== 'COMPLETED') {
      return NextResponse.json({ error: 'Rate Review must be completed first' }, { status: 400 });
    }

    const [updatedWf, updatedOrder] = await prisma.$transaction([
      prisma.preDispatchWorkflow.update({
        where: { id: order.preDispatchWorkflow.id },
        data: {
          paymentStatus: 'COMPLETED',
          paymentDecision: decision,
          paymentNote: note,
          paymentCompletedBy: session.userId,
          paymentCompletedAt: new Date(),
          paymentAudit: audit,
          currentStep: Math.max(order.preDispatchWorkflow.currentStep, 3),
          overallStatus: 'IN_PROGRESS'
        }
      }),
      prisma.dispatchIncomingOrder.update({
        where: { id },
        data: { updatedAt: new Date() }
      })
    ]);

    dispatchEventEmitter.emit(DISPATCH_EVENTS.UPDATE_INCOMING_ORDER, {
      ...updatedOrder,
      preDispatchWorkflow: updatedWf
    });

    return NextResponse.json({ success: true, data: updatedWf });

  } catch (error: any) {
    console.error('[Payment Verification Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

