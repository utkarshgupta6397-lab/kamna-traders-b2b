'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Eye,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Building2,
  Calendar,
  CreditCard,
  User,
  ShieldCheck,
  RefreshCw,
  Loader2,
  Check,
  Copy,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatIndianCurrency } from '@/lib/formatters';
import PaymentStatusBadge from '@/components/mobile/manage-payments/PaymentStatusBadge';

interface PaymentDetails {
  id: string;
  requestNumber: string;
  customerId: string;
  customerName: string;
  amount: number | string;
  paymentDate: string;
  paymentMode: string;
  photoUrl?: string | null;
  status: string;
  submittedAt: string;
  createdAt: string;
  createdById: string;
  createdBy?: { id: string; name: string };
  approvedById?: string | null;
  approvedAt?: string | null;
  approvedBy?: { id: string; name: string } | null;
  rejectedById?: string | null;
  rejectedAt?: string | null;
  rejectedBy?: { id: string; name: string } | null;
  rejectionReason?: string | null;
  zohoPaymentId?: string | null;
  zohoSyncStatus?: string;
  zohoSyncedAt?: string | null;
  zohoSyncError?: string | null;
  zohoSyncAttempts?: number;
  customer?: { id: string; name: string; gstNumber?: string | null };
}

interface PaymentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentId: string | null;
  canApprove: boolean;
  canReject: boolean;
  onApproveClick: (payment: PaymentDetails) => void;
  onDeclineClick: (payment: PaymentDetails) => void;
  onRefreshList: () => void;
}

export default function PaymentDetailsModal({
  isOpen,
  onClose,
  paymentId,
  canApprove,
  canReject,
  onApproveClick,
  onDeclineClick,
  onRefreshList,
}: PaymentDetailsModalProps) {
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetryingSync, setIsRetryingSync] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Fetch payment details
  const fetchPaymentDetails = async (id: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/mobile/manage-payments/${id}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setPayment(data.payment);
      } else {
        toast.error(data.error || 'Failed to load payment details');
      }
    } catch (err) {
      console.error('Fetch payment details error:', err);
      toast.error('Network error loading payment details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && paymentId) {
      fetchPaymentDetails(paymentId);
    } else {
      setPayment(null);
    }
  }, [isOpen, paymentId]);

  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedField(fieldName);
    toast.success(`Copied ${fieldName}`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleRetryZohoSync = async () => {
    if (!payment) return;
    setIsRetryingSync(true);
    const toastId = toast.loading('Retrying Zoho Books synchronization...');

    try {
      const res = await fetch(`/api/mobile/manage-payments/${payment.id}/sync-zoho`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.zohoSyncError || 'Zoho sync failed');
      }

      toast.success('Zoho Books Customer Advance created successfully!', { id: toastId });
      fetchPaymentDetails(payment.id);
      onRefreshList();
    } catch (err: any) {
      console.error('Retry sync error:', err);
      toast.error(err.message || 'Retry synchronization failed', { id: toastId });
      fetchPaymentDetails(payment.id);
    } finally {
      setIsRetryingSync(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs">
              {payment?.requestNumber || 'Payment Request'}
            </span>
            {payment && <PaymentStatusBadge status={payment.status} size="sm" />}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {isLoading ? (
            <div className="space-y-4 animate-pulse py-4">
              <div className="h-6 bg-slate-200 rounded w-1/3" />
              <div className="h-24 bg-slate-100 rounded-xl" />
              <div className="h-28 bg-slate-100 rounded-xl" />
              <div className="h-20 bg-slate-100 rounded-xl" />
            </div>
          ) : payment ? (
            <>
              {/* Section 1 & 2: Customer & Payment Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Customer Information */}
                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <Building2 size={12} />
                    Customer Information
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{payment.customerName}</p>
                    <p className="text-xs font-mono text-slate-500 mt-0.5">
                      Customer ID: {payment.customerId}
                    </p>
                    {payment.customer?.gstNumber && (
                      <p className="text-[11px] font-mono text-slate-500">
                        GST: {payment.customer.gstNumber}
                      </p>
                    )}
                  </div>
                </div>

                {/* Payment Information */}
                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <CreditCard size={12} />
                    Payment Information
                  </div>
                  <div>
                    <p className="text-xl font-bold text-emerald-700 tabular-nums">
                      {formatIndianCurrency(Number(payment.amount))}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                      <span className="font-semibold">{payment.paymentDate?.slice(0, 10)}</span>
                      <span>•</span>
                      <span className="font-medium text-slate-700">
                        {payment.paymentMode === 'POS' ? 'POS Device' : payment.paymentMode}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Receipt / Slip Photo */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Receipt / POS Slip Photo
                </p>
                {payment.photoUrl ? (
                  <div className="flex items-center gap-4">
                    <div
                      onClick={() => setLightboxOpen(true)}
                      className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-white cursor-pointer relative group shrink-0 shadow-xs"
                    >
                      <img
                        src={payment.photoUrl}
                        alt="Receipt Proof"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Eye size={18} />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">POS Payment Slip Proof</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Mandatory verification image submitted during recording.
                      </p>
                      <button
                        type="button"
                        onClick={() => setLightboxOpen(true)}
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-[#1A2766] hover:underline"
                      >
                        <Eye size={12} />
                        View Full Photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No receipt photo attached.</p>
                )}
              </div>

              {/* Section 4 & 5: Submission & Decision Audits */}
              <div className="grid grid-cols-2 gap-4">
                {/* Submission Info */}
                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <User size={12} />
                    Submission Information
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="text-slate-800 font-semibold">
                      {payment.createdBy?.name || 'Staff User'}
                    </p>
                    <p className="text-slate-500">
                      {new Date(payment.submittedAt || payment.createdAt).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>
                </div>

                {/* Decision Info */}
                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <ShieldCheck size={12} />
                    Approval / Decision
                  </div>
                  <div className="text-xs space-y-1">
                    {payment.status === 'APPROVED' ? (
                      <>
                        <p className="text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 size={12} /> Approved by {payment.approvedBy?.name || 'Manager'}
                        </p>
                        {payment.approvedAt && (
                          <p className="text-slate-500">
                            {new Date(payment.approvedAt).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </p>
                        )}
                      </>
                    ) : payment.status === 'REJECTED' ? (
                      <>
                        <p className="text-red-700 font-semibold flex items-center gap-1">
                          <AlertCircle size={12} /> Declined by {payment.rejectedBy?.name || 'Manager'}
                        </p>
                        {payment.rejectedAt && (
                          <p className="text-slate-500">
                            {new Date(payment.rejectedAt).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </p>
                        )}
                        {payment.rejectionReason && (
                          <p className="text-red-600 font-medium mt-1 bg-red-50 p-1.5 rounded border border-red-200">
                            Reason: {payment.rejectionReason}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-amber-700 font-medium flex items-center gap-1">
                        <Clock size={12} /> Awaiting management review
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 6: Zoho Books Integration Info */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Zoho Books Integration (Customer Advance)
                  </span>
                  {payment.zohoSyncStatus === 'ZOHO_SYNCED' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 size={10} /> Synced
                    </span>
                  ) : payment.zohoSyncStatus === 'ZOHO_SYNC_FAILED' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                      <AlertCircle size={10} /> Sync Failed
                    </span>
                  ) : payment.zohoSyncStatus === 'ZOHO_SYNC_PENDING' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      <RefreshCw size={10} className="animate-spin" /> In Progress
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      Not Synced
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px] block">Zoho Advance ID</span>
                    {payment.zohoPaymentId ? (
                      <span className="font-mono font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                        {payment.zohoPaymentId}
                        <button
                          type="button"
                          onClick={() => handleCopy(payment.zohoPaymentId!, 'Zoho Advance ID')}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          {copiedField === 'Zoho Advance ID' ? (
                            <Check size={12} className="text-emerald-600" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs italic mt-0.5 block">—</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Zoho Synced At</span>
                    <span className="text-slate-800 font-medium text-xs mt-0.5 block">
                      {payment.zohoSyncedAt
                        ? new Date(payment.zohoSyncedAt).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </span>
                  </div>
                </div>

                {payment.zohoSyncError && (
                  <div className="bg-red-50 p-2.5 rounded-lg border border-red-200 text-xs text-red-700 space-y-1">
                    <p className="font-bold flex items-center gap-1">
                      <AlertCircle size={12} />
                      Synchronization Error
                    </p>
                    <p className="text-[11px] font-mono leading-relaxed">{payment.zohoSyncError}</p>
                    {canApprove && (
                      <button
                        type="button"
                        onClick={handleRetryZohoSync}
                        disabled={isRetryingSync}
                        className="mt-2 flex items-center gap-1.5 px-3 py-1 bg-white border border-red-300 text-red-700 hover:bg-red-50 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={11} className={isRetryingSync ? 'animate-spin' : ''} />
                        Retry Zoho Advance Sync
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-slate-400 text-xs">Payment details not found.</div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-400">
            {payment?.status === 'PENDING_APPROVAL' && 'Pending approval decision'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              Close
            </button>

            {payment && payment.status === 'PENDING_APPROVAL' && (
              <>
                {canReject && (
                  <button
                    type="button"
                    onClick={() => onDeclineClick(payment)}
                    className="px-4 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                  >
                    Decline
                  </button>
                )}
                {canApprove && (
                  <button
                    type="button"
                    onClick={() => onApproveClick(payment)}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
                  >
                    Approve
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Preview */}
      {lightboxOpen && payment?.photoUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative max-w-3xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 p-1"
            >
              <X size={24} />
            </button>
            <img
              src={payment.photoUrl}
              alt="Receipt Full Preview"
              className="max-h-[80vh] w-auto rounded-xl shadow-2xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
