import React, { useState, useEffect } from 'react';
import { MasterConfig } from './types';
import { X, Save, Send, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import HsnHierarchyPreview from '../hsn-codes/HsnHierarchyPreview';

interface CreateMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: MasterConfig;
  onSuccess: () => void;
}

export default function CreateMasterModal({ isOpen, onClose, config, onSuccess }: CreateMasterModalProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [remarks, setRemarks] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [hsnError, setHsnError] = useState<string | null>(null);

  const hasUnsavedChanges = React.useMemo(() => {
    if (name.trim()) return true;
    if (code.trim()) return true;
    if (description.trim()) return true;
    if (remarks.trim()) return true;

    for (const key in customValues) {
      if (customValues[key] !== undefined && customValues[key] !== null && String(customValues[key]).trim() !== '') {
        return true;
      }
    }
    return false;
  }, [name, code, description, remarks, customValues]);

  const handleDismiss = () => {
    if (name || code || description || remarks || Object.values(customValues).some(Boolean)) {
      setIsDismissConfirmOpen(true);
    } else {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      setName('');
      setCode('');
      setDescription('');
      setRemarks('');
      setCustomValues({});
      setHsnError(null);
      
      if (config.customFields?.some(f => f.type === 'tax-rate-select')) {
        fetch('/api/staff/catalog/tax-rates?status=Active')
          .then(res => res.json())
          .then(data => {
            setTaxRates(Array.isArray(data.records) ? data.records : (Array.isArray(data) ? data : []));
          })
          .catch(console.error);
      }
    }
  }, [isOpen, config.customFields]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !submitting) {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, handleDismiss]);

  if (!isOpen) return null;

  const handleSubmit = async (submitForApproval: boolean) => {
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
        code: code.trim() || undefined,
        description: description.trim() || undefined,
        remarks: remarks.trim() || undefined,
        submitForApproval,
        ...customValues,
      };

      const res = await fetch(`/api/staff/catalog/${config.entityKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create record');

      toast.success(`${config.singularTitle} ${submitForApproval ? 'submitted for approval' : 'saved as Draft'}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error creating record');
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
            <h2 className="text-lg font-bold text-gray-900">Create New {config.singularTitle}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Add a new record to the master catalog registry.</p>
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
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              {config.entityKey === 'hsn-codes' ? 'Description (Name)' : 'Name'} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`e.g. ${config.singularTitle} Name`}
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              {config.entityKey === 'hsn-codes' ? 'HSN Code' : 'Code'} 
              <span className="text-gray-400 font-normal">
                {config.entityKey === 'hsn-codes' ? ' * (Minimum 6 digits)' : ' (Optional - Auto-generated if left blank)'}
              </span>
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                if (hsnError) setHsnError(null);
              }}
              placeholder={config.entityKey === 'hsn-codes' ? 'e.g. 85411000' : `e.g. ${config.entityKey.slice(0, 3).toUpperCase()}-10001`}
              className={`w-full px-3.5 py-2 bg-gray-50 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] ${hsnError ? 'border-red-500' : 'border-gray-200'}`}
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
              {f.type === 'select' || f.type === 'tax-rate-select' ? (
                <select
                  value={customValues[f.name] || ''}
                  onChange={(e) => setCustomValues({ ...customValues, [f.name]: e.target.value })}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none"
                >
                  <option value="">Select {f.label}</option>
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
                </select>
              ) : (
                <input
                  type={f.type}
                  step={f.type === 'number' ? 'any' : undefined}
                  value={customValues[f.name] || ''}
                  onChange={(e) => {
                    const val = f.uppercase ? e.target.value.toUpperCase() : e.target.value;
                    setCustomValues({ ...customValues, [f.name]: val });
                  }}
                  placeholder={`Enter ${f.label}`}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766]"
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional specifications or notes..."
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Remarks
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Creation remarks..."
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766]"
            />
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
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save as Draft
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1A2766] hover:bg-[#152052] text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Submit for Approval
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
