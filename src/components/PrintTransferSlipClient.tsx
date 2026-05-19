'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Printer, ArrowLeft } from 'lucide-react';
import { generateTransferSlip, TransferPrintPayload } from '@/lib/print/slip-renderer';
import ThermalSlip from '@/components/thermal-preview/ThermalSlip';

export default function PrintTransferSlipClient({
  payload,
}: {
  payload: TransferPrintPayload;
}) {
  const slipLines = useMemo(() => {
    return generateTransferSlip(payload);
  }, [payload]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto print:max-w-none print:mx-0 print:p-0">
      {/* Screen-only controls */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/staff/dashboard/transfers"
            className="p-2 hover:bg-gray-50 rounded-lg text-gray-500 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h2 className="font-bold text-gray-900 text-sm">
              Print Transfer Slip — {payload.transferNumber}
            </h2>
            <p className="text-[10px] text-gray-400">80mm Thermal Optimization Active</p>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-[#AE1B1E] text-white hover:bg-red-800 rounded-lg font-bold text-xs transition-all flex items-center gap-2 shadow-sm active:scale-95"
        >
          <Printer size={14} />
          Print Slip
        </button>
      </div>

      {/* Preview block */}
      <div className="flex flex-col items-center gap-4 py-8 bg-gray-100 rounded-2xl print:bg-white print:p-0 print:m-0">
        <div className="text-center space-y-1 print:hidden">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
            Operational Preview
          </h3>
          <p className="text-[9px] text-gray-400 italic">
            Exactly as it will appear on 80mm paper
          </p>
        </div>

        <div className="print:shadow-none print:border-0">
          <ThermalSlip lines={slipLines} />
        </div>
      </div>
    </div>
  );
}
