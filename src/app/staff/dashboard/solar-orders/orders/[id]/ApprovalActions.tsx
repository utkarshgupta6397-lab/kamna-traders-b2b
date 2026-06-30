'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, X, AlertTriangle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface ApprovalActionsProps {
  orderId: string;
  submittedBy: string;
  submittedAt: Date;
  canApprove: boolean;
}

export default function ApprovalActions({ orderId, submittedBy, submittedAt, canApprove }: ApprovalActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [remarks, setRemarks] = useState('');

  const updateStatus = async (newStatus: string) => {
    if (newStatus === 'REJECTED' && !remarks.trim()) {
      toast.error('Rejection remarks are required');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/solar-orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, remarks: newStatus === 'REJECTED' ? remarks : undefined })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Order successfully moved to ${newStatus === 'APPROVED' ? 'Execution' : 'Rejected'}`);
        setShowRejectModal(false);
        setRemarks('');
        router.refresh();
      } else {
        toast.error(data.error || 'Failed to update status');
      }
    } catch (e) {
      toast.error('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!canApprove) {
    return (
      <div className="bg-gray-50 border-t border-gray-200 p-8 text-center">
        <p className="text-sm font-medium text-gray-500 mb-2">This application is pending approval.</p>
        <p className="text-xs text-gray-400">You do not have the required permissions to approve or reject this order.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border-t-2 border-gray-100 p-8 mt-4">
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-200">
          
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Approval Decision</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Submitted by <span className="font-semibold text-gray-700">{submittedBy}</span> on <span className="font-semibold text-gray-700">{new Date(submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>.<br/>
              Please review all site details thoroughly before authorizing execution.
            </p>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={loading}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3.5 bg-white border-2 border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-50 hover:border-red-300 transition-all shadow-sm hover:shadow disabled:opacity-70"
            >
              <AlertTriangle size={18} />
              Reject
            </button>
            <button
              onClick={() => updateStatus('APPROVED')}
              disabled={loading}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-md hover:shadow-lg disabled:opacity-70 border-2 border-green-600 hover:border-green-700"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
              Approve Order
            </button>
          </div>
          
        </div>
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-red-50/50">
              <h3 className="text-lg font-bold text-red-900 flex items-center gap-2">
                <AlertTriangle size={20} className="text-red-500" />
                Reject Order Application
              </h3>
              <button onClick={() => setShowRejectModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors bg-white rounded-full p-1 border border-gray-200">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 bg-gray-50/30">
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 mb-2">
                <p className="text-xs text-amber-800 font-medium">
                  Rejecting this order will send it back to the creator. You must provide a clear reason for rejection so they can correct the details.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Rejection Remarks <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="e.g. Please verify the floor number and attach the remaining site images before resubmitting..."
                  className="w-full border-2 border-gray-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all min-h-[140px] resize-none shadow-sm"
                  autoFocus
                />
              </div>
            </div>
            
            <div className="p-5 border-t border-gray-100 bg-white flex justify-end gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-6 py-2.5 text-sm font-bold text-gray-600 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => updateStatus('REJECTED')}
                disabled={loading || !remarks.trim()}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
