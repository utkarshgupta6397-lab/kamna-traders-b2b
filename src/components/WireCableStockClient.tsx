'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, Box, ChevronDown, Check, AlertTriangle, X, Download } from 'lucide-react';
import CurrentStockSidebar from './CurrentStockSidebar';
import { formatStockDate } from '@/lib/date-utils';

// Types
interface Warehouse { id: string; name: string; isSystemWarehouse?: boolean; }
interface Brand { id: string; name: string; }
interface SkuInventory { [warehouseId: string]: { qty: number; isOos: boolean; } }
interface SkuItem {
  id: string; name: string; brandId?: string | null; brand?: string | null;
  categoryId?: string | null; categoryName?: string | null; unit?: string | null;
  inventory: SkuInventory;
  wireWidth?: string | null;
  wireColor?: string | null;
  bundleLength?: string | null;
}
interface Props {
  warehouses: Warehouse[]; categories: Record<string, unknown>[]; brands: Brand[];
  items: SkuItem[]; canSync?: boolean;
}

export interface WireCableDrilldown {
  wireType?: string; brandId?: string; wireWidth?: string;
  warehouseId?: string; wireColor?: string;
}

export interface ColorMetrics {
  physical: number;
  bundle: number;
  hasNA: boolean;
}

export interface PivotCellDef {
  value: number;
  hasNA?: boolean;
  colors: Record<string, ColorMetrics>;
  warehouses: Record<string, ColorMetrics>;
  totalMetrics: ColorMetrics;
  dimensions: WireCableDrilldown;
}

export interface PivotRowDef {
  id: string; label: string; isGroupHeader?: boolean; isGrandTotal?: boolean; depth?: number;
  cells: Record<string, PivotCellDef>;
  uom?: string;
}

export interface PivotColumnDef {
  id: string; label: string; isGrandTotal?: boolean;
}

export interface ColorBreakdownModalProps {
  data: {
    primaryColId: string; primaryColLabel: string;
    wireType: string; brand: string; width: string;
    metricsMap: Record<string, ColorMetrics>; // either colors or warehouses
    metricsLabels: Record<string, string>; // ID -> Name mapping
    total: ColorMetrics;
    mode: 'physical' | 'bundle' | 'color';
    breakdownType: 'color' | 'warehouse';
  } | null;
  onClose: () => void;
}

function BreakdownModal({ data, onClose }: ColorBreakdownModalProps) {
  if (!data) return null;
  
  // Sort the keys alphabetically for consistent display
  const allKeys = Object.keys(data.metricsMap).sort((a, b) => {
    const labelA = data.metricsLabels[a] || a;
    const labelB = data.metricsLabels[b] || b;
    if (a === 'Unknown') return 1;
    if (b === 'Unknown') return -1;
    return labelA.localeCompare(labelB);
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-gray-100 bg-[#f8f9fb] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">{data.breakdownType === 'color' ? 'Color Breakdown' : 'Warehouse Breakdown'}</h3>
            <p className="text-xs text-gray-500 mt-1">{data.primaryColLabel}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-white hover:bg-gray-100 rounded-full text-gray-500 transition-colors shadow-sm border border-gray-200"><X size={16} /></button>
        </div>
        <div className="p-5 bg-white">
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded">{data.wireType}</span>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded">{data.brand}</span>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded">{data.width}</span>
          </div>
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="py-2.5 px-3 font-semibold text-slate-600 uppercase text-[11px] tracking-wide">{data.breakdownType === 'color' ? 'Color' : 'Warehouse'}</th>
                <th className="py-2.5 px-3 font-semibold text-slate-600 uppercase text-[11px] tracking-wide text-right">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {allKeys.map(k => {
                const metrics = data.metricsMap[k];
                if (!metrics || metrics.physical === 0) return null;
                const label = data.metricsLabels[k] || k;
                return (
                  <tr key={k} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-slate-700">{label}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900 text-right">
                      {metrics.physical.toLocaleString(undefined, { maximumFractionDigits: 2 })} mtr <span className="text-slate-300 mx-1">|</span> {metrics.hasNA ? <span className="text-red-400 font-medium">N/A</span> : `${metrics.bundle.toLocaleString(undefined, { maximumFractionDigits: 2 })} bdls`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-indigo-50/50">
                <td className="py-3 px-3 font-bold text-indigo-900 uppercase text-[12px] tracking-wider">Total</td>
                <td className="py-3 px-3 font-black text-indigo-900 text-right">
                  {data.total.physical.toLocaleString(undefined, { maximumFractionDigits: 2 })} mtr <span className="text-indigo-300 mx-1">|</span> {data.total.hasNA ? <span className="text-red-500">N/A</span> : `${data.total.bundle.toLocaleString(undefined, { maximumFractionDigits: 2 })} bdls`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// Helpers
function normalizeWidth(width: string | null | undefined): string {
  if (!width) return 'Unknown';
  const num = parseFloat(width);
  if (!isNaN(num)) return `${num} sqmm`;
  return width.trim();
}

function normalizeColor(color: string | null | undefined): string {
  if (!color) return 'Unknown';
  const c = color.trim().toLowerCase();
  return c.charAt(0).toUpperCase() + c.slice(1);
}

const heatmapColors = [
  { r: 236, g: 253, b: 245 }, { r: 167, g: 243, b: 208 }, { r: 253, g: 230, b: 138 },
  { r: 251, g: 146, b: 60 }, { r: 239, g: 68, b: 68 }
];

function buildHeatmap(rows: PivotRowDef[]) {
  let maxBody = 0, maxGtCol = 0;
  rows.forEach(row => {
    if (row.isGroupHeader) return;
    Object.entries(row.cells).forEach(([colId, cell]) => {
      const val = cell.value;
      if (!isNaN(val) && val > 0) {
        const isGtCol = colId === 'GT';
        if (isGtCol) { if (val > maxGtCol) maxGtCol = val; }
        else if (!row.isGrandTotal) { if (val > maxBody) maxBody = val; }
      }
    });
  });

  const getStyle = (val: number, isGTRow: boolean, isGTCol: boolean): React.CSSProperties => {
    if (val <= 0) return {};
    if (isGTRow) {
      const ratio = Math.min(1, val / (maxGtCol || 1));
      const add = Math.round(ratio * 14);
      return { backgroundColor: `rgb(${26+add},${39+add},${102+add})`, color: '#fff' };
    }
    const ratio = Math.min(1, Math.max(0, val / (isGTCol ? (maxGtCol || 1) : (maxBody || 1))));
    const steps = heatmapColors.length - 1;
    const scaled = ratio * steps;
    const idx = Math.floor(scaled);
    let r, g, b;
    if (idx >= steps) {
      r = heatmapColors[steps].r; g = heatmapColors[steps].g; b = heatmapColors[steps].b;
    } else {
      const t = scaled - idx;
      const c1 = heatmapColors[idx];
      const c2 = heatmapColors[idx + 1];
      r = Math.round(c1.r + (c2.r - c1.r) * t);
      g = Math.round(c1.g + (c2.g - c1.g) * t);
      b = Math.round(c1.b + (c2.b - c1.b) * t);
    }
    if (isGTCol) { r = Math.round(r * 0.95); g = Math.round(g * 0.95); b = Math.round(b * 0.95); }
    const isDark = (r * 0.299 + g * 0.587 + b * 0.114) < 150;
    return { backgroundColor: `rgb(${r},${g},${b})`, color: isDark ? '#fff' : '#0f172a', fontWeight: ratio > 0.4 ? 600 : 500 };
  };
  return { getStyle };
}

function PivotTable({ title, mode, columns, rows, onCellClick }: {
  title: string; mode: 'physical' | 'bundle' | 'color';
  columns: PivotColumnDef[]; rows: PivotRowDef[];
  onCellClick: (row: PivotRowDef, col: PivotColumnDef, cell: PivotCellDef, mode: 'physical' | 'bundle' | 'color') => void;
}) {
  const { getStyle } = buildHeatmap(rows);
  const GT_BG = '#1A2766';

  const LS = (z: number): React.CSSProperties => ({ position: "sticky", left: 0, zIndex: z });
  const RS = (z: number): React.CSSProperties => ({ position: "sticky", right: 0, zIndex: z });

  const displayUnit = mode === 'bundle' ? 'bdls' : 'mtr';

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col mb-6 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-[#f8f9fb]">
        <h2 className="font-bold text-gray-800 text-[13px] tracking-wide uppercase">{title}</h2>
      </div>
      <div className="relative bg-white pivot-scroll-container overflow-x-auto overflow-y-auto max-h-[560px]">
        <table className="text-sm text-left w-full border-collapse" style={{ minWidth: "max-content" }}>
          <thead>
            <tr className="bg-[#f8f9fb]">
              <th className="px-4 py-3 font-bold text-[12px] text-gray-700 uppercase tracking-wider border-b-2 border-gray-300 border-r border-gray-200 bg-[#f8f9fb] h-[42px]" style={{ ...LS(50), top: 0 }}>
                Wire Type / Brand / Width
              </th>
              {columns.map(c => {
                const isGT = !!c.isGrandTotal;
                return (
                  <th key={c.id} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-center border-b-2 ${isGT ? 'text-white border-white/20 border-l-4 border-l-white/30' : 'text-gray-700 border-gray-300 border-l border-gray-200'}`}
                    style={isGT ? { ...RS(50), backgroundColor: GT_BG, minWidth: 100, top: 0, height: '42px' } : { position: "sticky", top: 0, zIndex: 50, backgroundColor: "#EEF2FF", minWidth: 120, height: '42px' }}>
                    {c.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => {
              if (row.isGroupHeader) {
                const isType = row.depth === 0;
                const padLeft = isType ? 'pl-4' : 'pl-8';
                const bgColor = isType ? '#F1F5F9' : '#F8FAFC'; // Solid bg-slate-100 and bg-slate-50
                const textColor = isType ? 'text-slate-800' : 'text-slate-600';
                return (
                  <tr key={row.id} className="border-b border-slate-200">
                    <td colSpan={columns.length + 1} className={`${padLeft} font-bold ${isType ? 'text-[13px] tracking-wider h-[40px] z-[40]' : 'text-[12px] h-[38px] z-[39]'} ${textColor} uppercase border-r border-slate-200`} style={{ ...LS(isType ? 40 : 39), top: isType ? '42px' : '82px', backgroundColor: bgColor }}>
                      <div className="flex items-center h-full">{row.label}</div>
                    </td>
                  </tr>
                );
              }

              const isAlt = !row.isGrandTotal && (rIdx % 2 !== 0);
              return (
                <tr key={row.id} className={`border-b border-gray-100 transition-all ${row.isGrandTotal ? 'font-bold text-[12px] text-white' : 'hover:bg-blue-50/50'} ${isAlt ? 'bg-[#fcfdfd]' : 'bg-white'}`} style={row.isGrandTotal ? { position: "sticky", bottom: 0, zIndex: 50 } : {}}>
                  <td className={`px-4 py-2 font-medium border-r border-gray-200 transition-colors ${row.isGrandTotal ? 'text-[12px] font-black uppercase tracking-wider border-t-2 border-white/10' : `text-[13px] text-gray-700 pl-12 ${isAlt ? 'bg-[#fcfdfd]' : 'bg-white'}`}`}
                    style={row.isGrandTotal ? { ...LS(40), backgroundColor: GT_BG, color: '#fff' } : LS(20)}>
                    <span className="truncate">{row.label}</span>
                  </td>
                  {columns.map(col => {
                    const cell = row.cells[col.id];
                    const val = cell?.value || 0;
                    const cs = getStyle(val, !!row.isGrandTotal, !!col.isGrandTotal);
                    const isClickable = val > 0 && !row.isGrandTotal && !col.isGrandTotal;
                    
                    return (
                      <td key={col.id} onClick={() => { if (isClickable) onCellClick(row, col, cell, mode); }}
                        className={`px-3 py-2 text-center transition-all ${row.isGrandTotal ? `border-t-2 border-white/10 py-3 ${col.isGrandTotal ? 'border-l-4 border-l-white/30' : 'border-l border-white/10'}` : `border-l border-gray-100 ${isClickable ? 'cursor-pointer hover:ring-2 hover:ring-inset hover:ring-blue-400 hover:brightness-110' : ''}`}`}
                        style={col.isGrandTotal ? { ...RS(row.isGrandTotal ? 35 : 20), ...cs } : cs}>
                        {val === 0 ? (
                          cell?.hasNA ? <span className="text-red-400 font-medium" title="Bundle size missing">N/A</span> : <span className={row.isGrandTotal ? "opacity-40" : "text-gray-300 select-none"}>—</span>
                        ) : (
                          <span className="whitespace-nowrap font-semibold">
                            {val.toLocaleString(undefined, { maximumFractionDigits: 2 })} {displayUnit}
                            {cell?.hasNA && <span className="text-red-400 ml-1" title="Some products in this group have missing bundle size">⚠️</span>}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const MultiSelectFilter = ({ label, options, selected, onToggle, prefix, wideMenu = false }: {
  label: string; options: { id: string; name: string }[]; selected: string[];
  onToggle: (id: string) => void; prefix?: React.ReactNode; wideMenu?: boolean;
}) => (
  <div className="relative group shrink-0">
    <button className="flex items-center gap-1.5 text-[13px] font-medium border border-gray-200 text-gray-700 rounded-md h-8 px-3 bg-white hover:bg-gray-50 focus:outline-none transition-colors whitespace-nowrap">
      {prefix}
      <span>{selected.length > 0 ? `${selected.length} ${label}` : `All ${label}`}</span>
      <ChevronDown size={14} className="text-gray-400" />
    </button>
    <div className="absolute left-0 mt-1 z-[50] bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all"
      style={{ minWidth: wideMenu ? '300px' : '192px', maxWidth: '360px' }}>
      <div className="p-1 max-h-64 overflow-auto">
        {options.map(opt => (
          <button key={opt.id} onClick={() => onToggle(opt.id)} className="w-full flex items-start gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 rounded text-left">
            <div className={`w-4 h-4 border rounded shrink-0 flex items-center justify-center mt-0.5 ${selected.includes(opt.id) ? 'bg-[#1A2766] border-[#1A2766]' : 'bg-white border-gray-300'}`}>
              {selected.includes(opt.id) && <Check size={10} className="text-white" />}
            </div>
            <span className="leading-snug break-words">{opt.name}</span>
          </button>
        ))}
      </div>
    </div>
  </div>
);

export default function WireCableStockClient({ warehouses, items }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedWireTypes, setSelectedWireTypes] = useState<string[]>([]);
  const [selectedWidths, setSelectedWidths] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);

  const [modalData, setModalData] = useState<ColorBreakdownModalProps['data']>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const operationalWarehouses = useMemo(() => warehouses.filter(w => !w.isSystemWarehouse), [warehouses]);
  const warehouseLabels = useMemo(() => {
    const m: Record<string, string> = {};
    operationalWarehouses.forEach(w => { m[w.id] = w.name; });
    return m;
  }, [operationalWarehouses]);

  const processedItems = useMemo(() => {
    return items.map(item => ({
      ...item,
      normalizedWidth: normalizeWidth(item.wireWidth),
      normalizedColor: normalizeColor(item.wireColor),
      wireType: item.categoryName || 'Unknown'
    }));
  }, [items]);

  const availableBrands = useMemo(() => Array.from(new Set(processedItems.map(i => i.brand).filter(Boolean) as string[])).map(name => ({ id: name, name })).sort((a, b) => a.name.localeCompare(b.name)), [processedItems]);
  const availableWireTypes = useMemo(() => Array.from(new Set(processedItems.map(i => i.wireType))).map(name => ({ id: name, name })).sort((a, b) => a.name.localeCompare(b.name)), [processedItems]);
  const availableWidths = useMemo(() => Array.from(new Set(processedItems.map(i => i.normalizedWidth))).map(name => ({ id: name, name })).sort((a, b) => (parseFloat(a.name) || 0) - (parseFloat(b.name) || 0)), [processedItems]);
  const availableColors = useMemo(() => Array.from(new Set(processedItems.map(i => i.normalizedColor))).map(name => ({ id: name, name })).sort((a, b) => a.name.localeCompare(b.name)), [processedItems]);

  const filteredItems = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    return processedItems.filter(item => {
      if (item.categoryName?.toLowerCase() === 'uncategorized') return false;
      if (q && !item.name.toLowerCase().includes(q) && !item.id.toLowerCase().includes(q)) return false;
      if (selectedBrands.length > 0 && (!item.brand || !selectedBrands.includes(item.brand))) return false;
      if (selectedWireTypes.length > 0 && !selectedWireTypes.includes(item.wireType)) return false;
      if (selectedWidths.length > 0 && !selectedWidths.includes(item.normalizedWidth)) return false;
      if (selectedColors.length > 0 && !selectedColors.includes(item.normalizedColor)) return false;
      return true;
    });
  }, [processedItems, debouncedSearch, selectedBrands, selectedWireTypes, selectedWidths, selectedColors]);

  const visibleWarehouses = useMemo(() => selectedWarehouses.length > 0 ? operationalWarehouses.filter(w => selectedWarehouses.includes(w.id)) : operationalWarehouses, [operationalWarehouses, selectedWarehouses]);

  const meaningfulWarehouses = useMemo(() => visibleWarehouses.filter(wh => filteredItems.some(item => (item.inventory[wh.id]?.qty || 0) > 0)), [filteredItems, visibleWarehouses]);
  const meaningfulColors = useMemo(() => {
    const colors = new Set<string>();
    filteredItems.forEach(item => {
      if (meaningfulWarehouses.some(wh => (item.inventory[wh.id]?.qty || 0) > 0)) {
        colors.add(item.normalizedColor);
      }
    });
    return Array.from(colors).sort();
  }, [filteredItems, meaningfulWarehouses]);

  const pivotCols: PivotColumnDef[] = useMemo(() => {
    return [
      ...meaningfulWarehouses.map(wh => ({ id: wh.id, label: wh.name })),
      { id: 'GT', label: 'Grand Total', isGrandTotal: true }
    ];
  }, [meaningfulWarehouses]);

  const colorPivotCols: PivotColumnDef[] = useMemo(() => {
    return [
      ...meaningfulColors.map(c => ({ id: c, label: c })),
      { id: 'GT', label: 'Grand Total', isGrandTotal: true }
    ];
  }, [meaningfulColors]);

  const { physicalRows, bundleRows, colorRows } = useMemo(() => {
    type CellData = { warehouseData: Record<string, PivotCellDef>; colorData: Record<string, PivotCellDef>; total: ColorMetrics };
    type Hierarchy = Map<string, Map<string, Map<string, CellData & { bundleSizeStr: string; uom: string }>>>;
    
    const root: Hierarchy = new Map();
    
    let gtTotalP = 0;
    let gtTotalB = 0;
    let gtHasNA = false;
    const colTotals: Record<string, ColorMetrics> = {};
    const colorColTotals: Record<string, ColorMetrics> = {};

    filteredItems.forEach(item => {
      const type = item.wireType;
      const brand = item.brand || 'Unbranded';
      const width = item.normalizedWidth;
      const color = item.normalizedColor;
      
      const bSize = parseFloat(item.bundleLength || '0');

      if (!root.has(type)) root.set(type, new Map());
      const tMap = root.get(type)!;
      
      if (!tMap.has(brand)) tMap.set(brand, new Map());
      const bMap = tMap.get(brand)!;
      
      if (!bMap.has(width)) {
        bMap.set(width, { 
          warehouseData: {}, 
          colorData: {},
          total: { physical: 0, bundle: 0, hasNA: false },
          bundleSizeStr: item.bundleLength ? `${item.bundleLength} mtr` : '',
          uom: item.unit || 'N/A'
        });
      } else if (item.bundleLength && !bMap.get(width)!.bundleSizeStr) {
        bMap.get(width)!.bundleSizeStr = `${item.bundleLength} mtr`;
      }
      
      const wObj = bMap.get(width)!;

      meaningfulWarehouses.forEach(wh => {
        const qty = Math.max(0, item.inventory[wh.id]?.qty || 0);
        if (qty > 0) {
          const isNA = bSize <= 0;
          const bQty = isNA ? 0 : qty / bSize;

          // WAREHOUSE DATA (Physical & Bundle charts)
          if (!wObj.warehouseData[wh.id]) {
            wObj.warehouseData[wh.id] = { value: 0, hasNA: false, colors: {}, warehouses: {}, totalMetrics: { physical: 0, bundle: 0, hasNA: false }, dimensions: { wireType: type, brandId: brand, wireWidth: width, warehouseId: wh.id } };
          }
          if (!wObj.warehouseData['GT']) {
            wObj.warehouseData['GT'] = { value: 0, hasNA: false, colors: {}, warehouses: {}, totalMetrics: { physical: 0, bundle: 0, hasNA: false }, dimensions: { wireType: type, brandId: brand, wireWidth: width } };
          }
          
          const whCell = wObj.warehouseData[wh.id];
          const gtWhCell = wObj.warehouseData['GT'];

          whCell.totalMetrics.physical += qty;
          whCell.totalMetrics.bundle += bQty;
          if (isNA) whCell.totalMetrics.hasNA = true;

          gtWhCell.totalMetrics.physical += qty;
          gtWhCell.totalMetrics.bundle += bQty;
          if (isNA) gtWhCell.totalMetrics.hasNA = true;

          if (!whCell.colors[color]) whCell.colors[color] = { physical: 0, bundle: 0, hasNA: false };
          whCell.colors[color].physical += qty;
          whCell.colors[color].bundle += bQty;
          if (isNA) whCell.colors[color].hasNA = true;

          if (!gtWhCell.colors[color]) gtWhCell.colors[color] = { physical: 0, bundle: 0, hasNA: false };
          gtWhCell.colors[color].physical += qty;
          gtWhCell.colors[color].bundle += bQty;
          if (isNA) gtWhCell.colors[color].hasNA = true;

          // COLOR DATA (Color chart)
          if (!wObj.colorData[color]) {
            wObj.colorData[color] = { value: 0, hasNA: false, colors: {}, warehouses: {}, totalMetrics: { physical: 0, bundle: 0, hasNA: false }, dimensions: { wireType: type, brandId: brand, wireWidth: width, wireColor: color } };
          }
          if (!wObj.colorData['GT']) {
            wObj.colorData['GT'] = { value: 0, hasNA: false, colors: {}, warehouses: {}, totalMetrics: { physical: 0, bundle: 0, hasNA: false }, dimensions: { wireType: type, brandId: brand, wireWidth: width } };
          }

          const colCell = wObj.colorData[color];
          const gtColCell = wObj.colorData['GT'];

          colCell.totalMetrics.physical += qty;
          colCell.totalMetrics.bundle += bQty;
          if (isNA) colCell.totalMetrics.hasNA = true;

          gtColCell.totalMetrics.physical += qty;
          gtColCell.totalMetrics.bundle += bQty;
          if (isNA) gtColCell.totalMetrics.hasNA = true;

          if (!colCell.warehouses[wh.id]) colCell.warehouses[wh.id] = { physical: 0, bundle: 0, hasNA: false };
          colCell.warehouses[wh.id].physical += qty;
          colCell.warehouses[wh.id].bundle += bQty;
          if (isNA) colCell.warehouses[wh.id].hasNA = true;

          if (!gtColCell.warehouses[wh.id]) gtColCell.warehouses[wh.id] = { physical: 0, bundle: 0, hasNA: false };
          gtColCell.warehouses[wh.id].physical += qty;
          gtColCell.warehouses[wh.id].bundle += bQty;
          if (isNA) gtColCell.warehouses[wh.id].hasNA = true;


          // GRAND TOTALS
          wObj.total.physical += qty;
          wObj.total.bundle += bQty;
          if (isNA) wObj.total.hasNA = true;

          if (!colTotals[wh.id]) colTotals[wh.id] = { physical: 0, bundle: 0, hasNA: false };
          colTotals[wh.id].physical += qty;
          colTotals[wh.id].bundle += bQty;
          if (isNA) colTotals[wh.id].hasNA = true;

          if (!colorColTotals[color]) colorColTotals[color] = { physical: 0, bundle: 0, hasNA: false };
          colorColTotals[color].physical += qty;
          colorColTotals[color].bundle += bQty;
          if (isNA) colorColTotals[color].hasNA = true;
          
          gtTotalP += qty;
          gtTotalB += bQty;
          if (isNA) gtHasNA = true;
        }
      });
    });

    const buildRows = (rootMap: Hierarchy, mode: 'physical' | 'bundle' | 'color') => {
      const isBundle = mode === 'bundle';
      const isColor = mode === 'color';

      const result: PivotRowDef[] = [];
      Array.from(rootMap.keys()).sort().forEach(type => {
        const typeMap = rootMap.get(type)!;
        result.push({ id: `type_${type}`, label: type, isGroupHeader: true, depth: 0, cells: {} });
        
        Array.from(typeMap.keys()).sort().forEach(brand => {
          const brandMap = typeMap.get(brand)!;
          result.push({ id: `brand_${type}_${brand}`, label: brand, isGroupHeader: true, depth: 1, cells: {} });
          
          Array.from(brandMap.keys()).sort((a,b) => (parseFloat(a) || 0) - (parseFloat(b) || 0)).forEach(width => {
            const wObj = brandMap.get(width)!;
            const dataMap = isColor ? wObj.colorData : wObj.warehouseData;
            
            const hasData = isBundle ? Object.keys(dataMap).length > 0 : wObj.total.physical > 0;
            if (hasData) {
              const rowLabel = isBundle && wObj.bundleSizeStr ? `${width} (${wObj.bundleSizeStr})` : width;
              const mappedData: Record<string, PivotCellDef> = {};
              Object.keys(dataMap).forEach(k => {
                const src = dataMap[k];
                mappedData[k] = {
                  ...src,
                  value: isBundle ? src.totalMetrics.bundle : src.totalMetrics.physical,
                  hasNA: isBundle ? src.totalMetrics.hasNA : false
                };
              });
              result.push({ id: `row_${type}_${brand}_${width}`, label: rowLabel, depth: 2, cells: mappedData, uom: wObj.uom });
            }
          });
        });
      });
      
      const gtRowCells: Record<string, PivotCellDef> = {};
      const targetTotals = isColor ? colorColTotals : colTotals;

      Object.keys(targetTotals).forEach(key => {
        const src = targetTotals[key];
        gtRowCells[key] = { 
          value: isBundle ? src.bundle : src.physical, 
          hasNA: isBundle ? src.hasNA : false, 
          colors: {}, warehouses: {}, 
          totalMetrics: src,
          dimensions: isColor ? { wireColor: key } : { warehouseId: key } 
        };
      });
      gtRowCells['GT'] = { 
        value: isBundle ? gtTotalB : gtTotalP, 
        hasNA: isBundle ? gtHasNA : false, 
        colors: {}, warehouses: {}, 
        totalMetrics: { physical: gtTotalP, bundle: gtTotalB, hasNA: gtHasNA },
        dimensions: {} 
      };

      result.push({ id: 'gt_row', label: 'Grand Total', isGrandTotal: true, depth: 0, cells: gtRowCells });
      return result;
    };

    return {
      physicalRows: buildRows(root, 'physical'),
      bundleRows: buildRows(root, 'bundle'),
      colorRows: buildRows(root, 'color')
    };
  }, [filteredItems, meaningfulWarehouses]);

  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>, val: string) =>
    set(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  const handleExportPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      
      const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
      
      doc.setFontSize(16);
      doc.setTextColor(20, 30, 80);
      doc.text('KAMNA ERP — Wire & Cables Stock', 14, 15);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated: ${formatStockDate(new Date())}`, 14, 22);

      const filterParts = [];
      if (selectedWarehouses.length) filterParts.push(`Warehouses: ${selectedWarehouses.length}`);
      if (selectedWireTypes.length) filterParts.push(`Types: ${selectedWireTypes.join(', ')}`);
      if (selectedBrands.length) filterParts.push(`Brands: ${selectedBrands.join(', ')}`);
      if (selectedWidths.length) filterParts.push(`Widths: ${selectedWidths.join(', ')}`);
      if (selectedColors.length) filterParts.push(`Colors: ${selectedColors.join(', ')}`);
      const filterStr = filterParts.length ? filterParts.join(' | ') : 'All data (no filters)';
      doc.text(`Filters: ${filterStr}`, 14, 28);

      let currentY = 38;

      const renderTable = (title: string, columns: PivotColumnDef[], rows: PivotRowDef[]) => {
        if (currentY > 170) {
          doc.addPage();
          currentY = 15;
        }

        doc.setFontSize(12);
        doc.setTextColor(40, 40, 40);
        doc.text(title, 14, currentY);
        currentY += 6;

        const head = [['Wire Type / Brand / Width', 'UOM', ...columns.map(c => c.label)]];
        const { getStyle } = buildHeatmap(rows);

        const body = rows.map(row => {
          const rowData: Record<string, unknown>[] = [];
          const isType = row.depth === 0;
          const isBrand = row.depth === 1;
          const isWidth = row.depth === 2;
          
          let labelStr = row.label;
          if (isBrand) labelStr = `   ${row.label}`;
          if (isWidth) labelStr = `      ${row.label}`;
          
          let cellBg: [number, number, number] = [255, 255, 255];
          let textColor: [number, number, number] = [50, 50, 50];
          let fontStyle: 'normal' | 'bold' = 'normal';

          if (row.isGroupHeader) {
            cellBg = isType ? [241, 245, 249] : [248, 250, 252];
            fontStyle = 'bold';
            textColor = isType ? [30, 41, 59] : [71, 85, 105];
          } else if (row.isGrandTotal) {
            cellBg = [26, 39, 102];
            textColor = [255, 255, 255];
            fontStyle = 'bold';
          }

          rowData.push({
            content: labelStr,
            styles: { fillColor: cellBg, textColor, fontStyle, halign: 'left' }
          });
          
          rowData.push({
            content: row.isGroupHeader || row.isGrandTotal ? '' : (row.uom || '—'),
            styles: { fillColor: cellBg, textColor: row.isGroupHeader ? cellBg : textColor, fontStyle, halign: 'center' }
          });

          columns.forEach(col => {
            const cell = row.cells[col.id];
            const val = cell?.value || 0;
            
            let content = '—';
            if (val > 0) {
              content = val.toLocaleString(undefined, { maximumFractionDigits: 2 });
              if (cell?.hasNA) content += ' *';
            }

            if (row.isGroupHeader) {
              rowData.push({ content: '', styles: { fillColor: cellBg } });
              return;
            }

            const style = getStyle(val, !!row.isGrandTotal, !!col.isGrandTotal);
            let outBg = cellBg;
            let outText = textColor;
            let outFont = fontStyle;

            if (style.backgroundColor && typeof style.backgroundColor === 'string') {
               const match = style.backgroundColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
               if (match) {
                 outBg = [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
               }
            }
            if (style.color === '#fff') outText = [255, 255, 255];
            if (style.fontWeight === 600) outFont = 'bold';

            rowData.push({
              content,
              styles: { fillColor: outBg, textColor: outText, fontStyle: outFont, halign: 'center' }
            });
          });
          
          return rowData;
        });

        autoTable(doc, {
          startY: currentY,
          head,
          body,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 2, lineWidth: 0.1, lineColor: [220, 220, 220] },
          headStyles: { fillColor: [248, 249, 251], textColor: [80, 80, 80], fontStyle: 'bold', halign: 'center' },
          columnStyles: { 0: { cellWidth: 50, halign: 'left' }, 1: { cellWidth: 15, halign: 'center' } },
          showHead: 'everyPage',
          margin: { top: 15, right: 14, bottom: 15, left: 14 }
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        currentY = (doc as any).lastAutoTable.finalY + 15;
      };

      renderTable('PHYSICAL STOCK — MTR', pivotCols, physicalRows);
      renderTable('BUNDLE STOCK — BDLS', pivotCols, bundleRows);
      renderTable('COLOR STOCK — MTR', colorPivotCols, colorRows);
      
      doc.save('Wire_Cable_Stock.pdf');
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <div className="flex h-full gap-5">
      <CurrentStockSidebar activeView="wire" />
      <div className="flex-1 flex flex-col h-full min-w-0 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between shrink-0 rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1A2766]/10 flex items-center justify-center">
              <Box size={17} className="text-[#1A2766]" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold tracking-tight text-gray-900 leading-tight">Wire & Cable Stock</h1>
              <div className="text-[11px] text-blue-600 font-medium">Category: Wire & Cables · {filteredItems.length} SKUs</div>
            </div>
          </div>
          <div className="text-[10px] text-gray-400 font-medium">Last updated: {formatStockDate(new Date())}</div>
        </div>

        <div className="px-4 py-2.5 border-b border-gray-100 bg-white flex flex-wrap items-center gap-2 shrink-0">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input type="text" placeholder="Search product or SKU…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 bg-gray-50 border border-gray-200 rounded-md text-[13px] text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors h-8" />
          </div>
          <MultiSelectFilter label="Warehouses" options={operationalWarehouses.map(w => ({ id: w.id, name: w.name }))} selected={selectedWarehouses} onToggle={id => toggle(setSelectedWarehouses, id)} prefix={<Box size={13} className="text-gray-400" />} />
          <MultiSelectFilter label="Wire Types" options={availableWireTypes} selected={selectedWireTypes} onToggle={id => toggle(setSelectedWireTypes, id)} />
          <MultiSelectFilter label="Brands" options={availableBrands} selected={selectedBrands} onToggle={id => toggle(setSelectedBrands, id)} />
          <MultiSelectFilter label="Widths" options={availableWidths} selected={selectedWidths} onToggle={id => toggle(setSelectedWidths, id)} />
          <MultiSelectFilter label="Colors" options={availableColors} selected={selectedColors} onToggle={id => toggle(setSelectedColors, id)} />
          
          <button onClick={handleExportPDF} className="ml-auto flex items-center gap-2 px-4 py-1.5 bg-[#1A2766] text-white text-[13px] font-semibold rounded-md shadow-sm hover:bg-[#1A2766]/90 transition-colors h-8">
            <Download size={14} />
            Screenshot
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 bg-[#f7f8fb] min-h-0 relative">
          {(!meaningfulWarehouses.length || filteredItems.length === 0) ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400">
              <AlertTriangle size={32} className="text-amber-400" />
              <div className="text-lg font-semibold text-gray-700">No Wire & Cable stock found</div>
              <p className="text-sm">Try adjusting your filters.</p>
            </div>
          ) : (
            <>
              <PivotTable 
                title="PHYSICAL STOCK — MTR"
                mode="physical"
                columns={pivotCols} 
                rows={physicalRows} 
                onCellClick={(row, col, cell, mode) => {
                  const whName = warehouses.find(w => w.id === col.id)?.name || 'Unknown Warehouse';
                  setModalData({
                    primaryColId: col.id,
                    primaryColLabel: col.id === 'GT' ? 'All Warehouses' : whName,
                    wireType: cell.dimensions.wireType || '',
                    brand: cell.dimensions.brandId || '',
                    width: cell.dimensions.wireWidth || '',
                    metricsMap: cell.colors,
                    metricsLabels: {}, // Color names are their own labels
                    total: cell.totalMetrics,
                    mode,
                    breakdownType: 'color'
                  });
                }}
              />
              <PivotTable 
                title="BUNDLE STOCK — BDLS"
                mode="bundle"
                columns={pivotCols} 
                rows={bundleRows} 
                onCellClick={(row, col, cell, mode) => {
                  const whName = warehouses.find(w => w.id === col.id)?.name || 'Unknown Warehouse';
                  setModalData({
                    primaryColId: col.id,
                    primaryColLabel: col.id === 'GT' ? 'All Warehouses' : whName,
                    wireType: cell.dimensions.wireType || '',
                    brand: cell.dimensions.brandId || '',
                    width: cell.dimensions.wireWidth || '',
                    metricsMap: cell.colors,
                    metricsLabels: {}, // Color names are their own labels
                    total: cell.totalMetrics,
                    mode,
                    breakdownType: 'color'
                  });
                }}
              />
              <PivotTable 
                title="COLOR STOCK — MTR"
                mode="color"
                columns={colorPivotCols} 
                rows={colorRows} 
                onCellClick={(row, col, cell, mode) => {
                  setModalData({
                    primaryColId: col.id,
                    primaryColLabel: col.id === 'GT' ? 'All Colors' : col.label,
                    wireType: cell.dimensions.wireType || '',
                    brand: cell.dimensions.brandId || '',
                    width: cell.dimensions.wireWidth || '',
                    metricsMap: cell.warehouses,
                    metricsLabels: warehouseLabels, // Convert warehouse IDs to names
                    total: cell.totalMetrics,
                    mode, // Will be 'color' which will display as mtr in the modal
                    breakdownType: 'warehouse'
                  });
                }}
              />
            </>
          )}
        </div>
      </div>
      <BreakdownModal data={modalData} onClose={() => setModalData(null)} />
    </div>
  );
}
