'use client';

import { useState } from 'react';
import { ArrowRight, Loader2, Check } from 'lucide-react';
import WorkflowEngine, { WorkflowStep } from '../components/WorkflowEngine';
import WorkflowInstallationUploader from '../components/WorkflowInstallationUploader';

export default function InstallationTabClient({ 
  orderId, 
  steps, 
  canEdit
}: { 
  orderId: string, 
  steps: WorkflowStep[],
  canEdit: boolean
}) {
  const [inverterNumber, setInverterNumber] = useState('');

  return (
    <WorkflowEngine
      orderId={orderId}
      steps={steps}
      theme="neon-blue"
      title="Installation Progress"
      reviewSteps={[]} // No review stages in installation
      canProgress={canEdit}
      canApprove={false}
      renderStageAction={(selectedStep, updateStep, remarks, setRemarks, loadingStep) => {
        const stepName = selectedStep.metadata?.name || selectedStep.stepKey;
        
        if (stepName === 'Rooftop Photos Uploaded') {
          return (
            <div className="w-full h-full">
              <WorkflowInstallationUploader
                orderId={orderId}
                canProgress={canEdit}
                onComplete={() => updateStep('COMPLETED')}
              />
            </div>
          );
        }

        if (stepName === 'Ready to Install') {
          return (
            <div className="p-6 md:p-8 w-full bg-slate-50 flex flex-col justify-center">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Installation Ready</h3>
                <p className="text-sm text-gray-500">
                  Documentation is complete. You can now start the installation phase.
                </p>
              </div>

              <button
                onClick={() => {
                  if (window.confirm('Start Installation for this order?')) {
                    updateStep('COMPLETED', 'Installation Started');
                  }
                }}
                disabled={loadingStep === selectedStep.id || !canEdit}
                className={`w-full flex items-center justify-center gap-2 px-6 py-4 font-bold text-base rounded-xl transition-all shadow-md group ${canEdit ? 'bg-[#00C2FF] text-white hover:bg-[#0091C2] hover:shadow-lg' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none'}`}
              >
                {loadingStep === selectedStep.id ? <Loader2 size={22} className="animate-spin" /> : (canEdit && <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />)}
                Start Installation
              </button>
            </div>
          );
        }

        if (stepName === 'Inverter Number Entered') {
          return (
            <div className="p-6 md:p-8 w-full bg-slate-50 flex flex-col justify-center">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Required Action</h3>
                <p className="text-sm text-gray-500">
                  Please enter the inverter serial number to proceed.
                </p>
              </div>

              {canEdit && (
                <div className="mb-6 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Inverter Serial <span className="text-[#00C2FF]">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Scan or Enter S/N..."
                      value={inverterNumber}
                      onChange={(e) => setInverterNumber(e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-4 focus:ring-[#00C2FF]/10 focus:border-[#00C2FF] transition-all bg-white font-mono uppercase"
                    />
                  </div>
                  <div>
                    <textarea
                      placeholder="Optional remarks..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C2FF]/20 focus:border-[#00C2FF] transition-all resize-none shadow-sm bg-white"
                      rows={2}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  if (selectedStep.status === 'PENDING') {
                    updateStep('IN_PROGRESS', remarks);
                  } else {
                    if (!inverterNumber.trim()) {
                      alert('Inverter Serial is required');
                      return;
                    }
                    updateStep('COMPLETED', remarks, { inverterNumber: inverterNumber.trim().toUpperCase() });
                  }
                }}
                disabled={loadingStep === selectedStep.id || !canEdit}
                className={`w-full flex items-center justify-center gap-2 px-6 py-4 font-bold text-base rounded-xl transition-all shadow-md group ${canEdit ? 'bg-[#00C2FF] text-white hover:bg-[#0091C2] hover:shadow-lg' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none'}`}
              >
                {loadingStep === selectedStep.id ? <Loader2 size={22} className="animate-spin" /> : (canEdit && <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />)}
                {selectedStep.status === 'PENDING' ? `Start: ${stepName}` : `Complete: ${stepName}`}
              </button>
            </div>
          );
        }

        // Generic stage handling (e.g. Installation Started, Wiring Completed, System Completed)
        if (selectedStep.status === 'PENDING' || selectedStep.status === 'IN_PROGRESS') {
          return (
            <div className="p-6 md:p-8 w-full bg-slate-50 flex flex-col justify-center">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Required Action</h3>
                <p className="text-sm text-gray-500">
                  Complete this stage to advance the installation process.
                </p>
              </div>

              {canEdit && (
                 <div className="mb-4">
                   <textarea
                     placeholder="Optional remarks before progressing..."
                     value={remarks}
                     onChange={(e) => setRemarks(e.target.value)}
                     className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C2FF]/20 focus:border-[#00C2FF] transition-all resize-none shadow-sm bg-white"
                     rows={2}
                   />
                 </div>
              )}

              <button
                onClick={() => updateStep(selectedStep.status === 'PENDING' ? 'IN_PROGRESS' : 'COMPLETED', remarks)}
                disabled={loadingStep === selectedStep.id || !canEdit}
                className={`w-full flex items-center justify-center gap-2 px-6 py-4 font-bold text-base rounded-xl transition-all shadow-md group ${canEdit ? 'bg-[#00C2FF] text-white hover:bg-[#0091C2] hover:shadow-lg' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none'}`}
              >
                {loadingStep === selectedStep.id ? <Loader2 size={22} className="animate-spin" /> : (canEdit && <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />)}
                {selectedStep.status === 'PENDING' ? `Start: ${stepName}` : `Complete: ${stepName}`}
              </button>
            </div>
          );
        }

        return null;
      }}
    />
  );
}
