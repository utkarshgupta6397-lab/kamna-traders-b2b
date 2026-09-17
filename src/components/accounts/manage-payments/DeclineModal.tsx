'use client';

import React, { useState } from 'react';
import { X, AlertOctagon, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const REASON_OPTIONS = [
  'Incorrect amount',
  'Incorrect customer',
  'Wrong payment date',
  'Duplicate payment',
  'Missing payment proof',
  'Other',
];

interface DeclineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeclined: () => void;
  payment: {
    id: string;
    requestNumber: string;
    customerName: string;
  } | null;
}

export default function DeclineModal({
  isOpen,
  onClose,
  onDeclined,
  payment,
}: DeclineModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [isDeclining, setIsDeclining] = useState(false);

  if (!isOpen || !payment) return null;

  const isOther = selectedReason === 'Other';
  const isFormValid = Boolean(selectedReason) && (!isOther || comment.trim().length > 0);

  const handleDecline = async () => {
    if (!isFormValid || isDeclining) return;

    setIsDeclining(true);
    const toastId = toast.loading('Declining payment request...');

    try {
      const res = await fetch(`/api/mobile/manage-payments/${payment.id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: selectedReason,
          comment: comment.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to decline payment');
      }

      toast.success('Payment request declined', { id: toastId });
      onDeclined();
      onClose();
    } catch (err: any) {
      console.error('[Decline Error]', err);
      toast.error(err.message || 'Failed to decline payment', { id: toastId });
    } finally {
      setIsDeclining(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <AlertOctagon size={18} className="text-red-600" />
            Decline Payment Request
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeclining}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="text-xs text-slate-600">
            Decline request <span className="font-mono font-bold text-slate-900">{payment.requestNumber}</span> for <span className="font-bold text-slate-900">{payment.customerName}</span>. Please specify the reason:
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-medium text-slate-900"
            >
              <option value="">Select a reason...</option>
              {REASON_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {isOther && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Comment <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Explain the reason for declining this payment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full p-3 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all text-slate-900"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeclining}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDecline}
            disabled={!isFormValid || isDeclining}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            {isDeclining ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Declining...
              </>
            ) : (
              'Confirm Decline'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
