import React, { useState, useEffect } from 'react';
import { MasterRecord, MasterConfig } from './types';
import MasterStatusBadge from './MasterStatusBadge';
import { X, Save, Send, Loader2, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import HsnHierarchyPreview from '../hsn-codes/HsnHierarchyPreview';

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
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [rootCategories, setRootCategories] = useState<any[]>([]);
  const [hsnError, setHsnError] = useState<string | null>(null);

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
      if ((record as any).zohoBooksTaxId !== undefined) custom.zohoBooksTaxId = (record as any).zohoBooksTaxId;
      if ((record as any).defaultGstRateId !== undefined) custom.defaultGstRateId = (record as any).defaultGstRateId;
      if (record.parentId !== undefined) custom.parentId = record.parentId;
      if (record.chapterCode !== undefined) custom.chapterCode = record.chapterCode;
      setCustomValues(custom);
      setHsnError(null);
    }
  }, [record]);

  useEffect(() => {
    if (isOpen) {
      if (config.customFields?.some(f => f.type === 'tax-rate-select')) {
        fetch('/api/staff/catalog/tax-rates?status=Active')
          .then(res => res.json())
          .then(data => {
            setTaxRates(Array.isArray(data.records) ? data.records : (Array.isArray(data) ? data : []));
          })
          .catch(console.error);
      }
      if (config.customFields?.some(f => f.type === 'category-select')) {
        fetch('/api/staff/catalog/categories?isRoot=true&status=Active')
          .then(res => res.json())
          .then(data => {
            setRootCategories(Array.isArray(data.records) ? data.records : (Array.isArray(data) ? data : []));
          })
          .catch(console.error);
      }
    }
  }, [isOpen, config.customFields]);

  if (!isOpen || !record) return null;

  const { canEdit, canSubmit, isReadOnly } = getRecordAuthorization(record, { canCreate, canModify, canApprove });

  const handleSave = async (submitAfterSave = false) => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    setHsnError(null);
    if (config.entityKey === 'hsn-codes') {
      const hsnCleanCode = code.replace(/[^0-9]/g, '');
      if (hsnCleanCode.length !== code.length) {
        setHsnError('HSN Code must contain only numeric digits');
        return;
      }
      if (hsnCleanCode.length < 6) {
        setHsnError('HSN Code is mandatory and must contain at least 6 digits');
        return;
      }
    }

    if (config.customFields) {
      for (const field of config.customFields) {
        const val = customValues[field.name];
        if (field.required && !val) {
          toast.error(`${field.label} is required`);
          return;
        }
        if (val && field.pattern && !new RegExp(field.pattern).test(val)) {
          toast.error(`Invalid ${field.label} format`);
          return;
        }
      }
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
              {config.entityKey === 'hsn-codes' ? 'Description (Name)' : 'Name'} <span className="text-red-500">*</span>
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
              {config.entityKey === 'hsn-codes' ? 'HSN Code' : 'Code'}
              {config.entityKey === 'hsn-codes' && <span className="text-gray-400 font-normal"> * (Minimum 6 digits)</span>}
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                if (hsnError) setHsnError(null);
              }}
              disabled={isReadOnly}
              placeholder={config.entityKey === 'hsn-codes' ? 'e.g. 85411000' : `e.g. ${config.entityKey.slice(0, 3).toUpperCase()}-10001`}
              className={`w-full px-3.5 py-2 bg-gray-50 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] disabled:opacity-70 disabled:cursor-not-allowed ${hsnError ? 'border-red-500' : 'border-gray-200'}`}
            />
            {hsnError && <p className="text-xs text-red-500 mt-1.5">{hsnError}</p>}
            {config.entityKey === 'hsn-codes' && <HsnHierarchyPreview code={code} />}
          </div>

          {/* Custom Entity Fields */}
          {config.customFields?.map((f) => (
            <div key={f.name}>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                {f.label} {f.required && <span className="text-red-500">*</span>}
              </label>
              {f.helperText && <p className="text-[10px] text-gray-500 mb-1.5">{f.helperText}</p>}
              {f.type === 'category-select' && (record._count?.children ?? 0) > 0 && (
                <p className="text-[10px] text-amber-600 mb-1.5">Cannot be nested because it has sub-categories.</p>
              )}
              {f.type === 'select' || f.type === 'tax-rate-select' || f.type === 'category-select' ? (
                <select
                  value={customValues[f.name] || ''}
                  onChange={(e) => setCustomValues({ ...customValues, [f.name]: e.target.value })}
                  disabled={isReadOnly || (f.type === 'category-select' && (record._count?.children ?? 0) > 0)}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none disabled:opacity-70"
                >
                  <option value="">{f.type === 'category-select' ? 'None (Root Category)' : `Select ${f.label}`}</option>
                  {f.type === 'select' && f.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                  {f.type === 'tax-rate-select' && taxRates.map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      {tr.name} ({tr.percentage}%)
                    </option>
                  ))}
                  {f.type === 'category-select' && rootCategories.filter(c => c.id !== record.id).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type}
                  step={f.type === 'number' ? 'any' : undefined}
                  disabled={isReadOnly}
                  value={customValues[f.name] || ''}
                  onChange={(e) => {
                    const val = f.uppercase ? e.target.value.toUpperCase() : e.target.value;
                    setCustomValues({ ...customValues, [f.name]: val });
                  }}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] disabled:opacity-60"
                />
              )}
            </div>
          ))}

          {config.entityKey !== 'tax-rates' && (
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
          )}

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
                <span>Activated By:</span>
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
