'use client';

import { useState, useEffect } from 'react';
import { Loader2, Check } from 'lucide-react';
import WorkflowEngine, { WorkflowStep } from '../components/WorkflowEngine';
import InstallationChecklistForm from './InstallationChecklistForm';
import SystemWiFiSetupForm from './SystemWiFiSetupForm';

export default function InstallationTabClient({ 
  orderId, 
  steps, 
  canEdit,
  debugInfo
}: { 
  orderId: string, 
  steps: WorkflowStep[],
  canEdit: boolean,
  debugInfo?: {
    orderStatus: string;
    hasPermission: boolean;
  }
}) {

  return (
    <WorkflowEngine
      orderId={orderId}
      steps={steps}
      theme="neon-blue"
      title="Installation Progress"
      reviewSteps={[]} 
      canProgress={canEdit}
      canApprove={false}
      renderStageAction={(selectedStep, updateStep, remarks, setRemarks, loadingStep) => {
        const stepName = selectedStep.metadata?.name || selectedStep.stepKey;

        if (stepName === 'Installation Checklist') {
          return (
            <InstallationChecklistForm
              orderId={orderId}
              step={selectedStep}
              updateStep={updateStep}
              canEdit={canEdit}
              loadingStep={loadingStep}
            />
          );
        }

        // Generic stage handling for all dynamic steps
        return (
          <div className="p-6 md:p-8 w-full bg-slate-50 flex flex-col justify-center">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-1">{stepName}</h3>
              <p className="text-sm text-gray-500">
                Please confirm that this task is complete.
              </p>
            </div>

            {canEdit && (
               <div className="mb-4">
                 <textarea
                   placeholder="Optional remarks before completing..."
                   value={remarks}
                   onChange={(e) => setRemarks(e.target.value)}
                   className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C2FF]/20 focus:border-[#00C2FF] transition-all resize-none shadow-sm bg-white"
                   rows={2}
                 />
               </div>
            )}

            <button
              onClick={() => updateStep('COMPLETED', remarks)}
              disabled={loadingStep === selectedStep.id || !canEdit}
              className={`w-full flex items-center justify-center gap-2 px-6 py-4 font-bold text-base rounded-xl transition-all shadow-md group ${canEdit ? 'bg-[#00C2FF] text-white hover:bg-[#0091C2] hover:shadow-lg' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none'}`}
            >
              {loadingStep === selectedStep.id ? <Loader2 size={22} className="animate-spin" /> : (canEdit && <Check size={22} className="group-hover:scale-110 transition-transform" />)}
              Complete {stepName}
            </button>
          </div>
        );

        return null;
      }}
    />
  );
}
