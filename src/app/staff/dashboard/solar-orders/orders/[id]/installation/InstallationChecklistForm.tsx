'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, X, CheckCircle2, Loader2, ImageIcon, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { WorkflowStep } from '../components/WorkflowEngine';

interface InstallationChecklistFormProps {
  orderId: string;
  step: WorkflowStep;
  updateStep: (status: string, notes?: string, metaOverride?: any) => Promise<void>;
  canEdit: boolean;
  loadingStep: string | null;
}

export default function InstallationChecklistForm({
  orderId,
  step,
  updateStep,
  canEdit,
  loadingStep
}: InstallationChecklistFormProps) {
  const meta = step.metadata || {};
  const isCompleted = step.status === 'COMPLETED';

  // Local state
  const [earthingCompleted, setEarthingCompleted] = useState<boolean>(meta.earthingCompleted || false);
  const [panelsInstalled, setPanelsInstalled] = useState<boolean>(meta.panelsInstalled || false);
  const [inverterInstalled, setInverterInstalled] = useState<boolean>(meta.inverterInstalled || false);
  const [inverterSerialNumber, setInverterSerialNumber] = useState<string>(meta.inverterSerialNumber || '');
  const [wiringDone, setWiringDone] = useState<boolean>(meta.wiringDone || false);
  
  const [gpsImage, setGpsImage] = useState<any>(meta.gpsImage || null);
  const [remarks, setRemarks] = useState<string>(meta.remarks || step.notes || '');

  const [uploadingGps, setUploadingGps] = useState(false);
  const gpsInputRef = useRef<HTMLInputElement>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const silentSave = async (updates: any) => {
    if (!canEdit) return;
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      const payload = {
        ...meta,
        earthingCompleted,
        panelsInstalled,
        inverterInstalled,
        inverterSerialNumber,
        wiringDone,
        gpsImage,
        remarks,
        ...updates,
        name: step.metadata?.name || 'Installation Checklist'
      };

      const res = await fetch(`/api/solar-orders/${orderId}/workflow/${step.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: payload })
      });
      
      if (res.ok) {
        setSaveStatus('saved');
        setTimeout(() => {
          setSaveStatus(prev => prev === 'saved' ? 'idle' : prev);
        }, 2000);
      } else {
        setSaveStatus('error');
      }
    } catch (e) {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGpsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error(`File ${file.name} exceeds 5MB limit`);
      if (gpsInputRef.current) gpsInputRef.current.value = '';
      return;
    }

    setUploadingGps(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const uploadData = await uploadRes.json();

      if (uploadRes.ok) {
        toast.success('GPS Photo uploaded successfully');
        const newGpsImage = {
          fileName: uploadData.fileName,
          url: uploadData.url,
          mimeType: uploadData.mimeType,
          fileSize: uploadData.fileSize
        };
        setGpsImage(newGpsImage);
        silentSave({ gpsImage: newGpsImage });
      } else {
        toast.error(uploadData.error || 'Upload failed');
      }
    } catch (err) {
      toast.error('Network error during upload');
    }
    
    setUploadingGps(false);
    if (gpsInputRef.current) gpsInputRef.current.value = '';
  };

  const removeGpsImage = () => {
    setGpsImage(null);
    silentSave({ gpsImage: null });
  };

  const isFormValid = () => {
    if (!earthingCompleted) return false;
    if (!panelsInstalled) return false;
    if (!inverterInstalled) return false;
    if (inverterInstalled && !inverterSerialNumber.trim()) return false;
    if (!wiringDone) return false;
    if (!gpsImage) return false;
    return true;
  };

  const handleSubmit = () => {
    if (!isFormValid()) {
      toast.error('Please complete all mandatory validations first.');
      return;
    }

    // No payload needed; data has been auto-saved via silentSave.
    updateStep('COMPLETED', remarks);
  };

  // If completed, show summary view
  if (isCompleted) {
    return (
      <div className="p-6 md:p-8 w-full bg-slate-50 flex flex-col justify-center border-t border-gray-100 h-full">
        <div className="bg-[#E5FAFF] border border-[#00C2FF] rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
             <div className="w-10 h-10 rounded-full bg-[#00C2FF] flex items-center justify-center text-white shadow-md">
               <CheckCircle2 size={24} />
             </div>
             <div>
               <h3 className="text-lg font-bold text-gray-900">Installation Checklist Verified</h3>
               <p className="text-sm text-gray-600">
                 Completed by <span className="font-bold">{step.completedBy?.name || 'System'}</span> on {step.completedAt ? new Date(step.completedAt).toLocaleString() : 'N/A'}
               </p>
             </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm mt-4 p-4 bg-white rounded-lg border border-gray-200">
            <div>
              <span className="text-gray-500 font-medium block">Inverter Serial Number</span>
              <p className="font-bold text-gray-900 mt-1">{meta.inverterSerialNumber || 'N/A'}</p>
            </div>
            <div>
              <span className="text-gray-500 font-medium block">GPS Site Image</span>
              {meta.gpsImage ? (
                <a href={meta.gpsImage.url} target="_blank" rel="noopener noreferrer" className="text-[#00C2FF] font-bold mt-1 inline-flex items-center gap-1 hover:underline">
                  View Attachment
                </a>
              ) : (
                <p className="font-bold text-gray-900 mt-1">N/A</p>
              )}
            </div>
            {meta.remarks && (
              <div className="col-span-2 mt-2 pt-2 border-t border-gray-100">
                <span className="text-gray-500 font-medium block">Remarks</span>
                <p className="font-medium text-gray-900 mt-1 whitespace-pre-wrap">{meta.remarks}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 w-full bg-slate-50 flex flex-col h-full overflow-y-auto">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-1">Installation Checklist</h3>
        <p className="text-sm text-gray-500">
          Please verify that the installation has been physically completed before proceeding to Net Metering.
        </p>
      </div>

      <div className="space-y-6 flex-1 mb-6">
        {/* Checklist Section */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-4">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={earthingCompleted}
              onChange={(e) => {
                if (canEdit) {
                  setEarthingCompleted(e.target.checked);
                  silentSave({ earthingCompleted: e.target.checked });
                }
              }}
              disabled={!canEdit}
              className="mt-1 w-5 h-5 rounded border-gray-300 text-[#00C2FF] focus:ring-[#00C2FF] disabled:opacity-50 transition-all cursor-pointer"
            />
            <div>
              <p className={`font-bold text-base ${earthingCompleted ? 'text-gray-900' : 'text-gray-700'}`}>Earthing Completed</p>
              <p className="text-xs text-red-500 font-bold tracking-wider uppercase mt-0.5">Required</p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={panelsInstalled}
              onChange={(e) => {
                if (canEdit) {
                  setPanelsInstalled(e.target.checked);
                  silentSave({ panelsInstalled: e.target.checked });
                }
              }}
              disabled={!canEdit}
              className="mt-1 w-5 h-5 rounded border-gray-300 text-[#00C2FF] focus:ring-[#00C2FF] disabled:opacity-50 transition-all cursor-pointer"
            />
            <div>
              <p className={`font-bold text-base ${panelsInstalled ? 'text-gray-900' : 'text-gray-700'}`}>Panels Installed</p>
              <p className="text-xs text-red-500 font-bold tracking-wider uppercase mt-0.5">Required</p>
            </div>
          </label>

          <div className="pt-2 border-t border-gray-100">
            <label className="flex items-start gap-3 cursor-pointer group mb-3">
              <input 
                type="checkbox" 
                checked={inverterInstalled}
                onChange={(e) => {
                  if (!canEdit) return;
                  setInverterInstalled(e.target.checked);
                  if (!e.target.checked) {
                    setInverterSerialNumber('');
                    silentSave({ inverterInstalled: false, inverterSerialNumber: '' });
                  } else {
                    silentSave({ inverterInstalled: true });
                  }
                }}
                disabled={!canEdit}
                className="mt-1 w-5 h-5 rounded border-gray-300 text-[#00C2FF] focus:ring-[#00C2FF] disabled:opacity-50 transition-all cursor-pointer"
              />
              <div>
                <p className={`font-bold text-base ${inverterInstalled ? 'text-gray-900' : 'text-gray-700'}`}>Inverter Installed</p>
                <p className="text-xs text-red-500 font-bold tracking-wider uppercase mt-0.5">Required</p>
              </div>
            </label>

            {inverterInstalled && (
              <div className="pl-8 animate-in slide-in-from-top-2 fade-in duration-200">
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Inverter Serial Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={inverterSerialNumber}
                  onChange={(e) => setInverterSerialNumber(e.target.value)}
                  onBlur={() => silentSave({ inverterSerialNumber })}
                  disabled={!canEdit}
                  placeholder="Enter serial number..."
                  className="w-full border-2 border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C2FF]/20 focus:border-[#00C2FF] transition-all bg-gray-50 focus:bg-white"
                />
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-gray-100">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={wiringDone}
                onChange={(e) => {
                  if (canEdit) {
                    setWiringDone(e.target.checked);
                    silentSave({ wiringDone: e.target.checked });
                  }
                }}
                disabled={!canEdit}
                className="mt-1 w-5 h-5 rounded border-gray-300 text-[#00C2FF] focus:ring-[#00C2FF] disabled:opacity-50 transition-all cursor-pointer"
              />
              <div>
                <p className={`font-bold text-base ${wiringDone ? 'text-gray-900' : 'text-gray-700'}`}>Wiring Done</p>
                <p className="text-xs text-red-500 font-bold tracking-wider uppercase mt-0.5">Required</p>
              </div>
            </label>
          </div>
        </div>

        {/* GPS Image Upload */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="mb-3">
            <h4 className="font-bold text-gray-900">
              GPS Site Image <span className="text-red-500">*</span>
            </h4>
            <p className="text-xs text-gray-500 mt-1">Accepted formats: jpg, jpeg, png, heic, pdf. Max 5MB.</p>
          </div>

          {gpsImage ? (
            <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-white rounded-lg border border-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {(gpsImage.mimeType?.includes('image') || gpsImage.url?.match(/\.(jpg|jpeg|png|gif|heic)$/i)) ? (
                  <img src={gpsImage.url} alt={gpsImage.fileName} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="text-gray-400" size={24} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{gpsImage.fileName}</p>
                <a href={gpsImage.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#00C2FF] hover:underline">View File</a>
              </div>
              {canEdit && (
                <button onClick={removeGpsImage} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <X size={18} />
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <input 
                type="file"
                ref={gpsInputRef}
                className="hidden"
                accept=".jpg,.jpeg,.png,.heic,.pdf,image/jpeg,image/png,image/heic,application/pdf"
                onChange={handleGpsUpload}
                disabled={!canEdit || uploadingGps}
              />
              <button 
                type="button"
                onClick={() => gpsInputRef.current?.click()}
                disabled={!canEdit || uploadingGps}
                className="w-full flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-[#00C2FF]/30 rounded-xl text-sm font-bold text-[#00C2FF] hover:border-[#00C2FF] hover:bg-[#E5FAFF] transition-all disabled:opacity-50"
              >
                {uploadingGps ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
                <span>{uploadingGps ? 'Uploading Image...' : 'Click to Upload GPS Image'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Remarks */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Installation Remarks <span className="text-[10px] uppercase tracking-wider font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full ml-2">Optional</span>
          </label>
          <textarea
            placeholder="Any additional notes..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            onBlur={() => silentSave({ remarks })}
            disabled={!canEdit}
            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C2FF]/20 focus:border-[#00C2FF] transition-all resize-none bg-gray-50 focus:bg-white"
            rows={3}
          />
        </div>
      </div>

      <div className="mt-auto">
        {!isFormValid() && canEdit && (
          <div className="mb-3 text-center text-sm font-bold text-red-500 bg-red-50 p-2 rounded-lg border border-red-100">
            All mandatory fields must be completed to proceed.
          </div>
        )}
        
        <button
          onClick={handleSubmit}
          disabled={loadingStep === step.id || !canEdit || !isFormValid()}
          className={`w-full flex items-center justify-center gap-2 px-6 py-4 font-bold text-base rounded-xl transition-all shadow-md group ${
            isFormValid() && canEdit 
              ? 'bg-[#00C2FF] text-white hover:bg-[#0091C2] hover:shadow-lg' 
              : 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300 shadow-none'
          }`}
        >
          {loadingStep === step.id ? <Loader2 size={22} className="animate-spin" /> : (canEdit && isFormValid() && <Check size={22} className="group-hover:scale-110 transition-transform" />)}
          Complete Installation Checklist
        </button>
      </div>
    </div>
  );
}
