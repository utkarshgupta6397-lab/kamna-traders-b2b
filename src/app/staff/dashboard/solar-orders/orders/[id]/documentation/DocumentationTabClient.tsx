'use client';

import { useState } from 'react';
import { ShieldCheck, ArrowRight, Loader2, Lock } from 'lucide-react';
import WorkflowDocumentUploader from './WorkflowDocumentUploader';
import WorkflowEngine, { WorkflowStep } from '../components/WorkflowEngine';
import VendorPortalAcceptedStep from './VendorPortalAcceptedStep';
import DocumentationApprovalStage from './DocumentationApprovalStage';
import { getWorkflowStageName, DOCUMENTATION_STEPS_CONFIG } from '@/lib/solar-workflow-config';
import { CancelledChequeModal } from './CancelledChequeModal';

export default function DocumentationTabClient({ 
  order, 
  steps, 
  canProgress, 
  canApprove,
  canMasterEdit,
  canManageWorkflowEdits,
  hasCancelledCheque
}: { 
  order: any, 
  steps: WorkflowStep[],
  canProgress: boolean,
  canApprove: boolean,
  canMasterEdit?: boolean,
  canManageWorkflowEdits?: boolean,
  hasCancelledCheque?: boolean
}) {
  const [showChequeModal, setShowChequeModal] = useState(false);
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
    <>
    <WorkflowEngine
      orderId={order.id}
      steps={validSteps}
      theme="neon-blue"
      title="Documentation Workflow"
      reviewSteps={reviewSteps}
      canProgress={canProgress}
      canApprove={canApprove}
      canMasterEdit={canMasterEdit}
      canManageWorkflowEdits={canManageWorkflowEdits}
      onErrorInterceptor={(errorMsg) => {
        if (errorMsg.includes("Cancelled Cheque")) {
          setShowChequeModal(true);
          return true;
        }
        return false;
      }}
      renderStageAction={(selectedStep, updateStep, remarks, setRemarks, loadingStep, isEditMode) => {
        const stepName = getWorkflowStageName(selectedStep.workflowType, selectedStep.stepKey);
        
        const configIndex = DOCUMENTATION_STEPS_CONFIG.findIndex(c => c.id === selectedStep.stepKey || c.legacyKey === selectedStep.stepKey);
        const config = DOCUMENTATION_STEPS_CONFIG[configIndex];
        const nextConfig = DOCUMENTATION_STEPS_CONFIG[configIndex + 1];
        
        const isApprovalStage = config?.requiresCancelledCheque;
        const isEnteringNextApproval = nextConfig?.requiresCancelledCheque;
        const isBlockedByCheque = (isApprovalStage || isEnteringNextApproval) && !hasCancelledCheque;
        const disabledMessage = isBlockedByCheque ? "Cancelled Cheque / Passbook must be uploaded before Final File Approval." : undefined;

        
        if (reviewSteps.includes(stepName) && selectedStep.status !== 'COMPLETED') {
          return (
            <>
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
                    if (data.error && data.error.includes("Cancelled Cheque")) {
                      setShowChequeModal(true);
                    } else {
                      alert(data.error || 'Failed to request corrections');
                    }
                  }
                } catch (e) {
                  alert('Network error');
                }
              }}
              canApprove={canApprove && !isBlockedByCheque}
              loadingStep={loadingStep}
            />
            {isBlockedByCheque && (
              <div className="mt-4 flex items-center justify-between gap-4 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-red-500">⚠</span>
                  <span className="font-medium">{disabledMessage}</span>
                </div>
                <button
                  onClick={() => setShowChequeModal(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition-colors shadow-sm whitespace-nowrap shrink-0"
                >
                  Upload Now
                </button>
              </div>
            )}
          </>
        );
      }

        if (stepName === 'Document Upload') {
          const requirements: any[] = [
            {
              type: 'CANCELLED_CHEQUE',
              label: 'Cancelled Cheque / Passbook',
              required: false,
              optionalText: 'Optional (Complete before Final Approval)',
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
                 disabledMessage={disabledMessage}
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
              disabledMessage={disabledMessage}
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
                   {disabledMessage && (
                     <div className="mb-3 flex items-center justify-between gap-4 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm shadow-sm">
                       <div className="flex items-center gap-2">
                         <span className="font-medium text-red-500">⚠</span>
                         <span className="font-medium">{disabledMessage}</span>
                       </div>
                       <button
                         onClick={() => setShowChequeModal(true)}
                         className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition-colors shadow-sm whitespace-nowrap shrink-0"
                       >
                         Upload Now
                       </button>
                     </div>
                   )}
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
                disabled={loadingStep === selectedStep.id || !canProgress || selectedStep.status === 'REJECTED' || !!disabledMessage}
                className={`w-full flex items-center justify-center gap-2 px-6 py-4 font-bold text-base rounded-xl transition-all shadow-md group ${canProgress && !disabledMessage ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none'}`}
                title={!canProgress ? "You don't have permission to progress this documentation workflow." : disabledMessage ? disabledMessage : undefined}
              >
                {loadingStep === selectedStep.id ? <Loader2 size={22} className="animate-spin" /> : (canProgress && !disabledMessage && <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />)}
                {selectedStep.status === 'PENDING' ? `Start: ${stepName}` : `Complete: ${stepName}`}
              </button>
            </div>
          );
        }

        return null; // Will use engine default for COMPLETED
      }}
    />
    <CancelledChequeModal 
      isOpen={showChequeModal} 
      onClose={() => setShowChequeModal(false)}
      order={order}
      canProgress={canProgress}
      onUploadComplete={() => {
        setShowChequeModal(false);
        window.location.reload();
      }}
    />
    </>
  );
}
