'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, X, CheckCircle2, Loader2, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

interface WorkflowInstallationUploaderProps {
  orderId: string;
  onComplete: () => void;
  canProgress: boolean;
}

export default function WorkflowInstallationUploader({ orderId, onComplete, canProgress }: WorkflowInstallationUploaderProps) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, [orderId]);

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`/api/solar-orders/${orderId}/files`);
      const data = await res.json();
      if (res.ok) {
        // We only care about installation photos
        const installPhotos = data.files.filter((f: any) => f.documentType === 'INSTALLATION_PHOTO');
        setDocuments(installPhotos);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (files: FileList) => {
    const acceptedTypes = ['.jpg', '.jpeg', '.png', '.heic', 'image/jpeg', 'image/png', 'image/heic'];
    const maxMb = 5;

    if (documents.length + files.length > 10) {
      toast.error('Maximum 10 photos allowed');
      return;
    }

    setUploading(true);
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > maxMb * 1024 * 1024) {
        toast.error(`File ${file.name} exceeds ${maxMb}MB`);
        continue;
      }

      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!acceptedTypes.includes(fileExtension) && !acceptedTypes.includes(file.type)) {
         toast.error(`Invalid format for ${file.name}`);
         continue;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        const uploadData = await uploadRes.json();
        
        if (uploadRes.ok) {
          // Immediately save to db as INSTALLATION_PHOTO
          const dbRes = await fetch(`/api/solar-orders/${orderId}/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              documentType: 'INSTALLATION_PHOTO',
              fileCategory: 'INSTALLATION', // File gallery uses category to filter
              fileName: uploadData.fileName,
              fileUrl: uploadData.url,
              fileType: uploadData.mimeType,
              fileSizeBytes: uploadData.fileSize
            })
          });

          if (dbRes.ok) {
             successCount++;
          }
        }
      } catch (e) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} photo(s) uploaded`);
      await fetchDocuments();
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (fileId: string) => {
    try {
      const res = await fetch(`/api/solar-orders/${orderId}/files?fileId=${fileId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success('Photo deleted');
        setDocuments(prev => prev.filter(d => d.id !== fileId));
      } else {
        toast.error('Failed to delete photo');
      }
    } catch (e) {
      toast.error('Network error');
    }
  };

  const handleSubmit = async () => {
    if (documents.length === 0) {
      toast.error('Please upload at least one photo');
      return;
    }
    setSubmitting(true);
    // Photos are already saved to db, just complete stage
    onComplete();
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-full">
        <Loader2 className="animate-spin text-[#00C2FF]" size={32} />
      </div>
    );
  }

  return (
    <div className="bg-white p-6 h-full flex flex-col">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Rooftop Photos</h3>
        <p className="text-sm text-gray-500">Upload site evidence. Max 10 photos (JPEG, PNG, HEIC). Max 5MB each.</p>
      </div>

      <div className="flex-1 overflow-y-auto mb-6 pr-2 space-y-4">
        {documents.map(doc => (
          <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
            <div className="w-12 h-12 bg-white rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
               {doc.fileType?.includes('image') ? (
                 <img src={doc.fileUrl} alt={doc.fileName} className="w-full h-full object-cover" />
               ) : (
                 <ImageIcon className="text-gray-400" size={24} />
               )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{doc.fileName}</p>
              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#00C2FF] hover:underline">View</a>
            </div>
            {canProgress && (
              <button onClick={() => handleDelete(doc.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <X size={18} />
              </button>
            )}
          </div>
        ))}

        {canProgress && documents.length < 10 && (
          <div className="relative">
            <input 
              type="file"
              multiple
              ref={fileInputRef}
              className="hidden"
              accept=".jpg,.jpeg,.png,.heic,image/jpeg,image/png,image/heic"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileUpload(e.target.files);
                }
              }}
            />
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-[#00C2FF]/30 rounded-xl text-sm font-bold text-[#00C2FF] hover:border-[#00C2FF] hover:bg-[#E5FAFF] transition-all disabled:opacity-50"
            >
              {uploading ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
              <span>{uploading ? 'Uploading...' : 'Click to Upload Photos'}</span>
            </button>
          </div>
        )}
      </div>

      {canProgress && (
        <button
          onClick={handleSubmit}
          disabled={submitting || documents.length === 0}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#00C2FF] text-white font-bold rounded-xl hover:bg-[#0091C2] transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none"
        >
          {submitting ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
          Submit Photos
        </button>
      )}
    </div>
  );
}
