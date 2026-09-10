'use client';

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Hourglass,
  Building2,
  FileText,
  User,
  Calendar,
  Layers,
  Image as ImageIcon,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Package,
  History,
  X,
  ChevronDown,
  ChevronUp,
  Maximize2,
} from "lucide-react";
import toast from "react-hot-toast";
import MobileImagePreview from "@/components/mobile/MobileImagePreview";

interface Props {
  invoiceId: string;
  canVerifyReceiving: boolean;
  canVerifyChecked: boolean;
  currentUserId: string;
}

type SectionTab = "RECEIVING" | "CHECKED" | "INVENTORY";

function formatCurrency(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, seconds)}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ${seconds % 60}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs < 24) return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs > 0 ? `${days}d ${remHrs}h` : `${days}d`;
}

/**
 * Image Thumbnail with loading state, error fallback, retry, and click-to-enlarge
 */
function FileThumbnail({
  file,
  onClick,
}: {
  file: { id: string; fileName: string; filePath: string; mimeType?: string };
  onClick: (url: string, title: string) => void;
}) {
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  const fileUrl = `/api/dispatch/post-dispatch/files/${file.id}${retryCount > 0 ? `?retry=${retryCount}` : ""}`;
  const isImage = !file.mimeType || file.mimeType.startsWith("image/");

  if (!isImage) {
    return (
      <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 flex flex-col justify-between aspect-video">
        <div className="flex items-center gap-2 text-gray-700">
          <FileText size={20} className="text-blue-600 shrink-0" />
          <span className="text-xs font-semibold truncate">{file.fileName}</span>
        </div>
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-[#1A2766] font-bold hover:underline"
        >
          <ExternalLink size={12} />
          <span>Open Document</span>
        </a>
      </div>
    );
  }

  return (
    <div className="group relative border border-gray-200 rounded-xl overflow-hidden bg-gray-100 aspect-video shadow-2xs">
      {loading && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <Loader2 size={18} className="animate-spin text-gray-400" />
        </div>
      )}

      {loadError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 p-2 text-center text-xs text-gray-500">
          <AlertCircle size={20} className="text-amber-500 mb-1" />
          <span className="text-[11px] font-medium text-gray-700 truncate max-w-full px-1">
            Unable to preview file
          </span>
          <p className="text-[10px] text-gray-400 truncate max-w-full">{file.fileName}</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLoadError(false);
              setLoading(true);
              setRetryCount((prev) => prev + 1);
            }}
            className="mt-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <div
          onClick={() => onClick(fileUrl, file.fileName)}
          className="w-full h-full cursor-pointer relative"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl}
            alt={file.fileName}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setLoadError(true);
            }}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-white text-xs font-bold flex items-center gap-1">
              <Maximize2 size={13} /> View Photo
            </span>
          </div>
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
            <p className="text-[10px] text-white truncate font-medium">{file.fileName}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DesktopPostDispatchReviewClient({
  invoiceId,
  canVerifyReceiving,
  canVerifyChecked,
  currentUserId,
}: Props) {
  const [invoice, setInvoice] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activePhoto, setActivePhoto] = useState<{ url: string; title?: string } | null>(null);

  // Section Tab Navigation: "RECEIVING" | "CHECKED" | "INVENTORY"
  const [activeSection, setActiveSection] = useState<SectionTab>("RECEIVING");

  // Rejection modal state
  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    workflowType: "RECEIVING" | "CHECKED";
    submissionId: string;
    submissionNumber: number;
  }>({
    isOpen: false,
    workflowType: "RECEIVING",
    submissionId: "",
    submissionNumber: 1,
  });
  const [rejectionReason, setRejectionReason] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  // Accordion state for prior submission history
  const [showPriorReceiving, setShowPriorReceiving] = useState(false);
  const [showPriorChecked, setShowPriorChecked] = useState(false);

  // Load invoice detail from local ERP database (0 Zoho API calls)
  const fetchInvoiceDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/mobile/post-dispatch/invoices/${invoiceId}`);
      if (!res.ok) {
        throw new Error("Failed to load invoice details");
      }
      const data = await res.json();
      setInvoice(data.invoice);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch invoice details");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchInvoiceDetail();
  }, [fetchInvoiceDetail]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchInvoiceDetail();
  };

  // Targeted individual status refresh from Zoho Books (only on user request)
  const handleZohoStatusRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/mobile/post-dispatch/invoices/${invoiceId}/refresh-status`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to refresh Zoho status");
      }
      toast.success(data.message || "Invoice status refreshed from Zoho Books");
      await fetchInvoiceDetail();
    } catch (err: any) {
      toast.error(err.message || "Status refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  // Verification: Approve
  const handleApprove = async (workflowType: "RECEIVING" | "CHECKED", submissionId: string) => {
    setSubmittingAction(true);
    try {
      const endpoint =
        workflowType === "RECEIVING"
          ? `/api/mobile/post-dispatch/receiving/verify/${submissionId}`
          : `/api/mobile/post-dispatch/checked/verify/${submissionId}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to approve submission");
      }

      toast.success(`${workflowType === "RECEIVING" ? "Receiving" : "Physical Check"} submission approved!`);
      await fetchInvoiceDetail();
    } catch (err: any) {
      toast.error(err.message || "Approval failed");
    } finally {
      setSubmittingAction(false);
    }
  };

  // Verification: Open Reject Modal
  const openRejectModal = (
    workflowType: "RECEIVING" | "CHECKED",
    submissionId: string,
    submissionNumber: number
  ) => {
    setRejectModal({
      isOpen: true,
      workflowType,
      submissionId,
      submissionNumber,
    });
    setRejectionReason("");
  };

  // Verification: Confirm Reject
  const handleConfirmReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Rejection remarks are mandatory.");
      return;
    }

    setSubmittingAction(true);
    try {
      const endpoint =
        rejectModal.workflowType === "RECEIVING"
          ? `/api/mobile/post-dispatch/receiving/verify/${rejectModal.submissionId}`
          : `/api/mobile/post-dispatch/checked/verify/${rejectModal.submissionId}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REJECT",
          comment: rejectionReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reject submission");
      }

      toast.success("Submission rejected and returned for rework.");
      setRejectModal((prev) => ({ ...prev, isOpen: false }));
      setRejectionReason("");
      await fetchInvoiceDetail();
    } catch (err: any) {
      toast.error(err.message || "Rejection failed");
    } finally {
      setSubmittingAction(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex flex-col items-center justify-center gap-3">
        <Loader2 size={32} className="animate-spin text-[#1A2766]" />
        <p className="text-sm font-medium text-gray-600">Loading Post-Dispatch Workspace…</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle size={48} className="text-amber-500 mb-3" />
        <h2 className="text-lg font-bold text-gray-900">Invoice Not Found</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          The requested post-dispatch invoice could not be located in the local system.
        </p>
        <Link
          href="/staff/dashboard/dispatch/incoming?dispatch=post"
          className="mt-4 px-4 py-2 bg-[#1A2766] text-white text-xs font-bold rounded-lg hover:bg-blue-900 transition-colors"
        >
          Return to Post-Dispatch Table
        </Link>
      </div>
    );
  }

  const receivingWf = invoice.workflows?.find((w: any) => w.workflowType === "RECEIVING");
  const checkedWf = invoice.workflows?.find((w: any) => w.workflowType === "CHECKED");
  const inventoryWf = invoice.workflows?.find((w: any) => w.workflowType === "INVENTORY_DEDUCTION");

  // Submissions ordered desc (submissionNumber: desc)
  const receivingSubs = receivingWf?.submissions || [];
  const latestReceivingSub = receivingSubs[0] || null;
  const priorReceivingSubs = receivingSubs.slice(1);

  const checkedSubs = checkedWf?.submissions || [];
  const latestCheckedSub = checkedSubs[0] || null;
  const priorCheckedSubs = checkedSubs.slice(1);

  const isReceivingAwaiting = latestReceivingSub?.status === "AWAITING_VERIFICATION";
  const isCheckedAwaiting = latestCheckedSub?.status === "AWAITING_VERIFICATION";

  const isReceivingSelfUploader = Boolean(
    currentUserId && latestReceivingSub && currentUserId === latestReceivingSub.uploadedByUserId
  );
  const isCheckedSelfUploader = Boolean(
    currentUserId && latestCheckedSub && currentUserId === latestCheckedSub.uploadedByUserId
  );

  const isVoid = invoice.isVoid;
  const isForceArchived = invoice.erpSubStatus === "Force Archived";

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Top Navigation & Breadcrumb */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/staff/dashboard/dispatch/incoming?dispatch=post"
              className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              title="Back to Post-Dispatch Table"
            >
              <ArrowLeft size={16} />
            </Link>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Dispatch</span>
              <span>/</span>
              <span>Post-Dispatch Review</span>
              <span>/</span>
              <span className="font-bold text-gray-900 font-mono">{invoice.invoiceNumber}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium transition-colors disabled:opacity-50"
              title="Refresh local data"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin text-[#1A2766]" : ""} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleZohoStatusRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-[#1A2766] text-xs font-semibold transition-colors disabled:opacity-50"
              title="Fetch single latest status from Zoho Books"
            >
              <ExternalLink size={13} className="text-blue-600" />
              <span>Fetch Zoho Status</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Two-Column Workspace */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ================================================================= */}
          {/* LEFT COLUMN: PRIMARY REVIEW WORKSPACE (8 COLS)                    */}
          {/* ================================================================= */}
          <div className="lg:col-span-8 space-y-5">
            
            {/* 1. INVOICE HEADER CARD */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {invoice.zohoInvoiceId ? (
                      <a
                        href={`https://books.zoho.in/app#/invoices/${invoice.zohoInvoiceId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-2xl font-bold font-mono text-[#1A2766] hover:underline inline-flex items-center gap-1.5 group"
                        title="Open Invoice in Zoho Books"
                      >
                        <span>{invoice.invoiceNumber}</span>
                        <ExternalLink size={16} className="text-gray-400 group-hover:text-[#1A2766] transition-colors" />
                      </a>
                    ) : (
                      <h1 className="text-2xl font-bold font-mono text-[#1A2766]">{invoice.invoiceNumber}</h1>
                    )}

                    {/* Zoho Status Badge */}
                    <span
                      className={`h-6 px-3 rounded-full text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center leading-none ${
                        isVoid
                          ? "bg-red-100 text-red-700"
                          : invoice.zohoStatus?.toLowerCase() === "draft"
                          ? "bg-slate-100 text-slate-700"
                          : invoice.zohoStatus?.toLowerCase() === "paid"
                          ? "bg-emerald-100 text-emerald-800"
                          : invoice.zohoStatus?.toLowerCase() === "sent"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {invoice.zohoStatus}
                    </span>

                    {/* ERP / Post-Dispatch Status */}
                    {isForceArchived ? (
                      <span className="h-6 px-2.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 inline-flex items-center justify-center leading-none">
                        Force Archived
                      </span>
                    ) : (
                      <span
                        className={`h-6 px-2.5 rounded-full text-xs font-semibold inline-flex items-center justify-center leading-none ${
                          invoice.erpStatus === "Active"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        ERP: {invoice.erpStatus}
                      </span>
                    )}
                  </div>

                  {/* Customer & GSTIN */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400">Customer:</span>
                      {invoice.customerId ? (
                        <a
                          href={`https://books.zoho.in/app#/contacts/${invoice.customerId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-gray-900 hover:text-[#1A2766] hover:underline inline-flex items-center gap-1 group"
                          title="Open Customer in Zoho Books"
                        >
                          <span>{invoice.customerName}</span>
                          <ExternalLink size={12} className="text-gray-400 group-hover:text-[#1A2766] transition-colors" />
                        </a>
                      ) : (
                        <span className="font-semibold text-gray-900">{invoice.customerName}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      <span className="text-gray-400">GSTIN:</span>
                      <span className={invoice.gstin ? "font-semibold text-gray-800" : "text-gray-400 italic"}>
                        {invoice.gstin ? invoice.gstin : "Null"}
                      </span>
                    </div>

                    {invoice.isConsumer && (
                      <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                        B2C (Consumer)
                      </span>
                    )}
                  </div>

                  {/* Warehouse & Sales Order */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <Building2 size={13} className="text-gray-400" />
                      <span>Source Warehouse:</span>
                      <span className="font-medium text-gray-800">
                        {invoice.warehouseName || "Not Assigned"}
                      </span>
                    </div>
                    {invoice.salesOrderNumber && (
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="text-gray-400">Sales Order:</span>
                        <span className="font-medium text-gray-800">{invoice.salesOrderNumber}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Financials & Timer Metric */}
                <div className="flex flex-row sm:flex-col sm:items-end justify-between gap-3 border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-100">
                  <div className="sm:text-right">
                    <div className="text-xs text-gray-400 font-medium">Invoice Total</div>
                    <div className="text-2xl font-bold font-mono text-gray-900 mt-0.5">
                      {formatCurrency(invoice.total, invoice.currencyCode || "INR")}
                    </div>
                  </div>

                  <div className="sm:text-right">
                    <div className="text-xs text-gray-400 font-medium">Post-Dispatch Timer</div>
                    <div className="inline-flex items-center gap-1.5 mt-0.5 font-mono text-xs font-semibold text-gray-800 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-200">
                      <Clock size={13} className="text-[#1A2766]" />
                      <span>{formatElapsed(invoice.elapsedSeconds || 0)}</span>
                      {invoice.timerStoppedAt && (
                        <span className="text-[10px] text-emerald-700 font-sans font-bold uppercase">(Frozen)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. SECTION TABS NAVIGATION */}
            <div className="bg-white rounded-2xl border border-gray-200 p-1.5 shadow-2xs">
              <nav className="flex space-x-1.5" aria-label="Workflow Sections">
                <button
                  type="button"
                  onClick={() => setActiveSection("RECEIVING")}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    activeSection === "RECEIVING"
                      ? "bg-[#1A2766] text-white shadow-xs"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <FileText size={14} />
                  <span>Customer Receiving</span>
                  {isReceivingAwaiting && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                  {receivingWf?.status === "COMPLETED" && (
                    <CheckCircle2 size={13} className={activeSection === "RECEIVING" ? "text-emerald-300" : "text-emerald-600"} />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection("CHECKED")}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    activeSection === "CHECKED"
                      ? "bg-[#1A2766] text-white shadow-xs"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <ShieldCheck size={14} />
                  <span>Checked By / Checked At</span>
                  {isCheckedAwaiting && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                  {checkedWf?.status === "COMPLETED" && (
                    <CheckCircle2 size={13} className={activeSection === "CHECKED" ? "text-emerald-300" : "text-emerald-600"} />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection("INVENTORY")}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    activeSection === "INVENTORY"
                      ? "bg-[#1A2766] text-white shadow-xs"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <Package size={14} />
                  <span>Inventory Deduction</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-semibold">
                    Phase 2
                  </span>
                </button>
              </nav>
            </div>

            {/* 3. WORKSPACE VIEWPORT */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
              
              {/* SECTION 1: CUSTOMER RECEIVING */}
              {activeSection === "RECEIVING" && (
                <div>
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1A2766] flex items-center justify-center border border-blue-200">
                        <FileText size={16} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm tracking-tight">Customer Receiving Proof</h3>
                        <p className="text-xs text-gray-500">Customer stamped receipt & delivery evidence uploaded by warehouse staff</p>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div>
                      {receivingWf?.status === "COMPLETED" ? (
                        <span className="h-6 px-3 rounded-full text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 inline-flex items-center gap-1.5">
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          <span>Verified & Approved</span>
                        </span>
                      ) : isReceivingAwaiting ? (
                        <span className="h-6 px-3 rounded-full text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 inline-flex items-center gap-1.5">
                          <Hourglass size={13} className="text-blue-600 animate-pulse" />
                          <span>Verification Pending</span>
                        </span>
                      ) : receivingWf?.status === "REWORK_REQUIRED" ? (
                        <span className="h-6 px-3 rounded-full text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 inline-flex items-center gap-1.5">
                          <RotateCcw size={13} className="text-amber-600" />
                          <span>Rework Required (Rejected)</span>
                        </span>
                      ) : (
                        <span className="h-6 px-3 rounded-full text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 inline-flex items-center gap-1.5">
                          <Clock size={13} className="text-gray-400" />
                          <span>Pending Upload</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-6">
                    {!latestReceivingSub ? (
                      <div className="text-center py-12 text-gray-400 text-xs">
                        <FileText size={28} className="mx-auto text-gray-300 mb-2" />
                        No receiving evidence has been submitted yet from mobile warehouse devices.
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {/* Submission Meta Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="font-bold text-gray-900">
                              Submission #{latestReceivingSub.submissionNumber}
                            </span>
                            <span className="text-gray-500">
                              Uploaded By: <strong className="text-gray-800">{latestReceivingSub.uploadedByUserName || "Staff"}</strong>
                            </span>
                            <span className="text-gray-500">
                              Uploaded At: <strong className="text-gray-800">{format(new Date(latestReceivingSub.uploadedAt), "dd MMM yyyy · hh:mm a")}</strong>
                            </span>
                          </div>

                          {latestReceivingSub.status === "APPROVED" && latestReceivingSub.verifiedByUserName && (
                            <div className="text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 size={13} />
                              <span>Approved by {latestReceivingSub.verifiedByUserName} on {format(new Date(latestReceivingSub.verifiedAt), "dd MMM · hh:mm a")}</span>
                            </div>
                          )}

                          {latestReceivingSub.status === "REJECTED" && (
                            <div className="text-amber-700 font-semibold flex items-center gap-1">
                              <RotateCcw size={13} />
                              <span>Rejected by {latestReceivingSub.verifiedByUserName || "Verifier"}: &ldquo;{latestReceivingSub.rejectionComment}&rdquo;</span>
                            </div>
                          )}
                        </div>

                        {/* Receiving Details / Notes */}
                        {latestReceivingSub.receivingDetails && (
                          <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                              Uploader Notes / Receiving Remarks
                            </label>
                            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-800 border border-gray-200">
                              {latestReceivingSub.receivingDetails}
                            </div>
                          </div>
                        )}

                        {/* Uploaded Evidence Photos / Documents */}
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                            Evidence Documents / Photos ({latestReceivingSub.files?.length || 0})
                          </label>
                          {latestReceivingSub.files?.length === 0 ? (
                            <div className="text-xs text-gray-400 italic">No files attached to this submission.</div>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {latestReceivingSub.files?.map((file: any) => (
                                <FileThumbnail
                                  key={file.id}
                                  file={file}
                                  onClick={(url, title) => setActivePhoto({ url, title: `Receiving: ${title}` })}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Verification Actions Bar */}
                        {isReceivingAwaiting && (
                          <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                            {isReceivingSelfUploader ? (
                              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                                <ShieldAlert size={14} className="text-amber-600 shrink-0" />
                                <span>You uploaded this submission and cannot self-verify it. An authorized independent verifier must review.</span>
                              </div>
                            ) : canVerifyReceiving ? (
                              <div className="flex items-center gap-2.5 ml-auto">
                                <button
                                  type="button"
                                  onClick={() => openRejectModal("RECEIVING", latestReceivingSub.id, latestReceivingSub.submissionNumber)}
                                  disabled={submittingAction}
                                  className="px-4 py-2 bg-white hover:bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                                >
                                  Reject with Remarks
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleApprove("RECEIVING", latestReceivingSub.id)}
                                  disabled={submittingAction}
                                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                                >
                                  {submittingAction ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                  <span>Approve & Verify</span>
                                </button>
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500 italic ml-auto">
                                Verification requires <code>Receiving Verification</code> permission.
                              </div>
                            )}
                          </div>
                        )}

                        {/* Prior Submissions Accordion */}
                        {priorReceivingSubs.length > 0 && (
                          <div className="pt-2 border-t border-gray-100">
                            <button
                              type="button"
                              onClick={() => setShowPriorReceiving(!showPriorReceiving)}
                              className="text-xs text-gray-500 hover:text-gray-800 font-semibold flex items-center gap-1 transition-colors"
                            >
                              {showPriorReceiving ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              <span>{showPriorReceiving ? "Hide" : "Show"} Prior Submissions ({priorReceivingSubs.length})</span>
                            </button>

                            {showPriorReceiving && (
                              <div className="mt-3 space-y-3 pl-3 border-l-2 border-gray-200">
                                {priorReceivingSubs.map((sub: any) => (
                                  <div key={sub.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-gray-800">Submission #{sub.submissionNumber}</span>
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          sub.status === "REJECTED"
                                            ? "bg-amber-100 text-amber-800"
                                            : "bg-gray-100 text-gray-700"
                                        }`}
                                      >
                                        {sub.status}
                                      </span>
                                    </div>
                                    <p className="text-gray-500">
                                      Uploaded by {sub.uploadedByUserName} on {format(new Date(sub.uploadedAt), "dd MMM yyyy · hh:mm a")}
                                    </p>
                                    {sub.rejectionComment && (
                                      <div className="text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
                                        <strong>Rejection Reason:</strong> {sub.rejectionComment}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION 2: CHECKED BY / CHECKED AT */}
              {activeSection === "CHECKED" && (
                <div>
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center border border-teal-200">
                        <ShieldCheck size={16} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm tracking-tight">Checked By / Checked At Verification</h3>
                        <p className="text-xs text-gray-500">Physical vehicle loading & quality check verification evidence</p>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div>
                      {checkedWf?.status === "COMPLETED" ? (
                        <span className="h-6 px-3 rounded-full text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 inline-flex items-center gap-1.5">
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          <span>Verified & Approved</span>
                        </span>
                      ) : isCheckedAwaiting ? (
                        <span className="h-6 px-3 rounded-full text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 inline-flex items-center gap-1.5">
                          <Hourglass size={13} className="text-blue-600 animate-pulse" />
                          <span>Verification Pending</span>
                        </span>
                      ) : checkedWf?.status === "REWORK_REQUIRED" ? (
                        <span className="h-6 px-3 rounded-full text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 inline-flex items-center gap-1.5">
                          <RotateCcw size={13} className="text-amber-600" />
                          <span>Rework Required (Rejected)</span>
                        </span>
                      ) : (
                        <span className="h-6 px-3 rounded-full text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 inline-flex items-center gap-1.5">
                          <Clock size={13} className="text-gray-400" />
                          <span>Pending Upload</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-6">
                    {!latestCheckedSub ? (
                      <div className="text-center py-12 text-gray-400 text-xs">
                        <ShieldCheck size={28} className="mx-auto text-gray-300 mb-2" />
                        No physical check evidence has been submitted yet from mobile warehouse devices.
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {/* Submission Meta Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="font-bold text-gray-900">
                              Submission #{latestCheckedSub.submissionNumber}
                            </span>
                            <span className="text-gray-500">
                              Checked By: <strong className="text-gray-800">{latestCheckedSub.checkedBy || "Not Recorded"}</strong>
                            </span>
                            {latestCheckedSub.checkedAt && (
                              <span className="text-gray-500">
                                Checked At: <strong className="text-gray-800">{format(new Date(latestCheckedSub.checkedAt), "dd MMM yyyy · hh:mm a")}</strong>
                              </span>
                            )}
                            <span className="text-gray-500">
                              Uploaded By: <strong className="text-gray-800">{latestCheckedSub.uploadedByUserName || "Staff"}</strong>
                            </span>
                          </div>

                          {latestCheckedSub.status === "APPROVED" && latestCheckedSub.verifiedByUserName && (
                            <div className="text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 size={13} />
                              <span>Approved by {latestCheckedSub.verifiedByUserName} on {format(new Date(latestCheckedSub.verifiedAt), "dd MMM · hh:mm a")}</span>
                            </div>
                          )}

                          {latestCheckedSub.status === "REJECTED" && (
                            <div className="text-amber-700 font-semibold flex items-center gap-1">
                              <RotateCcw size={13} />
                              <span>Rejected by {latestCheckedSub.verifiedByUserName || "Verifier"}: &ldquo;{latestCheckedSub.rejectionComment}&rdquo;</span>
                            </div>
                          )}
                        </div>

                        {/* Uploaded Photos / Files */}
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                            Physical Check Documents / Photos ({latestCheckedSub.files?.length || 0})
                          </label>
                          {latestCheckedSub.files?.length === 0 ? (
                            <div className="text-xs text-gray-400 italic">No files attached to this submission.</div>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {latestCheckedSub.files?.map((file: any) => (
                                <FileThumbnail
                                  key={file.id}
                                  file={file}
                                  onClick={(url, title) => setActivePhoto({ url, title: `Checked: ${title}` })}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Verification Actions Bar */}
                        {isCheckedAwaiting && (
                          <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                            {isCheckedSelfUploader ? (
                              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                                <ShieldAlert size={14} className="text-amber-600 shrink-0" />
                                <span>You uploaded this submission and cannot self-verify it. An authorized independent verifier must review.</span>
                              </div>
                            ) : canVerifyChecked ? (
                              <div className="flex items-center gap-2.5 ml-auto">
                                <button
                                  type="button"
                                  onClick={() => openRejectModal("CHECKED", latestCheckedSub.id, latestCheckedSub.submissionNumber)}
                                  disabled={submittingAction}
                                  className="px-4 py-2 bg-white hover:bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                                >
                                  Reject with Remarks
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleApprove("CHECKED", latestCheckedSub.id)}
                                  disabled={submittingAction}
                                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                                >
                                  {submittingAction ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                  <span>Approve & Verify</span>
                                </button>
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500 italic ml-auto">
                                Verification requires <code>Checked By Verification</code> permission.
                              </div>
                            )}
                          </div>
                        )}

                        {/* Prior Submissions Accordion */}
                        {priorCheckedSubs.length > 0 && (
                          <div className="pt-2 border-t border-gray-100">
                            <button
                              type="button"
                              onClick={() => setShowPriorChecked(!showPriorChecked)}
                              className="text-xs text-gray-500 hover:text-gray-800 font-semibold flex items-center gap-1 transition-colors"
                            >
                              {showPriorChecked ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              <span>{showPriorChecked ? "Hide" : "Show"} Prior Submissions ({priorCheckedSubs.length})</span>
                            </button>

                            {showPriorChecked && (
                              <div className="mt-3 space-y-3 pl-3 border-l-2 border-gray-200">
                                {priorCheckedSubs.map((sub: any) => (
                                  <div key={sub.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-gray-800">Submission #{sub.submissionNumber}</span>
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          sub.status === "REJECTED"
                                            ? "bg-amber-100 text-amber-800"
                                            : "bg-gray-100 text-gray-700"
                                        }`}
                                      >
                                        {sub.status}
                                      </span>
                                    </div>
                                    <p className="text-gray-500">
                                      Uploaded by {sub.uploadedByUserName} on {format(new Date(sub.uploadedAt), "dd MMM yyyy · hh:mm a")}
                                    </p>
                                    {sub.rejectionComment && (
                                      <div className="text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
                                        <strong>Rejection Reason:</strong> {sub.rejectionComment}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION 3: INVENTORY DEDUCTION (PHASE 2 - COMING SOON) */}
              {activeSection === "INVENTORY" && (
                <div>
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center border border-gray-200">
                        <Package size={16} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900 text-sm tracking-tight">Inventory Deduction</h3>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
                            Phase 2 — Coming Soon
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">Automated stock deduction against warehouse inventories will activate in Phase 2</p>
                      </div>
                    </div>

                    <span className="h-6 px-3 rounded-full text-xs font-semibold text-gray-400 bg-gray-100 border border-gray-200 inline-flex items-center">
                      Not Started (Phase 2)
                    </span>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
                      <strong>Phase 2 Workspace:</strong> Item mapping, stock deduction quantities, warehouse deviation approvals, and ERP stock register updates will be managed from this workspace upon Phase 2 rollout. No inventory deductions are executed during Phase 1.
                    </div>

                    {invoice.lines?.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Invoice Line Items ({invoice.lines.length})
                          </p>
                          <span className="text-[11px] text-gray-400">Stored in local ERP</span>
                        </div>
                        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white text-xs">
                          <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                              <tr>
                                <th className="px-3 py-2.5">Item Name</th>
                                <th className="px-3 py-2.5 text-right">Qty</th>
                                <th className="px-3 py-2.5 text-right">Rate</th>
                                <th className="px-3 py-2.5 text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {invoice.lines.map((line: any) => (
                                <tr key={line.id} className="text-gray-700 hover:bg-gray-50/50">
                                  <td className="px-3 py-2 font-medium">{line.itemName}</td>
                                  <td className="px-3 py-2 text-right font-mono">{line.quantity}</td>
                                  <td className="px-3 py-2 text-right font-mono">{formatCurrency(line.rate, invoice.currencyCode)}</td>
                                  <td className="px-3 py-2 text-right font-mono font-bold">{formatCurrency(line.amount, invoice.currencyCode)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic py-4 text-center">
                        Inventory line items have not been fetched or are not required in Phase 1.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ================================================================= */}
          {/* RIGHT COLUMN: PERSISTENT HISTORY SIDEBAR (4 COLS)                 */}
          {/* ================================================================= */}
          <div className="lg:col-span-4 lg:sticky lg:top-20">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs flex flex-col max-h-[calc(100vh-6rem)]">
              {/* Sidebar Header */}
              <div className="px-4 py-3.5 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200">
                    <History size={15} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-xs tracking-tight">Audit Trail & History</h3>
                    <p className="text-[10px] text-gray-500">Persistent Post-Dispatch Timeline</p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {invoice.history?.length || 0}
                </span>
              </div>

              {/* Independently Scrollable Timeline List */}
              <div className="p-4 overflow-y-auto flex-1 space-y-4">
                {!invoice.history || invoice.history.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-6">No history events recorded yet.</p>
                ) : (
                  <div className="relative border-l-2 border-gray-200 ml-2.5 pl-4 space-y-5">
                    {invoice.history.map((hist: any) => {
                      const isApprove = hist.eventType.includes("APPROVED");
                      const isReject = hist.eventType.includes("REJECTED");
                      const isForceArchive = hist.eventType === "INVOICE_FORCE_ARCHIVED";

                      return (
                        <div key={hist.id} className="relative">
                          {/* Timeline dot */}
                          <div
                            className={`absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full border-2 bg-white ${
                              isApprove
                                ? "border-emerald-600 bg-emerald-50"
                                : isReject
                                ? "border-amber-600 bg-amber-50"
                                : isForceArchive
                                ? "border-purple-600 bg-purple-50"
                                : "border-[#1A2766] bg-blue-50"
                            }`}
                          />
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-bold font-mono text-gray-900">
                                {hist.eventType.replace(/_/g, " ")}
                              </span>
                              {hist.workflowType && (
                                <span className="text-[9px] font-semibold uppercase bg-gray-100 text-gray-600 px-1 py-0.2 rounded">
                                  {hist.workflowType}
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-gray-400">
                              {format(new Date(hist.createdAt), "dd MMM yyyy · hh:mm:ss a")}
                            </p>

                            <p className="text-xs text-gray-600">
                              By: <strong className="text-gray-800">{hist.userName || "System"}</strong>
                            </p>

                            {hist.rejectionReason && (
                              <div className="text-xs text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-1">
                                <strong>Reason:</strong> {hist.rejectionReason}
                              </div>
                            )}

                            {hist.metadata?.notes && (
                              <div className="text-xs text-purple-900 bg-purple-50 p-2 rounded-lg border border-purple-200 mt-1">
                                <strong>Notes:</strong> {hist.metadata.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Rejection Confirmation Modal with Mandatory Remark */}
      {rejectModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-red-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-red-900 text-sm">
                  Reject {rejectModal.workflowType === "RECEIVING" ? "Customer Receiving" : "Physical Check"} Submission
                </h3>
                <p className="text-xs text-red-700">Submission #{rejectModal.submissionNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setRejectModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-gray-400 hover:text-gray-700 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-600 leading-relaxed">
                Rejecting this evidence will return the workflow to <strong>Rework Required</strong> on mobile warehouse devices.
                The existing submission and photos will be preserved in permanent history.
              </p>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Rejection Remarks <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this submission is rejected (e.g., customer stamp missing, blurry photo, damaged goods)..."
                  className="w-full text-xs p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModal((prev) => ({ ...prev, isOpen: false }))}
                  disabled={submittingAction}
                  className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={submittingAction || !rejectionReason.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                >
                  {submittingAction ? <Loader2 size={13} className="animate-spin" /> : null}
                  <span>Reject Submission</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {activePhoto && (
        <MobileImagePreview
          isOpen={true}
          imageUrl={activePhoto.url}
          title={activePhoto.title}
          onClose={() => setActivePhoto(null)}
        />
      )}
    </div>
  );
}
