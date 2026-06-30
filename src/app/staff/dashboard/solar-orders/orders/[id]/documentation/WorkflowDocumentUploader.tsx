'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, X, CheckCircle2, FileText, Loader2, Circle, Download, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export interface DocumentRequirement {
  type: string;
  label: string;
  required: boolean;
  maxMb: number;
  acceptedTypes: string[]; // e.g. ['.pdf', '.jpg', '.jpeg', '.png', '.heic']
  requiresPhone?: {
    label: string;
    description: string;
    validationRegex: RegExp;
  };
}

interface WorkflowDocumentUploaderProps {
  orderId: string;
  requirements: DocumentRequirement[];
  onComplete: () => void;
  canProgress: boolean;
  title?: string;
  subtitle?: string;
  submitButtonText?: string;
}

export default function WorkflowDocumentUploader({ 
  orderId, 
  requirements, 
  onComplete, 
  canProgress,
  title = "Customer Verification Documents",
  subtitle = "Please provide all mandatory verification documents to proceed.",
  submitButtonText = "Submit Documents"
}: WorkflowDocumentUploaderProps) {
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
    isSavedToDb?: boolean;
  }>>({});
  
  const [submitting, setSubmitting] = useState(false);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    fetchDocuments();
  }, [orderId]);

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`/api/solar-orders/${orderId}/files`);
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

    if (file.size > req.maxMb * 1024 * 1024) {
      toast.error(`File must be smaller than ${req.maxMb}MB`);
      return;
    }

    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!req.acceptedTypes.includes(fileExtension) && !req.acceptedTypes.includes(file.type)) {
       toast.error(`Invalid file format. Accepted: ${req.acceptedTypes.join(', ')}`);
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

  const handleDelete = async (type: string) => {
    const state = localState[type];
    if (!state) return;

    if (state.isSavedToDb && state.id) {
      try {
        const res = await fetch(`/api/solar-orders/${orderId}/files?fileId=${state.id}`, {
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
      const hasFile = !!state?.fileUrl;
      const hasValidPhone = !req.requiresPhone || (state?.phone && req.requiresPhone.validationRegex.test(state.phone));
      const isValid = (!req.required || hasFile) && hasValidPhone;
      return { req, hasFile, hasValidPhone, isValid };
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
      for (const item of summary) {
        if (!item.hasFile) continue;
        const state = localState[item.req.type];
        
        // Let's log activity only if it's a DCR_CERTIFICATE, or we could do it in general.
        // The API route doesn't automatically log when we upload files from here, 
        // because this posts directly to `/api/solar-orders/[id]/files`.
        await fetch(`/api/solar-orders/${orderId}/files`, {
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

        // Special Audit Log for DCR
        if (item.req.type === 'DCR_CERTIFICATE') {
          await fetch(`/api/solar-orders/${orderId}/activity`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               eventType: 'FILES_UPLOADED',
               description: `DCR Certificate Uploaded: ${state.fileName}`,
             })
          });
        }
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

  return (
    <div className="bg-white h-full flex flex-col">
      <div className="bg-slate-50 border-b border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 divide-y divide-gray-100 space-y-6">
        {requirements.map((req, idx) => {
          const state = localState[req.type];
          const isUploaded = !!state?.fileUrl;
          const phoneConfig = req.requiresPhone;
          const phoneValid = phoneConfig ? state?.phone && phoneConfig.validationRegex.test(state.phone) : true;

          return (
            <div key={req.type} className={idx > 0 ? "pt-6" : ""}>
              
              {/* Vertical Stack: Title & Meta */}
              <div className="mb-4">
                <h4 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-1.5">
                  {req.label}
                  {req.required && <span className="text-red-500 text-[10px] font-black uppercase tracking-wider bg-red-50 px-2 py-0.5 rounded border border-red-100">Required</span>}
                </h4>
                <div className="flex items-center gap-3 text-xs font-medium text-gray-500">
                  <span className="bg-gray-50 px-2 py-1 rounded border border-gray-100">Formats: {req.acceptedTypes.map(t => t.replace('.', '').toUpperCase()).join(', ')}</span>
                  <span className="bg-gray-50 px-2 py-1 rounded border border-gray-100">Max: {req.maxMb} MB</span>
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
                        accept={req.acceptedTypes.join(',')} 
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
                      accept={req.acceptedTypes.join(',')} 
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
                  {s.hasFile ? <span className="text-emerald-600 text-xs font-bold">(Uploaded)</span> : <span className="text-orange-500 text-xs font-bold">(Pending)</span>}
                  
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
