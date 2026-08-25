'use client';
import { useState } from 'react';
import SolarPanelStockClient from '@/components/SolarPanelStockClient';
import { FullScreenViewer } from '@/app/mobile/_components/StockImageViewer';

export default function MobileStockExportClient(props: any) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  if (imageUrl) {
    return <FullScreenViewer imageUrl={imageUrl} onClose={() => window.history.back()} />;
  }

  if (error) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="flex flex-col items-center">
          <div className="text-red-400 font-bold mb-3">Failed to generate stock report</div>
          <button onClick={() => { setError(false); }} className="px-4 py-2 bg-white text-black font-semibold rounded-full text-sm">
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
      
      {/* Hidden Canonical Report Renderer */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', opacity: 0, pointerEvents: 'none' }}>
        <SolarPanelStockClient 
          {...props} 
          isExportMode={true} 
          autoCapture={true} 
          onCaptured={(url: string) => setImageUrl(url)} 
          onCaptureError={(err: any) => setError(true)}
        />
      </div>
    </div>
  );
}
