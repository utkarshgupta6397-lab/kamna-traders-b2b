'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface OrderHeaderActionsProps {
  orderId: string;
  status: string;
  canApprove: boolean;
}

export default function OrderHeaderActions({ orderId, status, canApprove }: OrderHeaderActionsProps) {
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
        toast.success(`Order successfully moved to ${newStatus.replace('_', ' ')}`);
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

  return (
    <>
      <div className="flex items-center gap-3">

        {status === 'PENDING_APPROVAL' && canApprove && (
          <>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={loading}
              className="bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 px-4 py-2 text-sm font-medium rounded transition-colors shadow-sm disabled:opacity-70 flex items-center gap-2"
            >
              Reject
            </button>
            <button
              onClick={() => updateStatus('APPROVED')}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm font-medium rounded transition-colors shadow-sm disabled:opacity-70 flex items-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Approve Order
            </button>
          </>
        )}
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-gray-900">Reject Order</h3>
              <button onClick={() => setShowRejectModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Rejection Remarks <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Please specify why this order is being rejected..."
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all min-h-[100px]"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => updateStatus('REJECTED')}
                disabled={loading || !remarks.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-70 transition-colors"
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
