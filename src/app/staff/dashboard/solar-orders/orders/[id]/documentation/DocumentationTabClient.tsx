'use client';

import { ShieldCheck, ArrowRight, Loader2, Lock } from 'lucide-react';
import WorkflowDocumentUploader from './WorkflowDocumentUploader';
import WorkflowEngine, { WorkflowStep } from '../components/WorkflowEngine';
import VendorPortalAcceptedStep from './VendorPortalAcceptedStep';

export default function DocumentationTabClient({ 
  orderId, 
  steps, 
  canProgress, 
  canApprove 
}: { 
  orderId: string, 
  steps: WorkflowStep[],
  canProgress: boolean,
  canApprove: boolean,
}) {
  const reviewSteps = ['Review & Approval', 'Review Pending', 'File Upload Approval Pending'];

  return (
    <WorkflowEngine
      orderId={orderId}
      steps={steps}
      theme="green"
      title="Documentation Progress"
      reviewSteps={reviewSteps}
      canProgress={canProgress}
      canApprove={canApprove}
      renderStageAction={(selectedStep, updateStep, remarks, setRemarks, loadingStep) => {
        const stepName = selectedStep.metadata?.name || selectedStep.stepKey;
        
        if (stepName === 'Document Upload') {
          return (
            <div className="w-full">
               <WorkflowDocumentUploader 
                 orderId={orderId}
                 requirements={[
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
                 ]}
                 canProgress={canProgress}
                 onComplete={() => updateStep('COMPLETED')}
               />
            </div>
          );
        }

        if (stepName === 'DCR Certificate Pending') {
          return (
            <div className="w-full">
               <WorkflowDocumentUploader 
                 orderId={orderId}
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

              {!reviewSteps.includes(stepName) && canProgress && (
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

              {reviewSteps.includes(stepName) ? (
                canApprove ? (
                  <button
                    onClick={() => updateStep('COMPLETED')}
                    disabled={loadingStep === selectedStep.id}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 border border-green-700 text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-md disabled:opacity-50"
                  >
                    {loadingStep === selectedStep.id ? <Loader2 size={20} className="animate-spin" /> : <ShieldCheck size={20} />}
                    Approve Stage
                  </button>
                ) : (
                  <button disabled className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gray-200 text-gray-500 font-bold rounded-xl cursor-not-allowed border border-gray-300" title="You don't have permission to progress this workflow.">
                    <Lock size={18} />
                    Waiting for Administrator
                  </button>
                )
              ) : (
                <button
                  onClick={() => updateStep(selectedStep.status === 'PENDING' ? 'IN_PROGRESS' : 'COMPLETED', remarks)}
                  disabled={loadingStep === selectedStep.id || !canProgress || selectedStep.status === 'REJECTED'}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-4 font-bold text-base rounded-xl transition-all shadow-md group ${canProgress ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none'}`}
                  title={!canProgress ? "You don't have permission to progress this documentation workflow." : undefined}
                >
                  {loadingStep === selectedStep.id ? <Loader2 size={22} className="animate-spin" /> : (canProgress && <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />)}
                  {selectedStep.status === 'PENDING' ? `Start: ${stepName}` : `Complete: ${stepName}`}
                </button>
              )}
            </div>
          );
        }

        return null; // Will use engine default for COMPLETED
      }}
    />
  );
}
