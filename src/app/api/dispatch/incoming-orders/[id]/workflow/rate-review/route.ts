import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { dispatchEventEmitter, DISPATCH_EVENTS } from '@/lib/dispatch-events';
import { canCompleteDispatchStep, dispatchForbiddenResponse } from '@/lib/dispatch-auth';
import { recordDispatchWorkflowHistory } from '@/lib/dispatch-history';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!canCompleteDispatchStep(session, 'rate-review')) {
    return NextResponse.json(dispatchForbiddenResponse('Rate Review'), { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { audit, action } = body;

    const order = await prisma.dispatchIncomingOrder.findUnique({
      where: { id },
      include: { preDispatchWorkflow: true }
    });

    if (!order || !order.preDispatchWorkflow) {
      return NextResponse.json({ error: 'Order/Workflow not found' }, { status: 404 });
    }

    const currentWf = order.preDispatchWorkflow;

    // Concurrency protection: If the workflow has already moved past Rate Review
    const isPastRateReview = currentWf.currentStep > 1 || currentWf.rateReviewStatus === 'COMPLETED';

    if (isPastRateReview) {
      if (action === 'save') {
        // Safe no-op: Do NOT mutate database or regress status; return current workflow
        return NextResponse.json({
          success: true,
          message: 'Rate review is already completed; auto-save ignored.',
          data: currentWf
        });
      }
      if (action === 'complete') {
        return NextResponse.json({ error: 'Rate Review is already completed and cannot be modified.' }, { status: 400 });
      }
    }

    // Intermediate Save
    if (action === 'save') {
      const numVerified = Object.keys(audit?.items || {}).length;
      const newStatus = numVerified > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';

      // Atomic conditional update: enforces currentStep == 1 AND rateReviewStatus != 'COMPLETED'
      // If a concurrent complete request committed microseconds ago, count will be 0
      const updateResult = await prisma.preDispatchWorkflow.updateMany({
        where: {
          id: currentWf.id,
          currentStep: 1,
          rateReviewStatus: { not: 'COMPLETED' }
        },
        data: {
          rateReviewAudit: audit,
          rateReviewStatus: newStatus,
          overallStatus: newStatus === 'NOT_STARTED' && currentWf.overallStatus === 'IN_PROGRESS' 
            ? 'NOT_STARTED' 
            : (newStatus === 'IN_PROGRESS' ? 'IN_PROGRESS' : undefined)
        }
      });

      if (updateResult.count === 0) {
        // Stale save detected via atomic DB check! Fetch fresh workflow
        const freshWf = await prisma.preDispatchWorkflow.findUnique({
          where: { id: currentWf.id }
        });
        return NextResponse.json({
          success: true,
          message: 'Workflow already progressed beyond Rate Review; stale save ignored.',
          data: freshWf
        });
      }

      const updated = await prisma.preDispatchWorkflow.findUnique({
        where: { id: currentWf.id }
      });
      return NextResponse.json({ success: true, data: updated });
    }

    // Complete Rate Review
    if (action === 'complete') {
      // Validate server-side that all line items are verified
      const lineItems = (order.zohoDetailsJson as any)?.line_items || [];
      const isAllVerified = lineItems.length > 0 && lineItems.every((item: any) => audit?.items?.[item.item_id]?.verified);
      
      if (!isAllVerified) {
        return NextResponse.json({ error: 'Cannot complete: Not all items are verified.' }, { status: 400 });
      }

      const [updatedWf, updatedOrder] = await prisma.$transaction(async (tx) => {
        // Double-check row state inside transaction to prevent double-complete
        const fresh = await tx.preDispatchWorkflow.findUnique({
          where: { id: currentWf.id }
        });
        if (!fresh || fresh.currentStep > 1 || fresh.rateReviewStatus === 'COMPLETED') {
          throw new Error('Rate Review is already completed.');
        }

        const wf = await tx.preDispatchWorkflow.update({
          where: { id: currentWf.id },
          data: {
            rateReviewStatus: 'COMPLETED',
            rateReviewCompletedBy: session.userId,
            rateReviewCompletedAt: new Date(),
            rateReviewAudit: audit,
            currentStep: Math.max(fresh.currentStep, 2),
            overallStatus: 'IN_PROGRESS'
          }
        });

        const ord = await tx.dispatchIncomingOrder.update({
          where: { id },
          data: { updatedAt: new Date() }
        });

        await recordDispatchWorkflowHistory(tx, {
          dispatchOrderId: id,
          userId: session.userId,
          userName: session.name,
          action: 'Completed Rate Review',
          fromStage: 'Rate Review',
          toStage: 'Payment Verification',
          metadata: { totalItems: lineItems.length }
        });

        return [wf, ord];
      });

      dispatchEventEmitter.emit(DISPATCH_EVENTS.UPDATE_INCOMING_ORDER, {
        ...updatedOrder,
        preDispatchWorkflow: updatedWf
      });

      return NextResponse.json({ success: true, data: updatedWf });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('[Rate Review Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
