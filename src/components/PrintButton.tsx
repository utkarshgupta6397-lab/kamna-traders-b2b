'use client';

import { useEffect, useState } from 'react';
import { qzManager } from '@/lib/print/qz-tray';
import { renderDispatchSlips, PrintPayload } from '@/lib/print/slip-renderer';
import { Printer, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PrintButton({ payload }: { payload?: PrintPayload | null }) {
  const [isThermalReady, setIsThermalReady] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // 1. Detect QZ Tray on Mount
  useEffect(() => {
    const checkThermal = async () => {
      try {
        const connected = await qzManager.connect();
        if (connected) {
          const printer = await qzManager.findPrinter();
          setIsThermalReady(!!printer);
        }
      } catch (err) {
        console.warn('[PrintButton] Initial thermal check skipped:', err);
        setIsThermalReady(false);
      }
    };
    checkThermal();
  }, []);

  const handlePrint = async () => {
    if (isPrinting) return;

    // A. Use Thermal POS Infrastructure (Preferred)
    if (isThermalReady && payload) {
      setIsPrinting(true);
      const loadingToast = toast.loading('Sending to thermal printer...');
      try {
        const buffer = renderDispatchSlips(payload);
        await qzManager.printRaw(buffer);
        toast.success('Print job sent successfully', { id: loadingToast });

        fetch(`/api/staff/carts/${payload.id}/history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'PRINTED' })
        }).catch(err => console.error('Failed to log printed history:', err));

      } catch (err: any) {
        console.error('[PRINT_ERROR] Thermal failed, falling back', err);
        toast.error('Thermal printer failed. Using browser print.', { id: loadingToast });
        window.print();

        fetch(`/api/staff/carts/${payload.id}/history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'PRINTED' })
        }).catch(err => console.error('Failed to log printed history:', err));

      } finally {
        setIsPrinting(false);
      }
      return;
    }

    // B. Fallback to Browser Print
    window.print();
    if (payload?.id) {
      fetch(`/api/staff/carts/${payload.id}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'PRINTED' })
      }).catch(err => console.error('Failed to log printed history:', err));
    }
  };

  return (
    <button 
      onClick={handlePrint}
      disabled={isPrinting}
      className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 shadow-sm active:scale-95 ${
        isPrinting 
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : isThermalReady
            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
            : 'bg-[#AE1B1E] text-white hover:bg-red-800'
      }`}
    >
      {isPrinting ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Printer size={16} />
      )}
      {isPrinting ? 'Printing...' : isThermalReady ? 'Thermal Print' : 'Print Slips'}
      
      {isThermalReady && !isPrinting && (
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
      )}
    </button>
  );
}
