import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hasDispatchAccess } from '@/lib/dispatch-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Pure permission check: Must have dispatch access
  if (!hasDispatchAccess(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

    // Verify order existence
    const order = await prisma.dispatchIncomingOrder.findUnique({
      where: { id },
      select: {
        id: true,
        salesorderNumber: true,
        zohoSalesorderId: true,
        customerName: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Query immutable history for this order, newest first
    const history = await prisma.dispatchWorkflowHistory.findMany({
      where: { dispatchOrderId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        dispatchOrderId: true,
        userId: true,
        userName: true,
        action: true,
        fromStage: true,
        toStage: true,
        metadata: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      history,
      data: {
        order,
        history,
      },
    });
  } catch (error: any) {
    console.error('[Dispatch Workflow History API Error]', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
