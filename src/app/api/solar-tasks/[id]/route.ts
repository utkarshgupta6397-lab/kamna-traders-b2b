import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.solar_orders_view) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id: taskId } = await context.params;
    const body = await req.json();

    const { status, dueDate, dueTime, reason } = body;

    const existingTask = await prisma.solarTask.findUnique({ where: { id: taskId } });
    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const updateData: any = {};
    let activityDescription = '';
    let activityType = '';

    if (status) {
      updateData.status = status;
      if (status === 'COMPLETED') {
        updateData.completedById = session.userId;
        updateData.completedAt = new Date();
        activityDescription = `Completed task: ${existingTask.title}`;
        activityType = 'TASK_COMPLETED';
      } else if (status === 'PENDING') {
        updateData.completedById = null;
        updateData.completedAt = null;
        activityDescription = `Reopened task: ${existingTask.title}`;
        activityType = 'TASK_REOPENED';
      }
    }

    if (dueDate) {
      const dueDateObj = new Date(dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (dueDateObj < today) {
        return NextResponse.json({ error: 'Due Date cannot be in the past.' }, { status: 400 });
      }

      updateData.dueDate = dueDateObj;
      if (dueTime !== undefined) updateData.dueTime = dueTime;
      
      const newDateStr = updateData.dueDate.toLocaleDateString();
      activityDescription = `Snoozed task "${existingTask.title}" to ${newDateStr}`;
      if (reason) activityDescription += ` - Reason: ${reason}`;
      activityType = 'TASK_SNOOZED';
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updatedTask = await prisma.$transaction(async (tx) => {
      const task = await tx.solarTask.update({
        where: { id: taskId },
        data: updateData
      });

      if (activityType) {
        await tx.solarActivityLog.create({
          data: {
            solarOrderId: existingTask.solarOrderId,
            eventType: activityType,
            actorId: session.userId,
            actorName: session.name || 'Unknown User',
            description: activityDescription,
          }
        });
      }

      return task;
    });

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
