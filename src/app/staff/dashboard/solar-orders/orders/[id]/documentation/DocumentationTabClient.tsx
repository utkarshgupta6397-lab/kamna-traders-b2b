'use client';

import { ShieldCheck, ArrowRight, Loader2, Lock } from 'lucide-react';
import WorkflowDocumentUploader from './WorkflowDocumentUploader';
import WorkflowEngine, { WorkflowStep } from '../components/WorkflowEngine';
import VendorPortalAcceptedStep from './VendorPortalAcceptedStep';
import DocumentationApprovalStage from './DocumentationApprovalStage';
import { getWorkflowStageName, DOCUMENTATION_STEPS_CONFIG } from '@/lib/solar-workflow-config';

export default function DocumentationTabClient({ 
  order, 
  steps, 
  canProgress, 
  canApprove,
  canMasterEdit,
  canManageWorkflowEdits
}: { 
  order: any, 
  steps: WorkflowStep[],
  canProgress: boolean,
  canApprove: boolean,
  canMasterEdit?: boolean,
  canManageWorkflowEdits?: boolean,
}) {
  const reviewSteps = DOCUMENTATION_STEPS_CONFIG.filter(c => c.type === 'REVIEW').map(c => c.title);

  // Filter out any steps that no longer exist in the config (e.g. legacy DOC_4) and sort by config order
  const validSteps = steps.filter(step => 
    DOCUMENTATION_STEPS_CONFIG.some(c => c.id === step.stepKey || c.legacyKey === step.stepKey)
  ).sort((a, b) => {
    const indexA = DOCUMENTATION_STEPS_CONFIG.findIndex(c => c.id === a.stepKey || c.legacyKey === a.stepKey);
    const indexB = DOCUMENTATION_STEPS_CONFIG.findIndex(c => c.id === b.stepKey || c.legacyKey === b.stepKey);
    return indexA - indexB;
  });


  return (
    <WorkflowEngine
      orderId={order.id}
      steps={validSteps}
      theme="green"
      title="Documentation Progress"
      reviewSteps={reviewSteps}
      canProgress={canProgress}
      canApprove={canApprove}
      canMasterEdit={canMasterEdit}
      canManageWorkflowEdits={canManageWorkflowEdits}
      renderStageAction={(selectedStep, updateStep, remarks, setRemarks, loadingStep, isEditMode) => {
        const stepName = getWorkflowStageName(selectedStep.workflowType, selectedStep.stepKey);
        
        if (reviewSteps.includes(stepName) && selectedStep.status !== 'COMPLETED') {
          return (
            <DocumentationApprovalStage
              order={order}
              steps={validSteps}
              selectedStep={selectedStep}
              onApprove={() => updateStep('COMPLETED', undefined, undefined, isEditMode)}
              onRequestCorrections={async (targetStepId, correctionRemarks) => {
                try {
                  const res = await fetch(`/api/solar-orders/${order.id}/workflow/${selectedStep.id}/corrections`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetStepId, notes: correctionRemarks })
                  });
                  if (res.ok) {
                    window.location.reload();
                  } else {
                    const data = await res.json();
                    alert(data.error || 'Failed to request corrections');
                  }
                } catch (e) {
                  alert('Network error');
                }
              }}
              canApprove={canApprove}
              loadingStep={loadingStep}
            />
          );
        }

        if (stepName === 'Document Upload') {
          const requirements: any[] = [
            {
              type: 'CANCELLED_CHEQUE',
              label: 'Cancelled Cheque',
              required: true,
              maxMb: 2,
              acceptedTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.heic']
            },
            {
              type: 'ELECTRICITY_BILL',
              label: 'Electricity Bill',
              required: true,
              maxMb: 2,
              acceptedTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.heic'],
              requiresPhone: {
                label: 'Electricity Bill Phone Number',
                description: "Enter the mobile number associated with the uploaded electricity bill. This may be the customer's existing phone number or a different registered number.",
                validationRegex: /^[0-9]{10}$/
              }
            }
          ];

          if (order.loanCustomer) {
            requirements.push(
              {
                type: 'EMPTY_TERRACE_PHOTO',
                label: 'Empty Terrace Photo',
                required: true,
                maxMb: 2,
                acceptedTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.heic'],
                section: '🏦 Loan Processing Documents',
                sectionSubtitle: 'Complete the following additional documents required for bank loan processing.'
              },
              {
                type: 'AADHAAR_CARD',
                label: 'Aadhaar Card',
                required: true,
                maxMb: 2,
                acceptedTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.heic']
              },
              {
                type: 'PAN_CARD',
                label: 'PAN Card',
                required: true,
                maxMb: 2,
                acceptedTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.heic']
              },
              {
                type: 'CUSTOMER_EMAIL',
                label: 'Customer Email',
                required: true,
                inputType: 'TEXT',
                placeholder: 'customer@gmail.com',
                validationRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
              },
              {
                type: 'LOAN_ANNUAL_INCOME',
                label: 'Annual Income',
                required: true,
                inputType: 'CURRENCY',
                placeholder: '₹7,50,000',
                min: 1,
                max: 100000000
              },
              {
                type: 'LOAN_QUOTATION_AMOUNT',
                label: 'Loan Quotation Amount',
                required: true,
                inputType: 'CURRENCY',
                placeholder: '₹3,25,000',
                min: 1,
                max: order.totalOrderAmount || 0,
                maxErrorMsg: 'Loan quotation amount cannot exceed total order value.'
              }
            );
          }

          return (
            <div className="w-full">
               <WorkflowDocumentUploader 
                 order={order}
                 requirements={requirements}
                 canProgress={canProgress}
                 onComplete={() => updateStep('COMPLETED', undefined, undefined, isEditMode)}
                 isEditMode={isEditMode}
               />
            </div>
          );
        }

        if (stepName === 'DCR Certificate Pending') {
          return (
            <div className="w-full">
               <WorkflowDocumentUploader 
                 orderId={order.id}
                 title="DCR Certificate Upload"
                 subtitle="Please upload the official DCR Certificate from the vendor."
                 submitButtonText="Submit DCR Certificate"
                 requirements={[
                   {
                     type: 'DCR_CERTIFICATE',
                     label: 'DCR Certificate',
                     required: true,
                     maxMb: 10,
                     acceptedTypes: ['.pdf']
                   }
                 ]}
                 canProgress={canProgress}
                 onComplete={() => updateStep('COMPLETED', 'DCR Certificate Uploaded')}
               />
            </div>
          );
        }

        if (stepName === 'Vendor Portal Accepted' && selectedStep.status !== 'COMPLETED') {
          return (
            <VendorPortalAcceptedStep 
              canProgress={canProgress}
              onComplete={updateStep}
              loading={loadingStep === selectedStep.id}
              isLoanOrder={!!order.loanCustomer}
              initialAppNumber={(selectedStep.metadata as any)?.applicationNumber || order.applicationNumber || ''}
              initialLoanAppNumber={(selectedStep.metadata as any)?.loanApplicationNumber || order.loanApplicationNumber || ''}
              isEditMode={isEditMode}
            />
          );
        }

        if (selectedStep.status === 'PENDING' || selectedStep.status === 'IN_PROGRESS' || selectedStep.status === 'REJECTED') {
          return (
            <div className="p-6 md:p-8 w-full bg-slate-50 flex flex-col justify-center">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Required Action</h3>
                <p className="text-sm text-gray-500">
                  Complete this stage to advance the order documentation process.
                </p>
              </div>

              {canProgress && (
                 <div className="mb-4">
                   <textarea
                     placeholder="Optional remarks before progressing..."
                     value={remarks}
                     onChange={(e) => setRemarks(e.target.value)}
                     className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none shadow-sm bg-white"
                     rows={2}
                   />
                 </div>
              )}

              <button
                onClick={() => updateStep(selectedStep.status === 'PENDING' ? 'IN_PROGRESS' : 'COMPLETED', remarks)}
                disabled={loadingStep === selectedStep.id || !canProgress || selectedStep.status === 'REJECTED'}
                className={`w-full flex items-center justify-center gap-2 px-6 py-4 font-bold text-base rounded-xl transition-all shadow-md group ${canProgress ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none'}`}
                title={!canProgress ? "You don't have permission to progress this documentation workflow." : undefined}
              >
                {loadingStep === selectedStep.id ? <Loader2 size={22} className="animate-spin" /> : (canProgress && <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />)}
                {selectedStep.status === 'PENDING' ? `Start: ${stepName}` : `Complete: ${stepName}`}
              </button>
            </div>
          );
        }

        return null; // Will use engine default for COMPLETED
      }}
    />
  );
}
