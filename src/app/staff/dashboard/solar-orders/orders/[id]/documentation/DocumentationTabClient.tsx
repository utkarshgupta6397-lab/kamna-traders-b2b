'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Circle, AlertCircle, Lock, ArrowRight, Info, ShieldCheck, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import WorkflowDocumentUploader from './WorkflowDocumentUploader';

interface WorkflowStep {
  id: string;
  stepKey: string;
  stepIndex: number;
  status: string;
  blockedReason: string | null;
  notes: string | null;
  completedAt: Date | null;
  completedBy: { name: string } | null;
  metadata: any;
}

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
  const router = useRouter();
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  
  const initialStepIndex = steps.findIndex(s => s.status === 'IN_PROGRESS' || s.status === 'PENDING') ?? 0;
  const safeInitialIndex = initialStepIndex >= 0 ? initialStepIndex : steps.length - 1;
  const [selectedStepId, setSelectedStepId] = useState<string>(steps[safeInitialIndex]?.id || '');
  
  const [remarks, setRemarks] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  
  const [chunkSize, setChunkSize] = useState(6);
  const snakeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!snakeContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const width = entry.contentRect.width;
        // Each node needs about 140px min to breathe comfortably
        const calculatedSize = Math.max(3, Math.floor(width / 140));
        setChunkSize(calculatedSize);
      }
    });
    observer.observe(snakeContainerRef.current);
    return () => observer.disconnect();
  }, []);

  const reviewSteps = ['Review & Approval', 'Review Pending', 'File Upload Approval Pending'];

  const updateStep = async (stepId: string, newStatus: string, notes?: string) => {
    if (newStatus === 'REJECTED' && (!notes || !notes.trim())) {
      toast.error('Remarks are mandatory for rejection');
      return;
    }

    setLoadingStep(stepId);
    try {
      const res = await fetch(`/api/solar-orders/${orderId}/workflow/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notes })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Stage ${newStatus === 'COMPLETED' ? 'completed' : newStatus === 'IN_PROGRESS' ? 'started' : 'rejected'}`);
        setShowRejectModal(false);
        setRemarks('');
        
        // Auto-advance to next step if completed
        if (newStatus === 'COMPLETED') {
          const currentStepRecord = steps.find(s => s.id === stepId);
          if (currentStepRecord) {
             const nextStep = steps.find(s => s.stepIndex === currentStepRecord.stepIndex + 1);
             if (nextStep) {
               setSelectedStepId(nextStep.id);
             }
          }
        }

        router.refresh();
      } else {
        toast.error(data.error || 'Failed to update stage');
      }
    } catch (e) {
      toast.error('Network error');
    } finally {
      setLoadingStep(null);
    }
  };

  const completedCount = steps.filter(s => s.status === 'COMPLETED').length;
  const totalCount = steps.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100) || 0;
  const currentActiveStep = steps.find(s => s.status !== 'COMPLETED' && s.status !== 'SKIPPED') || steps[steps.length - 1];
  const selectedStep = steps.find(s => s.id === selectedStepId);
  const selectedIndex = steps.findIndex(s => s.id === selectedStepId);

  const getStatusConfig = (status: string, isReview: boolean) => {
    if (status === 'COMPLETED') return { color: 'text-emerald-600', bg: 'bg-emerald-500', border: 'border-emerald-500', icon: Check, label: 'Completed' };
    if (status === 'IN_PROGRESS') return { color: 'text-blue-600', bg: 'bg-blue-600', border: 'border-blue-600', icon: Loader2, label: 'Current' };
    if (status === 'PENDING') return { color: 'text-gray-400', bg: 'bg-white', border: 'border-gray-300', icon: Circle, label: isReview ? 'Approval Required' : 'Waiting' };
    if (status === 'BLOCKED') return { color: 'text-gray-400', bg: 'bg-gray-100', border: 'border-gray-200', icon: Lock, label: 'Blocked' };
    if (status === 'REJECTED') return { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-400', icon: AlertCircle, label: 'Rejected' };
    return { color: 'text-gray-400', bg: 'bg-white', border: 'border-gray-300', icon: Circle, label: 'Unknown' };
  };

  if (!steps.length) return null;

  const rows = [];
  for (let i = 0; i < steps.length; i += chunkSize) {
    rows.push(steps.slice(i, i + chunkSize));
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12 w-full">
      
      {/* Top Header - Progress Tracking */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Documentation Progress</h2>
            <p className="text-sm font-medium text-gray-500 mt-0.5">{completedCount} / {totalCount} Steps Completed</p>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-gray-500 mb-0.5">Current Stage</p>
              <p className="font-bold text-blue-700">{currentActiveStep?.metadata?.name || currentActiveStep?.stepKey}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-0.5">Estimated Remaining</p>
              <p className="font-bold text-gray-900">{totalCount - completedCount} Steps</p>
            </div>
          </div>
        </div>

        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Process Flow - Desktop Dynamic Snake */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 p-6 shadow-sm relative overflow-hidden" ref={snakeContainerRef}>
        
        <div className="flex flex-col relative w-full mx-auto">
          {rows.map((row, rowIndex) => {
            const isEven = rowIndex % 2 === 0;
            const isLastRow = rowIndex === rows.length - 1;
            // The percentage calculation for the connector lines based on dynamic chunks
            const offsetPercentage = `${100 / (chunkSize * 2)}%`;
            
            return (
              <div key={rowIndex} className={`flex relative min-h-[120px] w-full ${isEven ? 'flex-row' : 'flex-row-reverse'}`}>
                
                {/* Horizontal Connector Line for the row */}
                <div className="absolute top-[28px] left-0 right-0 h-[2px] bg-gray-200 z-0" style={{
                  left: offsetPercentage,
                  right: offsetPercentage,
                }} />

                {/* Vertical Connector Line to next row */}
                {!isLastRow && (
                  <div className={`absolute top-[28px] w-[2px] h-[120px] bg-gray-200 z-0`} style={{
                    [isEven ? 'right' : 'left']: offsetPercentage
                  }} />
                )}

                {row.map((step, colIndex) => {
                  const stepName = step.metadata?.name || step.stepKey;
                  const isReviewStep = reviewSteps.includes(stepName);
                  const conf = getStatusConfig(step.status, isReviewStep);
                  const isSelected = selectedStepId === step.id;
                  const isCurrent = step.status === 'IN_PROGRESS' || step.status === 'PENDING';
                  const isBlocked = step.status === 'BLOCKED';
                  const Icon = conf.icon;
                  const isFuture = step.stepIndex > currentActiveStep.stepIndex;
                  // Dynamic width to distribute evenly
                  const itemWidth = `${100 / chunkSize}%`;

                  return (
                    <div key={step.id} className="relative z-10 flex flex-col items-center" style={{ width: itemWidth }}>
                      
                      {/* Node Circle */}
                      <button
                        onClick={() => setSelectedStepId(step.id)}
                        disabled={isFuture}
                        className={`w-14 h-14 rounded-full flex items-center justify-center border-[3px] bg-white transition-all group outline-none
                          ${conf.border} 
                          ${isSelected ? 'ring-4 ring-blue-500/20 scale-110 shadow-lg' : 'hover:scale-105 shadow-sm'}
                          ${step.status === 'IN_PROGRESS' ? 'shadow-[0_0_20px_rgba(37,99,235,0.3)] border-blue-500' : ''}
                          ${isFuture ? 'opacity-40 grayscale cursor-not-allowed hover:scale-100' : ''}
                        `}
                        title={isFuture ? 'Stage locked' : isBlocked ? `Waiting for ${steps.find(s => s.stepIndex === step.stepIndex - 1)?.metadata?.name}` : stepName}
                      >
                        {step.status === 'COMPLETED' ? (
                          <div className={`w-full h-full rounded-full flex items-center justify-center ${conf.bg}`} title={step.completedAt ? `Completed on ${new Date(step.completedAt).toLocaleString('en-IN')}` : 'Completed'}>
                            <Icon size={20} className="text-white" strokeWidth={3} />
                          </div>
                        ) : step.status === 'BLOCKED' ? (
                          <div className={`w-full h-full rounded-full flex items-center justify-center ${conf.bg}`}>
                            <Icon size={20} className={conf.color} strokeWidth={2.5} />
                          </div>
                        ) : (
                          <div className={`w-full h-full rounded-full flex items-center justify-center bg-white`}>
                            <Icon size={20} className={`${conf.color} ${step.status === 'IN_PROGRESS' ? 'animate-spin' : ''}`} strokeWidth={2.5} />
                          </div>
                        )}
                      </button>

                      {/* Label Card */}
                      <div className={`mt-3 text-center px-1 w-full ${isSelected ? 'opacity-100' : 'opacity-80'}`}>
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <span className="text-[10px] font-black text-gray-400">{(step.stepIndex).toString().padStart(2, '0')}</span>
                          {isReviewStep && step.status !== 'COMPLETED' && (
                            <span className="px-1 py-[1px] text-[8px] font-bold uppercase bg-orange-100 text-orange-700 rounded-sm leading-none">Review</span>
                          )}
                        </div>
                        <h4 className={`text-xs font-bold leading-tight line-clamp-2 ${isCurrent ? 'text-blue-700' : 'text-gray-900'}`}>
                          {stepName}
                        </h4>
                        {/* We hide the extra status text on desktop to save space, colors indicate state */}
                      </div>

                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Process Flow - Mobile Carousel */}
      <div className="md:hidden bg-white rounded-xl border border-gray-200 p-4 shadow-sm relative">
        <div className="flex overflow-x-auto gap-3 pb-2 snap-x hide-scrollbar px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {steps.map((step, idx) => {
            const stepName = step.metadata?.name || step.stepKey;
            const isReviewStep = reviewSteps.includes(stepName);
            const conf = getStatusConfig(step.status, isReviewStep);
            const isSelected = selectedStepId === step.id;
            const Icon = conf.icon;

            const isFuture = step.stepIndex > currentActiveStep.stepIndex;

            return (
              <div key={step.id} className="flex items-center flex-shrink-0 snap-start">
                <button
                  onClick={() => setSelectedStepId(step.id)}
                  disabled={isFuture}
                  title={isFuture ? 'Stage locked' : ''}
                  className={`relative w-40 p-3 rounded-xl border text-left transition-all 
                    ${isSelected ? 'ring-2 ring-blue-500 shadow-sm active-stage-card' : 'hover:border-gray-300'} 
                    ${conf.bg === 'bg-emerald-500' ? 'bg-emerald-50 border-emerald-200' : conf.bg === 'bg-blue-600' ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}
                    ${isFuture ? 'opacity-50 grayscale cursor-not-allowed hover:border-gray-200' : ''}
                  `}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${conf.border} ${conf.bg === 'bg-emerald-500' || conf.bg === 'bg-blue-600' ? conf.bg : 'bg-white'}`}>
                       <Icon size={12} className={conf.bg === 'bg-emerald-500' || conf.bg === 'bg-blue-600' ? 'text-white' : conf.color} strokeWidth={3} />
                    </div>
                  </div>
                  <h4 className="text-xs font-bold text-gray-900 leading-tight mb-1 truncate">{stepName}</h4>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage Details Panel */}
      {selectedStep && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col xl:flex-row animate-in slide-in-from-bottom-2 fade-in duration-200">
          
          <div className="p-6 md:p-8 flex-1 border-b xl:border-b-0 xl:border-r border-gray-100 flex flex-col">
            
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black text-gray-300 tracking-tighter">{(selectedStep.stepIndex).toString().padStart(2, '0')}</span>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">{selectedStep.metadata?.name || selectedStep.stepKey}</h2>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setSelectedStepId(steps[selectedIndex - 1].id)} 
                  disabled={selectedIndex === 0}
                  className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-30 transition-colors"
                  title="Previous Stage"
                >
                  <ChevronLeft size={18} />
                </button>
                <button 
                  onClick={() => setSelectedStepId(steps[selectedIndex + 1].id)} 
                  disabled={selectedIndex === steps.length - 1 || steps[selectedIndex + 1].stepIndex > currentActiveStep.stepIndex}
                  className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Next Stage"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            
            {selectedStep.status === 'BLOCKED' && (
              <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-sm font-bold border border-gray-200 w-fit">
                <Lock size={16} />
                Blocked: Waiting for {steps.find(s => s.stepIndex === selectedStep.stepIndex - 1)?.metadata?.name || 'Previous Step'}
              </div>
            )}
            
            {selectedStep.status === 'COMPLETED' && (
              <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-bold border border-emerald-200 w-fit">
                <Check size={16} />
                Completed by {selectedStep.completedBy?.name || 'System'} on {new Date(selectedStep.completedAt!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mt-2 mb-6">
              <div>
                <span className="block text-xs font-medium text-gray-500 mb-1">Status</span>
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${getStatusConfig(selectedStep.status, false).color} bg-gray-50 border border-gray-100`}>
                  {getStatusConfig(selectedStep.status, false).label}
                </span>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-500 mb-1">Permission Requirement</span>
                <span className="text-sm font-bold text-gray-900">
                  {reviewSteps.includes(selectedStep.metadata?.name || selectedStep.stepKey) ? 'Order Approval' : 'Workflow Progress'}
                </span>
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-end">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 mb-2">
                <MessageSquare size={14} className="text-gray-400" />
                History & Notes
              </h4>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-sm text-gray-700 leading-relaxed min-h-[60px]">
                {selectedStep.notes || selectedStep.blockedReason || <span className="text-gray-400 italic">No notes recorded yet.</span>}
              </div>
            </div>
          </div>

          {/* Stage Detail or Uploader Component */}
          {(selectedStep.metadata?.name || selectedStep.stepKey) === 'Document Upload' ? (
            <div className="w-full xl:w-[600px] border-t xl:border-t-0 xl:border-l border-gray-100 flex-shrink-0">
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
                 onComplete={() => updateStep(selectedStep.id, 'COMPLETED')}
               />
            </div>
          ) : (selectedStep.status === 'PENDING' || selectedStep.status === 'IN_PROGRESS' || selectedStep.status === 'REJECTED') ? (
            <div className="p-6 md:p-8 w-full xl:w-[400px] bg-slate-50 flex flex-col justify-center border-t xl:border-t-0 border-gray-100">
              
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Required Action</h3>
                <p className="text-sm text-gray-500">
                  Complete this stage to advance the order documentation process.
                </p>
              </div>

              {!reviewSteps.includes(selectedStep.metadata?.name || selectedStep.stepKey) && canProgress && (
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

              {reviewSteps.includes(selectedStep.metadata?.name || selectedStep.stepKey) ? (
                canApprove ? (
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => updateStep(selectedStep.id, 'COMPLETED')}
                      disabled={loadingStep === selectedStep.id}
                      className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 border border-green-700 text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-md disabled:opacity-50"
                    >
                      {loadingStep === selectedStep.id ? <Loader2 size={20} className="animate-spin" /> : <ShieldCheck size={20} />}
                      Approve Stage
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={loadingStep === selectedStep.id}
                      className="w-full px-6 py-3 bg-white border-2 border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <button disabled className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gray-200 text-gray-500 font-bold rounded-xl cursor-not-allowed border border-gray-300" title="You don't have permission to progress this workflow.">
                    <Lock size={18} />
                    Waiting for Administrator
                  </button>
                )
              ) : (
                <button
                  onClick={() => updateStep(selectedStep.id, selectedStep.status === 'PENDING' ? 'IN_PROGRESS' : 'COMPLETED', remarks)}
                  disabled={loadingStep === selectedStep.id || !canProgress || selectedStep.status === 'REJECTED'}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-4 font-bold text-base rounded-xl transition-all shadow-md group ${canProgress ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none'}`}
                  title={!canProgress ? "You don't have permission to progress this documentation workflow." : undefined}
                >
                  {loadingStep === selectedStep.id ? <Loader2 size={22} className="animate-spin" /> : (canProgress && <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />)}
                  {selectedStep.status === 'PENDING' ? `Start: ${selectedStep.metadata?.name || selectedStep.stepKey}` : `Complete: ${selectedStep.metadata?.name || selectedStep.stepKey}`}
                </button>
              )}
            </div>
          ) : (
            <div className="p-6 md:p-8 w-full xl:w-[400px] bg-emerald-50/50 flex flex-col items-center justify-center text-center border-t xl:border-t-0 border-gray-100">
              <Check size={40} className="text-emerald-400 mb-3" />
              <h3 className="text-lg font-bold text-gray-800 mb-1">Stage Completed</h3>
              <p className="text-sm text-gray-500">This stage has been finalized and requires no further action.</p>
            </div>
          )}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedStep && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-red-50/50">
              <h3 className="text-lg font-bold text-red-900 flex items-center gap-2">
                <AlertCircle size={20} className="text-red-500" />
                Reject Stage
              </h3>
              <button onClick={() => setShowRejectModal(false)} className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 border border-gray-200">
                X
              </button>
            </div>
            
            <div className="p-6 bg-gray-50/30">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Rejection Remarks <span className="text-red-500">*</span>
              </label>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Reason for rejection..."
                className="w-full border-2 border-gray-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all min-h-[120px] resize-none bg-white"
                autoFocus
              />
            </div>
            
            <div className="p-5 border-t border-gray-100 bg-white flex justify-end gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => updateStep(selectedStep.id, 'REJECTED', remarks)}
                disabled={loadingStep === selectedStep.id || !remarks.trim()}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-all shadow-sm"
              >
                {loadingStep === selectedStep.id && <Loader2 size={16} className="animate-spin" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
