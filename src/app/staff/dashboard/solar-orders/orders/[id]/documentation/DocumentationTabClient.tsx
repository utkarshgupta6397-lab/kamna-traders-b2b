'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock, AlertTriangle, Loader2, Play, Circle, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

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
  canEdit, 
  canApprove 
}: { 
  orderId: string, 
  steps: WorkflowStep[],
  canEdit: boolean,
  canApprove: boolean,
}) {
  const router = useRouter();
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [activeNotes, setActiveNotes] = useState<Record<string, string>>({});
  const [openNotesId, setOpenNotesId] = useState<string | null>(null);

  const reviewSteps = ['Review & Approval', 'Review Pending', 'File Upload Approval Pending'];

  const updateStep = async (stepId: string, newStatus: string, notes?: string) => {
    setLoadingStep(stepId);
    try {
      const res = await fetch(`/api/solar-orders/${orderId}/workflow/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notes })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Step updated');
        setOpenNotesId(null);
        router.refresh();
      } else {
        toast.error(data.error || 'Failed to update step');
      }
    } catch (e) {
      toast.error('Network error');
    } finally {
      setLoadingStep(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8 animate-in fade-in duration-500">
      <div className="mb-8 border-b border-gray-100 pb-4">
        <h2 className="text-lg font-bold text-gray-900 tracking-tight">Documentation Workflow</h2>
        <p className="text-sm text-gray-500 mt-1">Track and manage pre-installation paperwork</p>
      </div>

      <div className="relative pl-3 sm:pl-4">
        {/* Continuous vertical line */}
        <div className="absolute left-[27px] sm:left-[31px] top-4 bottom-8 w-px bg-gray-200"></div>

        <div className="space-y-8">
          {steps.map((step, index) => {
            const stepName = step.metadata?.name || step.stepKey;
            const isReviewStep = reviewSteps.includes(stepName);
            const hasPermission = isReviewStep ? canApprove : canEdit;
            const isActionable = step.status === 'PENDING' || step.status === 'IN_PROGRESS';
            const isLast = index === steps.length - 1;

            let Icon = Circle;
            let iconColor = 'text-gray-300';
            let iconBg = 'bg-white';
            let containerStyle = 'opacity-70';
            
            if (step.status === 'COMPLETED') {
              Icon = Check;
              iconColor = 'text-white';
              iconBg = 'bg-emerald-500';
              containerStyle = 'opacity-100';
            } else if (step.status === 'IN_PROGRESS') {
              Icon = Loader2;
              iconColor = 'text-blue-500';
              iconBg = 'bg-blue-50';
              containerStyle = 'opacity-100 bg-blue-50/30 rounded-lg -ml-4 pl-4 pr-4 py-2 border border-blue-100';
            } else if (step.status === 'PENDING') {
              Icon = Circle;
              iconColor = 'text-gray-300';
              iconBg = 'bg-white';
              containerStyle = 'opacity-100';
            } else if (step.status === 'BLOCKED') {
              Icon = AlertTriangle;
              iconColor = 'text-white';
              iconBg = 'bg-red-500';
              containerStyle = 'opacity-100';
            }

            return (
              <div key={step.id} className={`relative flex items-start gap-5 sm:gap-6 group transition-all ${containerStyle}`}>
                
                {/* Timeline Node */}
                <div className={`relative z-10 flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 ${step.status === 'COMPLETED' ? 'border-emerald-500' : step.status === 'BLOCKED' ? 'border-red-500' : step.status === 'IN_PROGRESS' ? 'border-blue-200' : 'border-gray-200'} flex items-center justify-center ${iconBg}`}>
                  {step.status === 'IN_PROGRESS' ? (
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Icon size={step.status === 'COMPLETED' ? 16 : 14} className={iconColor} strokeWidth={step.status === 'COMPLETED' ? 3 : 2} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-1.5 sm:pt-2 pb-1">
                  <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-3 xl:gap-8">
                    
                    {/* Title and Metadata */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-gray-400 w-5 hidden sm:inline-block">{step.stepIndex}.</span>
                        <h3 className={`text-sm sm:text-base font-semibold ${step.status === 'IN_PROGRESS' ? 'text-blue-900' : 'text-gray-900'}`}>
                          {stepName}
                        </h3>
                        {isReviewStep && (
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 rounded-full">
                            Approval Required
                          </span>
                        )}
                      </div>

                      {step.status === 'COMPLETED' ? (
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                          <Check size={12} className="text-emerald-500" />
                          Done by <span className="font-medium text-gray-700">{step.completedBy?.name || 'System'}</span> on {new Date(step.completedAt!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      ) : step.status === 'BLOCKED' ? (
                        <p className="text-xs text-red-600 mt-1 font-medium bg-red-50 inline-block px-2 py-1 rounded">
                          Blocked: {step.blockedReason || 'Waiting for previous step'}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 mt-1 capitalize flex items-center gap-1">
                          <Clock size={12} />
                          {step.status.replace('_', ' ').toLowerCase()}
                        </p>
                      )}

                      {step.notes && (
                        <div className="mt-2.5 flex items-start gap-2 bg-gray-50 border border-gray-100 rounded-lg p-3 text-sm text-gray-700">
                          <MessageSquare size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                          <p className="leading-relaxed">{step.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Action Area */}
                    {isActionable && hasPermission && (
                      <div className="xl:w-72 flex-shrink-0">
                        {openNotesId === step.id ? (
                          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm animate-in slide-in-from-top-2">
                            <textarea
                              placeholder="Add notes (optional)..."
                              value={activeNotes[step.id] || ''}
                              onChange={(e) => setActiveNotes({ ...activeNotes, [step.id]: e.target.value })}
                              className="w-full text-sm border-none bg-gray-50 rounded p-2 focus:ring-0 resize-none mb-2 placeholder:text-gray-400"
                              rows={2}
                              autoFocus
                            />
                            <div className="flex gap-2">
                              {step.status === 'PENDING' && (
                                <button
                                  onClick={() => updateStep(step.id, 'IN_PROGRESS', activeNotes[step.id])}
                                  disabled={loadingStep === step.id}
                                  className="flex-1 text-xs px-3 py-1.5 border border-blue-200 text-blue-700 bg-blue-50 font-medium rounded hover:bg-blue-100 transition-colors disabled:opacity-50"
                                >
                                  Start
                                </button>
                              )}
                              <button
                                onClick={() => updateStep(step.id, 'COMPLETED', activeNotes[step.id])}
                                disabled={loadingStep === step.id}
                                className="flex-1 flex items-center justify-center gap-1 text-xs px-3 py-1.5 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
                              >
                                {loadingStep === step.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                {isReviewStep ? 'Approve' : 'Complete'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {step.status === 'PENDING' && (
                              <button
                                onClick={() => updateStep(step.id, 'IN_PROGRESS')}
                                disabled={loadingStep === step.id}
                                className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all disabled:opacity-50"
                                title="Start Step"
                              >
                                <Play size={14} className="ml-0.5" />
                              </button>
                            )}
                            <button
                              onClick={() => updateStep(step.id, 'COMPLETED')}
                              disabled={loadingStep === step.id}
                              className="flex-1 flex items-center justify-center gap-1.5 text-xs px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                            >
                              {loadingStep === step.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={2.5} />}
                              {isReviewStep ? 'Approve' : 'Complete'}
                            </button>
                            <button
                              onClick={() => setOpenNotesId(step.id)}
                              className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all"
                              title="Add Note"
                            >
                              <MessageSquare size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
