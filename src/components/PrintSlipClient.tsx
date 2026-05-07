'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
          <Link href="/staff/dashboard" className="text-sm text-[#1A2766] hover:underline">← Back</Link>
          <PrintButton auto={autoprint} />
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
    </div>
  );
}
