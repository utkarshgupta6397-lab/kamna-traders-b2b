'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { RefreshCw, CheckCircle2, AlertCircle, ExternalLink, ChevronDown, ChevronRight, Info, Eye, Loader2, Copy, Activity, XCircle } from 'lucide-react';
import PrintButton from '@/components/PrintButton';

type PrintItem = {
  skuId: string;
  name: string;
  qty: number;
  unit: string;
  zone: string;
};

type PrintPayload = {
  id: string;
  dispatchSlipNumber: string;
  customerName: string;
  notes: string | null;
  createdAt: string;
  warehouseName: string;
  staffName: string;
  items: PrintItem[];
  zoneGroups: Record<string, PrintItem[]>;
  qrPayload: string;
  // Zoho Integration Status
  zohoSyncStatus?: string | null;
  zohoSyncStep?: string | null;
  zohoSyncError?: string | null;
  zohoSalesorderId?: string | null;
  zohoSalesorderNumber?: string | null;
  zohoPayload?: any;
  zohoResponse?: any;
  zohoResponseTimeMs?: number | null;
  zohoExecutionTrace?: any;
  booksUrl?: string | null;
};

export default function PrintSlipClient({
  cartId,
  autoprint,
  serverPayload,
}: {
  cartId: string;
  autoprint: boolean;
  serverPayload: PrintPayload | null;
}) {
  const [payload, setPayload] = useState<PrintPayload | null>(serverPayload);
  const [showZoneSlips, setShowZoneSlips] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timings, setTimings] = useState<Record<string, number>>({});
  const [mountTimePerf, setMountTimePerf] = useState<number | null>(null);
  // Capture mount time synchronously during first render, not in useEffect
  const mountTimeAbsolute = useRef(Date.now());
  const [backendPerf, setBackendPerf] = useState<any>(null);
  const searchParams = useSearchParams();

  const handleCopy = () => {
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
TX Total: ${backendPerf?.transactionTotal?.toFixed(1) || 0}ms
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

  const [showDebug, setShowDebug] = useState(false);

  // 1. Initialize Baseline & Visibility
  useEffect(() => {
    const isDev = process.env.NODE_ENV !== 'production';
    const hasDebugParam = searchParams.get('debugPerf') === 'true';
    setShowDebug(isDev || hasDebugParam);
    
    // Use performance.now() for internal durations on this page
    setMountTimePerf(performance.now());
  }, [searchParams]);

  // 2. Data Hydration & Diagnostic Reconstruction
  useEffect(() => {
    // Use the ref captured during first render, not Date.now() inside effect
    // (effects fire AFTER paint, inflating navigation by hydration time)
    const tMount = mountTimeAbsolute.current;
    
    try {
      const diagRaw = sessionStorage.getItem(`dispatch_diag_${cartId}`);
      if (diagRaw) {
        const diag = JSON.parse(diagRaw);
        
        // Restore Payload
        if (diag.payload && !payload) {
          setPayload(diag.payload);
        }
        
        // Restore Backend Diagnostics
        if (diag.backendPerf) {
          setBackendPerf(diag.backendPerf);
        }

        // Calculate Timing Breakdown
        const clickTime = diag.clickTime;
        const apiDuration = diag.apiDuration;
        const navTime = Math.max(0, tMount - (clickTime + apiDuration));
        
        setTimings(prev => ({
          ...prev,
          apiRequest: apiDuration,
          navigation: navTime,
        }));
      }
    } catch (e) {
      console.error('[DIAG_ERROR] Hydration failed', e);
    }
  }, [cartId, payload]);

  // 3. Render Tracking
  useEffect(() => {
    if (payload && mountTimePerf !== null) {
      const nowPerf = performance.now();
      const renderDuration = nowPerf - mountTimePerf;
      
      setTimings(prev => ({
        ...prev,
        firstPaint: renderDuration,
      }));

      const timer = setTimeout(() => {
        setShowZoneSlips(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [payload, mountTimePerf]);

  // 4. Final Perceived Calculation
  useEffect(() => {
    if (showZoneSlips && timings.apiRequest && timings.navigation && timings.firstPaint) {
      setTimings(prev => ({
        ...prev,
        totalPerceived: (prev.apiRequest || 0) + (prev.navigation || 0) + (prev.firstPaint || 0)
      }));
    }
  }, [showZoneSlips, timings.apiRequest, timings.navigation, timings.firstPaint]);

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

  // 1.5. Zoho Sync Status Polling (High Frequency: 2s)
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

          // Stop polling if done
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
Environment: ${process.env.NODE_ENV || 'unknown'}

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

## ENVIRONMENT INFO
- NODE_ENV: ${process.env.NODE_ENV}
- hasPayload: ${!!zohoStatus.payload}
- hasResponse: ${!!zohoStatus.response}
- hasTrace: ${!!zohoStatus.trace}
==============================
    `.trim();

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
      if (data.success) {
        // Status will be updated by polling
      } else {
        alert(`Retry failed: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setRetrying(false);
    }
  };

  const displayId = useMemo(() => payload?.dispatchSlipNumber || payload?.id || '', [payload]);
  const parts = useMemo(() => displayId.split('-'), [displayId]);
  const isSequenceId = useMemo(() => parts.length === 4 && parts[0] === 'KS' && parts[1] === 'DP', [parts]);

  const FormattedId = () => {
    if (!isSequenceId) return <>{displayId}</>;
    return (
      <>
        {parts.slice(0, 3).join('-')}-<span className="font-bold">{parts[3]}</span>
      </>
    );
  };

  const dateStr = useMemo(() => {
    if (!payload) return '';
    return new Date(payload.createdAt).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata'
    }).replace(/ /g, '-') + ' ' + new Date(payload.createdAt).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
    });
  }, [payload]);

  const zoneGroups = useMemo(() => payload?.zoneGroups || {}, [payload]);

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
    <div className="relative p-4 space-y-6 print:space-y-0 print:p-0" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as any}>
      {/* ── OPERATIONAL DIAGNOSTICS PANEL ─────────────────────────────── */}
      {showDebug && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-black/90 text-white text-[9px] p-3 rounded-lg shadow-2xl backdrop-blur-lg border border-white/10 font-mono space-y-2 w-56 pointer-events-auto print:hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="font-bold tracking-tight">DIAGNOSTICS</span>
            </div>
            <button 
              onClick={handleCopy}
              className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded transition-colors text-[8px] uppercase font-bold"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div className="space-y-2.5">
            {/* Backend Phases */}
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

            {/* Frontend Lifecycle */}
            <div className="space-y-1">
              <p className="text-white/40 uppercase font-bold text-[7px] tracking-widest">Frontend Lifecycle</p>
              <div className="flex justify-between"><span>API R-Trip</span> <span className="text-white/60">{timings.apiRequest || 0}ms</span></div>
              <div className="flex justify-between"><span>Navigation</span> <span className="text-white/60">{timings.navigation?.toFixed(0) || 0}ms</span></div>
              <div className="flex justify-between"><span>First Paint</span> <span className="text-purple-400">{timings.firstPaint?.toFixed(0) || 0}ms</span></div>
            </div>

            {/* Diagnostics & Env */}
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

            {/* End to End */}
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
      <div className="print:hidden bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between shadow-sm">
        <div>
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            Print Center — <FormattedId />
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Set printer paper to 80mm · margins to None · scale to 100%
          </p>
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
                <div className="flex items-center gap-3 animate-in fade-in zoom-in-95 duration-500 py-1">
                  <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner">
                    <CheckCircle2 size={14} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-tight whitespace-nowrap">Zoho SO:</span>
                    <span className="text-[11px] font-mono font-black text-gray-800 tracking-tighter">{zohoStatus.number}</span>
                    {zohoStatus.id ? (
                      <a 
                        href={`https://books.zoho.in/app/${process.env.NEXT_PUBLIC_ZOHO_ORGANIZATION_ID || "60027595766"}#/salesorders/${zohoStatus.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 p-1 hover:bg-gray-100 rounded transition-colors text-emerald-600"
                        title="Open in Zoho Books"
                      >
                        <ExternalLink size={10} />
                      </a>
                    ) : (
                      <div 
                        className="ml-1 p-1 text-gray-300 cursor-not-allowed"
                        title="Zoho Sales Order link unavailable"
                      >
                        <ExternalLink size={10} />
                      </div>
                    )}
                  </div>
                </div>
              ) : zohoStatus.status === 'FAILED' ? (
                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-600 shadow-inner">
                    <AlertCircle size={18} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-red-700 uppercase tracking-tight">Sync Failed</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-red-400 font-medium truncate max-w-[120px]" title={zohoStatus.error || ''}>
                        {zohoStatus.error || 'API Error'}
                      </span>
                      <button 
                        onClick={handleZohoRetry}
                        disabled={retrying}
                        className="text-[10px] text-red-700 hover:underline font-black uppercase"
                      >
                        {retrying ? 'Retrying...' : 'Retry'}
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
                  {/* Step Progress Bar */}
                  <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-500 transition-all duration-500 ease-out"
                      style={{ 
                        width: zohoStatus.step === 'INITIATED' ? '15%' :
                               zohoStatus.step === 'PREPARING_PAYLOAD' ? '35%' :
                               zohoStatus.step === 'REFRESHING_TOKEN' ? '60%' :
                               zohoStatus.step === 'WAITING_FOR_ZOHO_RESPONSE' ? '85%' : '0%'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="h-10 w-px bg-gray-100 mx-1" />

            <button 
              onClick={() => setShowZohoDetails(true)}
              className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-400"
              title="View Logs"
            >
              <Info size={18} />
            </button>
          </div>

          <Link href="/staff/dashboard" className="text-sm text-[#1A2766] hover:underline">← Back</Link>
          <PrintButton auto={autoprint} payload={payload} />
        </div>
      </div>

      {/* ── MASTER SLIP ────────────────────────────────────────────────── */}
      <div className="bg-white w-[80mm] mx-auto print:mx-0 shadow-sm print:shadow-none font-mono text-sm print:break-after-page border border-gray-100 print:border-none">
        <div className="relative text-center border-b-2 border-dashed border-black py-3 mb-3">
          <p className="text-base font-black uppercase tracking-widest">Kamna Traders</p>
          <p className="text-[10px] text-gray-500">Master Dispatch Slip</p>
          {isSequenceId && (
            <div className="absolute top-2 right-2 bg-black text-white rounded-md px-2 py-0.5 shadow-sm print:shadow-none">
              <span className="text-sm font-black tracking-widest leading-none">{parts[3]}</span>
            </div>
          )}
        </div>

        <div className="px-3 space-y-0.5 text-xs mb-3">
          <p><span>Dispatch No:</span> <FormattedId /></p>
          <p><span className="font-bold">Date:</span> {dateStr}</p>
          <p><span className="font-bold">Warehouse:</span> {payload.warehouseName}</p>
          <p><span className="font-bold">Customer:</span> {payload.customerName}</p>
          {payload.notes && <p><span className="font-bold">Notes:</span> {payload.notes}</p>}
          <p><span className="font-bold">Staff:</span> {payload.staffName}</p>
        </div>

        <div className="border-t-2 border-b-2 border-dashed border-black py-2 px-3 mb-3">
          {Object.entries(zoneGroups).map(([zone, zItems], gIdx) => (
            <div key={gIdx} className="mb-4 last:mb-0">
              <div className="bg-gray-50 px-2 py-0.5 mb-2 border-l-4 border-black">
                <p className="text-[10px] font-black uppercase tracking-widest">{zone}</p>
              </div>
              <table className="w-full text-[11px] table-fixed">
                <tbody>
                  {zItems.map((item: PrintItem, idx: number) => (
                    <tr key={idx} className="border-b border-dotted border-gray-100 last:border-0 align-top">
                      <td className="py-1.5 pr-2">
                        <p className="text-[11px] font-bold leading-tight">{item.skuId}</p>
                        <p className="text-[9px] text-gray-500 leading-tight mt-0.5">{item.name}</p>
                      </td>
                      <td className="py-1.5 text-right font-bold whitespace-nowrap w-20">
                        {item.qty} {item.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center py-4 border-t border-dotted border-gray-300">
          <div className="mb-2">
            <QRCodeSVG value={payload.qrPayload} size={100} level="M" />
          </div>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">Scan to verify</p>
        </div>
        <p className="text-center text-[10px] italic pb-2 text-gray-400">— End of Master Slip —</p>
        <div className="hidden print:block text-[4px]" aria-hidden="true">
          {"\x0A\x0A\x0A\x1D\x56\x01"}
        </div>
      </div>

      {/* ── ZONE SLIPS (LAZY RENDERED) ─────────────────────────────────── */}
      {showZoneSlips && Object.entries(zoneGroups).map(([zone, zItems], idx) => (
        <div key={idx} className="bg-white w-[80mm] mx-auto print:mx-0 shadow-sm print:shadow-none font-mono text-sm print:break-after-page border border-gray-100 print:border-none animate-in fade-in duration-700">
          <div className="relative text-center border-b-2 border-black py-2 mb-2">
            <p className="text-xs font-black uppercase tracking-widest">Zone Slip · {zone}</p>
            <p className="text-[10px]">No: <FormattedId /> · {payload.warehouseName}</p>
          </div>
          <div className="px-3 text-[10px] mb-2 flex justify-between items-center text-gray-500">
            <span>{dateStr}</span>
            <span className="font-bold text-gray-800 uppercase max-w-[120px] truncate" title={payload.customerName}>{payload.customerName}</span>
          </div>
          <div className="border-t border-dashed border-black px-3 pb-3">
            <table className="w-full text-xs mt-1 table-fixed">
              <thead>
                <tr className="border-b border-gray-400">
                  <th className="text-left pb-1 font-bold w-[70%]">SKU / Product</th>
                  <th className="text-right pb-1 font-bold w-[30%]">Qty</th>
                </tr>
              </thead>
              <tbody>
                {zItems.map((item: PrintItem, i: number) => (
                  <tr key={i} className="border-b border-dotted border-gray-200 align-top">
                    <td className="py-1.5 pr-2">
                      <p className="text-[11px] font-bold leading-tight">{item.skuId}</p>
                      <p className="text-[9px] text-gray-500 leading-tight mt-0.5">{item.name}</p>
                    </td>
                    <td className="py-1.5 text-right font-black text-sm whitespace-nowrap">
                      {item.qty} {item.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center text-[10px] italic pb-2 text-gray-400">— End of Zone Slip —</p>
          <div className="hidden print:block text-[4px]" aria-hidden="true">
            {"\x0A\x0A\x0A\x1D\x56\x01"}
          </div>
        </div>
      ))}
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
                {process.env.NODE_ENV === 'development' && (
                  <button 
                    onClick={copyDebugReport}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-white/20 active:scale-95"
                  >
                    {copyingReport ? (
                      <>Report Copied!</>
                    ) : (
                      <>
                        <Copy size={12} />
                        Copy Debug Report
                      </>
                    )}
                  </button>
                )}
                <button 
                  onClick={() => setShowZohoDetails(false)}
                  className="hover:bg-white/20 p-2 rounded-lg transition-colors"
                >
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
                  <div className="text-sm font-mono font-bold text-gray-700 truncate">
                    {zohoStatus.id || 'N/A'}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">SO Number</span>
                  <div className="text-sm font-mono font-bold text-gray-700">
                    {zohoStatus.number || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Execution Trace */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center text-gray-500">
                    <Activity size={12} />
                  </div>
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
                          <span className="text-[9px] font-mono text-gray-400">
                            {new Date(t.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <p className="text-[10px] text-gray-400 italic">No trace recorded yet</p>
                    </div>
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
              {zohoStatus.id ? (
                <a 
                  href={`https://books.zoho.in/app/${process.env.NEXT_PUBLIC_ZOHO_ORGANIZATION_ID || "60027595766"}#/salesorders/${zohoStatus.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs font-bold text-emerald-700 hover:underline"
                >
                  Open in Zoho Books <ExternalLink size={14} />
                </a>
              ) : (
                <div className="text-xs text-gray-400 font-medium">Zoho Sales Order link unavailable</div>
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
