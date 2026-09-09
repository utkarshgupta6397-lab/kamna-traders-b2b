'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, X, Activity, Clock, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface ApiUsageData {
  todayTotal: number;
  todayInvoiceList: number;
  todayInvoiceDetail: number;
  todayInvoices?: number;
  todayEInvoice: number;
  todayOther: number;
  lastSuccessfulSync: string | null;
  nextScheduledSync: string | null;
  lastEInvoiceCheck: string | null;
  nextScheduledEInvoiceCheck: string | null;
}

interface SyncApiUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
}

export default function SyncApiUsageModal({
  isOpen,
  onClose,
  onSyncComplete,
}: SyncApiUsageModalProps) {
  const [usage, setUsage] = useState<ApiUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [checkingEInvoice, setCheckingEInvoice] = useState(false);
  const [eInvoiceReport, setEInvoiceReport] = useState<{
    eligible: number;
    processed: number;
    remaining: number;
    failed: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/mobile/post-dispatch/sync/status');
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.usage) {
        setUsage(data.usage);
      } else if (res.status === 403) {
        setErrorMessage(data.error || 'Forbidden. Post-Dispatch access required.');
      } else {
        setErrorMessage(data.error || data.message || 'Failed to retrieve API telemetry.');
      }
    } catch (err) {
      console.error('[Fetch API Usage Error]', err);
      setErrorMessage('Network or server error while fetching telemetry.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEligibleEInvoiceCount = useCallback(async () => {
    try {
      const res = await fetch('/api/mobile/post-dispatch/einvoice/status');
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.eligibleCount === 'number') {
        setEInvoiceReport((prev) => ({
          eligible: data.eligibleCount,
          processed: prev?.processed ?? 0,
          remaining: prev?.remaining ?? data.eligibleCount,
          failed: prev?.failed ?? 0,
        }));
      }
    } catch (err) {
      console.warn('[Fetch E-Invoice Count Error]', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchUsage();
      fetchEligibleEInvoiceCount();
    }
  }, [isOpen, fetchUsage, fetchEligibleEInvoiceCount]);

  if (!isOpen) return null;

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/mobile/post-dispatch/sync', {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Sync failed');
      }

      toast.success(data.message || 'Sync completed successfully!');
      await fetchUsage();
      await fetchEligibleEInvoiceCount();
      if (onSyncComplete) onSyncComplete();
    } catch (err: unknown) {
      console.error('[Manual Sync Error]', err);
      const errMsg = err instanceof Error ? err.message : 'Unable to synchronize invoices. Please try again.';
      toast.error(errMsg);
    } finally {
      setSyncing(false);
    }
  };

  const handleCheckEInvoice = async () => {
    setCheckingEInvoice(true);
    try {
      const res = await fetch('/api/mobile/post-dispatch/einvoice/status', {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || 'E-Invoice status check failed');
      }

      if (data.result) {
        setEInvoiceReport({
          eligible: data.result.eligibleCount,
          processed: data.result.processedCount,
          remaining: data.result.remainingCount,
          failed: data.result.failedCount,
        });
      }

      toast.success(data.message || 'E-Invoice check completed!');
      await fetchUsage();
      if (onSyncComplete) onSyncComplete();
    } catch (err: unknown) {
      console.error('[E-Invoice Check Error]', err);
      const errMsg = err instanceof Error ? err.message : 'Unable to check E-Invoice status.';
      toast.error(errMsg);
    } finally {
      setCheckingEInvoice(false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[#1A2766] text-base">Zoho Books Sync & Usage</h3>
              <p className="text-xs text-slate-500">Today&apos;s Post-Dispatch API telemetry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={syncing}
            className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs font-medium">Loading today&apos;s telemetry...</span>
            </div>
          ) : errorMessage ? (
            <div className="py-6 px-4 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
              <h4 className="font-bold text-sm text-slate-800">Access Restricted</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{errorMessage}</p>
              <p className="text-[11px] text-slate-400">Please contact your administrator if you need Post-Dispatch access.</p>
            </div>
          ) : (
            <>
                {/* Today's Usage Grid */}
                <div className="bg-gradient-to-br from-slate-900 to-[#1A2766] rounded-2xl p-4 text-white shadow-lg shadow-blue-950/10">
                  <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Today&apos;s API Usage (IST)
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                      Active
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 text-center mb-2.5">
                    <div className="bg-white/5 rounded-xl p-2.5 border border-white/5 col-span-3">
                      <span className="text-[11px] text-slate-400 block">Total API Calls</span>
                      <span className="text-2xl font-black tracking-tight text-white">
                        {usage?.todayTotal ?? 0}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="bg-white/5 rounded-xl p-2 border border-white/5">
                      <span className="text-[10px] text-slate-400 block">Invoice List Sync</span>
                      <span className="text-lg font-black text-blue-400">
                        {usage?.todayInvoiceList ?? 0}
                      </span>
                    </div>

                    <div className="bg-white/5 rounded-xl p-2 border border-white/5">
                      <span className="text-[10px] text-slate-400 block">Invoice Detail</span>
                      <span className="text-lg font-black text-emerald-400">
                        {usage?.todayInvoiceDetail ?? 0}
                      </span>
                    </div>

                    <div className="bg-white/5 rounded-xl p-2 border border-white/5">
                      <span className="text-[10px] text-slate-400 block">E-Invoice</span>
                      <span className="text-lg font-black text-teal-400">
                        {usage?.todayEInvoice ?? 0}
                      </span>
                    </div>

                    <div className="bg-white/5 rounded-xl p-2 border border-white/5">
                      <span className="text-[10px] text-slate-400 block">Other Calls</span>
                      <span className="text-lg font-black text-slate-300">
                        {usage?.todayOther ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Schedules Info */}
                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Last Invoice Sync
                    </span>
                    <span className="font-bold text-slate-800">
                      {formatIST(usage?.lastSuccessfulSync || null)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      Next Invoice Sync
                    </span>
                    <span className="font-bold text-blue-900">
                      {formatIST(usage?.nextScheduledSync || null)}
                    </span>
                  </div>

                  <div className="pt-1.5 border-t border-slate-200/40 flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                      Last E-Invoice Check
                    </span>
                    <span className="font-bold text-slate-800">
                      {formatIST(usage?.lastEInvoiceCheck || null)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-teal-600" />
                      Next E-Invoice Check
                    </span>
                    <span className="font-bold text-teal-900">
                      {formatIST(usage?.nextScheduledEInvoiceCheck || null)}
                    </span>
                  </div>
                </div>

                {/* Targeted E-Invoice Check Card */}
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-slate-800 text-xs">E-Invoice Status Check</h5>
                    <span className="text-[10px] text-slate-400 font-semibold">Max 100 calls</span>
                  </div>

                  {eInvoiceReport && (
                    <div className="grid grid-cols-4 gap-1.5 text-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Eligible</span>
                        <span className="font-black text-slate-800">{eInvoiceReport.eligible}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Processed</span>
                        <span className="font-black text-emerald-600">{eInvoiceReport.processed}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Remaining</span>
                        <span className="font-black text-amber-600">{eInvoiceReport.remaining}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Failed</span>
                        <span className="font-black text-slate-500">{eInvoiceReport.failed}</span>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleCheckEInvoice}
                    disabled={checkingEInvoice || syncing}
                    className="w-full py-2 px-3 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-teal-700 ${checkingEInvoice ? 'animate-spin' : ''}`} />
                    <span>{checkingEInvoice ? 'Checking Status...' : 'Check E-Invoice Status'}</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={syncing || checkingEInvoice}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-100 transition-colors"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleManualSync}
              disabled={syncing || checkingEInvoice || !!errorMessage}
              className="flex-1 py-3 px-4 rounded-xl bg-[#1A2766] hover:bg-[#141f52] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-900/10 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Invoices'}</span>
            </button>
          </div>
      </div>
    </div>
  );
}
