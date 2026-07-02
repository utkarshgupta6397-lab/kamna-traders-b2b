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

    // Use subVendorId as the definitive check for a Sub-Vendor order
    const isSubVendor = !!order.subVendorId;
    if (!isSubVendor) {
      return NextResponse.json({ error: 'File charge tracking is only applicable for Sub-Vendor orders.' }, { status: 400 });
    }

    const previousValue = order.fileChargePaid;
    const newValue = body.fileChargePaid;
    let fileChargeAmount = order.fileChargeAmount;

    // Validate amount if marking as paid
    if (newValue === true) {
      if (body.fileChargeAmount === undefined || body.fileChargeAmount === null || isNaN(Number(body.fileChargeAmount))) {
        return NextResponse.json({ error: 'File charge amount is required when marking as paid.' }, { status: 400 });
      }
      const amount = Number(body.fileChargeAmount);
      if (amount <= 0) {
        return NextResponse.json({ error: 'File charge amount must be greater than zero.' }, { status: 400 });
      }
      fileChargeAmount = amount;
    }

    // Execute in transaction to ensure audit log consistency
    const result = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.solarOrder.update({
        where: { id },
        data: {
          fileChargePaid: newValue,
          fileChargeAmount: newValue ? fileChargeAmount : order.fileChargeAmount, // Retain amount if marked unpaid
          lastEditedAt: new Date(),
          editCount: { increment: 1 }
        }
      });

      let logDescription = newValue 
        ? `Marked File Charge as Paid. Amount: ₹${fileChargeAmount?.toLocaleString('en-IN')}` 
        : `Marked File Charge as Not Paid.`;

      await tx.solarActivityLog.create({
        data: {
          solarOrderId: id,
          eventType: 'FILE_CHARGE_UPDATED',
          actorId: session.userId,
          actorName: session.name || 'Unknown',
          description: logDescription,
          metadata: {
            field: 'fileChargePaid',
            oldValue: previousValue,
            newValue: newValue,
            fileChargeAmount: fileChargeAmount ?? null
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
