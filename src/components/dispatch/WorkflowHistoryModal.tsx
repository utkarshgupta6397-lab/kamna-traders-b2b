'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
  X, 
  RotateCw, 
  Clock, 
  User, 
  ArrowRight, 
  ShieldCheck 
} from 'lucide-react';

export interface WorkflowHistoryItem {
  id: string;
  dispatchOrderId: string;
  userId: string | null;
  userName: string | null;
  action: string;
  fromStage: string | null;
  toStage: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

interface WorkflowHistoryModalProps {
  orderId: string;
  orderNumber?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const WorkflowHistoryModal: React.FC<WorkflowHistoryModalProps> = ({
  orderId,
  orderNumber,
  isOpen,
  onClose,
}) => {
  const [history, setHistory] = useState<WorkflowHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dispatch/incoming-orders/${orderId}/history`);
      if (!res.ok) {
        throw new Error(`Failed to fetch history: ${res.statusText}`);
      }
      const data = await res.json();
      const items = (data?.data?.history || data?.history || []) as WorkflowHistoryItem[];
      setHistory(items);
    } catch (err: unknown) {
      console.error('Error loading workflow history:', err);
      setError(err instanceof Error ? err.message : 'Unable to load history');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (isOpen && orderId) {
      void fetchHistory();
    }
  }, [isOpen, orderId, fetchHistory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Workflow Audit History
                {orderNumber && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono">
                    #{orderNumber}
                  </span>
                )}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Immutable record of all pre-dispatch and dispatch workflow transitions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchHistory}
              disabled={loading}
              title="Refresh timeline"
              className="p-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              <RotateCw className={`w-5 h-5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-400">
              <RotateCw className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm">Loading audit trail...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm">
              <p className="font-medium">Failed to load history</p>
              <p className="text-xs mt-1 text-red-600 dark:text-red-300">{error}</p>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-400 dark:text-zinc-500">
              <ShieldCheck className="w-10 h-10 stroke-1" />
              <p className="text-sm font-medium">No workflow events recorded yet</p>
              <p className="text-xs text-zinc-500 text-center max-w-sm">
                Actions taken in Rate Review, Payment Verification, Truck Details, Ready for Invoice, Invoice Confirmation, or Force Archive will be recorded here.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
              {history.map((item) => (
                <div key={item.id} className="relative group">
                  {/* Timeline dot */}
                  <div className="absolute -left-6 top-1.5 w-5 h-5 rounded-full border-2 border-white dark:border-zinc-900 bg-blue-500 group-hover:scale-110 transition-transform shadow-sm flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>

                  {/* Event card */}
                  <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40 p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                          {item.action}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                        {new Date(item.createdAt).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'medium',
                        })}
                      </span>
                    </div>

                    {/* From -> To Stage Badges */}
                    {(item.fromStage || item.toStage) && (
                      <div className="flex items-center gap-2 my-2 text-xs">
                        {item.fromStage && (
                          <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium">
                            {item.fromStage}
                          </span>
                        )}
                        {item.fromStage && item.toStage && (
                          <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                        {item.toStage && (
                          <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">
                            {item.toStage}
                          </span>
                        )}
                      </div>
                    )}

                    {/* User and metadata */}
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 text-xs text-zinc-500 dark:text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <User className="w-4 h-4 text-zinc-400" />
                        <span>{item.userName || item.userId || 'System'}</span>
                      </div>
                      {item.metadata && Object.keys(item.metadata).length > 0 && (
                        <div className="text-[11px] text-zinc-400 font-mono truncate max-w-xs">
                          {JSON.stringify(item.metadata)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/70 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
