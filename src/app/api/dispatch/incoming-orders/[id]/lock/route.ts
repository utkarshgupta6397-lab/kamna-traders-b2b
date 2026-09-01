import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { lockZohoSalesOrder } from '@/lib/zoho-sales-order-lock';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (!session.dispatch_view && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const order = await prisma.dispatchIncomingOrder.findUnique({ where: { id } });
    
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const updated = await lockZohoSalesOrder(id, order.zohoSalesorderId);
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error('[API Lock Error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
