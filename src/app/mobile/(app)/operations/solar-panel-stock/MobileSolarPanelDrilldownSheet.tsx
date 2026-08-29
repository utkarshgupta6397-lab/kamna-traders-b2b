'use client';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getSharedHeatmapStyle } from '@/components/CurrentStockShared';

export interface SolarSeriesDetail {
  seriesName: string;
  totalStock: number;
  wattages: { key: string; label: string; gt: number; whQtys: Record<string, number> }[];
  warehouseTotals: Record<string, number>;
  warehouses: { id: string; name: string }[];
}

interface Props {
  data: SolarSeriesDetail | null;
  onClose: () => void;
}

export default function MobileSolarPanelDrilldownSheet({ data, onClose }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [renderData, setRenderData] = useState<SolarSeriesDetail | null>(null);
  const [groupBy, setGroupBy] = useState<'watt' | 'warehouse'>('watt');

  useEffect(() => {
    if (data) {
      setRenderData(data);
      requestAnimationFrame(() => setIsOpen(true));
    } else {
      setIsOpen(false);
    }
  }, [data]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 300);
  };

  if (!renderData && !isOpen) return null;

  const d = renderData || data!;

  const wattMaxGt = Math.max(...d.wattages.map(w => w.gt), 1);
  const whValues = d.warehouses.map(wh => d.warehouseTotals[wh.id] || 0).filter(v => v > 0);
  const whMaxGt = Math.max(...whValues, 1);

  const hs = (val: number, maxVal: number) =>
    val > 0 && maxVal > 0 ? getSharedHeatmapStyle(val, maxVal, false, false) : {};

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col justify-end bg-black/40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      onClick={handleClose}
    >
      <div
        className={`bg-[#F8F9FB] w-full h-[92dvh] rounded-t-2xl shadow-xl flex flex-col transition-transform duration-300 pb-[env(safe-area-inset-bottom)] ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white rounded-t-2xl px-5 pt-4 pb-3 border-b border-slate-200 shrink-0 shadow-sm z-20">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-slate-900 text-[18px] tracking-tight leading-snug">{d.seriesName}</h3>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Stock</span>
                <span className="font-black text-[#1A2766] text-[15px] leading-none">{d.totalStock.toLocaleString()}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">pcs</span>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors shrink-0 -mr-1 mt-0.5"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
          <div className="mt-4 p-1 bg-slate-100 rounded-[12px] flex">
            <button
              onClick={() => setGroupBy('watt')}
              className={`flex-1 py-2 text-[13px] font-bold rounded-[10px] transition-all duration-200 ${groupBy === 'watt' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Group by Watt
            </button>
            <button
              onClick={() => setGroupBy('warehouse')}
              className={`flex-1 py-2 text-[13px] font-bold rounded-[10px] transition-all duration-200 ${groupBy === 'warehouse' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Group by Warehouse
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 flex items-center h-[38px] px-4">
            <span className="flex-1 font-bold text-[11px] text-slate-500 uppercase tracking-wider">
              {groupBy === 'watt' ? 'Wattage' : 'Warehouse'}
            </span>
            <span className="font-bold text-[11px] text-slate-500 uppercase tracking-wider">Stock</span>
          </div>
          <div className="bg-white divide-y divide-slate-100">
            {groupBy === 'watt' ? (
              d.wattages.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-400 text-[13px]">No wattage data</div>
              ) : (
                d.wattages.map(w => (
                  <div key={w.key} className="flex items-center px-4 py-3" style={hs(w.gt, wattMaxGt)}>
                    <span className="flex-1 font-semibold text-[14px] text-slate-800">{w.label}</span>
                    <div className="shrink-0 text-right">
                      <span className="font-black text-[15px] text-slate-900">{w.gt.toLocaleString()}</span>
                      <span className="text-[10px] font-bold text-slate-400 ml-1 uppercase">pcs</span>
                    </div>
                  </div>
                ))
              )
            ) : (
              d.warehouses.filter(wh => (d.warehouseTotals[wh.id] || 0) > 0).length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-400 text-[13px]">No warehouse data</div>
              ) : (
                d.warehouses.map(wh => {
                  const qty = d.warehouseTotals[wh.id] || 0;
                  if (qty === 0) return null;
                  return (
                    <div key={wh.id} className="flex items-center px-4 py-3" style={hs(qty, whMaxGt)}>
                      <span className="flex-1 font-semibold text-[14px] text-slate-800 min-w-0 pr-3">{wh.name}</span>
                      <div className="shrink-0 text-right">
                        <span className="font-black text-[15px] text-slate-900">{qty.toLocaleString()}</span>
                        <span className="text-[10px] font-bold text-slate-400 ml-1 uppercase">pcs</span>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-slate-200 px-5 py-4 shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] z-20">
          <div className="flex justify-between items-center">
            <span className="font-bold text-slate-600 text-[13px] uppercase tracking-wider">Series Total</span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-black text-[#1A2766] text-[20px] leading-none">{d.totalStock.toLocaleString()}</span>
              <span className="text-[11px] font-bold text-slate-400 uppercase">pcs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
