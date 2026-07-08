import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { INSTALLATION_STEPS, resolveWorkflowState, ACTIVE_WORKFLOW_ORDER_STATUSES } from '@/lib/solar-workflow-config';

// ─── GET /api/solar-orders/calendar ──────────────────────────────────────────
// Query params: from (ISO date), to (ISO date)
// Returns:
//   { scheduled: ScheduledOrder[], queue: QueueOrder[] }
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = session.role === 'ADMIN';
    const isStaff = session.role === 'STAFF';
    const canView =
      isAdmin || isStaff || !!session.solar_installation_view || !!session.solar_documentation_view;

    if (!canView) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const search = searchParams.get('search') || '';

    // ── Scheduled orders (have installationDate within range) ──────────────
    const scheduledWhere: any = {
      status: { in: ACTIVE_WORKFLOW_ORDER_STATUSES },
      installationDate: { not: null },
      isCancelled: false,
    };
    if (from && to) {
      scheduledWhere.installationDate = {
        gte: new Date(from),
        lte: new Date(to),
      };
    }

    const scheduledOrders = await prisma.solarOrder.findMany({
      where: scheduledWhere,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        phoneNumber: true,
        systemSize: true,
        installationDate: true,
        status: true,
        leadSource: true,
        remarks: true,
        totalOrderAmount: true,
        pendingAmount: true,
        zohoBooksCustomerId: true,
        salesman: { select: { id: true, name: true } },
        callingExecutive: { select: { id: true, name: true } },
        workflowSteps: {
          select: { workflowType: true, stepKey: true, status: true, stepIndex: true, metadata: true },
          orderBy: { stepIndex: 'asc' },
        },
      },
      orderBy: { installationDate: 'asc' },
    });

    // ── Queue orders (no installationDate, installation not 100% complete) ──
    const queueWhere: any = {
      status: { in: ACTIVE_WORKFLOW_ORDER_STATUSES },
      installationDate: null,
      isCancelled: false,
    };

    if (search) {
      queueWhere.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
        { applicationNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const queueOrders = await prisma.solarOrder.findMany({
      where: queueWhere,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        phoneNumber: true,
        systemSize: true,
        orderDate: true,
        status: true,
        leadSource: true,
        remarks: true,
        totalOrderAmount: true,
        pendingAmount: true,
        zohoBooksCustomerId: true,
        salesman: { select: { id: true, name: true } },
        callingExecutive: { select: { id: true, name: true } },
        workflowSteps: {
          select: { workflowType: true, stepKey: true, status: true, stepIndex: true, metadata: true },
          orderBy: { stepIndex: 'asc' },
        },
      },
      orderBy: { orderDate: 'asc' },
    });

    // (Replaced by resolveWorkflowState)

    const now = Date.now();

    const scheduled = scheduledOrders.map((o) => {
      const state = resolveWorkflowState(o.workflowSteps, 'INSTALLATION');
      const docState = resolveWorkflowState(o.workflowSteps, 'DOCUMENTATION');
      
      let address = '';
      if (o.remarks && o.remarks.includes('Address: ')) {
        const parts = o.remarks.split('Address: ');
        const afterAddress = parts[1].split('\nCity: ');
        address = afterAddress[0].trim();
      }

      const isZohoLinked = !!o.zohoBooksCustomerId;
      const actualPendingAmount = isZohoLinked ? o.pendingAmount : o.totalOrderAmount;
      const paidAmount = o.totalOrderAmount - actualPendingAmount;
      const paymentPercentage = o.totalOrderAmount > 0 ? (paidAmount / o.totalOrderAmount) * 100 : 0;

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        systemSize: o.systemSize,
        installationDate: o.installationDate,
        salesman: o.salesman?.name || o.callingExecutive?.name || null,
        currentStage: state.currentStage,
        pct: state.progressPercentage,
        status: o.status,
        leadSource: o.leadSource,
        address,
        docStage: docState.currentStage,
        totalOrderAmount: o.totalOrderAmount,
        paidAmount,
        paymentPercentage
      };
    });

    const queue = queueOrders
      .map((o) => {
        const state = resolveWorkflowState(o.workflowSteps, 'INSTALLATION');
        const docState = resolveWorkflowState(o.workflowSteps, 'DOCUMENTATION');
        
        // If all steps completed, exclude from queue (already done)
        if (state.isCompleted) return null;
        const daysSinceOrder = Math.floor((now - new Date(o.orderDate).getTime()) / 86_400_000);
        
        let address = '';
        if (o.remarks && o.remarks.includes('Address: ')) {
          const parts = o.remarks.split('Address: ');
          const afterAddress = parts[1].split('\nCity: ');
          address = afterAddress[0].trim();
        }

        const isZohoLinked = !!o.zohoBooksCustomerId;
        const actualPendingAmount = isZohoLinked ? o.pendingAmount : o.totalOrderAmount;
        const paidAmount = o.totalOrderAmount - actualPendingAmount;
        const paymentPercentage = o.totalOrderAmount > 0 ? (paidAmount / o.totalOrderAmount) * 100 : 0;

        return {
          id: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          phoneNumber: o.phoneNumber,
          systemSize: o.systemSize,
          orderDate: o.orderDate,
          daysSinceOrder,
          salesman: o.salesman?.name || o.callingExecutive?.name || null,
          currentStage: state.currentStage,
          pct: state.progressPercentage,
          status: o.status,
          leadSource: o.leadSource,
          address,
          docStage: docState.currentStage,
          totalOrderAmount: o.totalOrderAmount,
          paidAmount,
          paymentPercentage
        };
      })
      .filter(Boolean);

    return NextResponse.json({ scheduled, queue });
  } catch (err: any) {
    console.error('[Calendar GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── PATCH /api/solar-orders/calendar ────────────────────────────────────────
// Body: { orderId: string, installationDate: string | null }
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = session.role === 'ADMIN';
    const isStaff = session.role === 'STAFF';
    const canEdit = isAdmin || isStaff || !!session.solar_installation_view;

    if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { orderId, installationDate } = body;

    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

    const updated = await prisma.solarOrder.update({
      where: { id: orderId },
      data: {
        installationDate: installationDate ? new Date(installationDate) : null,
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        systemSize: true,
        installationDate: true,
        salesman: { select: { name: true } },
        callingExecutive: { select: { name: true } },
      },
    });

    return NextResponse.json({ order: updated });
  } catch (err: any) {
    console.error('[Calendar PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
