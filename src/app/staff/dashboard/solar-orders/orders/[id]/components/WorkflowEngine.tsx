'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Circle, AlertCircle, Lock, ArrowRight, Info, ShieldCheck, ChevronLeft, ChevronRight, MessageSquare, X } from 'lucide-react';
import toast from 'react-hot-toast';

export interface WorkflowStep {
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

interface WorkflowEngineProps {
  orderId: string;
  steps: WorkflowStep[];
  theme: 'green' | 'neon-blue';
  title: string;
  reviewSteps?: string[];
  canProgress: boolean;
  canApprove: boolean;
  renderStageAction: (
    step: WorkflowStep, 
    updateStep: (status: string, notes?: string, metaOverride?: any) => Promise<void>, 
    remarks: string, 
    setRemarks: (r: string) => void,
    loadingStep: string | null
  ) => React.ReactNode;
}

export default function WorkflowEngine({
  orderId,
  steps,
  theme,
  title,
  reviewSteps = [],
  canProgress,
  canApprove,
  renderStageAction
}: WorkflowEngineProps) {
  const router = useRouter();
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  
  const initialStepIndex = steps.findIndex(s => s.status === 'IN_PROGRESS' || s.status === 'PENDING') ?? 0;
  const safeInitialIndex = initialStepIndex >= 0 ? initialStepIndex : steps.length - 1;
  const [selectedStepId, setSelectedStepId] = useState<string>(steps[safeInitialIndex]?.id || '');
  
  const [remarks, setRemarks] = useState('');
  const [showCorrectionsModal, setShowCorrectionsModal] = useState(false);
  const [targetStepId, setTargetStepId] = useState<string>('');
  
  const [chunkSize, setChunkSize] = useState(6);
  const snakeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!snakeContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const width = entry.contentRect.width;
        const calculatedSize = Math.max(3, Math.floor(width / 140));
        setChunkSize(calculatedSize);
      }
    });
    observer.observe(snakeContainerRef.current);
    return () => observer.disconnect();
  }, []);

  const updateStep = async (newStatus: string, notes?: string, metaOverride?: any) => {
    if (newStatus === 'REJECTED' && (!notes || !notes.trim())) {
      toast.error('Remarks are mandatory for rejection');
      return;
    }

    setLoadingStep(selectedStepId);
    try {
      const res = await fetch(`/api/solar-orders/${orderId}/workflow/${selectedStepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notes, metadata: metaOverride })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Stage ${newStatus === 'COMPLETED' ? 'completed' : newStatus === 'IN_PROGRESS' ? 'started' : 'rejected'}`);
        setRemarks('');
        
        if (newStatus === 'COMPLETED') {
          const currentStepRecord = steps.find(s => s.id === selectedStepId);
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

  const requestCorrections = async () => {
    if (!remarks.trim()) {
      toast.error('Remarks are mandatory when requesting corrections');
      return;
    }
    if (!targetStepId) {
      toast.error('Please select a stage to send back to');
      return;
    }

    setLoadingStep(selectedStepId);
    try {
      const res = await fetch(`/api/solar-orders/${orderId}/workflow/${selectedStepId}/corrections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStepId, notes: remarks })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Workflow sent back for corrections');
        setShowCorrectionsModal(false);
        setRemarks('');
        setTargetStepId('');
        setSelectedStepId(targetStepId); 
        router.refresh();
      } else {
        toast.error(data.error || 'Failed to request corrections');
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

  // Theme Configs
  const themeColors = {
    green: {
      progress: 'bg-emerald-500',
      activeText: 'text-blue-700',
      activeBorder: 'border-blue-500',
      activeGlow: 'shadow-[0_0_20px_rgba(37,99,235,0.3)]',
      activeRing: 'ring-blue-500/20',
      completedBg: 'bg-emerald-500',
      completedBorder: 'border-emerald-500',
      completedText: 'text-emerald-600',
      stageActionBg: 'bg-emerald-50/50',
      stageActionIcon: 'text-emerald-400',
      historyBg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },
    'neon-blue': {
      progress: 'bg-[#00C2FF]',
      activeText: 'text-[#00C2FF]',
      activeBorder: 'border-[#4FD8FF]',
      activeGlow: 'shadow-[0_0_20px_rgba(79,216,255,0.4)]',
      activeRing: 'ring-[#4FD8FF]/20',
      completedBg: 'bg-[#00C2FF]',
      completedBorder: 'border-[#00C2FF]',
      completedText: 'text-[#00C2FF]',
      stageActionBg: 'bg-blue-50/50',
      stageActionIcon: 'text-[#00C2FF]',
      historyBg: 'bg-[#E5FAFF] text-[#0091C2] border-[#B3F0FF]'
    }
  };

  const currentTheme = themeColors[theme];

  const getStatusConfig = (status: string, isReview: boolean) => {
    if (status === 'COMPLETED') return { color: currentTheme.completedText, bg: currentTheme.completedBg, border: currentTheme.completedBorder, icon: Check, label: 'Completed' };
    if (status === 'IN_PROGRESS') return { color: currentTheme.activeText, bg: 'bg-white', border: currentTheme.activeBorder, icon: Loader2, label: 'Current' };
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
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h2>
            <p className="text-sm font-medium text-gray-500 mt-0.5">{completedCount} / {totalCount} Steps Completed</p>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-gray-500 mb-0.5">Current Stage</p>
              <p className={`font-bold ${currentTheme.activeText}`}>{currentActiveStep?.metadata?.name || currentActiveStep?.stepKey}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-0.5">Estimated Remaining</p>
              <p className="font-bold text-gray-900">{totalCount - completedCount} Steps</p>
            </div>
          </div>
        </div>

        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${currentTheme.progress} transition-all duration-1000 ease-out`} style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Process Flow - Desktop Dynamic Snake */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 p-6 shadow-sm relative overflow-hidden" ref={snakeContainerRef}>
        <div className="flex flex-col relative w-full mx-auto">
          {rows.map((row, rowIndex) => {
            const isEven = rowIndex % 2 === 0;
            const isLastRow = rowIndex === rows.length - 1;
            const offsetPercentage = `${100 / (chunkSize * 2)}%`;
            
            return (
              <div key={rowIndex} className={`flex relative min-h-[120px] w-full ${isEven ? 'flex-row' : 'flex-row-reverse'}`}>
                <div className="absolute top-[28px] left-0 right-0 h-[2px] bg-gray-200 z-0" style={{ left: offsetPercentage, right: offsetPercentage }} />
                {!isLastRow && (
                  <div className={`absolute top-[28px] w-[2px] h-[120px] bg-gray-200 z-0`} style={{ [isEven ? 'right' : 'left']: offsetPercentage }} />
                )}

                {row.map((step) => {
                  const stepName = step.metadata?.name || step.stepKey;
                  const isReviewStep = reviewSteps.includes(stepName);
                  const conf = getStatusConfig(step.status, isReviewStep);
                  const isSelected = selectedStepId === step.id;
                  const isCurrent = step.status === 'IN_PROGRESS' || step.status === 'PENDING';
                  const isBlocked = step.status === 'BLOCKED';
                  const Icon = conf.icon;
                  const isFuture = step.stepIndex > currentActiveStep.stepIndex;
                  const itemWidth = `${100 / chunkSize}%`;

                  return (
                    <div key={step.id} className="relative z-10 flex flex-col items-center" style={{ width: itemWidth }}>
                      <button
                        onClick={() => setSelectedStepId(step.id)}
                        disabled={isFuture}
                        className={`w-14 h-14 rounded-full flex items-center justify-center border-[3px] bg-white transition-all group outline-none
                          ${conf.border} 
                          ${isSelected ? `ring-4 ${currentTheme.activeRing} scale-110 shadow-lg` : 'hover:scale-105 shadow-sm'}
                          ${step.status === 'IN_PROGRESS' ? currentTheme.activeGlow : ''}
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
                          <div className={`w-full h-full rounded-full flex items-center justify-center ${step.status === 'IN_PROGRESS' ? conf.bg : 'bg-white'}`}>
                            <Icon size={20} className={`${step.status === 'IN_PROGRESS' ? 'text-white animate-spin' : conf.color}`} strokeWidth={2.5} />
                          </div>
                        )}
                      </button>

                      <div className={`mt-3 text-center px-1 w-full ${isSelected ? 'opacity-100' : 'opacity-80'}`}>
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <span className="text-[10px] font-black text-gray-400">{(step.stepIndex).toString().padStart(2, '0')}</span>
                          {isReviewStep && step.status !== 'COMPLETED' && (
                            <span className="px-1 py-[1px] text-[8px] font-bold uppercase bg-orange-100 text-orange-700 rounded-sm leading-none">Review</span>
                          )}
                        </div>
                        <h4 className={`text-xs font-bold leading-tight line-clamp-2 ${isCurrent ? currentTheme.activeText : 'text-gray-900'}`}>
                          {stepName}
                        </h4>
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
          {steps.map((step) => {
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
                    ${isSelected ? `ring-2 ${currentTheme.activeRing} shadow-sm active-stage-card` : 'hover:border-gray-300'} 
                    ${conf.bg === currentTheme.completedBg ? `${currentTheme.stageActionBg} ${conf.border}` : 'bg-white border-gray-200'}
                    ${isFuture ? 'opacity-50 grayscale cursor-not-allowed hover:border-gray-200' : ''}
                  `}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${conf.border} ${conf.bg === currentTheme.completedBg ? conf.bg : 'bg-white'}`}>
                       <Icon size={12} className={conf.bg === currentTheme.completedBg ? 'text-white' : conf.color} strokeWidth={3} />
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
              <div className={`inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg text-sm font-bold border w-fit ${currentTheme.historyBg}`}>
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
                {selectedStep.metadata?.inverterNumber && (
                   <div className="mt-2 text-sm text-gray-600 font-mono">
                     Serial: {selectedStep.metadata.inverterNumber}
                   </div>
                )}
              </div>
            </div>
          </div>

          {/* Render Extensible Actions Area */}
          {selectedStep.status === 'COMPLETED' ? (
             <div className={`p-6 md:p-8 w-full xl:w-[400px] ${currentTheme.stageActionBg} flex flex-col items-center justify-center text-center border-t xl:border-t-0 border-gray-100`}>
               <Check size={40} className={`${currentTheme.stageActionIcon} mb-3`} />
               <h3 className="text-lg font-bold text-gray-800 mb-1">Stage Completed</h3>
               <p className="text-sm text-gray-500">This stage has been finalized and requires no further action.</p>
             </div>
          ) : (
            <div className="w-full xl:w-[400px] border-t xl:border-t-0 xl:border-l border-gray-100 flex-shrink-0 flex flex-col justify-center">
              {renderStageAction(
                selectedStep, 
                (newStatus: string, notes?: string, metaOverride?: any) => updateStep(newStatus, notes, metaOverride),
                remarks, 
                setRemarks,
                loadingStep
              )}

              {/* Only show corrections button if it's a review step in documentation */}
              {reviewSteps.includes(selectedStep.metadata?.name || selectedStep.stepKey) && canApprove && (
                <div className="px-6 md:px-8 pb-6 md:pb-8 bg-slate-50">
                  <button
                    onClick={() => setShowCorrectionsModal(true)}
                    disabled={loadingStep === selectedStep.id}
                    className="w-full px-6 py-3 bg-white border-2 border-orange-200 text-orange-600 font-bold rounded-xl hover:bg-orange-50 transition-colors disabled:opacity-50 mt-3"
                  >
                    Request Corrections
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Request Corrections Modal */}
      {showCorrectionsModal && selectedStep && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-orange-50/50">
              <h3 className="text-lg font-bold text-orange-900 flex items-center gap-2">
                <AlertCircle size={20} className="text-orange-500" />
                Request Corrections
              </h3>
              <button onClick={() => setShowCorrectionsModal(false)} className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 border border-gray-200">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-6 bg-gray-50/30 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Send Back To <span className="text-orange-500">*</span>
                </label>
                <select
                  value={targetStepId}
                  onChange={(e) => setTargetStepId(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all bg-white"
                >
                  <option value="">-- Select Stage --</option>
                  {steps
                    .filter(s => s.stepIndex < selectedStep.stepIndex && s.status === 'COMPLETED')
                    .map(s => (
                      <option key={s.id} value={s.id}>
                        {s.metadata?.name || s.stepKey}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Remarks / Issues <span className="text-orange-500">*</span>
                </label>
                <textarea
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="e.g., Customer mobile number does not match bill."
                  className="w-full border-2 border-gray-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all min-h-[100px] resize-none bg-white"
                />
              </div>

              <div className="bg-orange-50 text-orange-800 text-xs p-3 rounded-lg border border-orange-100">
                <strong>Notice:</strong> This stage will be reopened for editing. Subsequent workflow stages will be locked until it is completed again. The overall order will not be cancelled.
              </div>
            </div>
            
            <div className="p-5 border-t border-gray-100 bg-white flex justify-end gap-3">
              <button
                onClick={() => setShowCorrectionsModal(false)}
                className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={requestCorrections}
                disabled={loadingStep === selectedStep.id || !remarks.trim() || !targetStepId}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-orange-600 rounded-xl hover:bg-orange-700 disabled:opacity-50 transition-all shadow-sm"
              >
                {loadingStep === selectedStep.id && <Loader2 size={16} className="animate-spin" />}
                Request Corrections
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
