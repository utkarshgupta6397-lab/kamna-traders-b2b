'use client';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';

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

// Subtle heatmap for mobile cards. Dark text on light background.
function getSubtleHeatmapStyle(val: number, maxVal: number) {
  if (val <= 0 || maxVal <= 0) return {};
  const ratio = val / maxVal;
  
  if (ratio <= 0.2) return { backgroundColor: '#f8fafc', color: '#334155' }; // Very light slate
  if (ratio <= 0.4) return { backgroundColor: '#ecfdf5', color: '#065f46' }; // Muted green (emerald-50)
  if (ratio <= 0.6) return { backgroundColor: '#d1fae5', color: '#065f46' }; // Light green (emerald-100)
  if (ratio <= 0.8) return { backgroundColor: '#fef3c7', color: '#92400e' }; // Soft amber
  return { backgroundColor: '#fee2e2', color: '#991b1b' }; // Muted red (red-50)
}

function ExpandableCard({
  title,
  subtitle,
  total,
  maxTotal,
  children
}: {
  title: string;
  subtitle?: string;
  total: number;
  maxTotal: number;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const hs = getSubtleHeatmapStyle(total, maxTotal);

  return (
    <div className="bg-white rounded-[14px] border border-slate-200 shadow-sm overflow-hidden mb-3">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3.5 active:bg-slate-50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0 pr-3">
          <span className="font-bold text-[15px] text-slate-800 block truncate">{title}</span>
          {subtitle && <span className="text-[12px] text-slate-500 font-medium block mt-0.5">{subtitle}</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div 
            className="px-2.5 py-1 rounded-lg border border-black/5 flex items-center justify-center min-w-[3rem]"
            style={hs}
          >
            <span className="font-black text-[14px] leading-none">{total.toLocaleString()}</span>
          </div>
          {expanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50">
          {children}
        </div>
      )}
    </div>
  );
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
              <h3 className="font-black text-slate-900 text-[18px] tracking-tight leading-snug break-words">{d.seriesName}</h3>
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
        <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
          {groupBy === 'watt' ? (
            d.wattages.length === 0 ? (
              <div className="text-center text-slate-400 text-[13px] py-8">No wattage data</div>
            ) : (
              d.wattages.map(w => {
                const subWhs = d.warehouses.filter(wh => w.whQtys[wh.id] > 0);
                const localMax = Math.max(...subWhs.map(wh => w.whQtys[wh.id]), 1);

                return (
                  <ExpandableCard 
                    key={w.key} 
                    title={w.label} 
                    subtitle={`${subWhs.length} warehouse${subWhs.length !== 1 ? 's' : ''}`}
                    total={w.gt} 
                    maxTotal={wattMaxGt}
                  >
                    <div className="divide-y divide-slate-100">
                      {subWhs.map(wh => (
                        <div key={wh.id} className="flex justify-between items-center px-4 py-2.5">
                          <span className="text-[13px] font-semibold text-slate-600">{wh.name}</span>
                          <span 
                            className="text-[13px] font-bold px-2 py-0.5 rounded-md border border-black/5" 
                            style={getSubtleHeatmapStyle(w.whQtys[wh.id], localMax)}
                          >
                            {w.whQtys[wh.id].toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ExpandableCard>
                );
              })
            )
          ) : (
            d.warehouses.filter(wh => (d.warehouseTotals[wh.id] || 0) > 0).length === 0 ? (
              <div className="text-center text-slate-400 text-[13px] py-8">No warehouse data</div>
            ) : (
              d.warehouses.map(wh => {
                const qty = d.warehouseTotals[wh.id] || 0;
                if (qty === 0) return null;
                
                const subWatts = d.wattages.filter(w => w.whQtys[wh.id] > 0);
                const localMax = Math.max(...subWatts.map(w => w.whQtys[wh.id]), 1);

                return (
                  <ExpandableCard 
                    key={wh.id} 
                    title={wh.name} 
                    subtitle={`${subWatts.length} wattage${subWatts.length !== 1 ? 's' : ''}`}
                    total={qty} 
                    maxTotal={whMaxGt}
                  >
                    <div className="divide-y divide-slate-100">
                      {subWatts.map(w => (
                        <div key={w.key} className="flex justify-between items-center px-4 py-2.5">
                          <span className="text-[13px] font-semibold text-slate-600">{w.label}</span>
                          <span 
                            className="text-[13px] font-bold px-2 py-0.5 rounded-md border border-black/5" 
                            style={getSubtleHeatmapStyle(w.whQtys[wh.id], localMax)}
                          >
                            {w.whQtys[wh.id].toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ExpandableCard>
                );
              })
            )
          )}
        </div>
      </div>
    </div>
  );
}
