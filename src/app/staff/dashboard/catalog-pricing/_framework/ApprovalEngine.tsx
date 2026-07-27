import React, { useState } from 'react';
import { MasterRecord, MasterConfig } from './types';
import { CheckCircle2, XCircle, AlertTriangle, Send, RotateCcw, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export type ActionType = 'submit' | 'approve' | 'decline' | 'archive' | 'restore';

interface ApprovalEngineProps {
  isOpen: boolean;
  onClose: () => void;
  record: MasterRecord | null;
  actionType: ActionType | null;
  config: MasterConfig;
  onSuccess: () => void;
}

export default function ApprovalEngine({
  isOpen,
  onClose,
  record,
  actionType,
  config,
  onSuccess,
}: ApprovalEngineProps) {
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !record || !actionType) return null;

  const getActionDetails = () => {
    switch (actionType) {
      case 'submit':
        return {
          title: 'Submit for Approval',
          description: `Submit "${record.name}" for manager/admin review. Record status will move to Approval Pending.`,
          btnCls: 'bg-amber-600 hover:bg-amber-700 text-white',
          icon: Send,
          requireRemarks: false,
        };
      case 'approve':
        return {
          title: 'Approve Record',
          description: `Approve "${record.name}". This record will become active and available for product creation.`,
          btnCls: 'bg-emerald-600 hover:bg-emerald-700 text-white',
          icon: CheckCircle2,
          requireRemarks: false,
        };
      case 'decline':
        return {
          title: 'Decline Record',
          description: `Decline "${record.name}" and return it to Draft state. Mandatory remarks are required to inform the creator.`,
          btnCls: 'bg-rose-600 hover:bg-rose-700 text-white',
          icon: XCircle,
          requireRemarks: true,
        };
      case 'archive':
        return {
          title: 'Archive Record',
          description: `Archive "${record.name}". Archived records become read-only and hidden from default selection dropdowns.`,
          btnCls: 'bg-red-600 hover:bg-red-700 text-white',
          icon: AlertTriangle,
          requireRemarks: false,
        };
      case 'restore':
        return {
          title: 'Restore Record',
          description: `Restore archived record "${record.name}" back to Draft status.`,
          btnCls: 'bg-[#1A2766] hover:bg-[#152052] text-white',
          icon: RotateCcw,
          requireRemarks: false,
        };
    }
  };

  const details = getActionDetails();
  const Icon = details.icon;

  const handleConfirm = async () => {
    if (details.requireRemarks && !remarks.trim()) {
      toast.error('Remarks are mandatory for this action');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/staff/catalog/${config.entityKey}/${record.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          remarks: remarks.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      toast.success(`Action "${details.title}" completed successfully`);
      setRemarks('');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Workflow action failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gray-100 text-gray-700">
              <Icon size={18} />
            </div>
            <h2 className="text-base font-bold text-gray-900">{details.title}</h2>
          </div>
          <button onClick={onClose} disabled={submitting} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">{details.description}</p>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Remarks {details.requireRemarks && <span className="text-red-500">*</span>}
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={details.requireRemarks ? 'Reason for decline...' : 'Optional workflow notes...'}
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20"
            />
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 border border-gray-200 hover:bg-white text-gray-700 rounded-lg text-xs font-medium"
          >
            Cancel
          </button>

          <button
            onClick={handleConfirm}
            disabled={submitting}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors ${details.btnCls}`}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
            Confirm {actionType.charAt(0).toUpperCase() + actionType.slice(1)}
          </button>
        </div>
      </div>
    </div>
  );
}
