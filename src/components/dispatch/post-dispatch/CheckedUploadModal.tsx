'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Loader2, Upload, AlertCircle, Trash2, AlertTriangle, Eye, ArrowDownToLine } from 'lucide-react';
import toast from 'react-hot-toast';
import { compressImage } from '@/lib/image-compress';
import MobileImagePreview from '@/components/mobile/MobileImagePreview';

export interface ImportedEvidenceItem {
  id: string;
  fileName: string;
  url: string;
  uploadedAt?: string;
  source: 'RECEIVING';
}

interface CheckedUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  currentUserName?: string;
  initialImportedEvidence?: ImportedEvidenceItem[];
  onSuccess: () => void;
}

export default function CheckedUploadModal({
  isOpen,
  onClose,
  invoiceId,
  invoiceNumber,
  customerName,
  currentUserName,
  initialImportedEvidence,
  onSuccess,
}: CheckedUploadModalProps) {
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [importedPhotos, setImportedPhotos] = useState<ImportedEvidenceItem[]>(initialImportedEvidence || []);
  const [loadingImported, setLoadingImported] = useState(false);
  const [previewModal, setPreviewModal] = useState<{ isOpen: boolean; url: string | null; title: string }>({
    isOpen: false,
    url: null,
    title: '',
  });

  const [checkedBy, setCheckedBy] = useState(currentUserName || '');
  // Format current local date-time for datetime-local input (YYYY-MM-DDTHH:mm)
  const nowStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  const [checkedAt, setCheckedAt] = useState(nowStr);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-fetch eligible receiving check evidence if not provided via props
  useEffect(() => {
    if (!isOpen || !invoiceId) return;

    if (initialImportedEvidence && initialImportedEvidence.length > 0) {
      setImportedPhotos(initialImportedEvidence);
      return;
    }

    let isMounted = true;
    const fetchReceivingEvidence = async () => {
      setLoadingImported(true);
      try {
        const res = await fetch(`/api/mobile/post-dispatch/invoices/${invoiceId}`);
        if (!res.ok) return;

        const data = await res.json();
        const invoice = data?.invoice;
        if (!invoice || !isMounted) return;

        // Locate receiving workflow
        const receivingWf = invoice.workflows?.find((w: any) => w.workflowType === 'RECEIVING');
        if (!receivingWf || !receivingWf.submissions || receivingWf.submissions.length === 0) {
          return;
        }

        // Submissions are ordered descending by submissionNumber
        const latestSubmission = receivingWf.submissions[0];

        // ELIGIBILITY RULE:
        // Must be APPROVED or AWAITING_VERIFICATION.
        // REJECTED submissions must NEVER be imported.
        if (latestSubmission.status !== 'APPROVED' && latestSubmission.status !== 'AWAITING_VERIFICATION') {
          return;
        }

        if (latestSubmission.files && latestSubmission.files.length > 0) {
          const importedItems: ImportedEvidenceItem[] = latestSubmission.files.map((f: any) => ({
            id: f.id,
            fileName: f.fileName,
            url: `/api/dispatch/post-dispatch/files/${f.id}`,
            uploadedAt: f.uploadedAt,
            source: 'RECEIVING',
          }));
          if (isMounted) {
            setImportedPhotos(importedItems);
          }
        }
      } catch (err) {
        console.error('[CheckedUploadModal] Error fetching receiving evidence:', err);
      } finally {
        if (isMounted) {
          setLoadingImported(false);
        }
      }
    };

    fetchReceivingEvidence();

    return () => {
      isMounted = false;
    };
  }, [isOpen, invoiceId, initialImportedEvidence]);

  if (!isOpen) return null;

  const totalEvidenceCount = photos.length + importedPhotos.length;

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

  const handleRemoveImportedPhoto = (index: number) => {
    setImportedPhotos((prev) => {
      const copy = [...prev];
      copy.splice(index, 1);
      return copy;
    });
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    // Prevent duplicate triggers if already submitting
    if (submitting) return;

    if (!checkedBy.trim()) {
      const msg = 'Checked By name is required.';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (!checkedAt) {
      const msg = 'Checked At timestamp is required.';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (totalEvidenceCount === 0) {
      const msg = 'At least one photo is required.';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      // Step 1: Prepare files to upload
      const filesToSubmit: File[] = [];
      const MAX_ALLOWED_FILE_SIZE = 15 * 1024 * 1024; // 15MB safety ceiling

      // A: Process and compress newly captured camera photos
      for (const p of photos) {
        const result = await compressImage(p.file, { maxEdge: 1600, quality: 0.8 });

        if (result.file.size > MAX_ALLOWED_FILE_SIZE) {
          throw new Error(
            `Photo "${p.file.name}" is too large (${(result.file.size / (1024 * 1024)).toFixed(1)}MB). Please retake the photo and try again.`
          );
        }
        filesToSubmit.push(result.file);
      }

      // B: Include imported receiving evidence as File objects for backend compatibility
      for (const imp of importedPhotos) {
        try {
          const res = await fetch(imp.url);
          if (!res.ok) {
            throw new Error(`Failed to load imported evidence "${imp.fileName}".`);
          }
          const blob = await res.blob();
          const file = new File([blob], imp.fileName, { type: blob.type || 'image/jpeg' });
          filesToSubmit.push(file);
        } catch (fetchErr: any) {
          throw new Error(fetchErr?.message || `Failed to process imported evidence "${imp.fileName}".`);
        }
      }

      if (filesToSubmit.length === 0) {
        throw new Error('At least one valid photo is required.');
      }

      const formData = new FormData();
      formData.append('checkedBy', checkedBy.trim());
      formData.append('checkedAt', new Date(checkedAt).toISOString());
      filesToSubmit.forEach((file) => {
        formData.append('files', file);
      });

      // Step 2: Dispatch request with network failure catch
      let res: Response;
      try {
        res = await fetch(`/api/mobile/post-dispatch/checked/upload/${invoiceId}`, {
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
            throw new Error('Invalid upload data. Please verify your photo and check details.');
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

      toast.success(successData?.message || 'Checked evidence uploaded successfully!');

      // Cleanup previews on confirmed success
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setPhotos([]);
      setImportedPhotos([]);
      setErrorMessage(null);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('[Checked Upload Error]', err);
      const msg = err instanceof Error ? err.message : 'Photo could not be uploaded. Please try again.';
      setErrorMessage(msg);
      toast.error(msg);
      // NOTE: Modal remains open and captured photos are preserved in state so user doesn't lose evidence
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pt-[max(1rem,env(safe-area-inset-top)+0.75rem)] pb-[max(1rem,env(safe-area-inset-bottom)+0.75rem)] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl w-full max-w-md max-h-[calc(100dvh-env(safe-area-inset-top)-2.5rem)] flex flex-col shadow-2xl overflow-hidden border border-slate-100 my-auto">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
            <div>
              <h3 className="font-bold text-[#1A2766] text-base">Checked By / Checked At</h3>
              <p className="text-xs text-slate-500 truncate max-w-[260px]">
                {invoiceNumber} • {customerName}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={submitting}
              className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Body */}
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

            {/* Imported Receiving Evidence Section */}
            {importedPhotos.length > 0 && (
              <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-600" />
                    Receiving Evidence ({importedPhotos.length})
                  </span>
                  <span className="text-[10px] bg-emerald-100/90 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                    Preloaded
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {importedPhotos.map((imp, idx) => (
                    <div
                      key={imp.id || idx}
                      className="group relative rounded-xl overflow-hidden border border-emerald-300/80 bg-white shadow-sm flex flex-col"
                    >
                      {/* Image Thumbnail */}
                      <div
                        className="relative aspect-[4/3] bg-slate-100 cursor-pointer overflow-hidden"
                        onClick={() =>
                          setPreviewModal({
                            isOpen: true,
                            url: imp.url,
                            title: `Receiving Evidence - ${imp.fileName}`,
                          })
                        }
                      >
                        <img
                          src={imp.url}
                          alt={imp.fileName}
                          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="bg-black/60 text-white text-[11px] px-2 py-1 rounded-md flex items-center gap-1">
                            <Eye className="w-3 h-3" /> Preview
                          </span>
                        </div>
                      </div>

                      {/* Exact Badge & Delete action */}
                      <div className="p-2 bg-white flex flex-col justify-between gap-1">
                        <span className="text-[10px] font-semibold text-emerald-700 leading-tight">
                          Imported from uploaded receiving
                        </span>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewModal({
                                isOpen: true,
                                url: imp.url,
                                title: `Receiving Evidence - ${imp.fileName}`,
                              })
                            }
                            className="text-[11px] text-blue-600 font-medium hover:underline flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveImportedPhoto(idx)}
                            disabled={submitting}
                            className="text-slate-400 hover:text-red-600 text-[11px] transition-colors p-1"
                            title="Remove imported evidence"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-emerald-800/90 font-medium">
                  ✓ Automatically counted toward check evidence requirement. You may also capture additional photos below.
                </p>
              </div>
            )}

            {/* Camera Capture */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Physical Check Evidence (Camera Only) {importedPhotos.length === 0 && '*'}
              </label>

              {/* Camera Framing Guidance Box */}
              <div className="mb-3 p-3 rounded-2xl bg-purple-50/70 border border-purple-200/80 flex flex-col items-center text-center">
                {/* Subtle Document Frame Outline */}
                <div className="w-48 h-28 my-1 rounded-xl border-2 border-dashed border-purple-400/80 bg-white/60 flex flex-col items-center justify-center p-2 relative shadow-inner">
                  <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 border-purple-600" />
                  <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-purple-600" />
                  <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 border-purple-600" />
                  <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 border-purple-600" />
                  <Camera className="w-5 h-5 text-purple-500 mb-1" />
                  <span className="text-[11px] font-bold text-purple-900 tracking-tight">CHECK EVIDENCE</span>
                  <span className="text-[9px] text-purple-600 font-medium">DOCUMENT FRAME</span>
                </div>
                <p className="text-[12px] font-semibold text-purple-900 mt-1.5">
                  Capture the complete document clearly.
                </p>
                <p className="text-[11px] text-purple-700/80">
                  Fit all serial numbers and check details within the frame.
                </p>
              </div>

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
                className="w-full py-3.5 px-4 rounded-2xl bg-[#1A2766] hover:bg-[#131d4d] active:scale-[0.98] text-white font-bold flex items-center justify-center gap-2 transition-all shadow-sm shadow-blue-950/20"
              >
                <Camera className="w-4 h-4" />
                <span className="text-sm">
                  {photos.length === 0 ? 'Open Camera & Capture' : 'Take Another Photo'}
                </span>
                <span className="text-[11px] font-normal text-purple-200">
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

            {/* Total Evidence Status Indicator */}
            <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Total Evidence Attached:</span>
              <span className="font-bold text-slate-900">
                {totalEvidenceCount} {totalEvidenceCount === 1 ? 'photo' : 'photos'}
                {importedPhotos.length > 0 && photos.length > 0 && (
                  <span className="text-slate-500 font-normal ml-1">
                    ({importedPhotos.length} imported + {photos.length} camera)
                  </span>
                )}
              </span>
            </div>

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
          <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex gap-2 shrink-0">
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
              disabled={submitting || totalEvidenceCount === 0 || !checkedBy.trim()}
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

      {/* Fullscreen Preview for Imported Receiving Images */}
      <MobileImagePreview
        isOpen={previewModal.isOpen}
        onClose={() => setPreviewModal({ isOpen: false, url: null, title: '' })}
        imageUrl={previewModal.url}
        title={previewModal.title}
        subtitle="Physical Check Evidence"
      />
    </>
  );
}
