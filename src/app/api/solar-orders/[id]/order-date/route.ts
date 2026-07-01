import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    const { id } = await context.params;

    if (!session || (!session.solar_orders_edit_order_date && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const order = await prisma.solarOrder.findUnique({
      where: { id },
      select: { id: true, status: true, orderDate: true, orderNumber: true }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status !== 'DRAFT' && order.status !== 'PENDING_APPROVAL') {
      return NextResponse.json({ error: 'Order Date can only be edited in Draft or Pending Approval stages' }, { status: 400 });
    }

    const body = await request.json();
    if (!body.orderDate) {
      return NextResponse.json({ error: 'Order Date is required' }, { status: 400 });
    }

    const orderDateObj = new Date(body.orderDate);
    if (isNaN(orderDateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid Order Date format' }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneYearAgo = new Date(today);
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    
    const dateToCheck = new Date(orderDateObj);
    dateToCheck.setHours(0,0,0,0);

    if (dateToCheck > today) {
      return NextResponse.json({ error: 'Order Date cannot be in the future' }, { status: 400 });
    }
    if (dateToCheck < oneYearAgo) {
      return NextResponse.json({ error: 'Order Date cannot be older than one year' }, { status: 400 });
    }

    const oldDateStr = new Date(order.orderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const newDateStr = new Date(orderDateObj).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    if (oldDateStr === newDateStr) {
      return NextResponse.json({ success: true });
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.solarOrder.update({
        where: { id },
        data: { orderDate: orderDateObj }
      });

      await tx.solarActivityLog.create({
        data: {
          solarOrderId: id,
          actorId: session.userId,
          actorName: session.name || 'Unknown User',
          eventType: 'ORDER_UPDATED',
          description: `Order Date changed from ${oldDateStr} to ${newDateStr}`
        }
      });

      return updated;
    });

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error('[SolarOrders OrderDate PATCH Error]', error);
    return NextResponse.json({ error: 'Failed to update order date' }, { status: 500 });
  }
}
