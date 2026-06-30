'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, X, CheckCircle2, Loader2, ImageIcon, MapPin, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import exifr from 'exifr';

interface WorkflowInstallationUploaderProps {
  orderId: string;
  onComplete: () => void;
  canProgress: boolean;
}

export default function WorkflowInstallationUploader({ orderId, onComplete, canProgress }: WorkflowInstallationUploaderProps) {
  const [gpsPhoto, setGpsPhoto] = useState<any>(null);
  const [sitePhotos, setSitePhotos] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [uploadingGps, setUploadingGps] = useState(false);
  const [uploadingSite, setUploadingSite] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const gpsInputRef = useRef<HTMLInputElement>(null);
  const siteInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, [orderId]);

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`/api/solar-orders/${orderId}/files`);
      const data = await res.json();
      if (res.ok) {
        const gpsFiles = data.files.filter((f: any) => f.documentType === 'INSTALLATION_GPS');
        const siteFiles = data.files.filter((f: any) => f.documentType === 'INSTALLATION_SITE');
        
        if (gpsFiles.length > 0) {
          // If we have GPS coordinates saved in metadata, we could load them here.
          // For now, we'll just display it as uploaded.
          setGpsPhoto(gpsFiles[0]); 
        } else {
          setGpsPhoto(null);
        }
        
        setSitePhotos(siteFiles);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File, documentType: string, fileCategory: string) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const uploadRes = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const uploadData = await uploadRes.json();
    
    if (uploadRes.ok) {
      const dbRes = await fetch(`/api/solar-orders/${orderId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType,
          fileCategory,
          fileName: uploadData.fileName,
          fileUrl: uploadData.url,
          fileType: uploadData.mimeType,
          fileSizeBytes: uploadData.fileSize
        })
      });

      if (dbRes.ok) {
         return true;
      }
    }
    return false;
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
    let coords: { latitude: number, longitude: number } | null = null;
    
    try {
      // Try to extract GPS from the image
      const exifData = await exifr.gps(file);
      if (exifData && exifData.latitude && exifData.longitude) {
        coords = { latitude: exifData.latitude, longitude: exifData.longitude };
      }
    } catch (err) {
      console.error('EXIF extraction failed', err);
    }

    try {
      const success = await uploadFile(file, 'INSTALLATION_GPS', 'INSTALLATION_GPS');
      if (success) {
        toast.success('GPS Photo uploaded');
        // Temporarily store coords in local state just to show the badge before refresh
        setGpsPhoto({ temporary: true, fileName: file.name, fileUrl: URL.createObjectURL(file), coords });
        await fetchDocuments();
      } else {
        toast.error('Upload failed');
      }
    } catch (err) {
      toast.error('Network error during upload');
    }
    
    setUploadingGps(false);
    if (gpsInputRef.current) gpsInputRef.current.value = '';
  };

  const handleSiteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    if (sitePhotos.length + files.length > 10) {
      toast.error('Maximum 10 site photos allowed');
      if (siteInputRef.current) siteInputRef.current.value = '';
      return;
    }

    setUploadingSite(true);
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`File ${file.name} exceeds 5MB`);
        continue;
      }
      const success = await uploadFile(file, 'INSTALLATION_SITE', 'INSTALLATION_SITE');
      if (success) successCount++;
    }

    if (successCount > 0) {
      toast.success(`${successCount} site photo(s) uploaded`);
      await fetchDocuments();
    }
    setUploadingSite(false);
    if (siteInputRef.current) siteInputRef.current.value = '';
  };

  const handleDelete = async (fileId: string, isGps: boolean) => {
    try {
      const res = await fetch(`/api/solar-orders/${orderId}/files?fileId=${fileId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success('Photo deleted');
        if (isGps) {
          setGpsPhoto(null);
        } else {
          setSitePhotos(prev => prev.filter(d => d.id !== fileId));
        }
      } else {
        toast.error('Failed to delete photo');
      }
    } catch (e) {
      toast.error('Network error');
    }
  };

  const handleSubmit = async () => {
    if (!gpsPhoto) {
      toast.error('GPS Verification Photo is mandatory');
      return;
    }
    setSubmitting(true);
    // Logging audit action happens on backend in route.ts when step completes,
    // or we can just send the request
    try {
      await fetch(`/api/solar-orders/${orderId}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'FILES_UPLOADED',
          description: `GPS Verification Photo uploaded. ${sitePhotos.length} Installed Site Photo(s) uploaded.`,
        })
      });
    } catch (e) {
      // ignore log failure
    }
    
    onComplete();
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-full">
        <Loader2 className="animate-spin text-[#00C2FF]" size={32} />
      </div>
    );
  }

  const renderFileCard = (doc: any, isGps: boolean = false) => (
    <div key={doc.id || doc.fileName} className="flex flex-col gap-2 p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
          {(doc.fileType?.includes('image') || doc.fileUrl) ? (
            <img src={doc.fileUrl} alt={doc.fileName} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="text-gray-400" size={24} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{doc.fileName}</p>
          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#00C2FF] hover:underline">View File</a>
        </div>
        {canProgress && doc.id && (
          <button onClick={() => handleDelete(doc.id, isGps)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <X size={18} />
          </button>
        )}
      </div>
      
      {/* GPS Specific Validation Badge (only works if we extracted coords during this session's upload for now, or if we had stored them) */}
      {isGps && doc.coords && (
         <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1.5 rounded-lg">
           <MapPin size={14} /> GPS Coordinates Found: {doc.coords.latitude.toFixed(5)}, {doc.coords.longitude.toFixed(5)}
         </div>
      )}
      {isGps && !doc.coords && doc.temporary && (
         <div className="flex items-center gap-1.5 text-xs font-semibold text-yellow-700 bg-yellow-50 px-2.5 py-1.5 rounded-lg">
           <AlertCircle size={14} /> GPS Coordinates Missing (Upload Accepted)
         </div>
      )}
    </div>
  );

  return (
    <div className="bg-gray-50 p-4 md:p-6 h-full flex flex-col gap-6 overflow-y-auto">
      
      {/* Section 1: GPS Verification Photo */}
      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              GPS Verification Photo 
              <span className="text-[10px] uppercase tracking-wider font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Mandatory</span>
            </h3>
            <div className="text-sm font-bold flex items-center gap-1.5">
               {gpsPhoto ? (
                 <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={16} /> Uploaded</span>
               ) : (
                 <span className="text-gray-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full border-2 border-gray-400 inline-block" /> Not Uploaded</span>
               )}
            </div>
          </div>
          <p className="text-sm text-gray-500">Proof of site visit. Max 5MB (JPEG, PNG, HEIC). 1 photo only.</p>
        </div>

        {gpsPhoto ? (
          renderFileCard(gpsPhoto, true)
        ) : canProgress ? (
          <div className="relative">
            <input 
              type="file"
              ref={gpsInputRef}
              className="hidden"
              accept=".jpg,.jpeg,.png,.heic,image/jpeg,image/png,image/heic"
              onChange={handleGpsUpload}
            />
            <button 
              type="button"
              onClick={() => gpsInputRef.current?.click()}
              disabled={uploadingGps}
              className="w-full flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-[#00C2FF]/30 rounded-xl text-sm font-bold text-[#00C2FF] hover:border-[#00C2FF] hover:bg-[#E5FAFF] transition-all disabled:opacity-50"
            >
              {uploadingGps ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
              <span>{uploadingGps ? 'Uploading & Parsing GPS...' : 'Click to Upload GPS Photo'}</span>
            </button>
          </div>
        ) : null}
      </div>

      {/* Section 2: Installed Site Photos */}
      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100 flex-1">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              Installed Site Photos
              <span className="text-[10px] uppercase tracking-wider font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Optional</span>
            </h3>
            <div className="text-sm font-bold text-gray-500">
               {sitePhotos.length} / 10 Photos
            </div>
          </div>
          <p className="text-sm text-gray-500">Gallery of the completed installation. Max 5MB each.</p>
        </div>

        <div className="space-y-3 mb-4">
          {sitePhotos.map(doc => renderFileCard(doc))}
        </div>

        {canProgress && sitePhotos.length < 10 && (
          <div className="relative">
            <input 
              type="file"
              multiple
              ref={siteInputRef}
              className="hidden"
              accept=".jpg,.jpeg,.png,.heic,image/jpeg,image/png,image/heic"
              onChange={handleSiteUpload}
            />
            <button 
              type="button"
              onClick={() => siteInputRef.current?.click()}
              disabled={uploadingSite}
              className="w-full flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-50"
            >
              {uploadingSite ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
              <span>{uploadingSite ? 'Uploading...' : 'Add More Photos'}</span>
            </button>
          </div>
        )}
      </div>

      {canProgress && (
        <button
          onClick={handleSubmit}
          disabled={submitting || !gpsPhoto}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#00C2FF] text-white font-bold rounded-xl hover:bg-[#0091C2] transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none"
        >
          {submitting ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
          Submit Installation Photos
        </button>
      )}
    </div>
  );
}
