'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, AlertCircle, ExternalLink, ChevronDown, Info, Loader2, Copy, Activity, XCircle, Printer, RefreshCw } from 'lucide-react';
import PrintButton from '@/components/PrintButton';
import { generateMasterSlip, generateZoneSlip, PrintPayload } from '@/lib/print/slip-renderer';
import ThermalSlip from '@/components/thermal-preview/ThermalSlip';

export default function PrintSlipClient({
  cartId,
  serverPayload,
}: {
  cartId: string;
  serverPayload: PrintPayload | null;
}) {
  const [payload, setPayload] = useState<PrintPayload | null>(serverPayload);
  const [showZoneSlips, setShowZoneSlips] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timings, setTimings] = useState<Record<string, number>>({});
  const [mountTimePerf, setMountTimePerf] = useState<number | null>(null);
  const mountTimeAbsolute = useRef(Date.now());
  const [backendPerf, setBackendPerf] = useState<any>(null);
  const searchParams = useSearchParams();

  // Baseline Visibility
  const [showDebug, setShowDebug] = useState(false);
  useEffect(() => {
    const isDev = process.env.NODE_ENV !== 'production';
    const hasDebugParam = searchParams.get('debugPerf') === 'true';
    setShowDebug(isDev || hasDebugParam);
    setMountTimePerf(performance.now());
  }, [searchParams]);

  // Hydration & Diagnostic Reconstruction
  useEffect(() => {
    const tMount = mountTimeAbsolute.current;
    try {
      const diagRaw = sessionStorage.getItem(`dispatch_diag_${cartId}`);
      if (diagRaw) {
        const diag = JSON.parse(diagRaw);
        if (diag.payload && !payload) setPayload(diag.payload);
        if (diag.backendPerf) setBackendPerf(diag.backendPerf);
        const clickTime = diag.clickTime;
        const apiDuration = diag.apiDuration;
        const navTime = Math.max(0, tMount - (clickTime + apiDuration));
        setTimings(prev => ({ ...prev, apiRequest: apiDuration, navigation: navTime }));
      }
    } catch (e) {
      console.error('[DIAG_ERROR] Hydration failed', e);
    }
  }, [cartId, payload]);

  // Performance Tracking
  useEffect(() => {
    if (payload && mountTimePerf !== null) {
      const nowPerf = performance.now();
      const renderDuration = nowPerf - mountTimePerf;
      setTimings(prev => ({ ...prev, firstPaint: renderDuration }));
      const timer = setTimeout(() => setShowZoneSlips(true), 300);
      return () => clearTimeout(timer);
    }
  }, [payload, mountTimePerf]);

  useEffect(() => {
    if (showZoneSlips && timings.apiRequest && timings.navigation && timings.firstPaint) {
      setTimings(prev => ({
        ...prev,
        totalPerceived: (prev.apiRequest || 0) + (prev.navigation || 0) + (prev.firstPaint || 0)
      }));
    }
  }, [showZoneSlips, timings.apiRequest, timings.navigation, timings.firstPaint]);

  // Zoho Sync State
  const [zohoStatus, setZohoStatus] = useState<{
    status: 'PENDING' | 'SUCCESS' | 'FAILED';
    step: string;
    error: string | null;
    id: string | null;
    number: string | null;
    booksUrl: string | null;
    responseTimeMs: number | null;
    payload: any;
    response: any;
    trace: any[] | null;
  }>({
    status: (serverPayload as any)?.zohoSyncStatus || 'PENDING',
    step: (serverPayload as any)?.zohoSyncStep || 'INITIATED',
    error: (serverPayload as any)?.zohoSyncError || null,
    id: (serverPayload as any)?.zohoSalesorderId || null,
    number: (serverPayload as any)?.zohoSalesorderNumber || null,
    booksUrl: (serverPayload as any)?.booksUrl || null,
    responseTimeMs: (serverPayload as any)?.zohoResponseTimeMs || null,
    payload: (serverPayload as any)?.zohoPayload || null,
    response: (serverPayload as any)?.zohoResponse || null,
    trace: (serverPayload as any)?.zohoExecutionTrace || null
  });
  const [retrying, setRetrying] = useState(false);
  const [showZohoDetails, setShowZohoDetails] = useState(false);

  // Status Polling
  useEffect(() => {
    let interval: NodeJS.Timeout;
    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/staff/zoho/sync-status/${cartId}`);
        const data = await res.json();
        if (data.zohoSyncStatus) {
          setZohoStatus({
            status: data.zohoSyncStatus,
            step: data.zohoSyncStep || 'INITIATED',
            error: data.zohoSyncError,
            id: data.zohoSalesorderId,
            number: data.zohoSalesorderNumber,
            booksUrl: data.booksUrl,
            responseTimeMs: data.zohoResponseTimeMs,
            payload: data.zohoPayload,
            response: data.zohoResponse,
            trace: data.zohoExecutionTrace
          });
          if (data.zohoSyncStatus === 'SUCCESS' || data.zohoSyncStatus === 'FAILED') {
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error('Failed to poll Zoho status', err);
      }
    };
    pollStatus();
    interval = setInterval(pollStatus, 2000);
    return () => clearInterval(interval);
  }, [cartId]);

  const [copyingReport, setCopyingReport] = useState(false);
  const copyDebugReport = async () => {
    const report = `
=== ZOHO SYNC DEBUG REPORT ===
Generated: ${new Date().toISOString()}

## DISPATCH INFO
- Dispatch No: ${displayId}
- Internal ID: ${cartId}
- CreatedAt: ${payload?.createdAt}
- Status: ${zohoStatus.status}
- Step: ${zohoStatus.step}

## ZOHO STATUS
- SalesOrder ID: ${zohoStatus.id || 'N/A'}
- SO Number: ${zohoStatus.number || 'N/A'}
- Response Time: ${zohoStatus.responseTimeMs ? `${zohoStatus.responseTimeMs}ms` : 'N/A'}

## EXECUTION TRACE
${Array.isArray(zohoStatus.trace) 
  ? zohoStatus.trace.map((t, idx) => `${idx + 1}. [${t.time}] ${t.step}`).join('\n') 
  : 'No trace available'}

## ERRORS
- Message: ${zohoStatus.error || 'None'}

## PAYLOAD
${JSON.stringify(zohoStatus.payload, null, 2)}

## API RESPONSE
${JSON.stringify(zohoStatus.response, null, 2)}
==============================`.trim();

    try {
      setCopyingReport(true);
      await navigator.clipboard.writeText(report);
      setTimeout(() => setCopyingReport(false), 2000);
    } catch (err) {
      console.error('Failed to copy report:', err);
      setCopyingReport(false);
    }
  };

  const handleZohoRetry = async () => {
    setRetrying(true);
    try {
      const res = await fetch('/api/admin/zoho/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartId })
      });
      const data = await res.json();
      if (!data.success) alert(`Retry failed: ${data.error}`);
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setRetrying(false);
    }
  };

  // Layout Helpers
  const displayId = useMemo(() => payload?.dispatchSlipNumber || payload?.id || '', [payload]);
  const parts = useMemo(() => displayId.split('-'), [displayId]);
  const isSequenceId = useMemo(() => parts.length === 4 && parts[0] === 'KS' && parts[1] === 'DP', [parts]);

  const FormattedId = () => {
    if (!isSequenceId) return <>{displayId}</>;
    return (
      <>{parts.slice(0, 3).join('-')}-<span className="font-bold">{parts[3]}</span></>
    );
  };

  const masterSlipLines = useMemo(() => payload ? generateMasterSlip(payload) : [], [payload]);

  const handleCopyDiag = () => {
    const text = `Dispatch Performance Report
Generated: ${new Date().toISOString()}

[FRONTEND LIFECYCLE]
API Roundtrip: ${timings.apiRequest || 0}ms
Navigation: ${timings.navigation?.toFixed(0) || 0}ms
First Paint: ${timings.firstPaint?.toFixed(0) || 0}ms
Total Perceived: ${timings.totalPerceived?.toFixed(0) || 0}ms

[BACKEND EXECUTION]
Auth Check: ${backendPerf?.auth?.toFixed(1) || 0}ms
Batch Reads: ${backendPerf?.preReads?.toFixed(1) || 0}ms
Dispatch No: ${backendPerf?.dispatchNo?.toFixed(1) || 0}ms
TX Writes: ${backendPerf?.transactionWrites?.toFixed(1) || 0}ms
History Write: ${backendPerf?.historyWrite?.toFixed(1) || 0}ms
API Server Total: ${backendPerf?.apiTotal?.toFixed(1) || 0}ms

[PAYLOAD METRICS]
SKUs: ${backendPerf?.skuCount || 0}
Zones: ${backendPerf?.zoneCount || 0}
Query Count: ${backendPerf?.queryCount || 0}

[INFRASTRUCTURE]
Vercel Region: ${backendPerf?.vercelRegion || 'unknown'}
Runtime: ${backendPerf?.dbType || 'unknown'}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!payload) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow text-center">
          <p className="text-gray-500 font-medium">Cart <code>{cartId}</code> not found.</p>
          <Link href="/staff/dashboard" className="mt-4 inline-block text-[#1A2766] text-sm hover:underline">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative p-4 space-y-6 print:hidden">
      {/* ── OPERATIONAL DIAGNOSTICS PANEL ─────────────────────────────── */}
      {showDebug && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-black/90 text-white text-[9px] p-3 rounded-lg shadow-2xl backdrop-blur-lg border border-white/10 font-mono space-y-2 w-56 pointer-events-auto print:hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="font-bold tracking-tight">DIAGNOSTICS</span>
            </div>
            <button 
              onClick={handleCopyDiag}
              className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded transition-colors text-[8px] uppercase font-bold"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div className="space-y-2.5">
            <div className="space-y-1">
              <p className="text-white/40 uppercase font-bold text-[7px] tracking-widest">Backend Phases</p>
              <div className="flex justify-between"><span>Auth Check</span> <span className="text-white/60">{backendPerf?.auth?.toFixed(0) || 0}ms</span></div>
              <div className="flex justify-between"><span>Batch Reads</span> <span className="text-white/60">{backendPerf?.preReads?.toFixed(0) || 0}ms</span></div>
              <div className="flex justify-between"><span>Dispatch No</span> <span className="text-white/60">{backendPerf?.dispatchNo?.toFixed(0) || 0}ms</span></div>
              <div className="flex justify-between"><span>TX Writes</span> <span className="text-white/60">{backendPerf?.transactionWrites?.toFixed(0) || 0}ms</span></div>
              <div className="flex justify-between"><span>History</span> <span className="text-white/60">{backendPerf?.historyWrite?.toFixed(0) || 0}ms</span></div>
              <div className="flex justify-between border-t border-white/5 pt-0.5">
                <span className="text-blue-400">API Server Total</span> 
                <span className="text-blue-400 font-bold">{backendPerf?.apiTotal?.toFixed(0) || 0}ms</span>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-white/40 uppercase font-bold text-[7px] tracking-widest">Frontend Lifecycle</p>
              <div className="flex justify-between"><span>API R-Trip</span> <span className="text-white/60">{timings.apiRequest || 0}ms</span></div>
              <div className="flex justify-between"><span>Navigation</span> <span className="text-white/60">{timings.navigation?.toFixed(0) || 0}ms</span></div>
              <div className="flex justify-between"><span>First Paint</span> <span className="text-purple-400">{timings.firstPaint?.toFixed(0) || 0}ms</span></div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-1.5 text-[8px]">
              <div className="space-y-0.5">
                <p className="text-white/30 uppercase text-[6px]">Payload</p>
                <div className="flex justify-between px-0.5"><span>SKUs</span> <span>{backendPerf?.skuCount || 0}</span></div>
                <div className="flex justify-between px-0.5"><span>Zones</span> <span>{backendPerf?.zoneCount || 0}</span></div>
                <div className="flex justify-between px-0.5"><span>Queries</span> <span>~{backendPerf?.queryCount || 0}</span></div>
              </div>
              <div className="space-y-0.5">
                <p className="text-white/30 uppercase text-[6px]">Infrastructure</p>
                <div className="flex justify-between px-0.5"><span>Region</span> <span className="text-yellow-500 uppercase">{backendPerf?.vercelRegion || '-'}</span></div>
                <div className="flex justify-between px-0.5"><span>DB</span> <span>{backendPerf?.dbType || '-'}</span></div>
              </div>
            </div>

            <div className="border-t border-white/20 pt-1.5 mt-1 flex justify-between items-center">
              <span className="font-bold text-white text-[10px]">TOTAL TIME</span> 
              <span className="font-bold text-white text-[11px] bg-white/10 px-1.5 py-0.5 rounded leading-none">
                {timings.totalPerceived?.toFixed(0) || 0}ms
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Screen-only controls ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between shadow-sm sticky top-4 z-[50]">
        <div>
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            Print Center — <FormattedId />
          </h2>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-xs text-gray-500">80mm Thermal Optimization Active</p>
            <div className="h-3 w-px bg-gray-200" />
            <div className="flex items-center gap-1.5">
              <Activity size={12} className="text-emerald-500" />
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tight">Direct Printer Link Ready</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* ── CONDENSED ZOHO SYNC STATUS ─────────────────────────────── */}
          <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg px-3 py-1.5 shadow-sm min-w-[320px]">
            <div className="flex flex-col flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Zoho Books Sync</span>
                {zohoStatus.responseTimeMs && (
                  <span className="text-[9px] text-gray-300 font-mono">{zohoStatus.responseTimeMs}ms</span>
                )}
              </div>

              {zohoStatus.status === 'SUCCESS' || !!zohoStatus.id ? (
                <div className="flex items-center gap-3 py-1">
                  <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <CheckCircle2 size={14} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-tight">Zoho SO:</span>
                    <span className="text-[11px] font-mono font-black text-gray-800">{zohoStatus.number}</span>
                    {zohoStatus.id && (
                      <a 
                        href={`https://books.zoho.in/app/${process.env.NEXT_PUBLIC_ZOHO_ORG_ID || ''}#/salesorders/${zohoStatus.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 hover:bg-gray-100 rounded transition-colors text-emerald-600"
                      >
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              ) : (zohoStatus.status === 'FAILED' || (!zohoStatus.id && zohoStatus.status !== 'SUCCESS')) ? (
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${zohoStatus.status === 'FAILED' ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'}`}>
                    {zohoStatus.status === 'FAILED' ? <AlertCircle size={18} /> : <Loader2 size={18} className="animate-spin" />}
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-xs font-black uppercase tracking-tight ${zohoStatus.status === 'FAILED' ? 'text-red-700' : 'text-yellow-700'}`}>
                      {zohoStatus.status === 'FAILED' ? 'Sync Failed' : 'Sync Pending'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 truncate max-w-[120px]">
                        {zohoStatus.error || (zohoStatus.status === 'FAILED' ? 'API Error' : 'Waiting for Zoho...')}
                      </span>
                      <button 
                        onClick={handleZohoRetry} 
                        disabled={retrying} 
                        className="text-[10px] text-blue-700 hover:underline font-black uppercase"
                      >
                        {retrying ? 'Retrying...' : 'Retry Now'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 size={14} className="text-yellow-600 animate-spin" />
                    <span className="text-xs font-black text-yellow-700 uppercase tracking-tight animate-pulse">
                      {zohoStatus.step.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="h-10 w-px bg-gray-100 mx-1" />

            <button 
              onClick={() => setShowZohoDetails(true)}
              className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-400"
            >
              <Info size={18} />
            </button>
          </div>

          <Link href="/staff/dashboard" className="text-sm text-[#1A2766] hover:underline">← Back</Link>
          <PrintButton payload={payload} />
        </div>
      </div>

      <div className="flex flex-col items-center gap-8 py-8 bg-gray-100 rounded-2xl min-h-[80vh]">
        <div className="text-center space-y-2">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Operational Preview</h3>
          <p className="text-[10px] text-gray-400 italic">Exactly as it will appear on 80mm paper</p>
        </div>

        <ThermalSlip lines={masterSlipLines} />

        {showZoneSlips && Object.entries(payload.zoneGroups).map(([zone, zItems], idx) => (
          <ThermalSlip key={idx} lines={generateZoneSlip(zone, zItems, payload)} />
        ))}
      </div>

      {/* ── ZOHO DETAILS MODAL ────────────────────────────────────────── */}
      {showZohoDetails && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100 scale-in-center animate-in zoom-in-95 duration-200">
            <div className={`p-4 flex items-center justify-between text-white ${zohoStatus.status === 'SUCCESS' ? 'bg-emerald-600' : 'bg-[#AE1B1E]'}`}>
              <div className="flex items-center gap-3">
                <Info size={20} />
                <div>
                  <h3 className="font-bold text-sm">Zoho Sync Diagnostics</h3>
                  <p className="text-[10px] opacity-80 uppercase tracking-widest font-bold">
                    Dispatch: {displayId}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={copyDebugReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-white/20 active:scale-95"
                >
                  {copyingReport ? <>Report Copied!</> : <><Copy size={12} /> Copy Debug Report</>}
                </button>
                <button onClick={() => setShowZohoDetails(false)} className="hover:bg-white/20 p-2 rounded-lg transition-colors">
                  <ChevronDown size={20} className="rotate-90" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Status Header */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Status</span>
                  <div className={`text-sm font-black uppercase ${zohoStatus.status === 'SUCCESS' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {zohoStatus.status}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Sales Order ID</span>
                  <div className="text-sm font-mono font-bold text-gray-700 truncate">{zohoStatus.id || 'N/A'}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">SO Number</span>
                  <div className="text-sm font-mono font-bold text-gray-700">{zohoStatus.number || 'N/A'}</div>
                </div>
              </div>

              {/* Execution Trace */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Activity size={12} className="text-gray-500" />
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-700">Execution Trace</h4>
                </div>
                <div className="bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
                  {zohoStatus.trace && Array.isArray(zohoStatus.trace) && zohoStatus.trace.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {zohoStatus.trace.map((t, idx) => (
                        <div key={idx} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-100/50 transition-colors">
                          <div className="flex items-center gap-3">
                            {t.step === 'SYNC_COMPLETED' ? (
                              <CheckCircle2 size={12} className="text-emerald-500" />
                            ) : t.step === 'SYNC_CRASHED' ? (
                              <XCircle size={12} className="text-rose-500" />
                            ) : (
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                            )}
                            <span className="text-[10px] font-mono font-bold text-gray-700">{t.step}</span>
                          </div>
                          <span className="text-[9px] font-mono text-gray-400">{new Date(t.time).toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center"><p className="text-[10px] text-gray-400 italic">No trace recorded yet</p></div>
                  )}
                </div>
              </div>

              {zohoStatus.error && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3">
                  <AlertCircle className="text-red-600 mt-0.5 flex-shrink-0" size={16} />
                  <div>
                    <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider block mb-0.5">Error Message</span>
                    <p className="text-sm text-red-900 font-medium">{zohoStatus.error}</p>
                  </div>
                </div>
              )}

              {/* JSON Inspectors */}
              <div className="space-y-4">
                <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
                  <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Request Payload</span>
                  </div>
                  <pre className="p-4 text-[10px] text-blue-300 font-mono overflow-x-auto max-h-[200px]">
                    {JSON.stringify(zohoStatus.payload, null, 2)}
                  </pre>
                </div>

                <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
                  <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">API Response</span>
                  </div>
                  <pre className="p-4 text-[10px] text-emerald-400 font-mono overflow-x-auto max-h-[200px]">
                    {JSON.stringify(zohoStatus.response, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-50 flex items-center justify-between bg-gray-50/50">
              {zohoStatus.status === 'SUCCESS' ? (
                <a 
                  href={`https://books.zoho.in/app/${process.env.NEXT_PUBLIC_ZOHO_ORG_ID || ''}#/salesorders/${zohoStatus.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-xs font-bold text-emerald-700 hover:underline"
                >
                  Open in Zoho Books <ExternalLink size={14} />
                </a>
              ) : (
                <div className="text-xs text-gray-400 font-medium">Verify your OAuth connection in Zoho Debug</div>
              )}
              <button 
                onClick={() => setShowZohoDetails(false)}
                className="px-6 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-black transition-colors shadow-sm"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
