import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const { invoiceNumber, invoiceId, mappingMethod } = body;

    if (!invoiceNumber) {
      return NextResponse.json({ error: 'Invoice number is required' }, { status: 400 });
    }

    const order = await prisma.dispatchIncomingOrder.findUnique({
      where: { id },
      include: { preDispatchWorkflow: true }
    });

    if (!order || !order.preDispatchWorkflow) {
      return NextResponse.json({ error: 'Order/Workflow not found' }, { status: 404 });
    }

    const wf = order.preDispatchWorkflow;

    if (wf.readyForInvoiceStatus !== 'COMPLETED') {
      return NextResponse.json({ error: 'Ready For Invoice must be completed first' }, { status: 400 });
    }

    const updated = await prisma.preDispatchWorkflow.update({
      where: { id: wf.id },
      data: {
        invoiceConfirmStatus: 'COMPLETED',
        mappedInvoiceNumber: invoiceNumber,
        mappedInvoiceId: invoiceId || null,
        mappingMethod: mappingMethod || 'MANUAL',
        invoiceConfirmBy: session.userId,
        invoiceConfirmAt: new Date(),
        currentStep: 5,
        overallStatus: 'PRE_DISPATCH_COMPLETED'
      }
    });

    return NextResponse.json({ success: true, data: updated });

  } catch (error: any) {
    console.error('[Invoice Confirmation Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
