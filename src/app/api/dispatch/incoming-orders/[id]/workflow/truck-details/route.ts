import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const { photoUrl } = body;

    if (!photoUrl) {
      return NextResponse.json({ error: 'Photo URL is required' }, { status: 400 });
    }

    const order = await prisma.dispatchIncomingOrder.findUnique({
      where: { id },
      include: { preDispatchWorkflow: true }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    let wf = order.preDispatchWorkflow;
    
    // Auto-create workflow if missing since this can happen from mobile first
    if (!wf) {
      wf = await prisma.preDispatchWorkflow.create({
        data: {
          dispatchOrderId: order.id,
          salesorderId: order.zohoSalesorderId
        }
      });
    }

    const updated = await prisma.preDispatchWorkflow.update({
      where: { id: wf.id },
      data: {
        truckDetailsStatus: 'COMPLETED',
        truckPhotoUrl: photoUrl,
        truckUploadedBy: session.userId,
        truckUploadedAt: new Date(),
        overallStatus: 'IN_PROGRESS'
      }
    });

    return NextResponse.json({ success: true, data: updated });

  } catch (error: any) {
    console.error('[Truck Details Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
