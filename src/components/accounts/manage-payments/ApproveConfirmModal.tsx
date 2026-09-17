'use client';

import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatIndianCurrency } from '@/lib/formatters';

interface ApproveConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApproved: () => void;
  payment: {
    id: string;
    requestNumber: string;
    customerName: string;
    amount: number | string;
    paymentDate: string;
    paymentMode: string;
  } | null;
}

export default function ApproveConfirmModal({
  isOpen,
  onClose,
  onApproved,
  payment,
}: ApproveConfirmModalProps) {
  const [isApproving, setIsApproving] = useState(false);

  if (!isOpen || !payment) return null;

  const handleApprove = async () => {
    setIsApproving(true);
    const toastId = toast.loading('Approving payment and syncing with Zoho Books...');

    try {
      const res = await fetch(`/api/mobile/manage-payments/${payment.id}/approve`, {
        method: 'PATCH',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to approve payment');
      }

      toast.success('Payment approved and synced to Zoho Books!', { id: toastId });
      onApproved();
      onClose();
    } catch (err: any) {
      console.error('[Approval Error]', err);
      toast.error(err.message || 'Payment approval failed', { id: toastId });
    } finally {
      setIsApproving(false);
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
            <CheckCircle2 size={18} className="text-emerald-600" />
            Approve Payment Request
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isApproving}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600">
            Are you sure you want to approve this payment request? Upon approval, a Customer Advance will be created in Zoho Books.
          </p>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2.5 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-slate-500 font-medium">Request Number</span>
              <span className="font-mono font-bold text-slate-900">{payment.requestNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Customer</span>
              <span className="font-bold text-slate-900 truncate max-w-[60%] text-right">
                {payment.customerName}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Amount</span>
              <span className="font-bold text-emerald-700 text-sm">
                {formatIndianCurrency(Number(payment.amount))}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Payment Date</span>
              <span className="font-semibold text-slate-800">
                {payment.paymentDate?.slice(0, 10)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Payment Mode</span>
              <span className="font-semibold text-slate-800">
                {payment.paymentMode === 'POS' ? 'POS Device' : payment.paymentMode}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isApproving}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={isApproving}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            {isApproving ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Approving & Syncing...
              </>
            ) : (
              'Confirm Approval'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
