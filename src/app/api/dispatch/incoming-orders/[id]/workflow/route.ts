import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  
  const order = await prisma.dispatchIncomingOrder.findUnique({
    where: { id },
    include: { preDispatchWorkflow: true }
  });

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  let workflow = order.preDispatchWorkflow;
  
  // Auto-initialize workflow if not exists
  if (!workflow) {
    workflow = await prisma.preDispatchWorkflow.create({
      data: {
        dispatchOrderId: order.id,
        salesorderId: order.zohoSalesorderId
      }
    });
  }

  return NextResponse.json({ success: true, data: { order, workflow } });
}
