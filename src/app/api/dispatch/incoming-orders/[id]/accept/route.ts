import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hasDispatchAccess } from '@/lib/dispatch-auth';
import { dispatchEventEmitter, DISPATCH_EVENTS } from '@/lib/dispatch-events';
import { recordDispatchWorkflowHistory } from '@/lib/dispatch-history';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Pure permission check: Server-side authorization
  // User must have overall dispatch access (admin or dispatch_view)
  if (!hasDispatchAccess(session)) {
    return NextResponse.json(
      { error: 'You do not have permission to perform this dispatch action.', code: 'FORBIDDEN_DISPATCH_ACCESS' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;

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

    if (order.status === 'ARCHIVED' || order.status === 'SENT_BACK_TO_OPS') {
      return NextResponse.json(
        { error: `Cannot accept an order in ${order.status} state.` },
        { status: 400 }
      );
    }

    let workflow = order.preDispatchWorkflow;

    // Idempotency: If already accepted, return existing data without duplicate history records
    if (workflow?.acceptedAt) {
      return NextResponse.json({
        success: true,
        message: 'Order is already accepted.',
        alreadyAccepted: true,
        data: {
          order,
          workflow,
        },
      });
    }

    const now = new Date();
    const actorName = session.name || 'Staff';
    const actorId = session.userId || session.id || 'unknown';

    // Execute acceptance in an atomic transaction
    const [updatedWorkflow, updatedOrder] = await prisma.$transaction(async (tx) => {
      let wf;
      if (workflow) {
        wf = await tx.preDispatchWorkflow.update({
          where: { id: workflow.id },
          data: {
            acceptedAt: now,
            acceptedBy: actorId,
            acceptedByName: actorName,
            overallStatus: workflow.overallStatus === 'NOT_STARTED' ? 'IN_PROGRESS' : workflow.overallStatus,
          },
        });
      } else {
        wf = await tx.preDispatchWorkflow.create({
          data: {
            dispatchOrderId: order.id,
            salesorderId: order.zohoSalesorderId,
            acceptedAt: now,
            acceptedBy: actorId,
            acceptedByName: actorName,
            overallStatus: 'IN_PROGRESS',
          },
        });
      }

      const ord = await tx.dispatchIncomingOrder.update({
        where: { id: order.id },
        data: {
          updatedAt: now,
        },
        include: {
          preDispatchWorkflow: true,
          truckUpload: true,
        },
      });

      // Immutable history entry identifying the user who accepted the Sales Order
      await recordDispatchWorkflowHistory(tx, {
        dispatchOrderId: order.id,
        userId: actorId,
        userName: actorName,
        action: 'Accepted',
        fromStage: 'Incoming Queue',
        toStage: 'Rate Review',
        metadata: {
          salesorderNumber: order.salesorderNumber || order.zohoSalesorderId,
          zohoSalesorderId: order.zohoSalesorderId,
          acceptedAt: now.toISOString(),
        },
      });

      return [wf, ord];
    });

    // Emit event so other connected tabs/clients update in real time
    dispatchEventEmitter.emit(DISPATCH_EVENTS.UPDATE_INCOMING_ORDER, {
      ...updatedOrder,
      preDispatchWorkflow: updatedWorkflow,
    });

    return NextResponse.json({
      success: true,
      message: 'Sales Order accepted successfully.',
      data: {
        order: updatedOrder,
        workflow: updatedWorkflow,
      },
    });
  } catch (error: any) {
    console.error('[Dispatch Order Accept API Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
