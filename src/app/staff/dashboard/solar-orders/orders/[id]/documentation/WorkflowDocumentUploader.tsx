'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, X, CheckCircle2, FileText, Loader2, Circle, Download, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export interface DocumentRequirement {
  type: string;
  label: string;
  required: boolean;
  inputType?: 'FILE' | 'TEXT' | 'DROPDOWN' | 'CURRENCY';
  maxMb?: number;
  acceptedTypes?: string[]; // e.g. ['.pdf', '.jpg', '.jpeg', '.png', '.heic']
  options?: string[];
  placeholder?: string;
  min?: number;
  max?: number;
  maxErrorMsg?: string;
  section?: string;
  sectionSubtitle?: string;
  requiresPhone?: {
    label: string;
    description: string;
    validationRegex: RegExp;
  };
  validationRegex?: RegExp;
}

interface WorkflowDocumentUploaderProps {
  order?: any;
  orderId?: string; // backwards compatibility
  requirements: DocumentRequirement[];
  onComplete: () => void;
  canProgress: boolean;
  title?: string;
  subtitle?: string;
  submitButtonText?: string;
}

export default function WorkflowDocumentUploader({ 
  order,
  orderId: legacyOrderId, 
  requirements, 
  onComplete, 
  canProgress,
  title = "Customer Verification Documents",
  subtitle = "Please provide all mandatory verification documents to proceed.",
  submitButtonText = "Submit Documents"
}: WorkflowDocumentUploaderProps) {
  const activeOrderId = order?.id || legacyOrderId;

  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  
  const [localState, setLocalState] = useState<Record<string, { 
    id?: string;
    fileUrl?: string; 
    fileName?: string;
    fileType?: string;
    fileSizeBytes?: number;
    phone?: string;
    value?: string;
    isSavedToDb?: boolean;
  }>>({});
  
  const [submitting, setSubmitting] = useState(false);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    fetchDocuments();
  }, [activeOrderId]);

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`/api/solar-orders/${activeOrderId}/files`);
      const data = await res.json();
      if (res.ok) {
        setDocuments(data.files);
        const newState: any = {};
        const docFiles = data.files.filter((f: any) => f.fileCategory === 'DOCUMENTATION');
        
        docFiles.forEach((doc: any) => {
          newState[doc.documentType] = {
            id: doc.id,
            fileUrl: doc.fileUrl,
            fileName: doc.fileName,
            fileType: doc.fileType,
            fileSizeBytes: doc.fileSizeBytes,
            phone: doc.metadata?.phone || '',
            isSavedToDb: true
          };
        });

        // Hydrate TEXT, DROPDOWN, and CURRENCY values from the order if they exist
        requirements.forEach(req => {
          if (req.inputType === 'TEXT' || req.inputType === 'DROPDOWN' || req.inputType === 'CURRENCY') {
            if (req.type === 'CUSTOMER_EMAIL' && order?.customerEmail) {
               newState[req.type] = { value: order.customerEmail, isSavedToDb: true };
            }
            if (req.type === 'LOAN_ANNUAL_INCOME' && order?.loanAnnualIncome) {
               newState[req.type] = { value: order.loanAnnualIncome.toString(), isSavedToDb: true };
            }
            if (req.type === 'LOAN_QUOTATION_AMOUNT' && order?.loanQuotationAmount) {
               newState[req.type] = { value: order.loanQuotationAmount.toString(), isSavedToDb: true };
            }
          }
        });

        setLocalState(newState);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (type: string, file: File) => {
    const req = requirements.find(r => r.type === type);
    if (!req) return;

    const maxMb = req.maxMb || 2;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`File must be smaller than ${maxMb}MB`);
      return;
    }

    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    const acceptedTypes = req.acceptedTypes || [];
    if (!acceptedTypes.includes(fileExtension) && !acceptedTypes.includes(file.type)) {
       toast.error(`Invalid file format. Accepted: ${acceptedTypes.join(', ')}`);
       return;
    }

    setUploading(type);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (res.ok) {
        setLocalState(prev => ({
          ...prev,
          [type]: { 
            ...prev[type], 
            fileUrl: data.url,
            fileName: data.fileName,
            fileType: data.mimeType,
            fileSizeBytes: data.fileSize,
            isSavedToDb: false
          }
        }));
        toast.success(`${req.label} uploaded successfully`);
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch (e) {
      toast.error('Network error during upload');
    } finally {
      setUploading(null);
    }
  };

  const handlePhoneChange = (type: string, val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    setLocalState(prev => ({
      ...prev,
      [type]: { ...prev[type], phone: digits }
    }));
  };

  const handleValueChange = (type: string, val: string) => {
    setLocalState(prev => ({
      ...prev,
      [type]: { ...prev[type], value: val }
    }));
  };

  const handleDelete = async (type: string) => {
    const state = localState[type];
    if (!state) return;

    if (state.isSavedToDb && state.id) {
      try {
        const res = await fetch(`/api/solar-orders/${activeOrderId}/files?fileId=${state.id}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete');
        toast.success('Document deleted');
      } catch (e) {
        toast.error('Could not delete document from database');
        return;
      }
    }

    setLocalState(p => {
      const newState = { ...p };
      delete newState[type];
      return newState;
    });
  };

  const getValidationSummary = () => {
    const summary = requirements.map(req => {
      const state = localState[req.type];
      
      if (req.inputType === 'TEXT' || req.inputType === 'DROPDOWN' || req.inputType === 'CURRENCY') {
        const val = state?.value || '';
        const hasValue = val.trim().length > 0;
        let isValid = !req.required || hasValue;
        
        if (hasValue && req.validationRegex) {
           isValid = req.validationRegex.test(val);
        }
        if (hasValue && req.inputType === 'CURRENCY') {
           const num = Number(val);
           if (isNaN(num)) isValid = false;
           if (req.min !== undefined && num < req.min) isValid = false;
           if (req.max !== undefined && num > req.max) isValid = false;
        }
        return { req, hasValue, isValid, isInput: true };
      }

      // Default FILE logic
      const hasFile = !!state?.fileUrl;
      const hasValidPhone = !req.requiresPhone || (state?.phone && req.requiresPhone.validationRegex.test(state.phone));
      const isValid = (!req.required || hasFile) && hasValidPhone;
      return { req, hasFile, hasValidPhone, isValid, isInput: false };
    });
    const allValid = summary.every(s => s.isValid);
    return { summary, allValid };
  };

  const handleSubmit = async () => {
    const { allValid, summary } = getValidationSummary();
    if (!allValid) {
      toast.error('Please complete all mandatory fields');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Submit Files
      for (const item of summary) {
        if (item.isInput || !item.hasFile) continue;
        const state = localState[item.req.type];
        
        if (!state.isSavedToDb) {
          await fetch(`/api/solar-orders/${activeOrderId}/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              documentType: item.req.type,
              fileCategory: 'DOCUMENTATION',
              fileName: state.fileName,
              fileUrl: state.fileUrl,
              fileType: state.fileType,
              fileSizeBytes: state.fileSizeBytes,
              metadata: item.req.requiresPhone ? { phone: state.phone } : undefined
            })
          });
        }

        // Special Audit Log for DCR
        if (item.req.type === 'DCR_CERTIFICATE' && !state.isSavedToDb) {
          await fetch(`/api/solar-orders/${activeOrderId}/activity`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               eventType: 'FILES_UPLOADED',
               description: `DCR Certificate Uploaded: ${state.fileName}`,
             })
          });
        }
      }

      // 2. Submit Input Fields via PATCH
      const patchData: any = {};
      summary.filter(s => s.isInput).forEach(item => {
         const state = localState[item.req.type];
         if (item.req.type === 'CUSTOMER_EMAIL') patchData.customerEmail = state.value;
         if (item.req.type === 'LOAN_ANNUAL_INCOME') patchData.loanAnnualIncome = Number(state.value);
         if (item.req.type === 'LOAN_QUOTATION_AMOUNT') patchData.loanQuotationAmount = Number(state.value);
      });

      if (Object.keys(patchData).length > 0) {
         await fetch(`/api/solar-orders/${activeOrderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patchData)
         });
      }

      onComplete();

    } catch (e) {
      toast.error('Failed to submit documents');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-full">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  const { summary, allValid } = getValidationSummary();

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  let currentSection = '';

  return (
    <div className="bg-white h-full flex flex-col">
      <div className="bg-slate-50 border-b border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {requirements.map((req, idx) => {
          const state = localState[req.type];
          
          let renderSectionHeader = false;
          if (req.section && req.section !== currentSection) {
             currentSection = req.section;
             renderSectionHeader = true;
          }

          if (req.inputType === 'TEXT' || req.inputType === 'DROPDOWN' || req.inputType === 'CURRENCY') {
             let isValid = true;
             if (req.validationRegex) {
               isValid = req.validationRegex.test(state?.value || '');
             }
             if (req.inputType === 'CURRENCY' && state?.value) {
                const num = Number(state.value);
                if (isNaN(num)) isValid = false;
                if (req.min !== undefined && num < req.min) isValid = false;
                if (req.max !== undefined && num > req.max) isValid = false;
             }
             
             return (
                <div key={req.type} className="w-full">
                  {renderSectionHeader && (
                    <div className="pt-6 mt-6 border-t border-gray-200">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">{req.section}</h3>
                      {req.sectionSubtitle && <p className="text-sm text-gray-500 mb-6">{req.sectionSubtitle}</p>}
                    </div>
                  )}
                  
                  <div className="mb-2 flex items-center gap-2">
                    <h4 className="text-base font-bold text-gray-900">{req.label}</h4>
                    {req.required && <span className="text-red-500 text-[10px] font-black uppercase tracking-wider bg-red-50 px-2 py-0.5 rounded border border-red-100">Required</span>}
                  </div>
                  
                  {req.inputType === 'CURRENCY' ? (
                     <div className="relative w-full">
                       <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">₹</span>
                       <input 
                         type="text"
                         placeholder={req.placeholder || '0'}
                         value={state?.value ? Intl.NumberFormat('en-IN').format(Number(state.value)) : ''}
                         onChange={e => {
                           const raw = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                           handleValueChange(req.type, raw);
                         }}
                         disabled={!canProgress}
                         className={`w-full pl-8 pr-4 py-3 border-2 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all bg-white shadow-sm ${
                            state?.value && !isValid 
                              ? 'border-red-300 focus:border-red-500' 
                              : state?.value && isValid 
                                ? 'border-emerald-300 focus:border-emerald-500' 
                                : 'border-gray-200 focus:border-blue-500'
                         }`}
                       />
                     </div>
                  ) : req.inputType === 'TEXT' ? (
                     <input 
                       type="text"
                       placeholder={req.placeholder || ''}
                       value={state?.value || ''}
                       onChange={e => handleValueChange(req.type, e.target.value)}
                       disabled={!canProgress}
                       className={`w-full px-4 py-3 border-2 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all bg-white shadow-sm ${
                          state?.value && !isValid 
                            ? 'border-red-300 focus:border-red-500' 
                            : state?.value && isValid 
                              ? 'border-emerald-300 focus:border-emerald-500' 
                              : 'border-gray-200 focus:border-blue-500'
                       }`}
                     />
                  ) : (
                     <select
                       value={state?.value || ''}
                       onChange={e => handleValueChange(req.type, e.target.value)}
                       disabled={!canProgress}
                       className={`w-full px-4 py-3 border-2 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all bg-white shadow-sm ${
                          state?.value ? 'border-emerald-300 focus:border-emerald-500' : 'border-gray-200 focus:border-blue-500'
                       }`}
                     >
                       <option value="" disabled>Select {req.label}...</option>
                       {req.options?.map(opt => (
                         <option key={opt} value={opt}>{opt}</option>
                       ))}
                     </select>
                  )}
                  
                  {state?.value && !isValid && req.inputType === 'TEXT' && (
                     <p className="text-xs text-red-500 mt-2 font-bold flex items-center gap-1">
                       <Circle size={12} className="fill-red-500" /> Invalid format
                     </p>
                  )}
                  {state?.value && !isValid && req.inputType === 'CURRENCY' && (
                     <p className="text-xs text-red-500 mt-2 font-bold flex items-center gap-1">
                       <Circle size={12} className="fill-red-500" /> {req.max !== undefined && Number(state.value) > req.max ? (req.maxErrorMsg || `Amount cannot exceed ${req.max}`) : 'Invalid amount'}
                     </p>
                  )}
                </div>
             );
          }

          // FILE Uploader
          const isUploaded = !!state?.fileUrl;
          const phoneConfig = req.requiresPhone;
          const phoneValid = phoneConfig ? state?.phone && phoneConfig.validationRegex.test(state.phone) : true;
          const acceptedTypes = req.acceptedTypes || [];
          const maxMb = req.maxMb || 2;

          return (
            <div key={req.type} className="w-full">
              {renderSectionHeader && (
                <div className="pt-6 mt-6 border-t border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{req.section}</h3>
                  {req.sectionSubtitle && <p className="text-sm text-gray-500 mb-6">{req.sectionSubtitle}</p>}
                </div>
              )}
              
              {/* Vertical Stack: Title & Meta */}
              <div className="mb-4">
                <h4 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-1.5">
                  {req.label}
                  {req.required && <span className="text-red-500 text-[10px] font-black uppercase tracking-wider bg-red-50 px-2 py-0.5 rounded border border-red-100">Required</span>}
                </h4>
                <div className="flex items-center gap-3 text-xs font-medium text-gray-500">
                  <span className="bg-gray-50 px-2 py-1 rounded border border-gray-100">Formats: {acceptedTypes.map(t => t.replace('.', '').toUpperCase()).join(', ')}</span>
                  <span className="bg-gray-50 px-2 py-1 rounded border border-gray-100">Max: {maxMb} MB</span>
                </div>
              </div>

              {/* Vertical Stack: Uploader Box */}
              <div>
                {isUploaded ? (
                  <div className="flex flex-col border border-gray-200 rounded-xl bg-gray-50 p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-emerald-600 flex-shrink-0 shadow-sm">
                        <CheckCircle2 size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate" title={state.fileName}>{state.fileName || req.label}</p>
                        <p className="text-xs text-gray-500">{state.fileSizeBytes ? formatBytes(state.fileSizeBytes) : 'Unknown size'}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3 w-full">
                      <a 
                        href={state.fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shadow-sm"
                      >
                        Preview
                      </a>
                      
                      <input 
                        type="file" 
                        ref={el => { fileInputRefs.current[req.type] = el; }}
                        className="hidden" 
                        accept={acceptedTypes.join(',')} 
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileUpload(req.type, e.target.files[0]);
                          }
                        }}
                      />

                      {canProgress && (
                        <>
                          <button 
                            onClick={() => fileInputRefs.current[req.type]?.click()}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-bold bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors shadow-sm"
                          >
                            Replace
                          </button>
                          <button 
                            onClick={() => handleDelete(req.type)}
                            className="flex-none px-4 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-gray-200 hover:border-red-100 rounded-lg transition-colors bg-white shadow-sm"
                            title="Delete Document"
                          >
                            <X size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full">
                    <input 
                      type="file" 
                      ref={el => { fileInputRefs.current[req.type] = el; }}
                      className="hidden" 
                      accept={acceptedTypes.join(',')} 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileUpload(req.type, e.target.files[0]);
                        }
                      }}
                    />
                    <button 
                      type="button"
                      onClick={() => fileInputRefs.current[req.type]?.click()}
                      disabled={uploading === req.type || !canProgress}
                      className="w-full min-h-[120px] flex flex-col items-center justify-center gap-3 px-4 py-6 border-2 border-dashed border-gray-300 rounded-xl text-sm font-bold text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gray-50/50"
                    >
                      {uploading === req.type ? <Loader2 size={32} className="animate-spin text-blue-500" /> : <Upload size={32} className="text-gray-400 group-hover:text-blue-500" />}
                      <div className="flex flex-col items-center text-center">
                        <span className="text-gray-900">{uploading === req.type ? 'Uploading...' : 'Click to Upload File'}</span>
                        <span className="text-xs text-gray-500 font-normal mt-1">or drag and drop</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Dependent Phone Field */}
              {phoneConfig && (
                <div className={`mt-6 p-5 bg-gray-50 border border-gray-200 rounded-xl ${isUploaded ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                  <h4 className="text-sm font-bold text-gray-900 mb-1">{phoneConfig.label} <span className="text-red-500">*</span></h4>
                  <p className="text-xs text-gray-500 mb-4">{phoneConfig.description}</p>
                  
                  <div className="relative w-full">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">+91</span>
                    <input 
                      type="text"
                      placeholder="__________"
                      value={state?.phone || ''}
                      onChange={(e) => handlePhoneChange(req.type, e.target.value)}
                      disabled={!canProgress}
                      className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all bg-white shadow-sm ${
                        state?.phone && !phoneValid 
                          ? 'border-red-300 focus:border-red-500' 
                          : state?.phone && phoneValid 
                            ? 'border-emerald-300 focus:border-emerald-500' 
                            : 'border-gray-200 focus:border-blue-500'
                      }`}
                    />
                  </div>
                  {state?.phone && !phoneValid && (
                    <p className="text-xs text-red-500 mt-2 font-bold flex items-center gap-1">
                      <Circle size={12} className="fill-red-500" /> Please enter a valid 10-digit number
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Validation Summary & Submit - Sticky Bottom */}
      {canProgress && (
        <div className="bg-white border-t border-gray-200 p-6 sticky bottom-0 z-10 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] w-full mt-auto">
          <div className="mb-5">
            <h4 className="text-sm font-bold text-gray-900 mb-3">Validation Summary</h4>
            <div className="space-y-2">
              {summary.map(s => (
                <div key={s.req.type} className="flex items-center gap-2 text-sm font-medium text-gray-600">
                  {s.isValid ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Circle size={16} className="text-gray-300" />}
                  <span className={s.isValid ? "text-gray-900" : "text-gray-500"}>{s.req.label}</span>
                  
                  {s.isInput ? (
                    s.hasValue ? <span className="text-emerald-600 text-xs font-bold">(Completed)</span> : <span className="text-orange-500 text-xs font-bold">(Pending)</span>
                  ) : (
                    s.hasFile ? <span className="text-emerald-600 text-xs font-bold">(Uploaded)</span> : <span className="text-orange-500 text-xs font-bold">(Pending)</span>
                  )}
                  
                  {s.req.requiresPhone && (
                    <span className="ml-1 text-xs">
                      {s.hasValidPhone ? <span className="text-emerald-600 font-bold">• Valid Phone Number</span> : <span className="text-orange-500 font-bold">• Pending Phone Number</span>}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <button
            onClick={handleSubmit}
            disabled={!allValid || submitting}
            className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none disabled:bg-gray-200 disabled:text-gray-400"
          >
            {submitting ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
            {submitButtonText}
          </button>
        </div>
      )}
    </div>
  );
}
