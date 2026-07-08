import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { cancellationReason, cancellationRemarks, confirmationText } = body;

    // 1. Validation
    if (!cancellationReason) {
      return NextResponse.json({ error: 'Cancellation reason is required.' }, { status: 400 });
    }
    if (cancellationReason === 'Other' && (!cancellationRemarks || cancellationRemarks.trim() === '')) {
      return NextResponse.json({ error: 'Remarks are required when reason is "Other".' }, { status: 400 });
    }
    if (confirmationText !== 'CANCEL') {
      return NextResponse.json({ error: 'Invalid confirmation text.' }, { status: 400 });
    }

    // 2. Permission Check (Phase 1)
    if (!session.solar_orders_approval && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'You do not have permission to cancel orders.' }, { status: 403 });
    }

    // 3. Fetch Order
    const order = await prisma.solarOrder.findUnique({
      where: { id },
      select: { id: true, isCancelled: true, status: true }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    if (order.isCancelled) {
      return NextResponse.json({ error: 'Order is already cancelled.' }, { status: 400 });
    }

    // 4. Perform Transaction
    await prisma.$transaction(async (tx) => {
      // 4a. Update Order (Phase 4)
      await tx.solarOrder.update({
        where: { id },
        data: {
          isCancelled: true,
          cancelledAt: new Date(),
          cancelledById: session.userId,
          cancellationReason,
          cancellationRemarks
        }
      });

      // 4b. Log Activity Timeline (Phase 8)
      const auditLog = `ORDER CANCELLED\nReason: ${cancellationReason}${cancellationRemarks ? `\nRemarks: ${cancellationRemarks}` : ''}`;
      await tx.projectChatMessage.create({
        data: {
          solarOrderId: id,
          message: auditLog,
          createdById: session.userId
        }
      });

      // 4c. Update Active Tasks (Phase 7)
      const activeTasks = await tx.solarTask.findMany({
        where: {
          solarOrderId: id,
          status: 'PENDING'
        },
        select: { id: true }
      });

      if (activeTasks.length > 0) {
        await tx.solarTask.updateMany({
          where: {
            id: { in: activeTasks.map(t => t.id) }
          },
          data: {
            status: 'CANCELLED',
            completedById: session.userId,
            completedAt: new Date()
          }
        });

        const followUps = activeTasks.map(task => ({
          taskId: task.id,
          userId: session.userId,
          comment: 'Task automatically closed because the associated order was cancelled.',
        }));

        await tx.solarTaskFollowUp.createMany({
          data: followUps
        });
      }
    });

    return NextResponse.json({ success: true, message: 'Order cancelled successfully.' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error', stack: error.stack }, { status: 500 });
  }
}
