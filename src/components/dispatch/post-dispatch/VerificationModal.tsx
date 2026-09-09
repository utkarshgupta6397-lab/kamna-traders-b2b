'use client';

import React, { useState } from 'react';
import { CheckCircle2, RotateCcw, X, Loader2, ShieldAlert, User, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

interface SubmissionFile {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
}

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowType: 'RECEIVING' | 'CHECKED';
  submissionId: string;
  invoiceNumber: string;
  customerName: string;
  uploadedByUserName: string;
  uploadedByUserId: string;
  uploadedAt: string;
  receivingDetails?: string | null;
  checkedBy?: string | null;
  checkedAt?: string | null;
  files: SubmissionFile[];
  currentUserId?: string;
  onSuccess: () => void;
  onPhotoClick: (url: string, title?: string) => void;
}

export default function VerificationModal({
  isOpen,
  onClose,
  workflowType,
  submissionId,
  invoiceNumber,
  customerName,
  uploadedByUserName,
  uploadedByUserId,
  uploadedAt,
  receivingDetails,
  checkedBy,
  checkedAt,
  files,
  currentUserId,
  onSuccess,
  onPhotoClick,
}: VerificationModalProps) {
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const isSelfUploader = Boolean(currentUserId && currentUserId === uploadedByUserId);
  const isReceiving = workflowType === 'RECEIVING';

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      const endpoint = isReceiving
        ? `/api/mobile/post-dispatch/receiving/verify/${submissionId}`
        : `/api/mobile/post-dispatch/checked/verify/${submissionId}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to update verification status.');
      }

      toast.success('Submission verified and approved!');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('[Verify Approve Error]', err);
      const msg = err instanceof Error ? err.message : 'Unable to update verification status.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Rejection reason is required.');
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = isReceiving
        ? `/api/mobile/post-dispatch/receiving/verify/${submissionId}`
        : `/api/mobile/post-dispatch/checked/verify/${submissionId}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REJECT',
          comment: rejectionReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to update verification status.');
      }

      toast.success('Submission rejected and marked for rework.');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('[Verify Reject Error]', err);
      const msg = err instanceof Error ? err.message : 'Unable to update verification status.';
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
            <h3 className="font-bold text-[#1A2766] text-base">
              Verify {isReceiving ? 'Customer Receiving' : 'Physical Check'}
            </h3>
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

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Uploader restriction warning */}
          {isSelfUploader && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-800 flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">Self-Verification Not Allowed</span>
                You uploaded this submission. Another authorized verifier must review and verify it.
              </div>
            </div>
          )}

          {/* Submission Info Cards */}
          <div className="bg-slate-50 rounded-2xl p-3.5 space-y-2 border border-slate-100 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Uploaded By
              </span>
              <span className="font-semibold text-slate-800">{uploadedByUserName}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Uploaded At
              </span>
              <span className="font-semibold text-slate-800">
                {new Date(uploadedAt).toLocaleString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })}
              </span>
            </div>

            {/* Workflow Specific Details */}
            {isReceiving && receivingDetails && (
              <div className="pt-2 border-t border-slate-200/60">
                <span className="text-slate-500 block mb-0.5">Receiving Details:</span>
                <span className="font-medium text-slate-800">{receivingDetails}</span>
              </div>
            )}

            {!isReceiving && (
              <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Checked By:</span>
                  <span className="font-bold text-blue-900">{checkedBy || 'Not specified'}</span>
                </div>
                {checkedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Checked At:</span>
                    <span className="font-medium text-slate-800">
                      {new Date(checkedAt).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Evidence Photos */}
          <div>
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Submitted Photos ({files.length})
            </span>
            <div className="grid grid-cols-2 gap-3">
              {files.map((file, idx) => {
                const fileUrl = `/api/dispatch/post-dispatch/files/${file.id}`;
                return (
                  <div
                    key={file.id}
                    onClick={() => onPhotoClick(fileUrl, `${invoiceNumber} Evidence #${idx + 1}`)}
                    className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 cursor-pointer group shadow-sm bg-slate-100"
                  >
                    <img
                      src={fileUrl}
                      alt={file.fileName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                      Tap to view
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rejection Comment Input (when rejecting) */}
          {rejecting && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
              <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider">
                Reason for Rejection *
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Customer stamp not visible, photo is blurry..."
                disabled={submitting}
                className="w-full p-2.5 rounded-xl border border-amber-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-800 placeholder:text-slate-400 bg-white"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setRejecting(false)}
                  disabled={submitting}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={submitting || !rejectionReason.trim()}
                  className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  Confirm Rejection
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!rejecting && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex gap-2">
            <button
              type="button"
              onClick={() => setRejecting(true)}
              disabled={submitting || isSelfUploader}
              className="flex-1 py-3 px-4 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-sm flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reject & Reopen</span>
            </button>

            <button
              type="button"
              onClick={handleApprove}
              disabled={submitting || isSelfUploader}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-900/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Approving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
