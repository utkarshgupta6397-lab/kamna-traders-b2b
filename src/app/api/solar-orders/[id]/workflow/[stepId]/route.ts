import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string, stepId: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, stepId } = await params;
    const body = await request.json();
    const { status, notes, blockedReason, metadata } = body;

    const step = await prisma.solarWorkflowStep.findUnique({ where: { id: stepId }, include: { solarOrder: true } });
    if (!step || step.solarOrderId !== id) return NextResponse.json({ error: 'Step not found' }, { status: 404 });

    const isAdmin = session.role === 'ADMIN';

    // Sequential Workflow Protection
    // Ensure that the step being updated is not a FUTURE step.
    const allSteps = await prisma.solarWorkflowStep.findMany({
      where: { solarOrderId: id, workflowType: step.workflowType },
      orderBy: { stepIndex: 'asc' }
    });
    const firstPending = allSteps.find(s => s.status !== 'COMPLETED' && s.status !== 'SKIPPED');
    
    // Allow updates to completed steps (e.g., adding notes) or the current active step
    // Reject updates to steps that are in the future
    if (firstPending && step.stepIndex > firstPending.stepIndex) {
      return NextResponse.json({ error: 'Stage is locked. Complete previous stages first.' }, { status: 403 });
    }

    // Permission check based on workflow type
    if (!isAdmin && !session.solar_manage_workflow) {
      if (step.workflowType === 'DOCUMENTATION') {
        // Some steps require approve permission
        const reviewSteps = ['Review & Approval', 'Review Pending', 'File Upload Approval Pending'];
        const stepName = (step.metadata as any)?.name;
        if (reviewSteps.includes(stepName) && !session.solar_orders_approval) {
          return NextResponse.json({ error: 'Order approval permission required' }, { status: 403 });
        } else if (!session.solar_orders_docs_progress) {
          return NextResponse.json({ error: 'Workflow Progress permission required to update documentation' }, { status: 403 });
        }
      } else if (step.workflowType === 'INSTALLATION') {
        if (!session.solar_orders_docs_progress) {
          return NextResponse.json({ error: 'Workflow Progress permission required' }, { status: 403 });
        }
      }
    }



    const result = await prisma.$transaction(async (tx) => {
      // If marking as COMPLETED
      let completedData = {};
      if (status === 'COMPLETED' && step.status !== 'COMPLETED') {
        completedData = {
          completedById: session.userId,
          completedAt: new Date(),
          blockedReason: null, // Clear blocked reason if completed
        };
      } else if (status && status !== 'COMPLETED') {
        // If changing to something else, clear completed data
        completedData = {
          completedById: null,
          completedAt: null,
        };
      }

      // Merge metadata if provided
      let newMetadata = step.metadata;
      if (metadata) {
        newMetadata = { ...(step.metadata as any || {}), ...metadata };
      }

      const updated = await tx.solarWorkflowStep.update({
        where: { id: stepId },
        data: {
          ...(status && { status }),
          ...(notes !== undefined && { notes }),
          ...(blockedReason !== undefined && { blockedReason }),
          ...completedData,
          metadata: newMetadata || undefined,
        }
      });

      // Log the activity
      const stepName = (newMetadata as any)?.name || step.stepKey;
      let logDesc = `Updated workflow step '${stepName}'`;
      if (status === 'COMPLETED') {
        logDesc = `Completed workflow step '${stepName}'`;
      }
      else if (status === 'BLOCKED') logDesc = `Blocked workflow step '${stepName}' - ${blockedReason}`;

      await tx.solarActivityLog.create({
        data: {
          solarOrderId: id,
          actorId: session.userId,
          actorName: session.name || 'Unknown User',
          eventType: 'WORKFLOW_UPDATED',
          description: logDesc,
        }
      });

      // Special logic: Unblock dependent steps
      if (status === 'COMPLETED') {
        if (step.workflowType === 'DOCUMENTATION') {
          // Unblock the next documentation step
          const nextDocStep = await tx.solarWorkflowStep.findFirst({
            where: { solarOrderId: id, workflowType: 'DOCUMENTATION', stepIndex: step.stepIndex + 1 }
          });
          if (nextDocStep && nextDocStep.status === 'BLOCKED') {
             const stepName = (nextDocStep.metadata as any)?.name;
             let shouldUnblock = true;

              if (stepName === 'DCR Certificate Pending') {
               // Check if Installation Checklist is completed
               const installStep3 = await tx.solarWorkflowStep.findFirst({
                 where: { solarOrderId: id, workflowType: 'INSTALLATION', stepIndex: 3 }
               });
               if (!installStep3 || installStep3.status !== 'COMPLETED') {
                 shouldUnblock = false;
               }
              }

             if (stepName === 'File Upload Approval Pending') {
               // Check if all install steps are completed
               const uncompletedInstalls = await tx.solarWorkflowStep.findMany({
                 where: { solarOrderId: id, workflowType: 'INSTALLATION', status: { not: 'COMPLETED' } }
               });
               const allRequiredDone = uncompletedInstalls.length === 0;
               if (!allRequiredDone) {
                 shouldUnblock = false;
               }
             }

             if (shouldUnblock) {
                await tx.solarWorkflowStep.update({
                  where: { id: nextDocStep.id },
                  data: { status: 'PENDING', blockedReason: null }
                });
             }
          }
        }

        if (step.workflowType === 'INSTALLATION') {
          // Unblock the next installation step
          const nextInstStep = await tx.solarWorkflowStep.findFirst({
            where: { solarOrderId: id, workflowType: 'INSTALLATION', stepIndex: step.stepIndex + 1 }
          });
          if (nextInstStep && nextInstStep.status === 'BLOCKED') {
            await tx.solarWorkflowStep.update({
              where: { id: nextInstStep.id },
              data: { status: 'PENDING' }
            });
          }

          // Generic unblocking logic: if we complete step 1 of Installation, start Installation.
          if (step.stepIndex === 1) {
            await tx.solarOrder.update({
              where: { id },
              data: { status: 'INSTALLATION_IN_PROGRESS' }
            });
            await tx.solarActivityLog.create({
              data: {
                solarOrderId: id,
                actorId: session.userId,
                actorName: session.name || 'Unknown User',
                eventType: 'STATUS_CHANGED',
                description: 'Installation Started',
              }
            });
          }

          // If we completed the final step, check if docs are complete
          const allInstalls = await tx.solarWorkflowStep.findMany({
            where: { solarOrderId: id, workflowType: 'INSTALLATION' }
          });
          const allInstallsCompleted = allInstalls.every(s => s.status === 'COMPLETED');
          
          if (allInstallsCompleted) {
             const docStep11 = await tx.solarWorkflowStep.findFirst({
               where: { solarOrderId: id, workflowType: 'DOCUMENTATION', stepIndex: 11 }
             });
             if (docStep11 && docStep11.status === 'BLOCKED') {
               const docStep10 = await tx.solarWorkflowStep.findFirst({
                 where: { solarOrderId: id, workflowType: 'DOCUMENTATION', stepIndex: 10 }
               });
               if (docStep10 && docStep10.status === 'COMPLETED') {
                 await tx.solarWorkflowStep.update({ where: { id: docStep11.id }, data: { status: 'PENDING', blockedReason: null } });
               }
             }

             // Also check if doc steps are fully completed
             const allDocs = await tx.solarWorkflowStep.findMany({
               where: { solarOrderId: id, workflowType: 'DOCUMENTATION' }
             });
             if (allDocs.every(s => s.status === 'COMPLETED')) {
               await tx.solarOrder.update({ where: { id }, data: { status: 'COMPLETED' } });
             }
          }
        }

        // Check doc completion
        if (step.workflowType === 'DOCUMENTATION') {
           const allDocs = await tx.solarWorkflowStep.findMany({
             where: { solarOrderId: id, workflowType: 'DOCUMENTATION' }
           });
           if (allDocs.every(s => s.status === 'COMPLETED')) {
             const allInstalls = await tx.solarWorkflowStep.findMany({
               where: { solarOrderId: id, workflowType: 'INSTALLATION' }
             });
             if (allInstalls.every(s => s.status === 'COMPLETED')) {
               await tx.solarOrder.update({ where: { id }, data: { status: 'COMPLETED' } });
             }
           }
        }
      }

      return updated;
    });

    return NextResponse.json({ success: true, step: result });
  } catch (error) {
    console.error('[SolarOrders Workflow API Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
