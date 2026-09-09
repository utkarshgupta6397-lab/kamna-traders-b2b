'use client';

import React, { useState, useRef } from 'react';
import { Camera, X, Loader2, Upload, AlertCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface CheckedUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  currentUserName?: string;
  onSuccess: () => void;
}

export default function CheckedUploadModal({
  isOpen,
  onClose,
  invoiceId,
  invoiceNumber,
  customerName,
  currentUserName,
  onSuccess,
}: CheckedUploadModalProps) {
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [checkedBy, setCheckedBy] = useState(currentUserName || '');
  // Format current local date-time for datetime-local input (YYYY-MM-DDTHH:mm)
  const nowStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  const [checkedAt, setCheckedAt] = useState(nowStr);
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
    if (!checkedBy.trim()) {
      toast.error('Checked By name is required.');
      return;
    }

    if (!checkedAt) {
      toast.error('Checked At timestamp is required.');
      return;
    }

    if (photos.length === 0) {
      toast.error('At least one photo is required.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('checkedBy', checkedBy.trim());
      formData.append('checkedAt', new Date(checkedAt).toISOString());
      photos.forEach((p) => {
        formData.append('files', p.file);
      });

      const res = await fetch(`/api/mobile/post-dispatch/checked/upload/${invoiceId}`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Photo could not be uploaded. Please try again.');
      }

      toast.success('Checked evidence uploaded successfully!');
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setPhotos([]);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[Checked Upload Error]', err);
      toast.error(err.message || 'Photo could not be uploaded. Please try again.');
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
            <h3 className="font-bold text-[#1A2766] text-base">Checked By / Checked At</h3>
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

        {/* Form Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Camera Capture */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Physical Check Evidence (Camera Only) *
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleCapture}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
              className="w-full py-4 px-4 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 text-blue-700 font-semibold flex flex-col items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <Camera className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold">Capture Check Photo</span>
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
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200">
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

          {/* Checked By (manual entry, does not have to equal logged-in uploader) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Checked By *
            </label>
            <input
              type="text"
              value={checkedBy}
              onChange={(e) => setCheckedBy(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              disabled={submitting}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Enter the name of the staff member who conducted the physical check.
            </span>
          </div>

          {/* Checked At (manual entry) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Checked At *
            </label>
            <input
              type="datetime-local"
              value={checkedAt}
              onChange={(e) => setCheckedAt(e.target.value)}
              disabled={submitting}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
            />
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200/60 p-3 text-xs text-amber-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Once submitted, physical check evidence becomes <strong>immutable</strong> and will be queued for verifier review.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
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
            disabled={submitting || photos.length === 0 || !checkedBy.trim()}
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
                <span>Submit Evidence</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
