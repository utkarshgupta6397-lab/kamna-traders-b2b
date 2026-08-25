'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { RefreshCw, X, Download, Share2, ZoomIn } from 'lucide-react';

// ---------------------------------------------------------------------------
// Full-screen viewer with native pinch-zoom / pan
// ---------------------------------------------------------------------------
function FullScreenViewer({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pinch/zoom state
  const scaleRef = useRef(1);
  const originRef = useRef({ x: 0, y: 0 });
  const lastTouchDistRef = useRef<number | null>(null);
  const lastTapRef = useRef<number>(0);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);

  const applyTransform = useCallback(() => {
    if (imgRef.current) {
      imgRef.current.style.transform =
        `translate(${panOffsetRef.current.x}px, ${panOffsetRef.current.y}px) scale(${scaleRef.current})`;
    }
  }, []);

  const resetTransform = useCallback(() => {
    scaleRef.current = 1;
    panOffsetRef.current = { x: 0, y: 0 };
    applyTransform();
  }, [applyTransform]);

  // Prevent body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Handle back gesture / ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const getTouchDist = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastTouchDistRef.current = getTouchDist(e.touches[0], e.touches[1]);
      isPanningRef.current = false;
    } else if (e.touches.length === 1) {
      // Double-tap detection
      const now = Date.now();
      if (now - lastTapRef.current < 280) {
        // Double tap — toggle zoom 1x <-> 2.5x
        if (scaleRef.current > 1.1) {
          resetTransform();
        } else {
          scaleRef.current = 2.5;
          applyTransform();
        }
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;
      panStartRef.current = { x: e.touches[0].clientX - panOffsetRef.current.x, y: e.touches[0].clientY - panOffsetRef.current.y };
      isPanningRef.current = true;
    }
  }, [applyTransform, resetTransform]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      isPanningRef.current = false;
      const dist = getTouchDist(e.touches[0], e.touches[1]);
      if (lastTouchDistRef.current !== null) {
        const delta = dist / lastTouchDistRef.current;
        scaleRef.current = Math.min(8, Math.max(1, scaleRef.current * delta));
        applyTransform();
      }
      lastTouchDistRef.current = dist;
    } else if (e.touches.length === 1 && isPanningRef.current) {
      if (scaleRef.current > 1) {
        panOffsetRef.current = {
          x: e.touches[0].clientX - panStartRef.current.x,
          y: e.touches[0].clientY - panStartRef.current.y,
        };
        applyTransform();
      }
    }
  }, [applyTransform]);

  const onTouchEnd = useCallback(() => {
    lastTouchDistRef.current = null;
    if (scaleRef.current <= 1) {
      panOffsetRef.current = { x: 0, y: 0 };
      applyTransform();
    }
  }, [applyTransform]);

  // Download — fetch the original high-res image and trigger browser download
  const handleDownload = useCallback(async () => {
    try {
      const resp = await fetch(imageUrl);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kamna-solar-panel-stock-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab
      window.open(imageUrl, '_blank');
    }
  }, [imageUrl]);

  const [isSharing, setIsSharing] = useState(false);

  // Share — native Web Share API
  const handleShare = useCallback(async () => {
    if (!navigator.share) return;
    try {
      setIsSharing(true);
      const resp = await fetch(imageUrl);
      const blob = await resp.blob();
      const file = new File([blob], `kamna-solar-panel-stock.png`, { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Kamna Solar Panel Stock' });
      } else {
        // Fallback for browsers that support share but not files
        await navigator.share({ title: 'Kamna Solar Panel Stock', url: imageUrl });
      }
    } catch {
      // User cancelled or not supported — silently ignore
    } finally {
      setIsSharing(false);
    }
  }, [imageUrl]);

  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', display: 'flex', flexDirection: 'column' }}
      ref={containerRef}
    >
      {/* Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10000,
          paddingTop: 'env(safe-area-inset-top)',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
          <button
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fff', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 20, padding: '6px 14px 6px 10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            <X size={18} />
            Close
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {canShare && (
              <button
                onClick={handleShare}
                disabled={isSharing}
                style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#fff', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 20, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: isSharing ? 0.7 : 1 }}
              >
                {isSharing ? <RefreshCw size={15} className="animate-spin" /> : <Share2 size={15} />}
                {isSharing ? 'Preparing...' : 'Share'}
              </button>
            )}
            <button
              onClick={handleDownload}
              style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#fff', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 20, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              <Download size={15} />
              Download
            </button>
          </div>
        </div>
      </div>

      {/* Image area — pinch/zoom/pan */}
      <div
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Solar Panel Stock Report"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            transformOrigin: 'center center',
            transition: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Bottom hint */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
        textAlign: 'center',
        background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 100%)',
        paddingTop: 16,
        pointerEvents: 'none',
      }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, margin: 0 }}>Pinch to zoom · Double-tap to reset</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main viewer component (shown inside the Solar Panel Stock page)
// ---------------------------------------------------------------------------
export default function StockImageViewer() {
  const [timestamp, setTimestamp] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const imageUrl = `/api/internal/generate-stock-image?t=${timestamp}`;

  const handleRefresh = () => {
    setLoading(true);
    setError(false);
    setTimestamp(Date.now());
    setViewerOpen(false);
  };

  return (
    <>
      {/* Full-screen viewer portal */}
      {viewerOpen && !loading && !error && (
        <FullScreenViewer imageUrl={imageUrl} onClose={() => setViewerOpen(false)} />
      )}

      <div className="flex-1 flex flex-col relative bg-[#F8F9FB] min-h-0">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 z-10 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
          <div>
            <h2 className="font-bold text-[13px] text-slate-800 uppercase tracking-widest">Current Stock</h2>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F8F9FB] text-slate-500 rounded-lg active:bg-slate-100 disabled:opacity-50 transition-colors border border-slate-200"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="text-[11px] font-bold uppercase tracking-wider">Refresh</span>
          </button>
        </div>

        {/* Image area */}
        <div className="flex-1 overflow-y-auto relative bg-[#F8F9FB] p-4 flex flex-col items-center">
          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#F8F9FB] z-10">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-[#1A2766] rounded-full animate-spin mb-3" />
              <div className="font-bold text-slate-800 text-sm">Generating Report…</div>
              <div className="text-slate-500 text-xs mt-1">This may take a few seconds</div>
            </div>
          )}

          {error ? (
            <div className="text-center p-6 bg-white rounded-xl border border-red-100 mt-4 w-full max-w-sm">
              <div className="text-red-500 font-bold mb-2">Failed to generate stock report</div>
              <button onClick={handleRefresh} className="text-sm text-[#1A2766] font-semibold underline">Try again</button>
            </div>
          ) : (
            <div 
              className="relative w-full max-w-md bg-white rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-200 overflow-hidden cursor-zoom-in active:scale-[0.98] transition-transform"
              onClick={() => !loading && !error && setViewerOpen(true)}
            >
              <div className="aspect-[4/3] w-full relative">
                <img
                  src={imageUrl}
                  alt="Solar Panel Stock Preview"
                  className={`w-full h-full object-cover object-top transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
                  onLoad={() => setLoading(false)}
                  onError={() => { setLoading(false); setError(true); }}
                  style={{ pointerEvents: 'none' }}
                />
              </div>
              <div className="px-4 py-3 bg-white border-t border-slate-100 flex items-center justify-between pointer-events-none">
                <span className="text-sm font-semibold text-slate-800">Stock Report Preview</span>
                <div className="flex items-center gap-1 text-[#1A2766] bg-blue-50 px-2 py-1 rounded text-xs font-bold">
                  <ZoomIn size={12} />
                  View Full
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
