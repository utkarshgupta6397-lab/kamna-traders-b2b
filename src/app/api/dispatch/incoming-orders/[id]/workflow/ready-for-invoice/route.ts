import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

    if (wf.rateReviewStatus !== 'COMPLETED' || wf.paymentStatus !== 'COMPLETED' || wf.truckDetailsStatus !== 'COMPLETED') {
      return NextResponse.json({ error: 'Previous steps including Truck Details must be completed' }, { status: 400 });
    }

    const updated = await prisma.preDispatchWorkflow.update({
      where: { id: wf.id },
      data: {
        readyForInvoiceStatus: 'COMPLETED',
        billingVerified,
        shippingVerified,
        warehouseVerified,
        readyCompletedBy: session.userId,
        readyCompletedAt: new Date(),
        currentStep: Math.max(wf.currentStep, 4)
      }
    });

    return NextResponse.json({ success: true, data: updated });

  } catch (error: any) {
    console.error('[Ready For Invoice Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
