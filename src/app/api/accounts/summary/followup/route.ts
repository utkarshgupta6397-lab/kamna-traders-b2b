import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

// Fetch all OPEN follow-up tasks
export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && !session.accounts_summary_view)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const tasks = await prisma.customerStatementTask.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' }
    });

    // Group tasks by customerId to get historical count of flags raised
    const countsGrouped = await prisma.customerStatementTask.groupBy({
      by: ['customerId'],
      _count: {
        id: true
      }
    });

    const historicalCounts = countsGrouped.reduce((acc, curr) => {
      acc[curr.customerId] = curr._count.id;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({ success: true, data: tasks, historicalCounts });
  } catch (error: any) {
    console.error('[GET /api/accounts/summary/followup]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Flag a customer for follow-up
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && !session.accounts_summary_view)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId, customerName, notes } = await request.json();
    if (!customerId || !customerName) {
      return NextResponse.json({ success: false, error: 'Missing customerId or customerName' }, { status: 400 });
    }

    // Lookup user's name from database
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true }
    });
    const flaggedByName = user?.name || 'Staff';

    // Check if there is already an open task for this customer
    const existing = await prisma.customerStatementTask.findFirst({
      where: { customerId, status: 'OPEN' }
    });

    if (existing) {
      return NextResponse.json({ success: true, data: existing });
    }

    const task = await prisma.customerStatementTask.create({
      data: {
        customerId,
        customerName,
        status: 'OPEN',
        flaggedByUserId: session.userId,
        flaggedByName,
        notes: notes || null,
      }
    });

    return NextResponse.json({ success: true, data: task });
  } catch (error: any) {
    console.error('[POST /api/accounts/summary/followup]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Release a flagged customer
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && !session.accounts_summary_view)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await request.json(); // id of the task to release
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing task id' }, { status: 400 });
    }

    // Lookup user's name from database
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true }
    });
    const releasedByName = user?.name || 'Staff';

    const task = await prisma.customerStatementTask.update({
      where: { id },
      data: {
        status: 'RELEASED',
        releasedByUserId: session.userId,
        releasedByName,
        releasedAt: new Date()
      }
    });

    return NextResponse.json({ success: true, data: task });
  } catch (error: any) {
    console.error('[PUT /api/accounts/summary/followup]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
