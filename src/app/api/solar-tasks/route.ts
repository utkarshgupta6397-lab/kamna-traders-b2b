import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.solar_orders_view) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'ALL'; // ALL, MINE, TODAY, OVERDUE, COMPLETED

    const where: any = {};
    const now = new Date();

    if (filter === 'MINE') {
      where.assignedToId = session.userId;
      where.status = 'PENDING';
    } else if (filter === 'COMPLETED') {
      where.status = 'COMPLETED';
    } else if (filter === 'OVERDUE') {
      where.status = 'PENDING';
      where.dueDate = { lt: new Date(now.setHours(0,0,0,0)) };
    } else if (filter === 'TODAY') {
      where.status = 'PENDING';
      const startOfDay = new Date(now.setHours(0,0,0,0));
      const endOfDay = new Date(now.setHours(23,59,59,999));
      where.dueDate = { gte: startOfDay, lte: endOfDay };
    } else if (filter === 'ALL') {
      where.status = 'PENDING';
    }

    const tasks = await prisma.solarTask.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        solarOrder: { 
          select: { 
            id: true, 
            orderNumber: true, 
            customerName: true 
          } 
        }
      },
      orderBy: [
        { dueDate: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    const users = await prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' }
    });

    const openTasksCount = await prisma.solarTask.count({
      where: {
        status: 'PENDING'
      }
    });

    return NextResponse.json({
      tasks,
      users,
      badgeCount: openTasksCount
    });
  } catch (error) {
    console.error('Error fetching global tasks:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.solar_orders_view) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { solarOrderId, title, description, assignedToId, dueDate, dueTime, status } = body;

    if (!solarOrderId || !title || !assignedToId || !dueDate) {
      return NextResponse.json({ error: 'Order, Title, Assigned To, and Due Date are required' }, { status: 400 });
    }

    const dueDateObj = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dueDateObj < today) {
      return NextResponse.json({ error: 'Due Date cannot be in the past.' }, { status: 400 });
    }

    const order = await prisma.solarOrder.findUnique({
      where: { id: solarOrderId },
      select: { status: true }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const inactiveStatuses = ['DRAFT', 'REJECTED', 'COMPLETED', 'CANCELLED'];
    if (inactiveStatuses.includes(order.status)) {
      return NextResponse.json({ error: 'Tasks can only be created for active orders.' }, { status: 400 });
    }

    const newTask = await prisma.$transaction(async (tx) => {
      const task = await tx.solarTask.create({
        data: {
          solarOrderId,
          title,
          description: description || null,
          assignedToId,
          dueDate: new Date(dueDate),
          dueTime: dueTime || null,
          status: status || 'PENDING',
          createdById: session.userId,
        },
        include: {
          assignedTo: { select: { name: true } }
        }
      });

      await tx.solarActivityLog.create({
        data: {
          solarOrderId,
          eventType: 'TASK_CREATED',
          actorId: session.userId,
          actorName: session.name || 'Unknown User',
          description: `Created new task: ${title}. Assigned to ${task.assignedTo?.name}`,
        }
      });

      return task;
    });

    return NextResponse.json({ task: newTask }, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
