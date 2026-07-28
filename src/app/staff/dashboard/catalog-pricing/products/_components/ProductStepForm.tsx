'use client';

import React from 'react';
import { Check } from 'lucide-react';

export interface Step {
  id: string;
  title: string;
}

interface ProductStepFormProps {
  steps: Step[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onNextStep?: () => void;
  children: React.ReactNode;
  onSaveDraft: () => void;
  onSubmitApproval: () => void;
  isSaving?: boolean;
}

export default function ProductStepForm({
  steps,
  currentStep,
  onStepChange,
  onNextStep,
  children,
  onSaveDraft,
  onSubmitApproval,
  isSaving = false,
}: ProductStepFormProps) {

  return (
    // Layer 1: Page Background #F6F8FB
    <div className="flex flex-col min-h-full bg-[#F6F8FB] text-gray-900 pb-16">
      
      {/* Page Header */}
      <div className="px-6 pt-8 pb-4 max-w-[1100px] mx-auto w-full">
        <h1 className="text-[26px] font-bold tracking-tight text-gray-900 mb-0.5">Create New Product</h1>
        <p className="text-[14px] text-gray-500">Create a single inventory product.</p>
      </div>

      {/* Layer 2: Unified Wizard Container */}
      <div className="flex-1 px-6 max-w-[1100px] mx-auto w-full">
        <div className="bg-white rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.04)] border border-gray-200/80 flex flex-col overflow-hidden min-h-[500px]">
          
          {/* Stepper as Header of Container */}
          <div className="px-8 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between bg-white relative">
            <div className="flex items-center gap-10">
              {steps.map((step, idx) => {
                const isCompleted = currentStep > idx;
                const isCurrent = currentStep === idx;
                const isPending = currentStep < idx;

                return (
                  <div 
                    key={step.id}
                    className={`flex items-center gap-3 relative z-10 transition-opacity duration-200 ${!isPending ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'}`}
                    onClick={() => !isPending && onStepChange(idx)}
                  >
                    <div className={`w-[26px] h-[26px] rounded-full flex items-center justify-center text-[13px] font-semibold transition-all duration-300 z-10
                      ${isCompleted ? 'bg-blue-600 text-white' : ''}
                      ${isCurrent ? 'bg-white border-[2px] border-blue-600 text-blue-600' : ''}
                      ${isPending ? 'bg-[#F3F4F6] text-gray-400' : ''}
                    `}>
                      {isCompleted ? <Check size={14} strokeWidth={3} /> : idx + 1}
                    </div>
                    <span className={`whitespace-nowrap text-[13.5px] transition-colors duration-300
                      ${isCurrent ? 'text-gray-900 font-medium' : ''}
                      ${isCompleted ? 'text-gray-700 font-medium' : ''}
                      ${isPending ? 'text-gray-400 font-medium' : ''}
                    `}>
                      {step.title}
                    </span>
                    
                    {/* Connector Line */}
                    {idx < steps.length - 1 && (
                      <div className="absolute left-[100%] top-1/2 -translate-y-1/2 w-8 ml-1 h-[2px] bg-gray-100 z-0">
                        <div 
                          className="h-full bg-blue-600 transition-all duration-300 ease-in-out"
                          style={{ width: currentStep > idx ? '100%' : '0%' }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-[13px] font-medium text-gray-500">
              Step {currentStep + 1} of {steps.length}
            </div>
          </div>

          {/* Layer 3: Main Form Content Area */}
          <div className="flex-1 p-8 bg-white relative">
            <div className="max-w-[800px] mx-auto transition-opacity duration-200 ease-in-out">
              {children}
            </div>
          </div>

          {/* Dedicated Footer inside container */}
          <div className="px-8 py-4 bg-[#FAFBFC] border-t border-gray-100 flex items-center justify-between">
            <button
              onClick={() => currentStep > 0 && onStepChange(currentStep - 1)}
              disabled={currentStep === 0 || isSaving}
              className={`h-[38px] px-5 rounded-lg text-[13.5px] font-medium transition-colors border
                ${currentStep === 0 ? 'invisible' : 'visible text-gray-700 border-gray-300 hover:bg-gray-50 bg-white shadow-sm'}
              `}
            >
              Previous
            </button>

            <div className="flex gap-3">
              {currentStep === steps.length - 1 ? (
                <>
                  <button
                    onClick={onSaveDraft}
                    disabled={isSaving}
                    className="h-[38px] px-5 rounded-lg text-[13.5px] font-medium transition-colors border border-gray-300 text-gray-700 hover:bg-gray-50 bg-white shadow-sm disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save as Draft'}
                  </button>
                  <button
                    onClick={onSubmitApproval}
                    disabled={isSaving}
                    className="h-[38px] px-6 rounded-lg text-[13.5px] font-medium transition-all shadow-sm bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSaving ? 'Submitting...' : 'Submit for Approval'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => onNextStep ? onNextStep() : onStepChange(currentStep + 1)}
                  className="h-[38px] px-6 rounded-lg text-[13.5px] font-medium transition-all shadow-sm bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]"
                >
                  Next
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
