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
    const { status, notes, blockedReason, metadata, isEditMode, wifiSsid: rootSsid, wifiPassword: rootPwd } = body;
    const wifiSsid = rootSsid !== undefined ? rootSsid : metadata?.wifiSsid;
    const wifiPassword = rootPwd !== undefined ? rootPwd : metadata?.wifiPassword;

    const step = await prisma.solarWorkflowStep.findUnique({ where: { id: stepId }, include: { solarOrder: true } });
    if (!step || step.solarOrderId !== id) return NextResponse.json({ error: 'Step not found' }, { status: 404 });

    const isAdmin = session.role === 'ADMIN';

    const stepNameForValidation = (step.metadata as any)?.name || step.stepKey;
    if (stepNameForValidation === 'Vendor Portal Accepted' && status === 'COMPLETED') {
      const appNumber = metadata?.applicationNumber;
      if (!appNumber || typeof appNumber !== 'string') {
        return NextResponse.json({ error: 'Application Number is required.' }, { status: 400 });
      }
      const cleaned = appNumber.trim().toUpperCase();
      if (!/^[A-Z0-9-]{10,40}$/.test(cleaned)) {
        return NextResponse.json({ error: 'Invalid Application Number format. Use 10-40 characters (A-Z, 0-9, Hyphens).' }, { status: 400 });
      }
      
      const existing = await prisma.solarOrder.findFirst({
        where: {
          applicationNumber: cleaned,
          id: { not: id }
        },
        select: { orderNumber: true }
      });
      if (existing) {
        return NextResponse.json({ error: `This Application Number already exists for Order ${existing.orderNumber}.` }, { status: 400 });
      }
      
      // Update metadata to cleaned value
      metadata.applicationNumber = cleaned;

      // Validate loanApplicationNumber if loan order
      if (step.solarOrder.loanCustomer) {
        const loanAppNumber = metadata?.loanApplicationNumber;
        if (!loanAppNumber || typeof loanAppNumber !== 'string') {
          return NextResponse.json({ error: 'Loan Application Number is required for loan orders.' }, { status: 400 });
        }
        const cleanedLoan = loanAppNumber.trim();
        if (cleanedLoan.length < 5 || cleanedLoan.length > 100) {
          return NextResponse.json({ error: 'Loan Application Number must be between 5 and 100 characters.' }, { status: 400 });
        }
        metadata.loanApplicationNumber = cleanedLoan;
      }
    }

    if (stepNameForValidation === 'System WiFi Setup Done') {
      if (status === 'COMPLETED' || isEditMode) {
        if (!wifiSsid || typeof wifiSsid !== 'string' || wifiSsid.trim() === '') {
          return NextResponse.json({ error: 'WiFi Name (SSID) is required.' }, { status: 400 });
        }
        if (!wifiPassword || typeof wifiPassword !== 'string' || wifiPassword.trim() === '') {
          return NextResponse.json({ error: 'WiFi Password is required.' }, { status: 400 });
        }
      }
    }

    // Sequential Workflow Protection
    // Ensure that the step being updated is not a FUTURE step.
    const allSteps = await prisma.solarWorkflowStep.findMany({
      where: { solarOrderId: id, workflowType: step.workflowType },
      orderBy: { stepIndex: 'asc' }
    });
    const firstPending = allSteps.find(s => s.status !== 'COMPLETED' && s.status !== 'SKIPPED');
    
    // Master Edit Validation
    if (isEditMode) {
      if (!session.workflow_edits && !isAdmin) {
        return NextResponse.json({ error: 'Manage Workflow Edits permission required' }, { status: 403 });
      }
      if (step.status !== 'COMPLETED') {
        return NextResponse.json({ error: 'Can only edit completed stages in edit mode.' }, { status: 400 });
      }
    } else {
      // Regular sequential lock
      if (firstPending && step.stepIndex > firstPending.stepIndex) {
        return NextResponse.json({ error: 'Stage is locked. Complete previous stages first.' }, { status: 403 });
      }
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
      // If marking as COMPLETED via normal flow
      let completedData = {};
      if (!isEditMode && status === 'COMPLETED' && step.status !== 'COMPLETED') {
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
      
      let editData = {};
      if (isEditMode) {
        editData = {
          editCount: step.editCount + 1,
          lastEditedAt: new Date(),
          lastEditedBy: session.userId
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
          ...(status && !isEditMode && { status }),
          ...(notes !== undefined && { notes }),
          ...(blockedReason !== undefined && { blockedReason }),
          ...completedData,
          ...editData,
          metadata: newMetadata || undefined,
          ...(wifiSsid !== undefined && { wifiSsid }),
          ...(wifiPassword !== undefined && { wifiPassword }),
        }
      });

      // Log the activity
      const stepName = (newMetadata as any)?.name || step.stepKey;
      let logDesc = `Updated workflow step '${stepName}'`;
      
      if (isEditMode) {
        // Find changes in metadata
        const oldMeta = (step.metadata as any) || {};
        const newMeta = (newMetadata as any) || {};
        const changes: string[] = [];
        
        for (const key of Object.keys(newMeta)) {
          // Mask sensitive fields if necessary
          const displayKey = key === 'password' || key === 'wifiPassword' ? 'Password' : key;
          const oldVal = key.toLowerCase().includes('password') ? '***' : String(oldMeta[key] || 'None');
          const newVal = key.toLowerCase().includes('password') ? '***' : String(newMeta[key] || 'None');
          
          if (oldVal !== newVal) {
            changes.push(`${displayKey}: ${oldVal} -> ${newVal}`);
          }
        }
        
        logDesc = `Master Edit applied to '${stepName}'. ${changes.join(', ')}`;
        
        if (stepName === 'System WiFi Setup Done') {
          if (wifiSsid !== undefined && wifiSsid !== step.wifiSsid) {
            changes.push(`WiFi SSID: ${step.wifiSsid || 'None'} -> ${wifiSsid}`);
          }
          if (wifiPassword !== undefined && wifiPassword !== step.wifiPassword) {
            changes.push(`WiFi Password: *** -> ***`);
          }
          if (changes.length > 0) {
            logDesc = `Master Edit applied to '${stepName}'. ${changes.join(', ')}`;
          }
        }
        
        if (stepName === 'Vendor Portal Accepted' && newMeta?.applicationNumber) {
           await tx.solarOrder.update({
             where: { id },
             data: { 
               applicationNumber: newMeta.applicationNumber,
               loanApplicationNumber: newMeta.loanApplicationNumber || null,
               editCount: { increment: 1 },
               lastEditedAt: new Date(),
               lastEditedBy: session.userId
             }
           });
        }
      } else if (status === 'COMPLETED') {
        logDesc = `Completed workflow step '${stepName}'`;
        
        if (stepName === 'System WiFi Setup Done') {
           logDesc = `Completed workflow step '${stepName}' with WiFi SSID: ${wifiSsid}`;
           if (wifiPassword !== undefined && wifiPassword !== step.wifiPassword) {
             // Just audit that it was provided
           }
        }
        
        const meta = newMetadata as any;
        if (stepName === 'Vendor Portal Accepted' && meta?.applicationNumber) {
           logDesc = `Completed workflow step '${stepName}' with Application Number: ${meta.applicationNumber}`;
           if (meta.loanApplicationNumber) {
              logDesc += `, Loan Application Number: ${meta.loanApplicationNumber}`;
           }
           await tx.solarOrder.update({
             where: { id },
             data: { 
               applicationNumber: meta.applicationNumber,
               loanApplicationNumber: meta.loanApplicationNumber || null
             }
           });
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
      if (status === 'COMPLETED' && !isEditMode) {
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
