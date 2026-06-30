import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: Request, { params }: { params: Promise<{ id: string, stepId: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, stepId } = await params;
    const body = await request.json();
    const { targetStepId, notes } = body;

    if (!targetStepId || !notes) {
      return NextResponse.json({ error: 'Target stage and remarks are mandatory' }, { status: 400 });
    }

    const currentStep = await prisma.solarWorkflowStep.findUnique({ where: { id: stepId }, include: { solarOrder: true } });
    if (!currentStep || currentStep.solarOrderId !== id) return NextResponse.json({ error: 'Current step not found' }, { status: 404 });

    const targetStep = await prisma.solarWorkflowStep.findUnique({ where: { id: targetStepId } });
    if (!targetStep || targetStep.solarOrderId !== id) return NextResponse.json({ error: 'Target step not found' }, { status: 404 });

    const isAdmin = session.role === 'ADMIN';

    // Permissions check
    if (!isAdmin && !session.solar_manage_workflow) {
      const reviewSteps = ['Review & Approval', 'Review Pending', 'File Upload Approval Pending'];
      const stepName = (currentStep.metadata as any)?.name;
      if (reviewSteps.includes(stepName) && !session.solar_orders_approval) {
        return NextResponse.json({ error: 'Order approval permission required' }, { status: 403 });
      }
    }

    // Must be sending backwards within the same workflow type
    if (targetStep.workflowType !== currentStep.workflowType || targetStep.stepIndex >= currentStep.stepIndex) {
      return NextResponse.json({ error: 'Can only request corrections for a previously completed stage' }, { status: 400 });
    }

    // Transaction for rollback
    await prisma.$transaction(async (tx) => {
      // 1. Un-complete target step
      await tx.solarWorkflowStep.update({
        where: { id: targetStepId },
        data: {
          status: 'PENDING',
          completedAt: null,
          completedById: null,
        }
      });

      // 2. Lock intermediate steps (and current step)
      await tx.solarWorkflowStep.updateMany({
        where: {
          solarOrderId: id,
          workflowType: currentStep.workflowType,
          stepIndex: {
            gt: targetStep.stepIndex,
          }
        },
        data: {
          status: 'BLOCKED',
          completedAt: null,
          completedById: null,
        }
      });

      // 3. Log the activity
      const targetStepName = (targetStep.metadata as any)?.name || targetStep.stepKey;
      
      await tx.solarActivityLog.create({
        data: {
          solarOrderId: id,
          actorId: session.userId,
          actorName: session.name || 'Unknown User',
          eventType: 'WORKFLOW_UPDATED',
          description: `Documentation sent back for corrections\n\nStage: ${targetStepName}\n\nReason: ${notes}`,
        }
      });

      // (Optional) Notify creator logic here if a notification system exists.
      // E.g., await tx.notification.create(...)
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SolarOrders Corrections API Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
