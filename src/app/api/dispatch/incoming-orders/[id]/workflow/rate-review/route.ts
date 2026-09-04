import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

    if (order.preDispatchWorkflow.currentStep > 1 && action === 'complete') {
      return NextResponse.json({ error: 'Rate Review is already completed and cannot be modified.' }, { status: 400 });
    }
    
    // Intermediate Save
    if (action === 'save') {
      const numVerified = Object.keys(audit?.items || {}).length;
      
      const newStatus = numVerified > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';
      
      const updated = await prisma.preDispatchWorkflow.update({
        where: { id: order.preDispatchWorkflow.id },
        data: {
          rateReviewAudit: audit,
          rateReviewStatus: newStatus,
          overallStatus: newStatus === 'NOT_STARTED' && order.preDispatchWorkflow.overallStatus === 'IN_PROGRESS' ? 'NOT_STARTED' : (newStatus === 'IN_PROGRESS' ? 'IN_PROGRESS' : undefined)
        }
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

      const updated = await prisma.preDispatchWorkflow.update({
        where: { id: order.preDispatchWorkflow.id },
        data: {
          rateReviewStatus: 'COMPLETED',
          rateReviewCompletedBy: session.userId,
          rateReviewCompletedAt: new Date(),
          rateReviewAudit: audit,
          currentStep: Math.max(order.preDispatchWorkflow.currentStep, 2),
          overallStatus: 'IN_PROGRESS'
        }
      });
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('[Rate Review Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
