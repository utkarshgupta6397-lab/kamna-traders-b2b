'use client';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface MobileWireCableDrilldownData {
  subCategory: string;
  brand: string;
  width: string;
  bundleSizeStr: string | null;
  matrix: Record<string, Record<string, { physical: number; bundle: number; hasNA: boolean }>>;
  colTotals: Record<string, { physical: number; bundle: number; hasNA: boolean }>;
  rowTotals: Record<string, { physical: number; bundle: number; hasNA: boolean }>;
  grandTotal: { physical: number; bundle: number; hasNA: boolean };
  warehouses: { id: string; name: string }[];
}

interface Props {
  data: MobileWireCableDrilldownData | null;
  mode: 'mtr' | 'bdls'; // Kept for interface compatibility but we always show both
  onClose: () => void;
}

function getBadgeColor(color: string) {
  const c = color.toLowerCase().trim();
  if (c === 'unknown' || c === 'n/a') return '#94a3b8'; // slate-400
  if (c === 'white') return '#f8fafc';
  return c;
}

export default function MobileWireCableDrilldownSheet({ data, onClose }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [renderData, setRenderData] = useState<MobileWireCableDrilldownData | null>(null);
  const [groupBy, setGroupBy] = useState<'color' | 'warehouse'>('color');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (data) {
      setIsLoading(true);
      setRenderData(data);
      requestAnimationFrame(() => setIsOpen(true));
      const t = setTimeout(() => setIsLoading(false), 200);
      return () => clearTimeout(t);
    } else {
      setIsOpen(false);
    }
  }, [data]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 300);
  };

  if (!renderData && !isOpen) return null;

  const { subCategory, brand, width, bundleSizeStr, matrix, colTotals, rowTotals, grandTotal, warehouses } = renderData || data!;

  const colors = Object.keys(matrix).sort((a, b) => {
    if (a === 'Unknown') return 1;
    if (b === 'Unknown') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col justify-end bg-black/40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={handleClose}>
      <div 
        className={`bg-[#F8F9FB] w-full h-[92dvh] rounded-t-2xl shadow-xl flex flex-col transition-transform duration-300 pb-[env(safe-area-inset-bottom)] ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky Header Section */}
        <div className="bg-white rounded-t-2xl px-5 pt-4 pb-3 border-b border-slate-200 shrink-0 z-20 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-900 text-[19px] tracking-tight">Stock Breakdown</h3>
            <button onClick={handleClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors shrink-0 -mr-2">
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
          
          {isLoading ? (
            <div className="flex gap-2 mt-3 animate-pulse">
              <div className="h-5 w-16 bg-slate-200 rounded"></div>
              <div className="h-5 w-20 bg-slate-200 rounded"></div>
              <div className="h-5 w-14 bg-slate-200 rounded"></div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="px-2 py-1 bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider rounded-md">{subCategory}</span>
              <span className="px-2 py-1 bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider rounded-md">{brand}</span>
              <span className="px-2 py-1 bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider rounded-md">{width}</span>
              {bundleSizeStr && (
                <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[11px] font-bold uppercase tracking-wider rounded-md">Bundle Size: {bundleSizeStr}</span>
              )}
            </div>
          )}

          <div className="mt-4 p-1 bg-slate-100 rounded-[12px] flex">
            <button 
              onClick={() => setGroupBy('color')} 
              className={`flex-1 py-2 text-[13px] font-bold rounded-[10px] transition-all duration-200 ${groupBy === 'color' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Group By Color
            </button>
            <button 
              onClick={() => setGroupBy('warehouse')} 
              className={`flex-1 py-2 text-[13px] font-bold rounded-[10px] transition-all duration-200 ${groupBy === 'warehouse' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Group By Warehouse
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {isLoading ? (
            <>
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm animate-pulse">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-slate-200"></div>
                      <div className="h-5 w-24 bg-slate-200 rounded"></div>
                    </div>
                    <div className="h-6 w-20 bg-slate-200 rounded"></div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between"><div className="h-4 w-32 bg-slate-100 rounded"></div><div className="h-4 w-16 bg-slate-100 rounded"></div></div>
                    <div className="flex justify-between"><div className="h-4 w-28 bg-slate-100 rounded"></div><div className="h-4 w-16 bg-slate-100 rounded"></div></div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              {groupBy === 'color' ? (
                <>
                  {colors.map(color => {
                    const metrics = rowTotals[color];
                    if (!metrics || metrics.physical === 0) return null;
                    
                    return (
                      <div key={color} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        {/* Card Header */}
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                          <div className="flex items-center gap-2.5">
                            <div 
                              className="w-3.5 h-3.5 rounded-full shadow-inner border border-black/10 flex-shrink-0" 
                              style={{ backgroundColor: getBadgeColor(color) }} 
                            />
                            <span className="font-black text-slate-800 text-[15px] uppercase tracking-wide">{color}</span>
                          </div>
                          <div className="flex flex-col items-end justify-center">
                            <span className="font-bold text-slate-900 text-[14px] leading-tight">
                              {metrics.physical.toLocaleString(undefined, { maximumFractionDigits: 2 })} MTR
                            </span>
                            {metrics.hasNA ? (
                              <span className="text-[11px] text-red-500 font-bold mt-0.5 leading-tight">N/A bdls</span>
                            ) : (
                              <span className="text-[11px] text-slate-500 font-semibold mt-0.5 leading-tight">
                                {metrics.bundle.toLocaleString(undefined, { maximumFractionDigits: 2 })} bdls
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Card Body */}
                        <div className="flex flex-col px-4 py-2">
                          {warehouses.map(wh => {
                            const cell = matrix[color]?.[wh.id];
                            if (!cell || cell.physical === 0) return null;
                            return (
                              <div key={wh.id} className="flex justify-between items-center py-2.5 border-b border-slate-50 last:border-0">
                                <span className="text-[14px] text-slate-600 font-semibold">{wh.name}</span>
                                <div className="flex flex-col items-end justify-center">
                                  <span className="font-bold text-slate-800 text-[14px] leading-tight">
                                    {cell.physical.toLocaleString(undefined, { maximumFractionDigits: 2 })} MTR
                                  </span>
                                  {cell.hasNA ? (
                                    <span className="text-[11px] text-red-400 font-semibold mt-0.5 leading-tight">N/A bdls</span>
                                  ) : (
                                    <span className="text-[11px] text-slate-400 font-semibold mt-0.5 leading-tight">
                                      {cell.bundle.toLocaleString(undefined, { maximumFractionDigits: 2 })} bdls
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <>
                  {warehouses.map(wh => {
                    const metrics = colTotals[wh.id];
                    if (!metrics || metrics.physical === 0) return null;

                    return (
                      <div key={wh.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        {/* Card Header */}
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                          <span className="font-black text-slate-800 text-[15px] uppercase tracking-wide">{wh.name}</span>
                          <div className="flex flex-col items-end justify-center">
                            <span className="font-bold text-slate-900 text-[14px] leading-tight">
                              {metrics.physical.toLocaleString(undefined, { maximumFractionDigits: 2 })} MTR
                            </span>
                            {metrics.hasNA ? (
                              <span className="text-[11px] text-red-500 font-bold mt-0.5 leading-tight">N/A bdls</span>
                            ) : (
                              <span className="text-[11px] text-slate-500 font-semibold mt-0.5 leading-tight">
                                {metrics.bundle.toLocaleString(undefined, { maximumFractionDigits: 2 })} bdls
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Card Body */}
                        <div className="flex flex-col px-4 py-2">
                          {colors.map(color => {
                            const cell = matrix[color]?.[wh.id];
                            if (!cell || cell.physical === 0) return null;
                            return (
                              <div key={color} className="flex justify-between items-center py-2.5 border-b border-slate-50 last:border-0">
                                <div className="flex items-center gap-2.5">
                                  <div 
                                    className="w-3 h-3 rounded-full shadow-inner border border-black/10 flex-shrink-0" 
                                    style={{ backgroundColor: getBadgeColor(color) }} 
                                  />
                                  <span className="text-[14px] text-slate-600 font-semibold uppercase">{color}</span>
                                </div>
                                <div className="flex flex-col items-end justify-center">
                                  <span className="font-bold text-slate-800 text-[14px] leading-tight">
                                    {cell.physical.toLocaleString(undefined, { maximumFractionDigits: 2 })} MTR
                                  </span>
                                  {cell.hasNA ? (
                                    <span className="text-[11px] text-red-400 font-semibold mt-0.5 leading-tight">N/A bdls</span>
                                  ) : (
                                    <span className="text-[11px] text-slate-400 font-semibold mt-0.5 leading-tight">
                                      {cell.bundle.toLocaleString(undefined, { maximumFractionDigits: 2 })} bdls
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>

        {/* Sticky Summary Footer */}
        <div className="bg-white border-t border-slate-200 px-5 py-4 shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] z-20">
          <div className="flex justify-between items-center">
            <span className="font-bold text-slate-600 text-[13px] uppercase tracking-wider">Overall Total</span>
            <div className="flex flex-col items-end justify-center">
              <span className="font-black text-[#1A2766] text-[18px] leading-tight">
                {grandTotal.physical.toLocaleString(undefined, { maximumFractionDigits: 2 })} MTR
              </span>
              {grandTotal.hasNA ? (
                <span className="text-[12px] text-red-500 font-bold mt-1 leading-tight">N/A bdls</span>
              ) : (
                <span className="text-[12px] text-blue-600/80 font-bold mt-1 leading-tight">
                  {grandTotal.bundle.toLocaleString(undefined, { maximumFractionDigits: 2 })} bdls
                </span>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
