import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = session.role === 'ADMIN';
    if (!isAdmin && !session.solar_orders_approval) {
      return NextResponse.json({ error: 'Permission denied. Only approvers can update the file charge status.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    
    if (typeof body.fileChargePaid !== 'boolean') {
      return NextResponse.json({ error: 'Invalid fileChargePaid value' }, { status: 400 });
    }

    const order = await prisma.solarOrder.findUnique({
      where: { id }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Variations of Sub-Vendor matching existing UI constraints
    const isSubVendor = ['SUB_VENDOR', 'SUB-VENDOR'].includes(order.leadSource?.toUpperCase());
    if (!isSubVendor) {
      return NextResponse.json({ error: 'File charge tracking is only applicable for Sub-Vendor orders.' }, { status: 400 });
    }

    const previousValue = order.fileChargePaid;
    const newValue = body.fileChargePaid;

    if (previousValue === newValue) {
      return NextResponse.json({ success: true, order });
    }

    // Execute in transaction to ensure audit log consistency
    const result = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.solarOrder.update({
        where: { id },
        data: {
          fileChargePaid: newValue,
          lastEditedAt: new Date(),
          editCount: { increment: 1 }
        }
      });

      await tx.solarActivityLog.create({
        data: {
          solarOrderId: id,
          eventType: 'FILE_CHARGE_UPDATED',
          actorId: session.userId,
          actorName: session.name || 'Unknown',
          description: `changed File Charge Paid\n\n${previousValue ? 'True' : 'False'} → ${newValue ? 'True' : 'False'}`,
          metadata: {
            field: 'fileChargePaid',
            oldValue: previousValue,
            newValue: newValue
          }
        }
      });

      return updatedOrder;
    });

    return NextResponse.json({ success: true, order: result });
  } catch (error) {
    console.error('[FILE_CHARGE_PATCH]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
