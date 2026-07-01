import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { INSTALLATION_STEPS } from '@/lib/solar-workflow-config';

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
      status: { notIn: ['CANCELLED', 'REJECTED'] },
      installationDate: { not: null },
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
        salesman: { select: { id: true, name: true } },
        callingExecutive: { select: { id: true, name: true } },
        workflowSteps: {
          where: { workflowType: 'INSTALLATION' },
          select: { stepKey: true, status: true, stepIndex: true, metadata: true },
          orderBy: { stepIndex: 'asc' },
        },
      },
      orderBy: { installationDate: 'asc' },
    });

    // ── Queue orders (no installationDate, installation not 100% complete) ──
    const queueWhere: any = {
      status: { notIn: ['CANCELLED', 'REJECTED', 'COMPLETED'] },
      installationDate: null,
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
        salesman: { select: { id: true, name: true } },
        callingExecutive: { select: { id: true, name: true } },
        workflowSteps: {
          where: { workflowType: 'INSTALLATION' },
          select: { stepKey: true, status: true, stepIndex: true, metadata: true },
          orderBy: { stepIndex: 'asc' },
        },
      },
      orderBy: { orderDate: 'asc' },
    });

    // Helper: derive current installation stage & completion %
    const deriveStage = (steps: any[]) => {
      let currentStage = 'Ready to Install';
      let completedCount = 0;
      for (const stepName of INSTALLATION_STEPS) {
        const match = steps.find(
          (s) => (s.metadata as any)?.name === stepName || s.stepKey === stepName
        );
        if (match?.status === 'COMPLETED') {
          completedCount++;
          currentStage = stepName;
        } else {
          currentStage = stepName;
          break;
        }
      }
      const pct = Math.round((completedCount / INSTALLATION_STEPS.length) * 100);
      return { currentStage, pct, completedCount };
    };

    const now = Date.now();

    const scheduled = scheduledOrders.map((o) => {
      const { currentStage, pct } = deriveStage(o.workflowSteps);
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        systemSize: o.systemSize,
        installationDate: o.installationDate,
        salesman: o.salesman?.name || o.callingExecutive?.name || null,
        currentStage,
        pct,
        status: o.status,
      };
    });

    const queue = queueOrders
      .map((o) => {
        const { currentStage, pct, completedCount } = deriveStage(o.workflowSteps);
        // If all steps completed, exclude from queue (already done)
        if (completedCount === INSTALLATION_STEPS.length) return null;
        const daysSinceOrder = Math.floor((now - new Date(o.orderDate).getTime()) / 86_400_000);
        return {
          id: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          phoneNumber: o.phoneNumber,
          systemSize: o.systemSize,
          orderDate: o.orderDate,
          daysSinceOrder,
          salesman: o.salesman?.name || o.callingExecutive?.name || null,
          currentStage,
          pct,
          status: o.status,
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
