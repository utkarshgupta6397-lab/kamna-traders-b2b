import { NextResponse } from 'next/server';
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
        } else if (!session.solar_orders_view) {
          return NextResponse.json({ error: 'Solar orders view permission required to update documentation' }, { status: 403 });
        }
      } else if (step.workflowType === 'INSTALLATION') {
        if (!session.solar_installation_complete) {
          return NextResponse.json({ error: 'Installation edit permission required' }, { status: 403 });
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
      let logDesc = `Updated workflow step '${(newMetadata as any)?.name || step.stepKey}'`;
      if (status === 'COMPLETED') logDesc = `Completed workflow step '${(newMetadata as any)?.name || step.stepKey}'`;
      else if (status === 'BLOCKED') logDesc = `Blocked workflow step '${(newMetadata as any)?.name || step.stepKey}' - ${blockedReason}`;

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
               // Check if Inverter Number Entered is completed
               const installStep4 = await tx.solarWorkflowStep.findFirst({
                 where: { solarOrderId: id, workflowType: 'INSTALLATION', stepIndex: 4 }
               });
               if (!installStep4 || installStep4.status !== 'COMPLETED') {
                 shouldUnblock = false;
               }
             } else if (stepName === 'File Upload Approval Pending') {
               // Check if install steps 2,3,4 are completed
               const requiredInstalls = await tx.solarWorkflowStep.findMany({
                 where: { solarOrderId: id, workflowType: 'INSTALLATION', stepIndex: { in: [2, 3, 4] } }
               });
               const allRequiredDone = requiredInstalls.length === 3 && requiredInstalls.every(s => s.status === 'COMPLETED');
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

          // Cross-workflow unblocking
          const stepName = (step.metadata as any)?.name;
          
          if (stepName === 'Ready to Install') {
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

          if (stepName === 'Inverter Number Entered') {
            // Unblocks DCR Certificate Pending (Doc Step 10)
            const docStep10 = await tx.solarWorkflowStep.findFirst({
              where: { solarOrderId: id, workflowType: 'DOCUMENTATION', stepIndex: 10 }
            });
            if (docStep10 && docStep10.status === 'BLOCKED') {
              // Check if doc step 9 is complete
              const docStep9 = await tx.solarWorkflowStep.findFirst({
                where: { solarOrderId: id, workflowType: 'DOCUMENTATION', stepIndex: 9 }
              });
              if (docStep9 && docStep9.status === 'COMPLETED') {
                await tx.solarWorkflowStep.update({ where: { id: docStep10.id }, data: { status: 'PENDING', blockedReason: null } });
              } else {
                await tx.solarWorkflowStep.update({ where: { id: docStep10.id }, data: { blockedReason: 'Waiting for Step 9' } });
              }
            }
          }

          if (['Installation Completed', 'Rooftop Photos Uploaded', 'Inverter Number Entered'].includes(stepName)) {
            // Unblocks File Upload Approval Pending (Doc Step 11) IF all 3 are done
            const allThree = await tx.solarWorkflowStep.findMany({
              where: { 
                solarOrderId: id, 
                workflowType: 'INSTALLATION', 
                metadata: { path: ['name'], string_contains: 'Installation Completed' } // Simplify check in real life or use step keys
              }
            });
            // Actually, we'll check step indexes 2, 3, 4
            const requiredInstalls = await tx.solarWorkflowStep.findMany({
              where: { solarOrderId: id, workflowType: 'INSTALLATION', stepIndex: { in: [2, 3, 4] } }
            });
            const allRequiredDone = requiredInstalls.every(s => s.status === 'COMPLETED');
            if (allRequiredDone) {
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
            }
          }

          // If step 6 is completed, check if doc step 18 is completed. If both, set order to COMPLETED
          if (stepName === 'System Completed') {
            const finalDocStep = await tx.solarWorkflowStep.findFirst({
              where: { solarOrderId: id, workflowType: 'DOCUMENTATION', stepIndex: 18 }
            });
            if (finalDocStep && finalDocStep.status === 'COMPLETED') {
              await tx.solarOrder.update({ where: { id }, data: { status: 'COMPLETED' } });
            }
          }
        }

        // Check doc completion
        if (step.workflowType === 'DOCUMENTATION' && step.stepIndex === 18) {
           const finalInstStep = await tx.solarWorkflowStep.findFirst({
             where: { solarOrderId: id, workflowType: 'INSTALLATION', stepIndex: 6 }
           });
           if (finalInstStep && finalInstStep.status === 'COMPLETED') {
             await tx.solarOrder.update({ where: { id }, data: { status: 'COMPLETED' } });
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
