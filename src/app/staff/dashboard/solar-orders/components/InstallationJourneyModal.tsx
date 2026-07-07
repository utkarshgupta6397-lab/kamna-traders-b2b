'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { INSTALLATION_STEPS } from '@/lib/solar-workflow-config';

interface InstallationJourneyModalProps {
  orderId: string;
  onClose: () => void;
  isOpen?: boolean;
  workflowType?: string;
  initialData?: any;
}

export default function InstallationJourneyModal({ orderId, onClose, isOpen, workflowType, initialData }: InstallationJourneyModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData && initialData.state) {
      setData(initialData);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/solar-orders/${orderId}/installation-state`);
        if (!res.ok) throw new Error('Failed to fetch installation journey');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [orderId, initialData]);

  if (isOpen === false) return null;
  if (!loading && !data) return null;

  const content = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-[#1A2766]">Installation Journey</h2>
            {data && (
              <p className="text-xs text-gray-500 mt-1">
                Assigned to: <span className="font-semibold text-gray-700">{data.assignedInstaller}</span>
              </p>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-grow bg-gray-50/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1A2766]"></div>
              <span className="text-sm text-gray-500 font-medium">Loading installation steps...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-500 p-4 rounded-lg flex items-center gap-2 border border-red-100">
              <AlertCircle size={18} />
              <span className="text-sm font-medium">{error}</span>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-3 bg-white p-3.5 rounded-lg border border-gray-200 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 shrink-0">
                  <span className="text-blue-600 font-bold text-sm">{data.state.progressPercentage}%</span>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Current Stage</div>
                  <div className="text-sm font-bold text-gray-900">{data.state.currentStage}</div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute top-0 bottom-0 left-[15px] w-px bg-gray-200 z-0"></div>
                <div className="space-y-0 relative z-10">
                  {INSTALLATION_STEPS.map((stepKey, idx) => {
                    const step = data.state.stepsMap[stepKey];
                    const isCompleted = step?.status === 'COMPLETED';
                    const isInProgress = step?.status === 'IN_PROGRESS';
                    const isPending = step?.status === 'PENDING';
                    const isBlocked = step?.status === 'BLOCKED' || step?.status === 'REJECTED';

                    return (
                      <div key={stepKey} className="flex gap-4 group">
                        <div className="flex flex-col items-center shrink-0">
                          <div className={`w-[30px] h-[30px] rounded-full flex items-center justify-center border-[2px] transition-colors ${
                            isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' :
                            isInProgress ? 'bg-blue-500 border-blue-500 text-white' :
                            isBlocked ? 'bg-red-50 border-red-300 text-red-500' :
                            'bg-white border-gray-300 text-gray-300 group-hover:border-gray-400'
                          }`}>
                            {isCompleted ? <CheckCircle2 size={16} strokeWidth={3} /> :
                             isInProgress ? <Clock size={16} strokeWidth={2.5} /> :
                             isBlocked ? <AlertCircle size={16} strokeWidth={2.5} /> :
                             <span className="text-xs font-bold">{idx + 1}</span>}
                          </div>
                          {idx !== INSTALLATION_STEPS.length - 1 && (
                            <div className={`w-px h-full min-h-[32px] ${isCompleted ? 'bg-emerald-500' : 'bg-transparent'}`}></div>
                          )}
                        </div>
                        
                        <div className={`flex-grow pb-6 pt-1 ${!isPending ? 'opacity-100' : 'opacity-60 grayscale'}`}>
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-4">
                            <div>
                              <h4 className={`text-sm font-bold ${isCompleted ? 'text-gray-900' : isInProgress ? 'text-blue-700' : isBlocked ? 'text-red-700' : 'text-gray-500'}`}>
                                {stepKey}
                              </h4>
                              {step?.completedByName && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Completed by <span className="font-medium text-gray-700">{step.completedByName}</span>
                                </p>
                              )}
                              {step?.notes && (
                                <p className="text-[11px] text-gray-500 italic mt-1.5 bg-gray-50 border border-gray-100 p-2 rounded-md">
                                  "{step.notes}"
                                </p>
                              )}
                            </div>
                            
                            <div className="shrink-0 text-left sm:text-right">
                              {step?.completedAt ? (
                                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                                  {new Date(step.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </span>
                              ) : step?.updatedAt ? (
                                <span className="text-[10px] font-medium text-gray-400">
                                  Updated {new Date(step.updatedAt).toLocaleDateString('en-IN')}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
