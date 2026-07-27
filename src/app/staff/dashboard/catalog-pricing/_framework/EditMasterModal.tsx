import React, { useState, useEffect } from 'react';
import { MasterRecord, MasterConfig } from './types';
import MasterStatusBadge from './MasterStatusBadge';
import { X, Save, Send, Loader2, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

import { getRecordAuthorization } from './authorization';

interface EditMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: MasterRecord | null;
  config: MasterConfig;
  onSuccess: () => void;
  canCreate: boolean;
  canModify: boolean;
  canApprove: boolean;
}

export default function EditMasterModal({
  isOpen,
  onClose,
  record,
  config,
  onSuccess,
  canCreate,
  canModify,
  canApprove,
}: EditMasterModalProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [remarks, setRemarks] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  const hasUnsavedChanges = React.useMemo(() => {
    if (!record) return false;
    if (name !== (record.name || '')) return true;
    if (code !== (record.code || '')) return true;
    if (description !== (record.description || '')) return true;
    if (remarks !== (record.remarks || '')) return true;

    // Check custom fields
    if (config.customFields) {
      for (const f of config.customFields) {
        const val = customValues[f.name];
        const recordVal = (record as any)[f.name];
        const valStr = val === undefined || val === null ? '' : String(val);
        const recordValStr = recordVal === undefined || recordVal === null ? '' : String(recordVal);
        if (valStr !== recordValStr) return true;
      }
    }
    return false;
  }, [record, name, code, description, remarks, customValues, config.customFields]);

  const handleDismiss = () => {
    if (!isReadOnly && hasUnsavedChanges) {
      if (window.confirm('Discard unsaved changes?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleDismiss]);

  useEffect(() => {
    if (record) {
      setName(record.name || '');
      setCode(record.code || '');
      setDescription(record.description || '');
      setRemarks(record.remarks || '');
      
      const custom: Record<string, any> = {};
      if (record.percentage !== undefined) custom.percentage = record.percentage;
      if (record.taxType !== undefined) custom.taxType = record.taxType;
      if (record.abbreviation !== undefined) custom.abbreviation = record.abbreviation;
      if (record.gstRate !== undefined) custom.gstRate = record.gstRate;
      if (record.chapterCode !== undefined) custom.chapterCode = record.chapterCode;
      setCustomValues(custom);
    }
  }, [record]);

  if (!isOpen || !record) return null;

  const { canEdit, canSubmit, isReadOnly } = getRecordAuthorization(record, { canCreate, canModify, canApprove });

  const handleSave = async (submitAfterSave = false) => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name: name.trim(),
        code: code.trim() || null,
        description: description.trim() || null,
        remarks: remarks.trim() || null,
        ...customValues,
      };

      const res = await fetch(`/api/staff/catalog/${config.entityKey}/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update record');

      if (submitAfterSave) {
        const actionRes = await fetch(`/api/staff/catalog/${config.entityKey}/${record.id}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'submit' }),
        });
        if (!actionRes.ok) {
          const actionData = await actionRes.json();
          throw new Error(actionData.error || 'Failed to submit record for approval');
        }
        toast.success(`${config.singularTitle} updated and submitted for approval`);
      } else {
        toast.success(`${config.singularTitle} updated successfully`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error updating record');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">
                {isReadOnly ? 'View' : 'Edit'} {config.singularTitle}
              </h2>
              <MasterStatusBadge status={record.status} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">ID: {record.id}</p>
          </div>
          <button
            onClick={handleDismiss}
            disabled={submitting}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {isReadOnly && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-800">
              <Lock size={14} className="flex-shrink-0" />
              <span>
                {record.status === 'Archived'
                  ? 'This record is Archived and read-only.'
                  : 'You do not have permission to edit this record.'}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              disabled={isReadOnly}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Code
            </label>
            <input
              type="text"
              disabled={isReadOnly}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] disabled:opacity-60"
            />
          </div>

          {/* Custom Entity Fields */}
          {config.customFields?.map((f) => (
            <div key={f.name}>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                {f.label}
              </label>
              {f.type === 'select' ? (
                <select
                  disabled={isReadOnly}
                  value={customValues[f.name] || ''}
                  onChange={(e) => setCustomValues({ ...customValues, [f.name]: e.target.value })}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none disabled:opacity-60"
                >
                  <option value="">Select {f.label}</option>
                  {f.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type}
                  step={f.type === 'number' ? 'any' : undefined}
                  disabled={isReadOnly}
                  value={customValues[f.name] || ''}
                  onChange={(e) => setCustomValues({ ...customValues, [f.name]: e.target.value })}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] disabled:opacity-60"
                />
              )}
            </div>
          ))}

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              rows={2}
              disabled={isReadOnly}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Remarks
            </label>
            <input
              type="text"
              disabled={isReadOnly}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] disabled:opacity-60"
            />
          </div>

          {/* Metadata Display */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-1.5 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Created By:</span>
              <span className="font-medium text-gray-800">{record.createdBy?.name || 'System'}</span>
            </div>
            <div className="flex justify-between">
              <span>Last Updated:</span>
              <span className="font-medium text-gray-800">{new Date(record.updatedAt).toLocaleString('en-IN')}</span>
            </div>
            {record.approvedBy && (
              <div className="flex justify-between">
                <span>Approved By:</span>
                <span className="font-medium text-emerald-700">{record.approvedBy.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleDismiss}
            disabled={submitting}
            className="px-4 py-2 border border-gray-200 hover:bg-white text-gray-700 rounded-lg text-xs font-medium transition-colors"
          >
            Close
          </button>

          {!isReadOnly && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Changes
              </button>

              {canSubmit && (
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#1A2766] hover:bg-[#152052] text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Save & Submit
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
