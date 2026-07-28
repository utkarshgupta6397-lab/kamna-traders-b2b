'use client';

import React, { useState } from 'react';
import { X, Save, ShieldAlert, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProductApprovalEngineProps {
  isOpen: boolean;
  onClose: () => void;
  record: any;
  action: 'submit' | 'approve' | 'decline' | 'archive' | 'reactivate' | 'deactivate';
  onSuccess: () => void;
}

export default function ProductApprovalEngine({
  isOpen,
  onClose,
  record,
  action,
  onSuccess
}: ProductApprovalEngineProps) {
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !record) return null;

  const getActionDetails = () => {
    switch (action) {
      case 'submit': return { title: 'Submit for Approval', btnText: 'Submit Product', color: 'bg-blue-600', icon: Save };
      case 'approve': return { title: 'Approve Product', btnText: 'Approve', color: 'bg-green-600', icon: ShieldAlert };
      case 'decline': return { title: 'Decline Product', btnText: 'Decline', color: 'bg-red-600', icon: X };
      case 'archive': return { title: 'Archive Product', btnText: 'Archive', color: 'bg-gray-600', icon: ShieldAlert };
      case 'reactivate': return { title: 'Reactivate Product', btnText: 'Reactivate', color: 'bg-green-600', icon: Save };
      case 'deactivate': return { title: 'Deactivate Product', btnText: 'Deactivate', color: 'bg-orange-600', icon: ShieldAlert };
      default: return { title: 'Action', btnText: 'Confirm', color: 'bg-blue-600', icon: Save };
    }
  };

  const details = getActionDetails();
  const Icon = details.icon;

  const handleSubmit = async () => {
    if (action === 'decline' && !remarks.trim()) {
      toast.error('Remarks are required when declining.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/staff/catalog/products/${record.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, remarks })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      
      toast.success(`Product ${action}d successfully`);
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${details.color.replace('bg-', 'bg-').replace('600', '50')} ${details.color.replace('bg-', 'text-')}`}>
              <Icon size={18} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{details.title}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            You are about to {action} the product <strong>{record.name}</strong> ({record.code}).
            {action === 'decline' && ' Please provide a reason for declining.'}
          </p>

          <label className="block text-sm font-medium text-gray-700 mb-1">
            Remarks {action === 'decline' && <span className="text-red-500">*</span>}
          </label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            rows={3}
            placeholder="Add any notes or comments..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button 
            onClick={onClose} 
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={submitting}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg flex items-center gap-2 transition-colors ${details.color} hover:brightness-90`}
          >
            {submitting && <Loader2 className="animate-spin" size={16} />}
            {details.btnText}
          </button>
        </div>
      </div>
    </div>
  );
}
