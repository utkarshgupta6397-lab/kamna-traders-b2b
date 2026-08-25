'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
const PdfViewer = dynamic(() => import('@/components/PdfViewer'), { ssr: false });

export default function MobileStockExportClient(props: any) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!imageUrl && !error) {
      fetch('/api/staff/operations/solar-panel-stock/export')
        .then(async (res) => {
          if (!res.ok) throw new Error(await res.text());
          const blob = await res.blob();
          setImageUrl(URL.createObjectURL(blob));
        })
        .catch(err => {
          console.error(err);
          setError(err);
        });
    }
  }, [imageUrl, error]);

  if (imageUrl) {
    return <PdfViewer url={imageUrl} onClose={() => window.history.back()} />;
  }

  if (error) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="flex flex-col items-center">
          <div className="text-red-400 font-bold mb-3">Failed to generate stock report</div>
          <div className="text-white text-xs whitespace-pre-wrap max-w-full overflow-auto p-4 bg-red-900/50 rounded mb-4">{error?.message || error?.toString()}\n\n{error?.stack}</div>
          <button onClick={() => { setError(null); }} className="px-4 py-2 bg-white text-black font-semibold rounded-full text-sm">
            Try again
          </button>
          <button onClick={() => window.history.back()} className="mt-4 px-4 py-2 text-white/70 font-semibold rounded-full text-sm">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-white rounded-full animate-spin mb-3" />
        <div className="font-bold text-white text-sm">Generating Report…</div>
        <div className="text-slate-400 text-xs mt-1">This may take a few seconds</div>
      </div>
    </div>
  );
}
