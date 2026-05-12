'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Loader2, TrendingUp, AlertTriangle, CheckCircle2, Filter } from 'lucide-react';
import { DOI_THRESHOLDS } from '@/lib/config';
import { formatStockDate, formatStockDateTime } from '@/lib/date-utils';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sku: {
    id: string;
    name: string;
    totalStock: number;
    inventoryByWarehouse: Record<string, { qty: number; isOos: boolean }>;
  } | null;
  warehouses: { id: string; name: string }[];
}

interface MovementData {
  id: string;
  date: string; // ISO String
  warehouseId: string;
  warehouseName: string;
  inward: number;
  outward: number;
  net: number;
  afterQty: number;
}

const SkuInsightsDrawer = React.memo(({ isOpen, onClose, sku, warehouses }: Props) => {

  const [loading, setLoading] = useState(false);
  const [movements, setMovements] = useState<MovementData[]>([]);
  const [totalsByWarehouse, setTotalsByWarehouse] = useState<Record<string, { in: number, out: number, avgDailyOut: number }>>({});
  const [overallTotals, setOverallTotals] = useState({ in: 0, out: 0, avgDailyOut: 0 });
  const [selectedWarehouses, setSelectedWarehouses] = useState<Set<string>>(new Set());
  const [isChartMounted, setIsChartMounted] = useState(false);
  const lastOpenedSkuId = useRef<string | null>(null);

  // Initialize selected warehouses only once per SKU open
  useEffect(() => {
    if (isOpen && sku && sku.id !== lastOpenedSkuId.current) {
      setSelectedWarehouses(new Set(warehouses.map(w => w.id)));
      lastOpenedSkuId.current = sku.id;
      
      // Delay chart mounting to ensure drawer animation is finished and dimensions are stable
      setIsChartMounted(false);
      const timer = setTimeout(() => setIsChartMounted(true), 500);
      return () => clearTimeout(timer);
    } else if (!isOpen) {
      lastOpenedSkuId.current = null;
      setIsChartMounted(false);
    }
  }, [isOpen, sku, warehouses]);

  useEffect(() => {
    if (isOpen && sku) {
      setLoading(true);
      fetch(`/api/staff/current-stock/sku-insights?skuId=${sku.id}`)
        .then(res => res.json())
        .then(data => {
          setMovements(data.movements || []);
          setTotalsByWarehouse(data.totalsByWarehouse || {});
          setOverallTotals(data.overallTotals || { in: 0, out: 0, avgDailyOut: 0 });
        })
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, sku]);

  const toggleWarehouse = (whId: string) => {
    setSelectedWarehouses(prev => {
      const next = new Set(prev);
      if (next.has(whId)) next.delete(whId);
      else next.add(whId);
      return next;
    });
  };

  // Helper for DOI formatting
  const calculateDOIValue = (stock: number, avgDailyOut: number) => {
    if (avgDailyOut === 0) return { value: '0', status: 'HEALTHY' };
    const doi = Math.round(stock / avgDailyOut);
    if (doi <= DOI_THRESHOLDS.CRITICAL) return { value: `${doi}d`, status: 'CRITICAL' };
    if (doi <= DOI_THRESHOLDS.WARNING) return { value: `${doi}d`, status: 'WARNING' };
    return { value: `${doi}d`, status: 'HEALTHY' };
  };

  const overallDOI = sku ? calculateDOIValue(sku.totalStock, overallTotals.avgDailyOut) : null;

  // Chart Data preparation
  const chartData = useMemo(() => {
    if (!movements.length) return [];

    // Group by Date for the chart
    const byDate: Record<string, any> = {};
    
    // We only process movements for selected warehouses
    const filteredMovements = movements.filter(m => selectedWarehouses.has(m.warehouseId));

    filteredMovements.forEach(m => {
      const dateKey = m.date.split('T')[0];
      if (!byDate[dateKey]) {
        byDate[dateKey] = { date: dateKey, Inward: 0, Outward: 0, Stock: m.afterQty };
      }
      byDate[dateKey].Inward += m.inward;
      byDate[dateKey].Outward += m.outward;
      // Approximate running stock for the chart by using the last known afterQty of the day
      byDate[dateKey].Stock = m.afterQty; 
    });

    return Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [movements, selectedWarehouses]);
  
  const filteredTableMovements = useMemo(() => {
    return movements
      .filter(m => selectedWarehouses.has(m.warehouseId))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [movements, selectedWarehouses]);


  if (!isOpen || !sku) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[100] transition-opacity" onClick={onClose} />
      <div className={`fixed inset-y-0 right-0 z-[110] w-full max-w-2xl bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-[#1A2766] text-white shrink-0">
          <div className="flex flex-col">
            <h2 className="font-bold text-lg leading-tight">{sku.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-white/80 font-mono bg-white/10 px-2 py-0.5 rounded">[{sku.id}]</span>
              <span className="text-xs font-bold bg-green-500/20 text-green-100 px-2 py-0.5 rounded border border-green-400/30">
                Stock: {sku.totalStock}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-[10px] text-white/60 text-right">
                Refined: {formatStockDate(new Date())}
             </div>
             <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
             </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading ? (
            <div className="space-y-6 animate-pulse">
              {/* DOI Cards Skeleton */}
              <div className="grid grid-cols-2 gap-4">
                <div className="h-24 bg-gray-100 rounded-lg border border-gray-200" />
                <div className="h-24 bg-gray-100 rounded-lg border border-gray-200" />
              </div>

              {/* Chart Skeleton */}
              <div className="h-64 bg-gray-50 rounded-lg border border-gray-200 flex flex-col p-4">
                <div className="h-4 w-32 bg-gray-100 rounded mb-4" />
                <div className="flex-1 bg-gray-100 rounded" />
              </div>

              {/* Table Skeleton */}
              <div className="space-y-2">
                <div className="h-4 w-40 bg-gray-100 rounded" />
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-10 border-b border-gray-100 last:border-0 bg-gray-50/50" />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* DOI Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg border transition-colors ${overallDOI?.status === 'CRITICAL' ? 'bg-red-50 border-red-200 text-red-800' : overallDOI?.status === 'WARNING' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
                  <div className="text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    {overallDOI?.status === 'CRITICAL' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                    Overall DOI
                  </div>
                  <div className="text-2xl font-black">{overallDOI?.value}</div>
                  <div className="text-[10px] opacity-70 mt-1">Avg daily out: {overallTotals.avgDailyOut.toFixed(1)}</div>
                </div>

                <div className="p-4 rounded-lg border border-gray-200 bg-gray-50 flex flex-col justify-center">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">WH Breakdown (DOI)</div>
                  <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-1">
                    {warehouses.map(wh => {
                      const stock = sku.inventoryByWarehouse[wh.id]?.qty || 0;
                      const avgOut = totalsByWarehouse[wh.id]?.avgDailyOut || 0;
                      const whDOI = calculateDOIValue(stock, avgOut);
                      return (
                        <div key={wh.id} className="flex justify-between items-center text-xs">
                          <span className="text-gray-600 truncate mr-2">{wh.name}</span>
                          <span className={`font-bold ${whDOI.status === 'CRITICAL' ? 'text-red-600' : whDOI.status === 'WARNING' ? 'text-amber-600' : 'text-green-600'}`}>
                            {whDOI.value} <span className="font-normal text-[10px] text-gray-400">({stock})</span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Warehouse Selector */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Filter size={16} /> Filter Trend & History
                </h3>
                <div className="flex flex-wrap gap-2">
                  {warehouses.map(wh => (
                    <label key={wh.id} className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-full border cursor-pointer transition-all ${selectedWarehouses.has(wh.id) ? 'bg-[#1A2766] text-white border-[#1A2766] shadow-sm' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                      <input 
                        type="checkbox" 
                        className="hidden"
                        checked={selectedWarehouses.has(wh.id)}
                        onChange={() => toggleWarehouse(wh.id)}
                      />
                      {wh.name}
                    </label>
                  ))}
                </div>
              </div>

              {/* Chart */}
              <div className="h-64 border border-gray-200 rounded-lg p-3 bg-white">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-4 tracking-wider flex items-center gap-1.5">
                  <TrendingUp size={14} /> 7-Day Trend
                </h3>
                {chartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400">No movement data for selected warehouses</div>
                ) : !isChartMounted ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 bg-gray-50/30 rounded-lg">
                    <Loader2 size={24} className="text-gray-300 animate-spin" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Stabilizing Layout...</span>
                  </div>
                ) : (
                  <div className="w-full h-full min-h-[250px] flex items-center justify-center bg-gray-50/50 rounded-lg overflow-hidden relative">
                    {isChartMounted && (
                      <div style={{ width: '100%', height: '100%', padding: '10px' }}>
                        <ComposedChart width={600} height={200} data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <XAxis dataKey="date" tick={{fontSize: 10}} tickFormatter={(val) => formatStockDate(val).split('-').slice(0, 2).join('-')} />
                          <YAxis 
                            yAxisId="left" 
                            tick={{fontSize: 10}} 
                            domain={[0, 'auto']}
                            allowDecimals={false}
                          />
                          <YAxis 
                            yAxisId="right" 
                            orientation="right" 
                            tick={{fontSize: 10}} 
                            domain={[0, 'auto']}
                            allowDecimals={false}
                          />
                          <Tooltip 
                            labelFormatter={(val) => formatStockDate(val)}
                            contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                          />
                          <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                          <Bar yAxisId="left" dataKey="Inward" fill="#10B981" radius={[2, 2, 0, 0]} maxBarSize={30} isAnimationActive={false} />
                          <Bar yAxisId="left" dataKey="Outward" fill="#EF4444" radius={[2, 2, 0, 0]} maxBarSize={30} isAnimationActive={false} />
                          <Line yAxisId="right" type="monotone" dataKey="Stock" stroke="#1A2766" strokeWidth={2} dot={{ r: 3, fill: '#1A2766' }} activeDot={{ r: 5 }} isAnimationActive={false} />
                        </ComposedChart>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Movement Table */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">Movement Summary (Daily)</h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto shadow-sm">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-gray-100 text-gray-600 uppercase">
                      <tr>
                        <th className="px-3 py-2 font-bold border-b border-r border-gray-200">Date</th>
                        <th className="px-3 py-2 font-bold border-b border-r border-gray-200">Warehouse</th>
                        <th className="px-3 py-2 font-bold border-b border-r border-gray-200 text-center text-green-700">+In</th>
                        <th className="px-3 py-2 font-bold border-b border-r border-gray-200 text-center text-red-700">-Out</th>
                        <th className="px-3 py-2 font-bold border-b border-r border-gray-200 text-center">Net</th>
                        <th className="px-3 py-2 font-bold border-b border-r border-gray-200 text-center bg-gray-50">Running Stock</th>
                        <th className="px-3 py-2 font-bold border-b text-center">DOI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredTableMovements.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-4 text-center text-gray-400">No movement history.</td>
                        </tr>
                      ) : (
                        filteredTableMovements.map(m => {
                          const whAvgOut = totalsByWarehouse[m.warehouseId]?.avgDailyOut || 0;
                          const whDOI = calculateDOIValue(m.afterQty, whAvgOut);
                          return (
                            <tr key={m.id} className="hover:bg-blue-50/30 transition-colors">
                              <td className="px-3 py-2 text-gray-500 border-r border-gray-100 whitespace-nowrap">{formatStockDate(m.date)}</td>
                              <td className="px-3 py-2 font-medium border-r border-gray-100">{m.warehouseName}</td>
                              <td className="px-3 py-2 text-center text-green-600 font-mono border-r border-gray-100 bg-green-50/10">{m.inward > 0 ? `+${m.inward}` : '-'}</td>
                              <td className="px-3 py-2 text-center text-red-600 font-mono border-r border-gray-100 bg-red-50/10">{m.outward > 0 ? `-${m.outward}` : '-'}</td>
                              <td className={`px-3 py-2 text-center font-bold font-mono border-r border-gray-100 ${m.net > 0 ? 'text-green-700' : m.net < 0 ? 'text-red-700' : 'text-gray-500'}`}>{m.net > 0 ? `+${m.net}` : m.net}</td>
                              <td className="px-3 py-2 text-center font-black font-mono border-r border-gray-100 bg-gray-50/50">{m.afterQty}</td>
                              <td className={`px-3 py-2 text-center font-bold font-mono ${whDOI.status === 'CRITICAL' ? 'text-red-600' : whDOI.status === 'WARNING' ? 'text-amber-600' : 'text-green-600'}`}>
                                {whDOI.value}
                              </td>
                            </tr>
                          );
                        })
                      )}

                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
});

export default SkuInsightsDrawer;

