'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  Camera,
  Upload,
  RotateCcw,
  Ban,
  FileText,
  User,
  Calendar,
  Layers,
  ShieldAlert,
  Loader2,
  Eye,
  PackageCheck,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ReceivingUploadModal from './ReceivingUploadModal';
import CheckedUploadModal from './CheckedUploadModal';
import VerificationModal from './VerificationModal';

interface InvoiceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  onPhotoClick: (url: string, title?: string) => void;
  onUpdated: () => void;
}

function formatINR(val: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) {
    return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
  }
  return `${mins}m`;
}

export default function InvoiceDetailModal({
  isOpen,
  onClose,
  invoiceId,
  onPhotoClick,
  onUpdated,
}: InvoiceDetailModalProps) {
  const [invoice, setInvoice] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [inventoryLines, setInventoryLines] = useState<any[]>([]);

  // Workflow Modal States
  const [receivingModalOpen, setReceivingModalOpen] = useState(false);
  const [checkedModalOpen, setCheckedModalOpen] = useState(false);
  const [verifyModalState, setVerifyModalState] = useState<{
    isOpen: boolean;
    workflowType: 'RECEIVING' | 'CHECKED';
    submission: any | null;
  }>({
    isOpen: false,
    workflowType: 'RECEIVING',
    submission: null,
  });

  const handleReviewInventory = async (forceRefresh: boolean = false) => {
    setLoadingInventory(true);
    try {
      const res = await fetch(`/api/mobile/post-dispatch/invoices/${invoiceId}/review-inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to retrieve inventory data');
      }
      setInventoryLines(data.lines || []);
      setInventoryOpen(true);
      if (forceRefresh) {
        toast.success(`Refreshed ${data.lines?.length || 0} line items from Zoho Books`);
        fetchDetail();
      }
    } catch (err: any) {
      toast.error(err.message || 'Error loading inventory detail');
    } finally {
      setLoadingInventory(false);
    }
  };

  const fetchDetail = async () => {
    try {
      const res = await fetch(`/api/mobile/post-dispatch/invoices/${invoiceId}`);
      if (res.ok) {
        const data = await res.json();
        setInvoice(data.invoice);
        if (data.invoice?.lines?.length > 0) {
          setInventoryLines(data.invoice.lines);
        }
      }
    } catch (err) {
      console.error('[Fetch Invoice Detail Error]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && invoiceId) {
      setLoading(true);
      fetchDetail();
    }
  }, [isOpen, invoiceId]);

  if (!isOpen) return null;

  const receivingWf = invoice?.workflows?.find((w: any) => w.workflowType === 'RECEIVING');
  const checkedWf = invoice?.workflows?.find((w: any) => w.workflowType === 'CHECKED');
  const inventoryWf = invoice?.workflows?.find((w: any) => w.workflowType === 'INVENTORY_DEDUCTION');

  const latestReceivingSub = receivingWf?.submissions?.[0] || null;
  const latestCheckedSub = checkedWf?.submissions?.[0] || null;

  const isVoid = invoice?.isVoid;
  const isDraft = invoice?.zohoStatus?.toLowerCase() === 'draft';
  const isActionable = invoice?.isActionable;
  const currentUserId = invoice?.currentUserId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[#1A2766] text-lg tracking-tight">
                {invoice?.invoiceNumber || 'Invoice Details'}
              </h3>
              {invoice?.zohoStatus && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                    isVoid
                      ? 'bg-red-100 text-red-700'
                      : isDraft
                      ? 'bg-slate-100 text-slate-600'
                      : invoice.zohoStatus.toLowerCase() === 'sent'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {invoice.zohoStatus}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate max-w-[280px]">
              {invoice?.customerName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs font-medium">Loading invoice workflows...</span>
            </div>
          ) : !invoice ? (
            <div className="py-8 text-center text-sm text-slate-500">Invoice not found.</div>
          ) : (
            <>
              {/* Draft / Void Notice */}
              {isDraft && (
                <div className="rounded-2xl bg-slate-100 border border-slate-200 p-3 text-xs text-slate-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <strong>Draft Invoice:</strong> Draft invoices are imported for visibility but are{' '}
                    <strong>not actionable</strong> in Post Dispatch until marked <em>Sent</em> in Zoho Books.
                  </div>
                </div>
              )}

              {isVoid && (
                <div className="rounded-2xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-800 flex items-start gap-2.5">
                  <Ban className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">ARCHIVED — VOID</span>
                    This invoice was marked <strong>Void</strong> in Zoho Books. The invoice timer has stopped and all workflow actions are disabled. History remains permanently preserved.
                  </div>
                </div>
              )}

              {/* Status & Overview Bar */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-2xl p-3.5 border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                    Total Amount
                  </span>
                  <span className="text-base font-black text-[#1A2766]">
                    {formatINR(invoice.total)}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                    ERP Status
                  </span>
                  <span className="text-sm font-bold text-slate-800">
                    {invoice.erpStatus} {invoice.erpSubStatus ? `(${invoice.erpSubStatus})` : ''}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                    Sales Order
                  </span>
                  <span className="text-xs font-semibold text-slate-700">
                    {invoice.salesOrderNumber || 'Independent'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                    Invoice Timer
                  </span>
                  <div className="flex items-center gap-1 text-slate-800 font-bold">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{formatDuration(invoice.elapsedSeconds)}</span>
                    {invoice.timerStoppedAt && (
                      <span className="text-[10px] text-slate-400 font-normal">(stopped)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* E-Invoice Section */}
              <div className="bg-white rounded-2xl p-3.5 border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1A2766] uppercase tracking-wider text-[11px]">
                    E-Invoice
                  </span>
                  {invoice.eInvoiceGenerated ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-bold text-[10px]">
                      <CheckCircle2 className="w-3 h-3 text-teal-600" />
                      ✓ Generated
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold text-[10px]">
                      Not Generated
                    </span>
                  )}
                </div>

                {invoice.eInvoiceGenerated ? (
                  <div className="space-y-1 bg-teal-50/50 rounded-xl p-2.5 border border-teal-100 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">IRN:</span>
                      <span className="font-mono text-slate-800 truncate max-w-[200px]" title={invoice.eInvoiceIrn || ''}>
                        {invoice.eInvoiceIrn || '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Ack No:</span>
                      <span className="font-mono text-slate-800">
                        {invoice.eInvoiceAckNo || '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Ack Date:</span>
                      <span className="font-mono text-slate-800">
                        {invoice.eInvoiceAckDate || '—'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    No E-Invoice IRN reported by Zoho Books for this invoice.
                  </p>
                )}
              </div>

              {/* Workflows Section */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Post-Dispatch Workflows
                </h4>

                {/* Workflow 1: Customer Receiving Upload */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-bold text-slate-800 text-sm">1. Customer Receiving</h5>
                      <p className="text-[11px] text-slate-500">
                        Customer delivery / signed receiving proof
                      </p>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        receivingWf?.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : receivingWf?.status === 'AWAITING_VERIFICATION'
                          ? 'bg-blue-100 text-blue-800'
                          : receivingWf?.status === 'REWORK_REQUIRED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {receivingWf?.status === 'COMPLETED'
                        ? '✓ Approved'
                        : receivingWf?.status === 'AWAITING_VERIFICATION'
                        ? 'Awaiting Verification'
                        : receivingWf?.status === 'REWORK_REQUIRED'
                        ? '❌ Rework Required'
                        : 'Pending'}
                    </span>
                  </div>

                  {/* Rejection comment display if rework required */}
                  {receivingWf?.status === 'REWORK_REQUIRED' && latestReceivingSub?.rejectionComment && (
                    <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-xs space-y-1">
                      <span className="font-bold text-amber-900 block">Rejection Reason:</span>
                      <p className="text-amber-800">{latestReceivingSub.rejectionComment}</p>
                    </div>
                  )}

                  {/* Latest Submission Evidence Thumbnails */}
                  {latestReceivingSub && latestReceivingSub.files?.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Submission #{latestReceivingSub.submissionNumber}</span>
                        <span>By {latestReceivingSub.uploadedByUserName || 'Staff'}</span>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {latestReceivingSub.files.map((file: any) => {
                          const fileUrl = `/api/dispatch/post-dispatch/files/${file.id}`;
                          return (
                            <img
                              key={file.id}
                              src={fileUrl}
                              alt={file.fileName}
                              onClick={() => onPhotoClick(fileUrl, 'Receiving Evidence')}
                              className="w-14 h-14 object-cover rounded-xl border border-slate-200 cursor-pointer shrink-0 hover:scale-105 transition-transform"
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Actions for Receiving */}
                  {isActionable && !isVoid && (
                    <div className="flex gap-2 pt-1">
                      {/* Upload / Re-upload button */}
                      {receivingWf?.status !== 'COMPLETED' && (
                        <button
                          type="button"
                          onClick={() => setReceivingModalOpen(true)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>
                            {receivingWf?.status === 'REWORK_REQUIRED' ? 'Re-upload Evidence' : 'Upload Proof'}
                          </span>
                        </button>
                      )}

                      {/* Verification button */}
                      {receivingWf?.status === 'AWAITING_VERIFICATION' && latestReceivingSub && (
                        <button
                          type="button"
                          onClick={() =>
                            setVerifyModalState({
                              isOpen: true,
                              workflowType: 'RECEIVING',
                              submission: latestReceivingSub,
                            })
                          }
                          className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect & Verify</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Workflow 2: Checked By / Checked At */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-bold text-slate-800 text-sm">2. Checked By / Checked At</h5>
                      <p className="text-[11px] text-slate-500">
                        Physical check evidence & staff verification
                      </p>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        checkedWf?.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : checkedWf?.status === 'AWAITING_VERIFICATION'
                          ? 'bg-blue-100 text-blue-800'
                          : checkedWf?.status === 'REWORK_REQUIRED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {checkedWf?.status === 'COMPLETED'
                        ? '✓ Approved'
                        : checkedWf?.status === 'AWAITING_VERIFICATION'
                        ? 'Awaiting Verification'
                        : checkedWf?.status === 'REWORK_REQUIRED'
                        ? '❌ Rework Required'
                        : 'Pending'}
                    </span>
                  </div>

                  {checkedWf?.status === 'REWORK_REQUIRED' && latestCheckedSub?.rejectionComment && (
                    <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-xs space-y-1">
                      <span className="font-bold text-amber-900 block">Rejection Reason:</span>
                      <p className="text-amber-800">{latestCheckedSub.rejectionComment}</p>
                    </div>
                  )}

                  {latestCheckedSub && (
                    <div className="space-y-1.5 pt-1 text-xs bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Checked By:</span>
                        <span className="font-bold text-slate-800">{latestCheckedSub.checkedBy || '—'}</span>
                      </div>
                      {latestCheckedSub.checkedAt && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Checked At:</span>
                          <span className="font-medium text-slate-700">
                            {new Date(latestCheckedSub.checkedAt).toLocaleString('en-IN', {
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
                      {latestCheckedSub.files?.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pt-1">
                          {latestCheckedSub.files.map((file: any) => {
                            const fileUrl = `/api/dispatch/post-dispatch/files/${file.id}`;
                            return (
                              <img
                                key={file.id}
                                src={fileUrl}
                                alt={file.fileName}
                                onClick={() => onPhotoClick(fileUrl, 'Checked Evidence')}
                                className="w-14 h-14 object-cover rounded-xl border border-slate-200 cursor-pointer shrink-0 hover:scale-105 transition-transform"
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions for Checked */}
                  {isActionable && !isVoid && (
                    <div className="flex gap-2 pt-1">
                      {checkedWf?.status !== 'COMPLETED' && (
                        <button
                          type="button"
                          onClick={() => setCheckedModalOpen(true)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>
                            {checkedWf?.status === 'REWORK_REQUIRED' ? 'Re-upload Evidence' : 'Upload Evidence'}
                          </span>
                        </button>
                      )}

                      {checkedWf?.status === 'AWAITING_VERIFICATION' && latestCheckedSub && (
                        <button
                          type="button"
                          onClick={() =>
                            setVerifyModalState({
                              isOpen: true,
                              workflowType: 'CHECKED',
                              submission: latestCheckedSub,
                            })
                          }
                          className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect & Verify</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Workflow 3: Inventory Deduction & Detail Review */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-bold text-slate-800 text-sm">3. Inventory Deduction</h5>
                      <p className="text-[11px] text-slate-500">
                        Line items, SKUs & stock deduction verification
                      </p>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                      Phase 2 Ready
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleReviewInventory(false)}
                      disabled={loadingInventory}
                      className="flex-1 py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#1A2766] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {loadingInventory ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <PackageCheck className="w-3.5 h-3.5 text-blue-600" />
                      )}
                      <span>{inventoryOpen ? 'Hide Inventory' : 'Review Inventory'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReviewInventory(true)}
                      disabled={loadingInventory}
                      title="Fetch Latest Data from Zoho Books"
                      className="py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingInventory ? 'animate-spin' : ''}`} />
                      <span>Fetch Latest Data</span>
                    </button>
                  </div>

                  {/* Lazy-Loaded Inventory Line Items */}
                  {inventoryOpen && (
                    <div className="pt-2 border-t border-slate-100 space-y-2 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <span>Line Items ({inventoryLines.length})</span>
                        <span>Qty × Rate</span>
                      </div>

                      {inventoryLines.length === 0 ? (
                        <p className="text-xs text-slate-400 py-2 text-center bg-slate-50 rounded-xl">
                          No line items recorded for this invoice.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {inventoryLines.map((line: any, idx: number) => (
                            <div
                              key={line.id || idx}
                              className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs flex items-center justify-between"
                            >
                              <div className="truncate pr-2">
                                <span className="font-semibold text-slate-800 block truncate">
                                  {line.itemName}
                                </span>
                                {line.hsnCode && (
                                  <span className="text-[10px] text-slate-400">HSN: {line.hsnCode}</span>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-bold text-slate-800 block">
                                  {line.quantity} × {formatINR(line.rate)}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {formatINR(line.amount)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* POST DISPATCH IMMUTABLE HISTORY */}
              <div className="space-y-2 pt-2">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Post Dispatch History
                </h4>

                {invoice.history?.length === 0 ? (
                  <p className="text-xs text-slate-400">No events logged yet.</p>
                ) : (
                  <div className="space-y-2">
                    {invoice.history.map((hist: any) => (
                      <div
                        key={hist.id}
                        className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/70 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between font-semibold text-slate-700">
                          <span>{hist.eventType.replace(/_/g, ' ')}</span>
                          <span className="text-[11px] text-slate-400 font-normal">
                            {new Date(hist.createdAt).toLocaleString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          By: <strong className="text-slate-700">{hist.userName || 'System'}</strong>
                        </div>
                        {hist.rejectionReason && (
                          <div className="text-[11px] text-amber-800 bg-amber-50/80 p-1.5 rounded-lg border border-amber-200/60">
                            Reason: {hist.rejectionReason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Upload Modals */}
      {invoice && (
        <>
          <ReceivingUploadModal
            isOpen={receivingModalOpen}
            onClose={() => setReceivingModalOpen(false)}
            invoiceId={invoice.id}
            invoiceNumber={invoice.invoiceNumber}
            customerName={invoice.customerName}
            onSuccess={() => {
              fetchDetail();
              onUpdated();
            }}
          />

          <CheckedUploadModal
            isOpen={checkedModalOpen}
            onClose={() => setCheckedModalOpen(false)}
            invoiceId={invoice.id}
            invoiceNumber={invoice.invoiceNumber}
            customerName={invoice.customerName}
            onSuccess={() => {
              fetchDetail();
              onUpdated();
            }}
          />

          {verifyModalState.submission && (
            <VerificationModal
              isOpen={verifyModalState.isOpen}
              onClose={() =>
                setVerifyModalState({
                  isOpen: false,
                  workflowType: 'RECEIVING',
                  submission: null,
                })
              }
              workflowType={verifyModalState.workflowType}
              submissionId={verifyModalState.submission.id}
              invoiceNumber={invoice.invoiceNumber}
              customerName={invoice.customerName}
              uploadedByUserName={verifyModalState.submission.uploadedByUserName}
              uploadedByUserId={verifyModalState.submission.uploadedByUserId}
              uploadedAt={verifyModalState.submission.uploadedAt}
              receivingDetails={verifyModalState.submission.receivingDetails}
              checkedBy={verifyModalState.submission.checkedBy}
              checkedAt={verifyModalState.submission.checkedAt}
              files={verifyModalState.submission.files || []}
              currentUserId={currentUserId}
              onPhotoClick={onPhotoClick}
              onSuccess={() => {
                fetchDetail();
                onUpdated();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
