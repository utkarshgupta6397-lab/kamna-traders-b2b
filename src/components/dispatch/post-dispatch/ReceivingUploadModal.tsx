'use client';

import React, { useState, useRef } from 'react';
import { Camera, X, Loader2, Upload, AlertCircle, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { compressImage } from '@/lib/image-compress';

interface ReceivingUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  onSuccess: () => void;
}

export default function ReceivingUploadModal({
  isOpen,
  onClose,
  invoiceId,
  invoiceNumber,
  customerName,
  onSuccess,
}: ReceivingUploadModalProps) {
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [receivingDetails, setReceivingDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const newPhotos = newFiles.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));
      setPhotos((prev) => [...prev, ...newPhotos]);
      setErrorMessage(null);
    }
    // Reset input so same photo can be retaken if deleted
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].preview);
      copy.splice(index, 1);
      return copy;
    });
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    // Prevent duplicate triggers if already submitting
    if (submitting) return;

    if (photos.length === 0) {
      const msg = 'At least one photo is required.';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      // Step 1: Compress images client-side (each captured photo processed once)
      const compressedFiles: File[] = [];
      const MAX_ALLOWED_FILE_SIZE = 15 * 1024 * 1024; // 15MB safety ceiling

      for (const p of photos) {
        const result = await compressImage(p.file, { maxEdge: 1600, quality: 0.8 });
        
        // Safety check if single file is still excessively large (> 15MB)
        if (result.file.size > MAX_ALLOWED_FILE_SIZE) {
          throw new Error(
            `Photo "${p.file.name}" is too large (${(result.file.size / (1024 * 1024)).toFixed(1)}MB). Please retake the photo and try again.`
          );
        }
        compressedFiles.push(result.file);
      }

      const formData = new FormData();
      formData.append('receivingDetails', receivingDetails.trim());
      compressedFiles.forEach((file) => {
        formData.append('files', file);
      });

      // Step 2: Dispatch request with network failure catch
      let res: Response;
      try {
        res = await fetch(`/api/mobile/post-dispatch/receiving/upload/${invoiceId}`, {
          method: 'POST',
          body: formData,
        });
      } catch (fetchErr) {
        throw new Error('Unable to upload. Please check your connection and try again.');
      }

      // Step 3: Robust HTTP status & non-JSON handling
      if (!res.ok) {
        let serverErrorMsg: string | null = null;
        const contentType = res.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
          try {
            const data = await res.json();
            if (data?.error && typeof data.error === 'string') {
              serverErrorMsg = data.error;
            }
          } catch {
            // Non-valid JSON despite header
          }
        }

        if (serverErrorMsg) {
          throw new Error(serverErrorMsg);
        }

        // Status code specific user-friendly fallbacks
        switch (res.status) {
          case 400:
            throw new Error('Invalid upload data. Please verify your photo and details.');
          case 401:
          case 403:
            throw new Error('You are not authorized to submit this proof.');
          case 413:
            throw new Error('Photo is too large. Please retake the photo and try again.');
          case 429:
            throw new Error('Too many requests. Please wait a moment and try again.');
          default:
            if (res.status >= 500) {
              throw new Error('Upload service is temporarily unavailable. Please try again.');
            }
            throw new Error(`Upload failed (Status ${res.status}). Please try again.`);
        }
      }

      // Verify successful JSON response
      let successData: any = null;
      try {
        successData = await res.json();
      } catch {
        // Successful status but unexpected body format
      }

      toast.success(successData?.message || 'Receiving proof uploaded successfully!');

      // Cleanup previews on confirmed success
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setPhotos([]);
      setReceivingDetails('');
      setErrorMessage(null);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('[Receiving Upload Error]', err);
      const msg = err instanceof Error ? err.message : 'Photo could not be uploaded. Please try again.';
      setErrorMessage(msg);
      toast.error(msg);
      // NOTE: Modal remains open and captured photos are preserved in state so user doesn't lose evidence
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="font-bold text-[#1A2766] text-base">Receiving Upload</h3>
            <p className="text-xs text-slate-500 truncate max-w-[260px]">
              {invoiceNumber} • {customerName}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-red-400 hover:text-red-600 text-xs shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Camera Capture Section */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Customer Receiving Proof (Camera Only) *
            </label>

            {/* Camera Framing Guidance Box */}
            <div className="mb-3 p-3 rounded-2xl bg-blue-50/70 border border-blue-200/80 flex flex-col items-center text-center">
              {/* Subtle Document Frame Outline */}
              <div className="w-48 h-28 my-1 rounded-xl border-2 border-dashed border-blue-400/80 bg-white/60 flex flex-col items-center justify-center p-2 relative shadow-inner">
                <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 border-blue-600" />
                <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-blue-600" />
                <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 border-blue-600" />
                <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 border-blue-600" />
                <Camera className="w-5 h-5 text-blue-500 mb-1" />
                <span className="text-[11px] font-bold text-blue-900 tracking-tight">RECEIVING PROOF</span>
                <span className="text-[9px] text-blue-600 font-medium">DOCUMENT FRAME</span>
              </div>
              <p className="text-[12px] font-semibold text-blue-900 mt-1.5">
                Fit the complete receiving proof inside the frame.
              </p>
              <p className="text-[11px] text-blue-700/80">
                Ensure customer signature, delivery address, and date are readable.
              </p>
            </div>

            {/* Hidden native camera-only file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleCapture}
              className="hidden"
            />

            {/* Trigger Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#1A2766] hover:bg-[#131d4d] active:scale-[0.98] text-white font-bold flex items-center justify-center gap-2 transition-all shadow-sm shadow-blue-950/20"
            >
              <Camera className="w-4 h-4" />
              <span className="text-sm">
                {photos.length === 0 ? 'Open Camera & Capture' : 'Take Another Photo'}
              </span>
              <span className="text-[11px] font-normal text-blue-200">
                ({photos.length} captured)
              </span>
            </button>
          </div>

          {/* Captured Photos Preview */}
          {photos.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-600">
                Captured Evidence ({photos.length}):
              </span>
              <div className="grid grid-cols-3 gap-2.5">
                {photos.map((p, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group">
                    <img
                      src={p.preview}
                      alt={`Evidence ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      disabled={submitting}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Single-line receiving details */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Receiving Details
            </label>
            <input
              type="text"
              value={receivingDetails}
              onChange={(e) => setReceivingDetails(e.target.value)}
              placeholder="e.g. Received by Mohan (Store Manager), stamp verified"
              disabled={submitting}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder:text-slate-400"
            />
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200/60 p-3 text-xs text-amber-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Once submitted, evidence becomes <strong>immutable</strong> and will be queued for verifier review.
            </span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || photos.length === 0}
            className="flex-1 py-3 px-4 rounded-xl bg-[#1A2766] hover:bg-[#141f52] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-900/10"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Submit Proof</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
