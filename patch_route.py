import re

with open('src/app/api/solar-orders/[id]/workflow/[stepId]/route.ts', 'r') as f:
    content = f.read()

# Add imports for DOCUMENTATION_STEPS and INSTALLATION_STEPS
import_stmt = "import { DOCUMENTATION_STEPS, INSTALLATION_STEPS } from '@/lib/solar-workflow-config';\n"
if "DOCUMENTATION_STEPS" not in content:
    content = content.replace("import { prisma } from '@/lib/db';", f"import {{ prisma }} from '@/lib/db';\n{import_stmt}")

# 1. Replace the doc -> install dependency hardcoded check
old_dcr_check = """              if (stepName === 'DCR Certificate Pending') {
               // Check if Installation Checklist is completed
               const installStep3 = await tx.solarWorkflowStep.findFirst({
                 where: { solarOrderId: id, workflowType: 'INSTALLATION', stepIndex: 3 }
               });
               if (!installStep3 || installStep3.status !== 'COMPLETED') {
                 shouldUnblock = false;
               }
              }"""

new_dcr_check = """              if (stepName === 'DCR Certificate Pending') {
               // Check if Installation Checklist is completed
               const installChecklistIndex = INSTALLATION_STEPS.indexOf('Installation Checklist') + 1;
               const installChecklistKey = `INST_${installChecklistIndex}`;
               const installStepChecklist = await tx.solarWorkflowStep.findFirst({
                 where: { solarOrderId: id, workflowType: 'INSTALLATION', stepKey: installChecklistKey }
               });
               if (!installStepChecklist || installStepChecklist.status !== 'COMPLETED') {
                 shouldUnblock = false;
               }
              }"""

content = content.replace(old_dcr_check, new_dcr_check)


# 2. Add unblocking of DCR Certificate Pending when Installation Checklist completes
# Find where nextInstStep is unblocked
inst_unblock_block = """          // Unblock the next installation step
          const nextInstStep = await tx.solarWorkflowStep.findFirst({
            where: { solarOrderId: id, workflowType: 'INSTALLATION', stepIndex: step.stepIndex + 1 }
          });
          if (nextInstStep && nextInstStep.status === 'BLOCKED') {
            await tx.solarWorkflowStep.update({
              where: { id: nextInstStep.id },
              data: { status: 'PENDING' }
            });
          }"""

new_inst_unblock_block = inst_unblock_block + """

          // Unblock DCR Certificate Pending if Installation Checklist is completed
          const installChecklistIndex = INSTALLATION_STEPS.indexOf('Installation Checklist') + 1;
          const installChecklistKey = `INST_${installChecklistIndex}`;
          if (step.stepKey === installChecklistKey) {
             const dcrPendingIndex = DOCUMENTATION_STEPS.indexOf('DCR Certificate Pending') + 1;
             const dcrPendingKey = `DOC_${dcrPendingIndex}`;
             
             const dcrStep = await tx.solarWorkflowStep.findFirst({
               where: { solarOrderId: id, workflowType: 'DOCUMENTATION', stepKey: dcrPendingKey }
             });
             
             if (dcrStep && dcrStep.status === 'BLOCKED') {
               // Check if the previous step (Company Stamp Pending) is completed
               const companyStampIndex = DOCUMENTATION_STEPS.indexOf('Company Stamp Pending') + 1;
               const companyStampKey = `DOC_${companyStampIndex}`;
               const companyStampStep = await tx.solarWorkflowStep.findFirst({
                 where: { solarOrderId: id, workflowType: 'DOCUMENTATION', stepKey: companyStampKey }
               });
               
               if (companyStampStep && companyStampStep.status === 'COMPLETED') {
                 await tx.solarWorkflowStep.update({
                   where: { id: dcrStep.id },
                   data: { status: 'PENDING', blockedReason: null }
                 });
               }
             }
          }"""

content = content.replace(inst_unblock_block, new_inst_unblock_block)

# 3. Fix the hardcoded 10 and 11 check at the end of INSTALLATION completion
old_doc_check_11 = """             const docStep11 = await tx.solarWorkflowStep.findFirst({
               where: { solarOrderId: id, workflowType: 'DOCUMENTATION', stepIndex: 11 }
             });
             if (docStep11 && docStep11.status === 'BLOCKED') {
               const docStep10 = await tx.solarWorkflowStep.findFirst({
                 where: { solarOrderId: id, workflowType: 'DOCUMENTATION', stepIndex: 10 }
               });
               if (docStep10 && docStep10.status === 'COMPLETED') {
                 await tx.solarWorkflowStep.update({ where: { id: docStep11.id }, data: { status: 'PENDING', blockedReason: null } });
               }
             }"""

new_doc_check_11 = """             const docStep11Index = DOCUMENTATION_STEPS.indexOf('File Upload Approval Pending') + 1;
             const docStep11Key = `DOC_${docStep11Index}`;
             const docStep11 = await tx.solarWorkflowStep.findFirst({
               where: { solarOrderId: id, workflowType: 'DOCUMENTATION', stepKey: docStep11Key }
             });
             if (docStep11 && docStep11.status === 'BLOCKED') {
               const docStep10Index = DOCUMENTATION_STEPS.indexOf('DCR Certificate Pending') + 1;
               const docStep10Key = `DOC_${docStep10Index}`;
               const docStep10 = await tx.solarWorkflowStep.findFirst({
                 where: { solarOrderId: id, workflowType: 'DOCUMENTATION', stepKey: docStep10Key }
               });
               if (docStep10 && docStep10.status === 'COMPLETED') {
                 await tx.solarWorkflowStep.update({ where: { id: docStep11.id }, data: { status: 'PENDING', blockedReason: null } });
               }
             }"""

content = content.replace(old_doc_check_11, new_doc_check_11)

with open('src/app/api/solar-orders/[id]/workflow/[stepId]/route.ts', 'w') as f:
    f.write(content)

