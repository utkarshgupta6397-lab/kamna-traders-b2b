'use client';
import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, Lock, ArrowLeft, CircleDot, CircleSlash, AlertCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import MiniCustomerStatement from '@/components/zoho/MiniCustomerStatement';

export default function PaymentVerificationStep({
  order,
  workflow,
  onRefresh,
  onPreviousStep,
  hasPermission = true,
}: {
  order: any;
  workflow: any;
  onRefresh: () => void;
  onPreviousStep?: () => void;
  hasPermission?: boolean;
}) {
  const [statementData, setStatementData] = useState<any>(null);
  const [statementLoading, setStatementLoading] = useState(true);
  const [statementRefreshing, setStatementRefreshing] = useState(false);
  
  const [decision, setDecision] = useState<string>('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showWithoutPaymentModal, setShowWithoutPaymentModal] = useState(false);

  const fetchStatement = async (isManualRefresh = false) => {
    if (!order.customerId) return;
    if (isManualRefresh) {
      setStatementRefreshing(true);
    } else {
      setStatementLoading(true);
    }

    try {
      const res = await fetch(`/api/dispatch/incoming-orders/${order.id}/statement`);
      const d = await res.json();
      if (d.success) {
        setStatementData(d.data);
        if (isManualRefresh) {
          toast.success('Customer statement refreshed');
        }
      } else if (isManualRefresh) {
        toast.error(d.error || 'Failed to refresh statement');
      }
    } catch (err: any) {
      if (isManualRefresh) {
        toast.error(err.message || 'Error refreshing statement');
      }
    } finally {
      setStatementLoading(false);
      setStatementRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatement(false);
  }, [order.customerId, order.id]);

  const handleRefreshStatement = () => {
    return fetchStatement(true);
  };

  const [isEditingCompleted, setIsEditingCompleted] = useState(false);

  if (workflow.paymentStatus === 'COMPLETED' && !isEditingCompleted) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="text-emerald-500" size={24} />
          <div>
            <h3 className="font-bold text-emerald-800">Payment Verification Completed</h3>
            <p className="text-sm text-emerald-600">Decision: <span className="font-bold">{workflow.paymentDecision}</span></p>
            {workflow.paymentNote && <p className="text-sm text-emerald-600 mt-1">Note: {workflow.paymentNote}</p>}
          </div>
        </div>
        {hasPermission && (
          <button
            type="button"
            onClick={() => {
              setDecision(workflow.paymentDecision || '');
              setNote(workflow.paymentNote || '');
              setIsEditingCompleted(true);
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-100 shadow-sm transition-colors"
          >
            Edit Verification
          </button>
        )}
      </div>
    );
  }

  const handleCompleteClick = () => {
    if (!decision) {
      toast.error('Please select a payment decision');
      return;
    }

    if (decision === 'Without Payment') {
      setShowWithoutPaymentModal(true);
      return;
    }

    executeSubmission();
  };

  const executeSubmission = async () => {
    setSubmitting(true);
    setShowWithoutPaymentModal(false);
    try {
      const res = await fetch(`/api/dispatch/incoming-orders/${order.id}/workflow/payment-verification`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note, audit: { total: order.total } })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to verify payment');
      
      toast.success(isEditingCompleted ? 'Payment Verification Updated' : 'Payment Verification Completed');
      setIsEditingCompleted(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const orderTotal = Number(order.zohoDetailsJson?.total || order.total || 0);

  const decisionOptions = [
    {
      id: 'Complete Payment',
      label: 'Complete Payment',
      icon: <CheckCircle2 size={16} className={decision === 'Complete Payment' ? 'text-[#1A2766]' : 'text-emerald-600'} aria-hidden="true" />,
    },
    {
      id: 'Partial Payment',
      label: 'Partial Payment',
      icon: <CircleDot size={16} className={decision === 'Partial Payment' ? 'text-[#1A2766]' : 'text-amber-600'} aria-hidden="true" />,
    },
    {
      id: 'Without Payment',
      label: 'Without Payment',
      icon: <CircleSlash size={16} className={decision === 'Without Payment' ? 'text-[#1A2766]' : 'text-gray-500'} aria-hidden="true" />,
    },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-5 flex-1 min-h-0 w-full h-full">
      {/* Left side: Statement */}
      <div className="w-full lg:w-3/5 border border-gray-200 rounded-lg overflow-hidden flex flex-col flex-1 min-h-[380px] lg:min-h-0 h-[520px] lg:h-full">
        {order.customerId ? (
          <MiniCustomerStatement 
            customerId={order.customerId} 
            statementData={statementData} 
            statementLoading={statementLoading}
            orderTotal={orderTotal}
            onRefresh={handleRefreshStatement}
            refreshing={statementRefreshing}
          />
        ) : (
          <div className="p-6 text-gray-500">Customer not mapped.</div>
        )}
      </div>
      
      {/* Right side: Decision */}
      <div className="w-full lg:w-2/5 flex flex-col flex-1 min-h-[380px] lg:min-h-0 h-auto lg:h-full">
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm flex flex-col flex-1 h-full overflow-hidden">
          {/* Scrollable inputs area */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            {!hasPermission && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 font-medium flex items-center gap-2">
                <Lock size={15} className="text-amber-600 shrink-0" />
                <span>You have read-only access to Payment Verification. <strong>Payment Verification permission</strong> is required to submit a decision.</span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Payment Decision</h3>
                {onPreviousStep && (
                  <button
                    type="button"
                    onClick={onPreviousStep}
                    title="Back to Step 1: Rate Review"
                    aria-label="Back to Step 1: Rate Review"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-[#1A2766] hover:bg-gray-100 px-2 py-1 rounded transition-colors cursor-pointer"
                  >
                    <ArrowLeft size={13} />
                    <span>Back to Rate Review</span>
                  </button>
                )}
              </div>
              
              <div className="space-y-2">
                {decisionOptions.map(opt => (
                  <label 
                    key={opt.id} 
                    className={`flex items-center gap-3 p-2.5 border rounded-lg transition-all ${
                      decision === opt.id 
                        ? 'border-[#1A2766] bg-blue-50/60 ring-1 ring-[#1A2766]' 
                        : 'border-gray-200 hover:bg-gray-50'
                    } ${!hasPermission ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <input 
                      type="radio" 
                      name="paymentDecision" 
                      value={opt.id} 
                      checked={decision === opt.id} 
                      onChange={() => hasPermission && setDecision(opt.id)} 
                      disabled={!hasPermission}
                      className="w-4 h-4 text-[#1A2766] focus:ring-[#1A2766] disabled:cursor-not-allowed shrink-0" 
                    />
                    <div className="flex items-center gap-2 min-w-0">
                      {opt.icon}
                      <span className="font-semibold text-gray-800 text-sm truncate">{opt.label}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-bold text-gray-600 uppercase">Internal Note <span className="text-gray-400 font-normal lowercase">(optional)</span></label>
              <textarea 
                value={note}
                onChange={e => setNote(e.target.value)}
                disabled={!hasPermission}
                placeholder={hasPermission ? "Enter details or reference (optional)..." : "Payment Verification permission required to add notes"}
                className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2766] focus:border-transparent outline-none min-h-[85px] resize-y disabled:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-500"
              />
            </div>
          </div>
          
          {/* Sticky anchored action button at bottom */}
          <div className="pt-4 border-t border-gray-100 mt-4 shrink-0 flex flex-col gap-2">
            {!hasPermission ? (
              <span className="text-[11px] text-amber-700 font-bold flex items-center justify-center gap-1">
                <Lock size={12} /> Payment Verification permission required
              </span>
            ) : !decision ? (
              <p className="text-xs text-gray-500 text-center font-medium">
                Select a payment decision to continue
              </p>
            ) : null}

            {isEditingCompleted && (
              <button
                type="button"
                onClick={() => setIsEditingCompleted(false)}
                disabled={submitting}
                className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm cursor-pointer"
              >
                Cancel Edit
              </button>
            )}

            <button
              type="button"
              onClick={handleCompleteClick}
              disabled={!decision || submitting || !hasPermission}
              className="w-full bg-[#1A2766] text-white px-4 py-3 rounded-lg font-bold hover:bg-blue-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm text-sm cursor-pointer"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {submitting ? 'Verifying Payment...' : isEditingCompleted ? 'Update Payment Verification' : 'Complete Payment Verification'}
            </button>
          </div>
        </div>
      </div>

      {/* Without Payment Lightweight Confirmation Modal */}
      {showWithoutPaymentModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="without-payment-dialog-title"
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-amber-50/50">
              <h3 id="without-payment-dialog-title" className="text-base font-bold text-gray-900 flex items-center gap-2">
                <AlertCircle size={18} className="text-amber-600 shrink-0" aria-hidden="true" />
                Proceed without payment?
              </h3>
              <button
                type="button"
                onClick={() => setShowWithoutPaymentModal(false)}
                disabled={submitting}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded cursor-pointer"
                aria-label="Close modal"
                title="Close modal"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600 mb-5">
                This Sales Order will be verified without a recorded payment.
              </p>
              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowWithoutPaymentModal(false)}
                  disabled={submitting}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeSubmission}
                  disabled={submitting}
                  className="px-4 py-2 bg-[#1A2766] hover:bg-blue-900 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  {submitting && <Loader2 size={15} className="animate-spin" />}
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
