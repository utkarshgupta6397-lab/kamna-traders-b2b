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

    // Business Logic Validation: Starting Installation
    if (status === 'COMPLETED' && (step.metadata as any)?.name === 'Ready to Install') {
      if (step.solarOrder.status !== 'EXECUTION') {
        return NextResponse.json({ error: 'Order must be in EXECUTION to start installation' }, { status: 400 });
      }
    }

    // Business Logic Validation: Installation Checklist
    if (status === 'COMPLETED' && (step.metadata as any)?.name === 'Installation Checklist') {
      const inverterNumber = metadata?.inverterNumber;
      if (!metadata?.wiringCompleted || !metadata?.inverterInstalled) {
        return NextResponse.json({ error: 'All checklist items must be completed' }, { status: 400 });
      }
      if (!inverterNumber || typeof inverterNumber !== 'string' || inverterNumber.trim() === '') {
        return NextResponse.json({ error: 'Inverter Serial Number is mandatory' }, { status: 400 });
      }

      // Format serial number
      const cleanSerial = inverterNumber.trim().replace(/\s+/g, ' ').toUpperCase();
      metadata.inverterNumber = cleanSerial;

      // Check for duplicates
      const existing = await prisma.solarWorkflowStep.findFirst({
        where: {
          workflowType: 'INSTALLATION',
          id: { not: stepId },
          metadata: {
            path: ['inverterNumber'],
            equals: cleanSerial
          }
        }
      });

      if (existing) {
        return NextResponse.json({ error: 'This inverter serial number is already registered.' }, { status: 400 });
      }
    }

    // Business Logic Validation: System WiFi Setup Done
    if (status === 'COMPLETED' && (step.metadata as any)?.name === 'System WiFi Setup Done') {
      const wifiUsername = metadata?.wifiUsername;
      let wifiPassword = metadata?.wifiPassword;

      if (!wifiUsername || !wifiPassword || wifiUsername.trim() === '' || wifiPassword.trim() === '') {
        return NextResponse.json({ error: 'WiFi Username and Password are required' }, { status: 400 });
      }

      // Encrypt the password before saving
      const ENCRYPTION_KEY = process.env.NEXTAUTH_SECRET || 'kamna_default_secret_key_1234567';
      const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(wifiPassword, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      metadata.wifiPassword = `${iv.toString('hex')}:${encrypted}`; // Safe encrypted storage
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
        if (stepName === 'Installation Checklist') {
          logDesc = `Installation Checklist Completed. Wiring Completed: Yes, Inverter Installed: Yes. Inverter Serial Number Saved: ${(newMetadata as any).inverterNumber}`;
        } else if (stepName === 'System WiFi Setup Done') {
          logDesc = `WiFi Configured for Inverter. Username: ${(newMetadata as any).wifiUsername}`;
        } else {
          logDesc = `Completed workflow step '${stepName}'`;
        }
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
             } else if (stepName === 'File Upload Approval Pending') {
               // Check if install steps 7 is completed
               const requiredInstalls = await tx.solarWorkflowStep.findMany({
                 where: { solarOrderId: id, workflowType: 'INSTALLATION', stepIndex: 7 }
               });
               const allRequiredDone = requiredInstalls.length === 1 && requiredInstalls[0].status === 'COMPLETED';
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

          if (stepName === 'Installation Checklist') {
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

          if (stepName === 'Installation Completed') {
            // Unblocks File Upload Approval Pending (Doc Step 11) IF all 7 are done
            const allRequiredDone = true; // since step 7 completed, we assume all are done linearly
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

            // Also check if doc step 18 is completed. If both, set order to COMPLETED
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
             where: { solarOrderId: id, workflowType: 'INSTALLATION', stepIndex: 7 }
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
