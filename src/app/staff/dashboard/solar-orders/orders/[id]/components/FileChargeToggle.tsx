'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { XCircle, CheckCircle, Loader2, X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface FileChargeToggleProps {
  orderId: string;
  isPaid: boolean;
  amount?: number | null;
  canApprove: boolean;
}

export default function FileChargeToggle({ orderId, isPaid, amount, canApprove }: FileChargeToggleProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [fileChargeAmount, setFileChargeAmount] = useState<string>('');
  const [amountError, setAmountError] = useState<string>('');

  const handleToggleClick = () => {
    if (!canApprove) return;
    setFileChargeAmount(amount ? amount.toString() : '');
    setAmountError('');
    setShowModal(true);
  };

  const handleConfirm = async () => {
    const newValue = !isPaid;
    let finalAmount = null;

    if (newValue === true) {
      if (!fileChargeAmount.trim()) {
        setAmountError('Please enter the File Charge Amount.');
        return;
      }
      finalAmount = parseFloat(fileChargeAmount);
      if (isNaN(finalAmount) || finalAmount <= 0) {
        setAmountError('Amount must be a valid positive number.');
        return;
      }
    }

    setLoading(true);
    
    try {
      const res = await fetch(`/api/solar-orders/${orderId}/file-charge-paid`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileChargePaid: newValue, fileChargeAmount: finalAmount })
      });
      
      if (res.ok) {
        toast.success('File Charge status updated successfully.');
        setShowModal(false);
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Unable to update File Charge status.');
      }
    } catch (e) {
      toast.error('Network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div 
        onClick={handleToggleClick}
        title={canApprove ? (isPaid ? 'File Charge marked as paid.' : 'File Charge has not been marked as paid.') : 'Only Solar Order Approvers can modify this status.'}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border shadow-sm transition-all
          ${canApprove ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}
          ${isPaid 
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-300' 
            : 'bg-red-50 text-red-600 border-red-200 hover:border-red-300'}
        `}
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : isPaid ? (
          <CheckCircle size={14} className="text-emerald-500" />
        ) : (
          <XCircle size={14} className="text-red-500" />
        )}
        <span>{isPaid ? `Paid${amount ? ` ₹${amount.toLocaleString('en-IN')}` : ''}` : 'Not Paid'}</span>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                Confirm Status Change
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-6 text-sm text-gray-600 space-y-4">
              <p>Change File Charge status?</p>
              <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div>
                  <span className="block text-xs text-gray-400 font-semibold mb-1">Current:</span>
                  <span className={`font-bold ${isPaid ? 'text-emerald-600' : 'text-red-600'}`}>
                    {isPaid ? 'Paid' : 'Not Paid'}
                  </span>
                </div>
                <div className="text-gray-300">→</div>
                <div>
                  <span className="block text-xs text-gray-400 font-semibold mb-1">New:</span>
                  <span className={`font-bold ${!isPaid ? 'text-emerald-600' : 'text-red-600'}`}>
                    {!isPaid ? 'Paid' : 'Not Paid'}
                  </span>
                </div>
              </div>

              {!isPaid && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">File Charge Amount *</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={fileChargeAmount}
                      onChange={(e) => {
                        setFileChargeAmount(e.target.value);
                        if (amountError) setAmountError('');
                      }}
                      className={`block w-full pl-8 pr-3 py-2 border rounded-md shadow-sm focus:ring-[#1A2766] focus:border-[#1A2766] sm:text-sm ${amountError ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'}`}
                      placeholder="Enter amount"
                    />
                  </div>
                  {amountError && <p className="mt-1 text-xs text-red-600">{amountError}</p>}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-70 transition-colors shadow-sm"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
