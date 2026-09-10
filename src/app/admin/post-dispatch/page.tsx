'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Ban,
  Eye,
  FileText,
  RotateCcw,
  Loader2,
  Calendar,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';

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

export default function AdminPostDispatchPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'verification' | 'archived'>('all');
  const [search, setSearch] = useState('');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [usage, setUsage] = useState<any | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // 1-second countdown ticker when cooldown is active
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const interval = setInterval(() => {
      setCooldownRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownRemaining]);

  // Verification queue modal state
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [rejectionModal, setRejectionModal] = useState<{
    isOpen: boolean;
    submissionId: string;
    workflowType: string;
    comment: string;
    submitting: boolean;
  }>({
    isOpen: false,
    submissionId: '',
    workflowType: '',
    comment: '',
    submitting: false,
  });

  const fetchUsage = async () => {
    try {
      const res = await fetch('/api/mobile/post-dispatch/sync/status');
      if (res.ok) {
        const data = await res.json();
        setUsage(data.usage);
        if (typeof data.usage?.cooldownRemainingSeconds === 'number') {
          setCooldownRemaining(data.usage.cooldownRemainingSeconds);
        }
      }
    } catch (err) {
      console.error('[Admin PostDispatch Usage Error]', err);
    }
  };

  const fetchInvoices = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('tab', activeTab);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/mobile/post-dispatch/invoices?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
      }
    } catch (err) {
      console.error('[Admin PostDispatch Fetch Error]', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, search]);

  useEffect(() => {
    setLoading(true);
    fetchInvoices();
    fetchUsage();
  }, [fetchInvoices]);

  const handleManualSync = async () => {
    if (cooldownRemaining > 0 || syncing) return;

    setSyncing(true);
    try {
      const res = await fetch('/api/mobile/post-dispatch/sync', {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        const retryAfter = data.retry_after_seconds || 60;
        setCooldownRemaining(retryAfter);
        toast.error(data.message || `Please wait ${retryAfter} seconds before starting another manual sync.`);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Sync failed');
      }

      setCooldownRemaining(60);
      toast.success(data.message || 'Sync completed successfully!');
      await Promise.all([fetchInvoices(), fetchUsage()]);
    } catch (err: any) {
      console.error('[Admin Manual Sync Error]', err);
      toast.error(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenDetail = async (invoiceId: string) => {
    try {
      const res = await fetch(`/api/mobile/post-dispatch/invoices/${invoiceId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedInvoice(data.invoice);
      }
    } catch (err) {
      console.error('[Open Detail Error]', err);
    }
  };

  const handleApproveSubmission = async (workflowType: string, submissionId: string) => {
    try {
      const endpoint =
        workflowType === 'RECEIVING'
          ? `/api/mobile/post-dispatch/receiving/verify/${submissionId}`
          : `/api/mobile/post-dispatch/checked/verify/${submissionId}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Approval failed');
      }

      toast.success('Approved successfully!');
      if (selectedInvoice) {
        handleOpenDetail(selectedInvoice.id);
      }
      fetchInvoices();
    } catch (err: any) {
      toast.error(err.message || 'Approval failed');
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectionModal.comment.trim()) {
      toast.error('Rejection reason is required.');
      return;
    }

    setRejectionModal((prev) => ({ ...prev, submitting: true }));
    try {
      const endpoint =
        rejectionModal.workflowType === 'RECEIVING'
          ? `/api/mobile/post-dispatch/receiving/verify/${rejectionModal.submissionId}`
          : `/api/mobile/post-dispatch/checked/verify/${rejectionModal.submissionId}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REJECT',
          comment: rejectionModal.comment.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Rejection failed');
      }

      toast.success('Rejected and marked for rework.');
      setRejectionModal({
        isOpen: false,
        submissionId: '',
        workflowType: '',
        comment: '',
        submitting: false,
      });

      if (selectedInvoice) {
        handleOpenDetail(selectedInvoice.id);
      }
      fetchInvoices();
    } catch (err: any) {
      toast.error(err.message || 'Rejection failed');
      setRejectionModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  const formatIST = (iso: string | null) => {
    if (!iso) return 'None recorded';
    try {
      return new Date(iso).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header & Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2766]">Post Dispatch Management</h1>
          <p className="text-sm text-slate-500">
            Invoice synchronization, evidence verification, and audit telemetry
          </p>
        </div>

        <button
          type="button"
          onClick={handleManualSync}
          disabled={syncing || cooldownRemaining > 0}
          className="px-4 py-2.5 rounded-xl bg-[#1A2766] hover:bg-[#141f52] text-white font-bold text-sm flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          <span>
            {syncing
              ? 'Syncing Invoices...'
              : cooldownRemaining > 0
              ? `Sync Invoices (${cooldownRemaining}s)`
              : 'Sync Invoices'}
          </span>
        </button>
      </div>

      {/* API Usage & Synchronization Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Today&apos;s Total Calls (IST)
          </span>
          <span className="text-2xl font-black text-[#1A2766] mt-1 block">
            {usage?.todayTotal ?? 0}
          </span>
          <span className="text-[11px] text-slate-500">Resets daily at 00:00 IST</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Invoice Calls
          </span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block">
            {usage?.todayInvoices ?? 0}
          </span>
          <span className="text-[11px] text-slate-500">List & detail requests</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            E-Invoice Calls
          </span>
          <span className="text-2xl font-black text-teal-600 mt-1 block">
            {usage?.todayEInvoice ?? 0}
          </span>
          <span className="text-[11px] text-slate-500">On-demand verification</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Sync Schedule
          </span>
          <div className="mt-1 text-xs space-y-0.5">
            <div>
              Last: <strong className="text-slate-800">{formatIST(usage?.lastSuccessfulSync || null)}</strong>
            </div>
            <div>
              Next: <strong className="text-blue-900">{formatIST(usage?.nextScheduledSync || null)}</strong>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">Every 15m (09:00 - 20:00 IST)</span>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Filters and Tabs */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex gap-1 bg-slate-200/60 p-1 rounded-xl text-xs font-bold">
            {(['all', 'pending', 'verification', 'archived'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg transition-all uppercase ${
                  activeTab === tab
                    ? 'bg-white text-[#1A2766] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice number, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
            />
          </div>
        </div>

        {/* Invoices Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Invoice Number</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Zoho Status</th>
                <th className="px-4 py-3">E-Invoice</th>
                <th className="px-4 py-3">Workflows</th>
                <th className="px-4 py-3">Timer</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading Post Dispatch invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    No invoices matching current filter.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const isVoid = inv.erpSubStatus === 'Void' || inv.zohoStatus.toLowerCase() === 'void';
                  const isDraft = inv.zohoStatus.toLowerCase() === 'draft';

                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isVoid ? 'bg-red-50/20' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-bold text-[#1A2766]">
                        {inv.invoiceNumber}
                      </td>

                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {inv.customerName}
                      </td>

                      <td className="px-4 py-3 font-bold text-slate-900">
                        {formatINR(inv.total)}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            isVoid
                              ? 'bg-red-100 text-red-700'
                              : isDraft
                              ? 'bg-slate-100 text-slate-600'
                              : inv.zohoStatus.toLowerCase() === 'sent'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {inv.zohoStatus}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {inv.eInvoice.generated ? (
                          <span className="inline-flex items-center gap-1 text-teal-700 font-semibold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Generated
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Not Generated</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              inv.workflowSummary.receivingStatus === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : inv.workflowSummary.receivingStatus === 'AWAITING_VERIFICATION'
                                ? 'bg-blue-100 text-blue-800'
                                : inv.workflowSummary.receivingStatus === 'REWORK_REQUIRED'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            Rec: {inv.workflowSummary.receivingStatus}
                          </span>

                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              inv.workflowSummary.checkedStatus === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : inv.workflowSummary.checkedStatus === 'AWAITING_VERIFICATION'
                                ? 'bg-blue-100 text-blue-800'
                                : inv.workflowSummary.checkedStatus === 'REWORK_REQUIRED'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            Chk: {inv.workflowSummary.checkedStatus}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {formatDuration(inv.timer.elapsedSeconds)}
                        {inv.timer.isStopped && (
                          <span className="text-[10px] text-slate-400 ml-1">(stopped)</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(inv.id)}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-[#1A2766] font-bold rounded-lg transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Invoice Detail Drawer/Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-[#1A2766] text-lg">
                  {selectedInvoice.invoiceNumber}
                </h3>
                <p className="text-xs text-slate-500">{selectedInvoice.customerName}</p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Workflows inspection */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider">
                  Workflows & Submissions
                </h4>

                {selectedInvoice.workflows?.map((wf: any) => (
                  <div
                    key={wf.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-sm">
                        {wf.workflowType}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold ${
                          wf.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : wf.status === 'AWAITING_VERIFICATION'
                            ? 'bg-blue-100 text-blue-800'
                            : wf.status === 'REWORK_REQUIRED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {wf.status}
                      </span>
                    </div>

                    {/* Submissions list */}
                    {wf.submissions?.map((sub: any) => (
                      <div
                        key={sub.id}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-700">
                            Submission #{sub.submissionNumber} ({sub.status})
                          </span>
                          <span className="text-slate-400">
                            Uploaded by {sub.uploadedByUserName} on{' '}
                            {new Date(sub.uploadedAt).toLocaleString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                            })}
                          </span>
                        </div>

                        {sub.receivingDetails && (
                          <div>
                            <span className="text-slate-500">Details: </span>
                            <span className="font-medium text-slate-800">
                              {sub.receivingDetails}
                            </span>
                          </div>
                        )}

                        {sub.checkedBy && (
                          <div className="flex gap-4">
                            <span>
                              Checked By: <strong>{sub.checkedBy}</strong>
                            </span>
                            {sub.checkedAt && (
                              <span>
                                Checked At:{' '}
                                <strong>
                                  {new Date(sub.checkedAt).toLocaleString('en-IN', {
                                    timeZone: 'Asia/Kolkata',
                                  })}
                                </strong>
                              </span>
                            )}
                          </div>
                        )}

                        {sub.rejectionComment && (
                          <div className="text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                            Rejection Reason: {sub.rejectionComment}
                          </div>
                        )}

                        {/* Photos */}
                        {sub.files?.length > 0 && (
                          <div className="flex gap-2 overflow-x-auto pt-1">
                            {sub.files.map((f: any) => (
                              <a
                                key={f.id}
                                href={`/api/dispatch/post-dispatch/files/${f.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="block w-16 h-16 rounded-xl overflow-hidden border border-slate-200 hover:scale-105 transition-transform shrink-0"
                              >
                                <img
                                  src={`/api/dispatch/post-dispatch/files/${f.id}`}
                                  alt={f.fileName}
                                  className="w-full h-full object-cover"
                                />
                              </a>
                            ))}
                          </div>
                        )}

                        {/* Actions if awaiting verification */}
                        {sub.status === 'AWAITING_VERIFICATION' && (
                          <div className="flex gap-2 pt-2 border-t border-slate-200/60 justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                setRejectionModal({
                                  isOpen: true,
                                  submissionId: sub.id,
                                  workflowType: wf.workflowType,
                                  comment: '',
                                  submitting: false,
                                })
                              }
                              className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold border border-red-200"
                            >
                              Reject & Reopen
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApproveSubmission(wf.workflowType, sub.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                            >
                              Approve
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* History */}
              <div className="space-y-2 pt-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider">
                  Audit History
                </h4>
                <div className="space-y-1.5">
                  {selectedInvoice.history?.map((h: any) => (
                    <div
                      key={h.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-slate-700">
                          {h.eventType.replace(/_/g, ' ')}
                        </span>
                        <span className="text-slate-400 ml-2">by {h.userName || 'System'}</span>
                        {h.rejectionReason && (
                          <span className="text-red-600 block mt-0.5">
                            Reason: {h.rejectionReason}
                          </span>
                        )}
                      </div>
                      <span className="text-slate-400 text-[10px]">
                        {new Date(h.createdAt).toLocaleString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 font-bold rounded-xl text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Comment Modal */}
      {rejectionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-slate-800">Reject Submission</h3>
            <p className="text-xs text-slate-500">
              Please provide a comment explaining why this submission requires rework.
            </p>
            <textarea
              rows={3}
              value={rejectionModal.comment}
              onChange={(e) =>
                setRejectionModal((prev) => ({ ...prev, comment: e.target.value }))
              }
              placeholder="e.g. Customer stamp not visible..."
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-red-500/20"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() =>
                  setRejectionModal({
                    isOpen: false,
                    submissionId: '',
                    workflowType: '',
                    comment: '',
                    submitting: false,
                  })
                }
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={rejectionModal.submitting || !rejectionModal.comment.trim()}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {rejectionModal.submitting ? 'Rejecting...' : 'Reject & Reopen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
