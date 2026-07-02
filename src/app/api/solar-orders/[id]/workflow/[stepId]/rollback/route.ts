import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { DOCUMENTATION_STEPS_CONFIG } from '@/lib/solar-workflow-config';

export async function POST(request: Request, { params }: { params: Promise<{ id: string, stepId: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = session.role === 'ADMIN';
    if (!session.workflow_edits && !isAdmin) {
      return NextResponse.json({ error: 'Manage Workflow Edits permission required' }, { status: 403 });
    }

    const { id, stepId } = await params;
    const body = await request.json();
    const { reason, cascade } = body;

    if (!reason || reason.trim() === '') {
      return NextResponse.json({ error: 'Rollback reason is required' }, { status: 400 });
    }

    const targetStep = await prisma.solarWorkflowStep.findUnique({
      where: { id: stepId }
    });

    if (!targetStep || targetStep.solarOrderId !== id) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    if (targetStep.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Can only rollback completed stages' }, { status: 400 });
    }

    let stepsToRollback = [targetStep];

    if (cascade) {
      const subsequentCompletedSteps = await prisma.solarWorkflowStep.findMany({
        where: {
          solarOrderId: id,
          workflowType: targetStep.workflowType,
          stepIndex: { gte: targetStep.stepIndex },
          status: 'COMPLETED'
        },
        orderBy: { stepIndex: 'desc' } // Rollback from end to start
      });
      stepsToRollback = subsequentCompletedSteps;
    }

    const result = await prisma.$transaction(async (tx) => {
      for (const step of stepsToRollback) {
        const stepName = (step.metadata as any)?.name || step.stepKey;
        
        await tx.solarWorkflowStep.update({
          where: { id: step.id },
          data: {
            status: 'PENDING',
            completedById: null,
            completedAt: null,
            editCount: 0,
            lastEditedAt: null,
            lastEditedBy: null
          }
        });

        await tx.solarActivityLog.create({
          data: {
            solarOrderId: id,
            actorId: session.userId,
            actorName: session.name || 'Unknown User',
            eventType: 'WORKFLOW_ROLLEDBACK',
            description: `Rolled Back ${stepName}. Reason: ${reason}`
          }
        });
      }

      // If we rolled back installation steps, recalculate order status
      if (targetStep.workflowType === 'INSTALLATION') {
        const remainingInstalls = await tx.solarWorkflowStep.count({
          where: { solarOrderId: id, workflowType: 'INSTALLATION', status: 'COMPLETED' }
        });
        
        if (remainingInstalls === 0) {
           await tx.solarOrder.update({
             where: { id },
             data: { status: 'APPROVED' } // Assuming it goes back to APPROVED if no installs are done
           });
        } else {
           await tx.solarOrder.update({
             where: { id },
             data: { status: 'INSTALLATION_IN_PROGRESS' }
           });
        }
      } else if (targetStep.workflowType === 'DOCUMENTATION') {
        // Also if we roll back review, the order might go back to PENDING_APPROVAL
        const config = DOCUMENTATION_STEPS_CONFIG.find(c => c.id === targetStep.stepKey || c.legacyKey === targetStep.stepKey);
        const isApprovalStep = config ? config.permission === 'solar_orders_approval' : false;
        
        if (isApprovalStep) {
           await tx.solarOrder.update({
             where: { id },
             data: { status: 'PENDING_APPROVAL' }
           });
        } else {
           await tx.solarOrder.update({
             where: { id },
             data: { status: 'EXECUTION' }
           });
        }
      }

      return { rolledBackCount: stepsToRollback.length };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[SolarOrders Rollback API Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
