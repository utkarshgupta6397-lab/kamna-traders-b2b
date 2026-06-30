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
}

export default function WorkflowDocumentUploader({ orderId, requirements, onComplete, canProgress }: WorkflowDocumentUploaderProps) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  
  // Local state for tracking uploads and inputs before submission
  // It now stores all file metadata so it can be persisted correctly
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
        // Pre-fill local state if already uploaded
        const newState: any = {};
        // We only care about documentation files for this specific uploader
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
      // Physically delete from database
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

    // Remove from local state
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
      // Save all documents that are not yet saved to db or whose phone numbers changed
      for (const item of summary) {
        if (!item.hasFile) continue;
        const state = localState[item.req.type];
        
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
      }

      onComplete();

    } catch (e) {
      toast.error('Failed to submit documents');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center">
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
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="bg-slate-50 border-b border-gray-200 p-5">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Customer Verification Documents</h3>
        <p className="text-sm text-gray-500">Please provide all mandatory verification documents to proceed.</p>
      </div>

      <div className="divide-y divide-gray-100">
        {requirements.map((req, idx) => {
          const state = localState[req.type];
          const isUploaded = !!state?.fileUrl;
          const phoneConfig = req.requiresPhone;
          const phoneValid = phoneConfig ? state?.phone && phoneConfig.validationRegex.test(state.phone) : true;

          return (
            <div key={req.type} className="p-6">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                
                {/* Left side: Instructions */}
                <div className="flex-1">
                  <h4 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
                    {req.label}
                    {req.required && <span className="text-red-500 text-xs uppercase tracking-wider bg-red-50 px-1.5 py-0.5 rounded">Required</span>}
                  </h4>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-gray-500 mb-4">
                    <span>Formats: {req.acceptedTypes.map(t => t.replace('.', '').toUpperCase()).join(', ')}</span>
                    <span>Max Size: {req.maxMb} MB</span>
                  </div>
                  
                  {isUploaded ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-bold">
                      <CheckCircle2 size={16} /> Uploaded Successfully
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 text-gray-500 border border-gray-200 rounded-lg text-sm font-medium">
                      <Circle size={16} /> Not Uploaded
                    </div>
                  )}
                </div>

                {/* Right side: Uploader */}
                <div className="flex-shrink-0 w-full md:w-80">
                  {isUploaded ? (
                    <div className="flex flex-col border border-gray-200 rounded-xl bg-gray-50 p-3">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-blue-600 flex-shrink-0">
                          <FileText size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate" title={state.fileName}>{state.fileName || req.label}</p>
                          <p className="text-xs text-gray-500">{state.fileSizeBytes ? formatBytes(state.fileSizeBytes) : 'Unknown size'}</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <a 
                          href={state.fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          View
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
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-bold bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              Replace
                            </button>
                            <button 
                              onClick={() => handleDelete(req.type)}
                              className="flex-none p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent rounded-lg transition-colors"
                              title="Delete Document"
                            >
                              <X size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
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
                        className="w-full flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-gray-300 rounded-xl text-sm font-bold text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                      >
                        {uploading === req.type ? <Loader2 size={24} className="animate-spin text-blue-500" /> : <Upload size={24} className="text-gray-400 group-hover:text-blue-500" />}
                        <div className="flex flex-col items-start ml-2 text-left">
                          <span className="text-gray-900">{uploading === req.type ? 'Uploading...' : 'Click to Upload File'}</span>
                          <span className="text-xs text-gray-500 font-normal mt-0.5">or drag and drop</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Dependent Phone Field */}
              {phoneConfig && (
                <div className={`mt-6 pt-6 border-t border-gray-100 ${isUploaded ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  <h4 className="text-sm font-bold text-gray-900 mb-1">{phoneConfig.label} <span className="text-red-500">*</span></h4>
                  <p className="text-xs text-gray-500 mb-3">{phoneConfig.description}</p>
                  
                  <div className="relative max-w-xs">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">+91</span>
                    <input 
                      type="text"
                      placeholder="__________"
                      value={state?.phone || ''}
                      onChange={(e) => handlePhoneChange(req.type, e.target.value)}
                      disabled={!canProgress}
                      className={`w-full pl-10 pr-4 py-2.5 border-2 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all ${
                        state?.phone && !phoneValid 
                          ? 'border-red-300 focus:border-red-500' 
                          : state?.phone && phoneValid 
                            ? 'border-emerald-300 focus:border-emerald-500' 
                            : 'border-gray-200 focus:border-blue-500'
                      }`}
                    />
                  </div>
                  {state?.phone && !phoneValid && (
                    <p className="text-xs text-red-500 mt-1.5 font-medium">Please enter a valid 10-digit number</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Validation Summary & Submit */}
      {canProgress && (
        <div className="bg-slate-50 border-t border-gray-200 p-6 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-3">Validation Summary</h4>
            <div className="space-y-2">
              {summary.map(s => (
                <div key={s.req.type} className="flex items-center gap-2 text-sm font-medium text-gray-600">
                  {s.isValid ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Circle size={16} className="text-gray-300" />}
                  {s.req.label} {s.hasFile ? 'Uploaded' : 'Pending'}
                  {s.req.requiresPhone && (
                    <span className="ml-2">
                      ({s.hasValidPhone ? 'Valid Phone Number' : 'Pending Phone Number'})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex-shrink-0 w-full md:w-auto">
            <button
              onClick={handleSubmit}
              disabled={!allValid || submitting}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none disabled:bg-gray-300 disabled:text-gray-500"
            >
              {submitting ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
              Submit Documents
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
