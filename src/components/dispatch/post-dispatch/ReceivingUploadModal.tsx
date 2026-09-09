'use client';

import React, { useState, useRef } from 'react';
import { Camera, X, Loader2, Upload, AlertCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

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
  };

  const handleSubmit = async () => {
    if (photos.length === 0) {
      toast.error('At least one photo is required.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('receivingDetails', receivingDetails.trim());
      photos.forEach((p) => {
        formData.append('files', p.file);
      });

      const res = await fetch(`/api/mobile/post-dispatch/receiving/upload/${invoiceId}`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Photo could not be uploaded. Please try again.');
      }

      toast.success('Receiving proof uploaded successfully!');
      // Cleanup previews
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setPhotos([]);
      setReceivingDetails('');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('[Receiving Upload Error]', err);
      const msg = err instanceof Error ? err.message : 'Photo could not be uploaded. Please try again.';
      toast.error(msg);
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
          {/* Camera Capture Section */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Customer Receiving Proof (Camera Only) *
            </label>

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
              className="w-full py-4 px-4 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 text-blue-700 font-semibold flex flex-col items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <Camera className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold">Take Photo with Camera</span>
              <span className="text-xs text-slate-500 font-normal">
                {photos.length === 0 ? 'At least 1 photo required' : `${photos.length} photo(s) captured`}
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
