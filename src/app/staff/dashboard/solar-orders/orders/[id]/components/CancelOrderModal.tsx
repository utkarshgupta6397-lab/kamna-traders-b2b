'use client';

import { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

interface CancelOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  onSuccess: () => void;
}

const CANCELLATION_REASONS = [
  'Customer Cancelled',
  'Duplicate Order',
  'Wrong Entry',
  'Technical Not Feasible',
  'Loan Rejected',
  'Pricing Issue',
  'Customer Unreachable',
  'Sub Vendor Cancelled',
  'Other'
];

export default function CancelOrderModal({ isOpen, onClose, orderId, onSuccess }: CancelOrderModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [confirmationText, setConfirmationText] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleNext = () => {
    if (step === 2) {
      if (!reason) {
        setError('Please select a cancellation reason.');
        return;
      }
      if (reason === 'Other' && !remarks.trim()) {
        setError('Please specify the reason.');
        return;
      }
    }
    setError('');
    setStep((s) => (s + 1) as 1 | 2 | 3);
  };

  const handleCancel = async () => {
    if (!understood || confirmationText !== 'CANCEL') {
      setError('You must check the box and type CANCEL exactly.');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/solar-orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cancellationReason: reason,
          cancellationRemarks: remarks.trim(),
          confirmationText
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel order.');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-red-50/50">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle size={20} />
            <h2 className="text-lg font-bold">Cancel this Order?</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-white rounded-full p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-gray-700 text-sm leading-relaxed">
                This action removes the order from all active workflows, installation planning, documentation queues, reports and dashboards.
              </p>
              <p className="text-gray-700 text-sm leading-relaxed">
                The order will remain available for audit purposes.
              </p>
              <p className="text-gray-900 font-medium text-sm mt-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
                This action should only be used when the order will never proceed further.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Cancellation Reason *</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all outline-none"
                >
                  <option value="" disabled>Select a reason...</option>
                  {CANCELLATION_REASONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              
              {reason === 'Other' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Please specify reason *</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter detailed reason here..."
                    className="w-full border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all outline-none resize-none"
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={understood}
                  onChange={(e) => setUnderstood(e.target.checked)}
                  className="mt-1 w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                />
                <span className="text-sm text-gray-700 leading-relaxed font-medium">
                  I understand that this order will no longer appear in active workflows, dashboards, installation, documentation or reports.
                </span>
              </label>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Type CANCEL to confirm
                </label>
                <input
                  type="text"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder="CANCEL"
                  className="w-full border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all outline-none font-mono text-center uppercase tracking-widest"
                  autoComplete="off"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            {step === 1 ? 'Cancel' : 'Close'}
          </button>
          
          {step < 3 ? (
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition-colors shadow-sm"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleCancel}
              disabled={loading || !understood || confirmationText !== 'CANCEL'}
              className="px-6 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Confirm Cancellation'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
