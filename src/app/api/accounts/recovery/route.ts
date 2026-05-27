import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

// Fetch all ACTIVE recovery tasks
export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && !session.accounts_summary_view && !session.accounts_recovery_manage)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const tasks = await prisma.recoveryInvoiceTask.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { flaggedAt: 'desc' }
    });

    // Group tasks by invoiceId to get historical count of flags raised
    const countsGrouped = await prisma.recoveryInvoiceTask.groupBy({
      by: ['invoiceId'],
      _count: {
        id: true
      }
    });

    const historicalCounts = countsGrouped.reduce((acc, curr) => {
      acc[curr.invoiceId] = curr._count.id;
      return acc;
    }, {} as Record<string, number>);

    // Group tasks by customerId to get historical count of flags raised at customer level
    const customerCountsGrouped = await prisma.recoveryInvoiceTask.groupBy({
      by: ['customerId'],
      _count: {
        id: true
      }
    });

    const historicalCustomerCounts = customerCountsGrouped.reduce((acc, curr) => {
      acc[curr.customerId] = curr._count.id;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      data: tasks,
      historicalCounts,
      historicalCustomerCounts,
      currentUserId: session.userId,
      releaseAllowed: session.role === 'ADMIN' || !!(session as any).release_statement_queue
    });
  } catch (error: any) {
    console.error('[GET /api/accounts/recovery]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Flag an invoice (create/update recovery task)
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && !session.accounts_summary_view && !session.accounts_recovery_manage)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const {
      invoiceId,
      invoiceNumber,
      customerId,
      customerName,
      lastKnownPendingAmount,
      lastKnownInvoiceStatus,
      notes
    } = await request.json();

    if (!invoiceId || !invoiceNumber || !customerId || !customerName) {
      return NextResponse.json({ success: false, error: 'Missing required invoice or customer fields' }, { status: 400 });
    }

    // Lookup user's name from database
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true }
    });
    const flaggedByName = user?.name || 'Staff';

    // Check if there is already an ACTIVE task for this invoice
    const existing = await prisma.recoveryInvoiceTask.findFirst({
      where: { invoiceId, status: 'ACTIVE' }
    });

    if (existing) {
      const updated = await prisma.recoveryInvoiceTask.update({
        where: { id: existing.id },
        data: {
          flagCount: { increment: 1 },
          lastKnownPendingAmount: lastKnownPendingAmount !== undefined ? lastKnownPendingAmount : existing.lastKnownPendingAmount,
          lastKnownInvoiceStatus: lastKnownInvoiceStatus !== undefined ? lastKnownInvoiceStatus : existing.lastKnownInvoiceStatus,
          notes: notes !== undefined ? notes : existing.notes
        }
      });
      return NextResponse.json({ success: true, data: updated });
    }

    const task = await prisma.recoveryInvoiceTask.create({
      data: {
        invoiceId,
        invoiceNumber,
        customerId,
        customerName,
        status: 'ACTIVE',
        flaggedByUserId: session.userId,
        flaggedByName,
        lastKnownPendingAmount: lastKnownPendingAmount || null,
        lastKnownInvoiceStatus: lastKnownInvoiceStatus || null,
        notes: notes || null
      }
    });

    return NextResponse.json({ success: true, data: task });
  } catch (error: any) {
    console.error('[POST /api/accounts/recovery]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Perform recovery operations (release, remind, reminder_sent)
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    // These actions require accounts_recovery_manage permission specifically
    if (!session || (session.role !== 'ADMIN' && !session.accounts_recovery_manage)) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Requires Accounts Recovery Management permission' }, { status: 403 });
    }

    const { id, action, requiresReminder, notes } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing task id' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true }
    });
    const userName = user?.name || 'Staff';

    const existing = await prisma.recoveryInvoiceTask.findUnique({
      where: { id }
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    let updateData: any = {};

    if (action === 'release') {
      const isReleaseAllowed = session.role === 'ADMIN' || !!(session as any).release_statement_queue;
      if (!isReleaseAllowed) {
        return NextResponse.json({ success: false, error: 'Unauthorized: Requires release_statement_queue permission' }, { status: 403 });
      }
      updateData = {
        status: 'RELEASED',
        releasedByUserId: session.userId,
        releasedByName: userName,
        releasedAt: new Date()
      };
    } else if (action === 'remind') {
      updateData = {
        requiresReminder: requiresReminder !== undefined ? requiresReminder : !existing.requiresReminder
      };
    } else if (action === 'reminder_sent') {
      updateData = {
        reminderSent: true,
        reminderSentAt: new Date(),
        reminderSentById: session.userId,
        reminderSentByName: userName,
        reminderCount: { increment: 1 }
      };
    } else if (action === 'update_notes') {
      updateData = {
        notes: notes || null
      };
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

    const task = await prisma.recoveryInvoiceTask.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ success: true, data: task });
  } catch (error: any) {
    console.error('[PUT /api/accounts/recovery]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
