'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Building2,
  Calendar,
  CreditCard,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Camera,
  Check,
  X,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import PaymentStatusBadge from '@/components/mobile/manage-payments/PaymentStatusBadge';
import MobileImagePreview from '@/components/mobile/MobileImagePreview';
import { formatIndianCurrency } from '@/lib/formatters';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface PaymentDetailProps {
  payment: {
    id: string;
    requestNumber: string;
    customerId: string;
    customerName: string;
    amount: number;
    paymentDate: string;
    paymentMode: string;
    photoUrl?: string | null;
    status: string;
    createdById: string;
    createdAt: string;
    submittedAt: string;
    approvedById?: string | null;
    approvedAt?: string | null;
    rejectedById?: string | null;
    rejectedAt?: string | null;
    rejectionReason?: string | null;
    zohoPaymentId?: string | null;
    zohoSyncStatus?: string | null;
    zohoSyncedAt?: string | null;
    zohoSyncError?: string | null;
    zohoSyncAttempts?: number;
    lastZohoSyncAttemptAt?: string | null;
    customer?: {
      id: string;
      name: string;
      gstNumber?: string | null;
      status?: string;
    } | null;
    createdBy?: {
      id: string;
      name: string;
      role?: string;
    } | null;
    approvedBy?: {
      id: string;
      name: string;
    } | null;
    rejectedBy?: {
      id: string;
      name: string;
    } | null;
  };
  canApprove?: boolean;
  canReject?: boolean;
}

const REJECTION_REASONS = [
  'Incorrect amount',
  'Incorrect customer',
  'Wrong payment date',
  'Duplicate payment',
  'Missing payment proof',
  'Other',
];

export default function PaymentDetailClient({
  payment: initialPayment,
  canApprove = false,
  canReject = false,
}: PaymentDetailProps) {
  const [payment, setPayment] = useState(initialPayment);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Approval & Decline States
  const [isApproving, setIsApproving] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [isRetryingSync, setIsRetryingSync] = useState(false);
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [declineComment, setDeclineComment] = useState<string>('');

  // Formatted dates
  let formattedPaymentDate = payment.paymentDate;
  try {
    formattedPaymentDate = format(new Date(payment.paymentDate), 'dd MMMM yyyy');
  } catch (e) {
    formattedPaymentDate = payment.paymentDate;
  }

  let formattedSubmittedAt = payment.submittedAt || payment.createdAt;
  try {
    formattedSubmittedAt = format(
      new Date(payment.submittedAt || payment.createdAt),
      'dd MMM yyyy, hh:mm a'
    );
  } catch (e) {
    formattedSubmittedAt = String(payment.createdAt);
  }

  let formattedApprovedAt = payment.approvedAt;
  if (payment.approvedAt) {
    try {
      formattedApprovedAt = format(new Date(payment.approvedAt), 'dd MMM yyyy, hh:mm a');
    } catch (e) {
      formattedApprovedAt = String(payment.approvedAt);
    }
  }

  let formattedRejectedAt = payment.rejectedAt;
  if (payment.rejectedAt) {
    try {
      formattedRejectedAt = format(new Date(payment.rejectedAt), 'dd MMM yyyy, hh:mm a');
    } catch (e) {
      formattedRejectedAt = String(payment.rejectedAt);
    }
  }

  let formattedZohoSyncedAt = payment.zohoSyncedAt;
  if (payment.zohoSyncedAt) {
    try {
      formattedZohoSyncedAt = format(new Date(payment.zohoSyncedAt), 'dd MMM yyyy, hh:mm a');
    } catch (e) {
      formattedZohoSyncedAt = String(payment.zohoSyncedAt);
    }
  }

  // Handle Approve Action
  const handleApprove = async () => {
    if (isApproving || payment.status !== 'PENDING_APPROVAL') return;

    const confirmed = window.confirm(
      `Are you sure you want to approve payment #${payment.requestNumber} for ${formatIndianCurrency(
        payment.amount,
        false
      )}? This will create a Customer Advance in Zoho Books.`
    );
    if (!confirmed) return;

    setIsApproving(true);
    const toastId = toast.loading('Creating Customer Advance in Zoho Books & approving...');

    try {
      const res = await fetch(`/api/mobile/manage-payments/${payment.id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.zohoSyncError) {
          setPayment((prev) => ({
            ...prev,
            zohoSyncStatus: data.zohoSyncStatus || 'ZOHO_SYNC_FAILED',
            zohoSyncError: data.zohoSyncError,
          }));
        }
        throw new Error(data.error || 'Failed to approve payment');
      }

      setPayment((prev) => ({
        ...prev,
        ...data.payment,
        amount: Number(data.payment.amount),
      }));

      toast.success('Approved and synced to Zoho Books successfully', { id: toastId });
    } catch (err: any) {
      console.error('Approve error:', err);
      toast.error(err?.message || 'Failed to approve payment', { id: toastId });
    } finally {
      setIsApproving(false);
    }
  };

  // Handle Retry Zoho Sync Action
  const handleRetrySync = async () => {
    if (isRetryingSync) return;
    setIsRetryingSync(true);
    const toastId = toast.loading('Syncing Customer Advance to Zoho Books...');

    try {
      const res = await fetch(`/api/mobile/manage-payments/${payment.id}/sync-zoho`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.zohoSyncError) {
          setPayment((prev) => ({
            ...prev,
            zohoSyncStatus: data.zohoSyncStatus || 'ZOHO_SYNC_FAILED',
            zohoSyncError: data.zohoSyncError,
          }));
        }
        throw new Error(data.error || 'Failed to sync with Zoho Books');
      }

      setPayment((prev) => ({
        ...prev,
        ...data.payment,
        amount: Number(data.payment.amount),
      }));

      toast.success('Successfully synced with Zoho Books', { id: toastId });
    } catch (err: any) {
      console.error('Zoho sync error:', err);
      toast.error(err?.message || 'Failed to sync with Zoho Books', { id: toastId });
    } finally {
      setIsRetryingSync(false);
    }
  };

  // Handle Decline Action
  const handleConfirmDecline = async () => {
    if (!selectedReason) {
      toast.error('Please select a decline reason');
      return;
    }

    if (selectedReason === 'Other' && !declineComment.trim()) {
      toast.error('Please provide a comment for "Other"');
      return;
    }

    setIsDeclining(true);
    const toastId = toast.loading('Declining payment request...');

    try {
      const res = await fetch(`/api/mobile/manage-payments/${payment.id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: selectedReason,
          comment: declineComment.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to decline payment');
      }

      setPayment((prev) => ({
        ...prev,
        ...data.payment,
        amount: Number(data.payment.amount),
      }));

      setIsDeclineModalOpen(false);
      setSelectedReason('');
      setDeclineComment('');
      toast.success('Payment request declined', { id: toastId });
    } catch (err: any) {
      console.error('Decline error:', err);
      toast.error(err?.message || 'Failed to decline payment', { id: toastId });
    } finally {
      setIsDeclining(false);
    }
  };

  const isPending = payment.status === 'PENDING_APPROVAL';
  const showApprovalArea = isPending && (canApprove || canReject);

  return (
    <div className="flex-1 flex flex-col font-sans min-h-0 bg-[#F8F9FB]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)] shrink-0">
        <div className="flex items-center justify-between px-2 min-h-[56px] py-1">
          <Link
            href="/mobile/accounts/manage-payments"
            className="flex items-center gap-1 px-3 py-2 active:opacity-60 transition-opacity"
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="font-bold text-[15px]">Payments</span>
          </Link>

          <span className="font-bold text-[16px] tracking-tight">Payment Details</span>

          <div className="w-16" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-5 max-w-[430px] mx-auto w-full flex flex-col gap-4 pb-20">
        {/* Status Card */}
        <div className="bg-white rounded-[20px] p-5 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
              Request Status
            </span>
            <PaymentStatusBadge status={payment.status} size="md" />
          </div>

          <div className="text-xs text-slate-500 font-medium leading-relaxed">
            {payment.status === 'PENDING_APPROVAL' && (
              <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50/70 p-2.5 rounded-xl border border-amber-100">
                <Clock size={16} className="shrink-0 text-amber-600" />
                <span>This payment request has been submitted and is awaiting approval.</span>
              </span>
            )}
            {payment.status === 'APPROVED' && (
              <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                <span>This payment request has been approved.</span>
              </span>
            )}
            {payment.status === 'REJECTED' && (
              <span className="flex items-center gap-1.5 text-red-700 bg-red-50/70 p-2.5 rounded-xl border border-red-100">
                <XCircle size={16} className="shrink-0 text-red-600" />
                <span>This payment request has been declined.</span>
              </span>
            )}
          </div>

          {/* Rejection Reason Banner if Rejected */}
          {payment.status === 'REJECTED' && payment.rejectionReason && (
            <div className="mt-1 bg-red-50/80 border border-red-200/70 rounded-xl p-3 text-xs flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase text-red-700 tracking-wider flex items-center gap-1">
                <AlertTriangle size={13} />
                Decline Reason
              </span>
              <p className="font-semibold text-red-900 leading-snug">
                {payment.rejectionReason}
              </p>
            </div>
          )}

          {/* Zoho Sync Issue Banner if Pending or Failed */}
          {payment.zohoSyncStatus === 'ZOHO_SYNC_FAILED' && payment.zohoSyncError && (
            <div className="mt-1 bg-amber-50/90 border border-amber-200 rounded-xl p-3 text-xs flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase text-amber-800 tracking-wider flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-600" />
                Zoho Books Sync Issue
              </span>
              <p className="font-semibold text-amber-950 leading-snug">
                {payment.zohoSyncError}
              </p>
              {payment.status === 'PENDING_APPROVAL' ? (
                <span className="text-[11px] text-amber-700">
                  Approval was halted. Check Zoho authorization and tap Approve to retry.
                </span>
              ) : (
                canApprove && (
                  <button
                    type="button"
                    onClick={handleRetrySync}
                    disabled={isRetryingSync}
                    className="mt-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs active:scale-[0.98] transition-all disabled:opacity-60"
                  >
                    {isRetryingSync ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <RefreshCw size={13} />
                    )}
                    <span>Retry Zoho Sync</span>
                  </button>
                )
              )}
            </div>
          )}
        </div>

        {/* Phase 2: Action Area (Approve / Decline) */}
        {showApprovalArea && (
          <div className="bg-white rounded-[20px] p-4 border border-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.06)] flex flex-col gap-2.5">
            <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
              Management Decision
            </span>

            <div className="grid grid-cols-2 gap-3 pt-1">
              {canReject && (
                <button
                  type="button"
                  onClick={() => setIsDeclineModalOpen(true)}
                  disabled={isApproving || isDeclining}
                  className="py-3 px-3 rounded-xl font-bold text-sm bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <X size={17} strokeWidth={2.5} />
                  <span>Decline</span>
                </button>
              )}

              {canApprove && (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isApproving || isDeclining}
                  className="py-3 px-3 rounded-xl font-bold text-sm bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isApproving ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <Check size={17} strokeWidth={2.5} />
                  )}
                  <span>Approve</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Customer Information Card */}
        <div className="bg-white rounded-[20px] p-5 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col gap-3">
          <div className="flex items-center gap-2 text-slate-400">
            <Building2 size={16} />
            <span className="text-[11px] uppercase font-bold tracking-wider">
              Customer Information
            </span>
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900 leading-tight">
              {payment.customerName || payment.customer?.name || 'Customer'}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-slate-500">
              <span>Customer ID: {payment.customerId}</span>
              {payment.customer?.gstNumber && (
                <span>GST: {payment.customer.gstNumber}</span>
              )}
            </div>
          </div>
        </div>

        {/* Payment Amount & Details Card */}
        <div className="bg-white rounded-[20px] p-5 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col gap-4">
          <div className="flex items-center gap-2 text-slate-400">
            <CreditCard size={16} />
            <span className="text-[11px] uppercase font-bold tracking-wider">
              Payment Details
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 pb-3 border-b border-slate-50">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Amount</span>
              <span className="text-[22px] font-black text-[#1A2766] tracking-tight">
                {formatIndianCurrency(payment.amount, false)}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Payment Mode</span>
              <span className="inline-block mt-1 px-2.5 py-1 bg-slate-100 text-slate-800 font-extrabold text-xs rounded-md">
                {payment.paymentMode || 'POS'}
              </span>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Payment Date</span>
              <span className="font-bold text-slate-800">{formattedPaymentDate}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Request ID</span>
              <span className="font-mono font-bold text-slate-800">{payment.requestNumber}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Submitted By</span>
              <span className="font-semibold text-slate-800">
                {payment.createdBy?.name || 'Staff User'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Submitted At</span>
              <span className="font-medium text-slate-600">{formattedSubmittedAt}</span>
            </div>

            {/* Approved Metadata */}
            {payment.status === 'APPROVED' && (
              <>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <span className="text-emerald-700 font-semibold">Approved By</span>
                  <span className="font-bold text-emerald-900">
                    {payment.approvedBy?.name || 'Authorized Approver'}
                  </span>
                </div>
                {formattedApprovedAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Approved At</span>
                    <span className="font-medium text-slate-600">{formattedApprovedAt}</span>
                  </div>
                )}

                {/* Zoho Customer Advance Sync Details */}
                <div className="pt-2.5 mt-1 border-t border-slate-100 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Zoho Books Advance</span>
                    {payment.zohoSyncStatus === 'ZOHO_SYNCED' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 size={12} /> Synced
                      </span>
                    ) : payment.zohoSyncStatus === 'ZOHO_SYNC_FAILED' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                        <AlertTriangle size={12} /> Sync Issue
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                        <Loader2 size={12} className="animate-spin" /> Pending
                      </span>
                    )}
                  </div>

                  {payment.zohoPaymentId && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Zoho Payment ID</span>
                      <span className="font-mono font-bold text-slate-800">{payment.zohoPaymentId}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Advance Mode</span>
                    <span className="font-semibold text-slate-700">POS Device</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Deposit Account</span>
                    <span className="font-semibold text-slate-700">Kamna Traders ICICI</span>
                  </div>

                  {formattedZohoSyncedAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Zoho Synced At</span>
                      <span className="font-medium text-slate-600">{formattedZohoSyncedAt}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Rejected Metadata */}
            {payment.status === 'REJECTED' && (
              <>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <span className="text-red-700 font-semibold">Declined By</span>
                  <span className="font-bold text-red-900">
                    {payment.rejectedBy?.name || 'Authorized Reviewer'}
                  </span>
                </div>
                {formattedRejectedAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Declined At</span>
                    <span className="font-medium text-slate-600">{formattedRejectedAt}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Photo Proof Section */}
        {payment.photoUrl && (
          <div className="bg-white rounded-[20px] p-5 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col gap-3">
            <div className="flex items-center gap-2 text-slate-400">
              <Camera size={16} />
              <span className="text-[11px] uppercase font-bold tracking-wider">
                Receipt Proof Photo
              </span>
            </div>

            <div
              onClick={() => setIsPreviewOpen(true)}
              className="relative w-full h-48 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 cursor-pointer group shadow-xs"
            >
              <img
                src={payment.photoUrl}
                alt="Receipt proof photo"
                className="w-full h-full object-contain"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity gap-2 text-xs font-bold">
                <Eye size={18} />
                <span>Tap to view full image</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center font-medium">
              Tap the receipt image to view in high resolution
            </p>
          </div>
        )}

        {/* Immutability / Audit Footer Note */}
        <div className="text-center py-2 px-4 text-slate-400 text-[11px] leading-relaxed">
          Request #{payment.requestNumber} is recorded for audit purposes.
        </div>
      </main>

      {/* Fullscreen Photo Viewer */}
      {payment.photoUrl && (
        <MobileImagePreview
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          imageUrl={payment.photoUrl}
          title={payment.requestNumber}
          subtitle={payment.customerName}
        />
      )}

      {/* Phase 2: Decline Reason Bottom Sheet Modal */}
      {isDeclineModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center p-0 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-[430px] rounded-t-[24px] p-5 pb-8 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Decline Payment</h3>
                <p className="text-xs text-slate-500">
                  Select a reason for declining #{payment.requestNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDeclineModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            {/* Reason Options List */}
            <div className="flex flex-col gap-2">
              {REJECTION_REASONS.map((r) => (
                <label
                  key={r}
                  className={`flex items-center justify-between p-3.5 rounded-xl border text-sm font-medium cursor-pointer transition-all ${
                    selectedReason === r
                      ? 'border-red-500 bg-red-50/50 text-red-900 font-semibold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span>{r}</span>
                  <input
                    type="radio"
                    name="declineReason"
                    value={r}
                    checked={selectedReason === r}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="accent-red-600 w-4 h-4"
                  />
                </label>
              ))}
            </div>

            {/* Custom Comment Field */}
            {(selectedReason === 'Other' || selectedReason) && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600">
                  {selectedReason === 'Other' ? (
                    <span>
                      Comment <span className="text-red-500">*</span>
                    </span>
                  ) : (
                    <span>Additional Note (Optional)</span>
                  )}
                </label>
                <textarea
                  rows={3}
                  value={declineComment}
                  onChange={(e) => setDeclineComment(e.target.value)}
                  placeholder={
                    selectedReason === 'Other'
                      ? 'Describe why this payment was declined (required)...'
                      : 'Add any notes for staff...'
                  }
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-800"
                />
              </div>
            )}

            {/* Modal Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeclineModalOpen(false)}
                className="py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm active:scale-[0.98] transition-all"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDecline}
                disabled={
                  isDeclining ||
                  !selectedReason ||
                  (selectedReason === 'Other' && !declineComment.trim())
                }
                className="py-3 px-4 rounded-xl bg-red-600 text-white font-bold text-sm shadow-md hover:bg-red-700 disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
              >
                {isDeclining ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <X size={16} strokeWidth={2.5} />
                )}
                <span>Confirm Decline</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
