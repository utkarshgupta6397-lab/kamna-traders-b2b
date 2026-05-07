'use client';

import { useEffect, useState, useMemo } from 'react';
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
  const [mountTime, setMountTime] = useState<number | null>(null);
  const searchParams = useSearchParams();

  const handleCopy = () => {
    const text = `Dispatch Performance

API Request: ${timings.apiRequest || 0}ms
Navigation: ${timings.navigation?.toFixed(0) || 0}ms
Data Load: ${timings.dataFetch?.toFixed(0) || 0}ms
First Paint: ${timings.firstPaint?.toFixed(0) || 0}ms
Total Perceived: ${timings.totalPerceived?.toFixed(0) || 0}ms`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Performance debug panel visibility
  const showDebug = process.env.NODE_ENV !== 'production' || searchParams.get('debugPerf') === 'true';

  // Initialize client-side timing baselines
  useEffect(() => {
    const now = performance.now();
    setMountTime(now);

    const apiTime = searchParams.get('apiTime');
    const pushTime = searchParams.get('pushTime');

    if (apiTime) {
      setTimings(prev => ({ ...prev, apiRequest: parseInt(apiTime) }));
    }

    if (pushTime) {
      const pTime = parseInt(pushTime);
      setTimings(prev => ({ ...prev, navigation: now - pTime }));
    }
  }, [searchParams]);

  // Try to load from sessionStorage if server didn't provide data
  useEffect(() => {
    if (!payload) {
      const t0 = performance.now();
      try {
        const cached = sessionStorage.getItem(`print_${cartId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          setPayload(parsed);
          sessionStorage.removeItem(`print_${cartId}`);
          setTimings(prev => ({ ...prev, dataFetch: performance.now() - t0 }));
        }
      } catch {}
    } else {
      setTimings(prev => ({ ...prev, dataFetch: 0 })); // Data came from server
    }
  }, [cartId, payload]);

  // Lazy render zone slips after initial paint
  useEffect(() => {
    if (payload && mountTime !== null) {
      // First paint is when Master Slip is rendered (on mount if payload exists)
      setTimings(prev => ({ ...prev, firstPaint: performance.now() - mountTime }));

      const timer = setTimeout(() => {
        setShowZoneSlips(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [payload, mountTime]);

  // Track total perceived time relative to start of API request
  useEffect(() => {
    if (showZoneSlips && mountTime !== null) {
      const apiReq = timings.apiRequest || 0;
      const nav = timings.navigation || 0;
      const render = performance.now() - mountTime;
      setTimings(prev => ({ ...prev, totalPerceived: apiReq + nav + render }));
    }
  }, [showZoneSlips, mountTime, timings.apiRequest, timings.navigation]);

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
      {/* ── PERFORMANCE DEBUG PANEL ───────────────────────────────────── */}
      {showDebug && mountTime !== null && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-black/80 text-white text-[10px] p-3 rounded-lg shadow-xl backdrop-blur-md border border-white/20 font-mono space-y-1.5 w-48 pointer-events-auto print:hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between border-b border-white/20 pb-1 mb-1">
            <p className="font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Performance
            </p>
            <button 
              onClick={handleCopy}
              className="text-[9px] bg-white/10 hover:bg-white/20 px-1.5 py-0.5 rounded transition-colors"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between"><span>API Request</span> <span className={timings.apiRequest > 4000 ? 'text-red-400' : 'text-green-400'}>{timings.apiRequest || 0}ms</span></div>
            <div className="flex justify-between"><span>Navigation</span> <span className="text-blue-400">{timings.navigation?.toFixed(0) || 0}ms</span></div>
            <div className="flex justify-between"><span>Data Load</span> <span className="text-yellow-400">{timings.dataFetch?.toFixed(0) || 0}ms</span></div>
            <div className="flex justify-between"><span>First Paint</span> <span className="text-purple-400">{timings.firstPaint?.toFixed(0) || 0}ms</span></div>
            <div className="flex justify-between border-t border-white/10 pt-1 mt-1">
              <span className="font-bold">Total perceived</span> 
              <span className="font-bold text-white">{timings.totalPerceived?.toFixed(0) || 0}ms</span>
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
