import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { resolveWorkflowState } from '@/lib/solar-workflow-config';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;

    const order = await prisma.solarOrder.findUnique({
      where: { id },
      select: {
        id: true,
        workflowSteps: {
          where: { workflowType: 'INSTALLATION' },
          select: {
            stepKey: true,
            status: true,
            updatedAt: true,
            startedAt: true,
            completedAt: true,
            notes: true,
            completedBy: { select: { name: true } },
            metadata: true,
            stepIndex: true
          },
          orderBy: { stepIndex: 'asc' }
        }
      }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const state = resolveWorkflowState(order.workflowSteps, 'INSTALLATION');

    return NextResponse.json({
      orderId: order.id,
      assignedInstaller: 'Unassigned',
      state
    });
  } catch (error: any) {
    console.error('Error fetching installation state:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch installation state' }, { status: 500 });
  }
}
