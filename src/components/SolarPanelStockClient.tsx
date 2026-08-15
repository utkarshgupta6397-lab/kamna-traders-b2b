'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, Box, ChevronDown, Check, Loader2, AlertTriangle, ExternalLink, X, Camera
} from 'lucide-react';
import CurrentStockSidebar from './CurrentStockSidebar';
import { formatStockDate } from '@/lib/date-utils';
import { toCanvas } from 'html-to-image';
import toast from 'react-hot-toast';

// Types
interface Warehouse { id: string; name: string; isSystemWarehouse?: boolean; }
interface Brand { id: string; name: string; }
interface SkuInventory { [warehouseId: string]: { qty: number; isOos: boolean; } }
interface SkuItem {
  id: string; name: string; brandId?: string | null; brand?: string | null;
  categoryId?: string | null; categoryName?: string | null; unit?: string | null;
  inventory: SkuInventory; isDcrEligible?: boolean;
  wattage?: string | null;
  parentProductId?: string | null;
  parentProductName?: string | null;
}
interface Props {
  warehouses: Warehouse[]; categories: any[]; brands: Brand[];
  items: SkuItem[]; canSync?: boolean;
}

export interface SolarPanelDrilldown {
  brandId?: string;
  wattage?: string;
  seriesId?: string;
  warehouseId?: string;
  dcrStatus?: 'DCR' | 'Non-DCR';
}

export interface PivotCellDef {
  value: number;
  dimensions?: SolarPanelDrilldown;
}

export interface PivotColumnDef {
  id: string; label: string; isGrandTotal?: boolean; isWarehouseGroup?: boolean;
  subColumns?: { id: string; label: string; isTotal?: boolean; }[];
}
export interface PivotRowDef {
  id: string; label: string; isGroupHeader?: boolean; isGrandTotal?: boolean;
  href?: string;
  cells: Record<string, PivotCellDef | number>;
}
interface PivotTableProps {
  title: string; subtitle: string; firstColLabel: string;
  columns: PivotColumnDef[]; rows: PivotRowDef[]; firstColWidth?: number;
  activeDrilldown: SolarPanelDrilldown | null;
  onCellClick: (dimensions: SolarPanelDrilldown) => void;
  headerRight?: React.ReactNode;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

// Heatmap — Google Charts colorful interpolation
const colors = [
  { r: 236, g: 253, b: 245 }, // 0.0 - Very light mint/cyan (neutral-ish for lowest positive)
  { r: 167, g: 243, b: 208 }, // 0.25 - Light green
  { r: 253, g: 230, b: 138 }, // 0.50 - Yellow
  { r: 251, g: 146, b: 60 },  // 0.75 - Orange
  { r: 239, g: 68, b: 68 }    // 1.0 - Red
];

function buildHeatmap(rows: PivotRowDef[]) {
  let maxBody = 0, maxGtCol = 0;
  rows.forEach(row => {
    if (row.isGroupHeader) return;
    Object.entries(row.cells).forEach(([colId, cell]) => {
      const val = typeof cell === 'number' ? cell : cell?.value;
      const n = Number(val);
      if (!isNaN(n) && n > 0) {
        const isGtCol = colId.startsWith('GT_') || colId === 'GT';
        if (isGtCol) { if (n > maxGtCol) maxGtCol = n; }
        else if (!row.isGrandTotal) { if (n > maxBody) maxBody = n; }
      }
    });
  });

  const getStyle = (val: number, isGTRow: boolean, isGTCol: boolean): React.CSSProperties => {
    const n = Number(val) || 0;
    if (n <= 0) return {};

    if (isGTRow) {
      const ratio = Math.min(1, n / (maxGtCol || 1));
      const add = Math.round(ratio * 14);
      return { backgroundColor: `rgb(${26+add},${39+add},${102+add})`, color: '#fff' };
    }

    let ratio = Math.min(1, Math.max(0, n / (isGTCol ? (maxGtCol || 1) : (maxBody || 1))));
    
    const steps = colors.length - 1;
    const scaled = ratio * steps;
    const idx = Math.floor(scaled);
    let r, g, b;
    if (idx >= steps) {
      r = colors[steps].r; g = colors[steps].g; b = colors[steps].b;
    } else {
      const t = scaled - idx;
      const c1 = colors[idx];
      const c2 = colors[idx + 1];
      r = Math.round(c1.r + (c2.r - c1.r) * t);
      g = Math.round(c1.g + (c2.g - c1.g) * t);
      b = Math.round(c1.b + (c2.b - c1.b) * t);
    }

    if (isGTCol) {
      r = Math.round(r * 0.95); g = Math.round(g * 0.95); b = Math.round(b * 0.95);
    }

    const isDark = (r * 0.299 + g * 0.587 + b * 0.114) < 150;
    return { 
      backgroundColor: `rgb(${r},${g},${b})`, 
      color: isDark ? '#fff' : '#0f172a', 
      fontWeight: ratio > 0.4 ? 600 : 500 
    };
  };
  return { getStyle };
}

function isDrilldownMatch(cellDim: SolarPanelDrilldown | undefined, active: SolarPanelDrilldown | null) {
  if (!active || !cellDim) return false;
  // If active exists, and cellDim matches all active keys exactly (or superset)
  return Object.keys(active).every(k => (active as any)[k] === (cellDim as any)[k]);
}

function PivotTable({ title, subtitle, firstColLabel, columns, rows, firstColWidth = 220, activeDrilldown, onCellClick, headerRight, containerRef }: PivotTableProps) {
  type Leaf = { id: string; label: string; width: number; isGrandTotal: boolean; isTotal: boolean; parentId?: string; isFirstInGroup: boolean; rightOffset?: number; };
  const flatLeaves: Leaf[] = [];
  columns.forEach(col => {
    const isGT = !!col.isGrandTotal;
    if (col.subColumns?.length) {
      col.subColumns.forEach((sc, si) => {
        flatLeaves.push({ id: `${col.id}_${sc.id}`, label: sc.label, width: sc.isTotal ? 85 : 70, isGrandTotal: isGT, isTotal: !!sc.isTotal, parentId: col.id, isFirstInGroup: si === 0 });
      });
    } else {
      flatLeaves.push({ id: col.id, label: col.label, width: isGT ? 85 : 75, isGrandTotal: isGT, isTotal: false, isFirstInGroup: true });
    }
  });

  let offset = 0;
  for (let i = flatLeaves.length - 1; i >= 0; i--) {
    if (flatLeaves[i].isGrandTotal) { flatLeaves[i].rightOffset = offset; offset += flatLeaves[i].width; }
  }
  const gtTotalWidth = offset;
  const hasSubCols = columns.some(c => c.subColumns?.length);
  const { getStyle } = buildHeatmap(rows);
  const GT_BG = '#1A2766';

  const LS = (z: number): React.CSSProperties => ({ position: 'sticky', left: 0, zIndex: z });
  const RS = (right: number, z: number): React.CSSProperties => ({ position: 'sticky', right, zIndex: z });
  const groupBorder = (l: Leaf) =>
    l.isFirstInGroup && !l.isGrandTotal ? 'border-l-2 border-l-slate-300'
    : l.isGrandTotal && l.isFirstInGroup ? 'border-l-4 border-l-[#1A2766]/40'
    : 'border-l border-l-gray-200/50';

  return (
    <div ref={containerRef} className="bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col mb-6" style={{ overflow: 'hidden' }}>
      <div className="px-4 py-3 border-b border-gray-100 bg-white shrink-0 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900 text-[13px] uppercase tracking-wide">{title}</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        {headerRight && <div>{headerRight}</div>}
      </div>
      <div className="overflow-x-auto overflow-y-auto max-h-[560px] relative bg-white">
        <table className="text-sm text-left" style={{ minWidth: 'max-content', width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr className="bg-[#f8f9fb]">
              <th
                className="px-3 py-2.5 font-bold text-[11px] text-gray-600 uppercase tracking-wide border-b-2 border-b-gray-300 border-r border-r-gray-200 bg-[#f8f9fb] text-left"
                style={{ ...LS(40), width: firstColWidth, minWidth: firstColWidth, maxWidth: firstColWidth }}
                rowSpan={hasSubCols ? 2 : 1}
              >
                {firstColLabel}
              </th>
              {columns.map(c => {
                const isGT = !!c.isGrandTotal;
                const span = c.subColumns ? c.subColumns.length : 1;
                return (
                  <th
                    key={c.id}
                    colSpan={span}
                    rowSpan={hasSubCols && !c.subColumns ? 2 : 1}
                    className={`px-2 py-2.5 text-[11px] font-bold uppercase tracking-wide text-center border-b border-b-gray-200 ${isGT ? 'text-white border-b-2 border-b-white/20 border-l-4 border-l-white/30' : 'text-gray-700 border-l-2 border-l-slate-300'}`}
                    style={isGT ? { ...RS(0, 35), backgroundColor: GT_BG, minWidth: gtTotalWidth } : { position: 'sticky', top: 0, zIndex: 30, backgroundColor: '#EEF2FF' }}
                  >
                    {c.label}
                  </th>
                );
              })}
            </tr>
            {hasSubCols && (
              <tr className="bg-[#f8f9fb]">
                {flatLeaves.map((leaf, idx) => {
                  const isGT = leaf.isGrandTotal;
                  return (
                    <th
                      key={`sub_${idx}`}
                      className={`px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-center border-b-2 border-b-gray-300 ${isGT ? 'text-blue-100 border-l border-l-white/10' : leaf.isFirstInGroup ? 'text-sky-700 border-l-2 border-l-slate-300' : 'text-gray-500 border-l border-l-gray-200'} ${leaf.isTotal && !isGT ? 'bg-[#EEF2FF] text-indigo-700 font-bold' : ''}`}
                      style={isGT
                        ? { ...RS(leaf.rightOffset!, 35), backgroundColor: GT_BG, width: leaf.width, minWidth: leaf.width, maxWidth: leaf.width }
                        : { position: 'sticky', top: 37, zIndex: 30, backgroundColor: leaf.isTotal ? '#EEF2FF' : '#f8f9fb', width: leaf.width, minWidth: leaf.width, maxWidth: leaf.width }}
                    >
                      {leaf.label}
                    </th>
                  );
                })}
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map(row => {
              if (row.isGroupHeader) {
                return (
                  <tr key={row.id} className="bg-slate-50/80 border-b border-slate-200">
                    <td className="px-3 py-2 font-bold text-[12px] text-slate-700 uppercase tracking-wide border-r border-slate-200 bg-slate-50/80" style={LS(20)}>
                      {row.label}
                    </td>
                    {flatLeaves.map((leaf, idx) => (
                      <td key={idx} className={groupBorder(leaf)}
                        style={leaf.isGrandTotal ? { ...RS(leaf.rightOffset!, 15), backgroundColor: '#ECEEF8', width: leaf.width, minWidth: leaf.width } : { backgroundColor: '#f8f9fb' }}
                      />
                    ))}
                  </tr>
                );
              }
              
              return (
                <tr key={row.id} className={`border-b border-gray-100 transition-all ${row.isGrandTotal ? 'font-bold text-[12px] text-white' : 'hover:brightness-95 group'}`} style={row.isGrandTotal ? { position: 'sticky', bottom: 0, zIndex: 30 } : {}}>
                  <td
                    className={`px-3 py-1.5 font-medium border-r border-gray-200 transition-colors ${row.isGrandTotal ? 'text-[11px] font-black uppercase tracking-wider border-t-2 border-t-white/10 border-r border-r-white/20' : `text-[13px] text-gray-700 bg-white ${row.id.includes('_child_') ? 'pl-7 text-gray-600 text-[12px]' : ''}`}`}
                    style={row.isGrandTotal ? { ...LS(40), backgroundColor: GT_BG, color: '#fff' } : LS(20)}
                  >
                    <div className="flex items-center" title={row.label} style={{ maxWidth: firstColWidth - 28 }}>
                      {row.href && !row.isGrandTotal ? (
                        <a href={row.href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 hover-group truncate font-semibold cursor-pointer">
                          <span className="truncate">{row.label}</span>
                          <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </a>
                      ) : (
                        <span className="truncate">{row.label}</span>
                      )}
                      
                      {!row.isGrandTotal && row.id.includes('_child_Unknown') && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: '#f59e0b', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 3, padding: '1px 4px', whiteSpace: 'nowrap' }}>
                          no wattage
                        </span>
                      )}
                    </div>
                  </td>
                  {flatLeaves.map((leaf, idx) => {
                    const cellData = row.cells[leaf.id];
                    const val = typeof cellData === 'number' ? cellData : cellData?.value || 0;
                    const dim = typeof cellData === 'object' ? cellData?.dimensions : undefined;
                    const isClickable = dim && Object.keys(dim).length > 0;
                    const isMatched = isDrilldownMatch(dim, activeDrilldown);
                    const cs = getStyle(val, !!row.isGrandTotal, leaf.isGrandTotal);

                    const interactiveStyle = isClickable && !row.isGrandTotal ? { cursor: 'pointer' } : {};
                    const highlightClass = isMatched && !row.isGrandTotal ? 'ring-inset ring-2 ring-blue-500 shadow-inner' : '';
                    const hoverClass = isClickable && !row.isGrandTotal ? 'hover:ring-inset hover:ring-2 hover:ring-blue-400 hover:brightness-110' : '';

                    return (
                      <td key={idx}
                        onClick={() => { if (isClickable) onCellClick(dim); }}
                        title={isClickable && !row.isGrandTotal ? 'Click to drill down' : undefined}
                        className={`px-2 py-1.5 text-center transition-all ${row.isGrandTotal ? `border-t-2 border-t-white/10 py-2.5 ${leaf.isFirstInGroup && !leaf.isGrandTotal ? 'border-l-2 border-l-white/20' : ''} ${leaf.isGrandTotal && leaf.isFirstInGroup ? 'border-l-4 border-l-white/30' : ''}` : `text-[13px] ${groupBorder(leaf)}`} ${hoverClass} ${highlightClass}`}
                        style={leaf.isGrandTotal 
                          ? { ...RS(leaf.rightOffset!, row.isGrandTotal ? 35 : 20), ...cs, ...interactiveStyle, width: leaf.width, minWidth: leaf.width } 
                          : { ...cs, ...interactiveStyle, width: leaf.width, minWidth: leaf.width }}
                      >
                        {val === 0 ? <span className={row.isGrandTotal ? "opacity-40" : "text-gray-200 select-none"}>—</span> : val.toLocaleString()}
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
    <div className="absolute left-0 mt-1 z-[200] bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all"
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

export default function SolarPanelStockClient({ warehouses, categories, brands, items }: Props) {
  const pivot1Ref = useRef<HTMLDivElement>(null);
  
  // Global Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedDcr, setSelectedDcr] = useState<string[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [selectedWattages, setSelectedWattages] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // Shared Drilldown State
  const [activeDrilldown, setActiveDrilldown] = useState<SolarPanelDrilldown | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // If ANY global filter changes, clear the active drilldown.
  useEffect(() => setActiveDrilldown(null), [debouncedSearch, selectedWarehouses, selectedBrands, selectedDcr, selectedSeries, selectedWattages]);

  const solarCategory = categories.find(c => c.name.toLowerCase() === 'solar panel');
  const isFixtureMode = process.env.NODE_ENV === 'development' && warehouses.filter(w => !w.isSystemWarehouse).length < 5;
  const operationalWarehouses = useMemo(() => {
    if (isFixtureMode) {
      return [
        { id: 'WH001', name: 'Main Solar Warehouse' },
        { id: 'mock_delhi', name: 'Delhi Warehouse' },
        { id: 'mock_meerut', name: 'Meerut Warehouse' },
        { id: 'mock_lucknow', name: 'Lucknow Warehouse' },
        { id: 'mock_noida', name: 'Noida Warehouse' },
      ];
    }
    return warehouses.filter(w => !w.isSystemWarehouse);
  }, [warehouses, isFixtureMode]);

  const availableBrands = useMemo(() => {
    const m = new Map<string, string>();
    items.forEach(item => { if (item.brandId && item.brand) m.set(item.brandId, item.brand); });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const availableSeries = useMemo(() => {
    const s = new Set<string>();
    items.forEach(i => { if (i.parentProductName) s.add(i.parentProductName); });
    return Array.from(s).sort();
  }, [items]);

  const availableWattages = useMemo(() => {
    const s = new Set<string>();
    items.forEach(i => { if (i.wattage) s.add(i.wattage); });
    return Array.from(s).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    return items.filter(item => {
      if (q && !item.name.toLowerCase().includes(q) && !item.id.toLowerCase().includes(q)) return false;
      if (selectedBrands.length > 0 && (!item.brandId || !selectedBrands.includes(item.brandId))) return false;
      const dcrStatus = item.isDcrEligible ? 'DCR' : 'Non-DCR';
      if (selectedDcr.length > 0 && !selectedDcr.includes(dcrStatus)) return false;
      if (selectedSeries.length > 0 && (!item.parentProductName || !selectedSeries.includes(item.parentProductName))) return false;
      if (selectedWattages.length > 0 && (!item.wattage || !selectedWattages.includes(item.wattage))) return false;
      return true;
    });
  }, [items, debouncedSearch, selectedBrands, selectedDcr, selectedSeries, selectedWattages]);

  // Effective items (filteredItems + Drilldown)
  const effectiveItems = useMemo(() => {
    if (!activeDrilldown) return filteredItems;
    return filteredItems.filter(item => {
      if (activeDrilldown.brandId && (item.brand || 'Unbranded') !== activeDrilldown.brandId) return false;
      if (activeDrilldown.wattage && (item.wattage?.trim() || 'Unknown') !== activeDrilldown.wattage) return false;
      if (activeDrilldown.seriesId && item.parentProductName !== activeDrilldown.seriesId) return false;
      if (activeDrilldown.dcrStatus && (item.isDcrEligible ? 'DCR' : 'Non-DCR') !== activeDrilldown.dcrStatus) return false;
      return true;
    });
  }, [filteredItems, activeDrilldown]);

  const visibleWarehouses = useMemo(() =>
    selectedWarehouses.length > 0 ? operationalWarehouses.filter(w => selectedWarehouses.includes(w.id)) : operationalWarehouses,
    [operationalWarehouses, selectedWarehouses]);

  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>, val: string) =>
    set(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  // Respects warehouse drilldown without collapsing columns
  const getQty = (item: SkuItem, whId: string): number => {
    if (activeDrilldown?.warehouseId && activeDrilldown.warehouseId !== whId) return 0;
    
    if (isFixtureMode) {
      const hash = Array.from(item.id).reduce((acc, c) => acc + c.charCodeAt(0), 0);
      let base = 0;
      if (whId === 'WH001') base = (hash % 12) * (item.isDcrEligible ? 8 : 20);
      else if (whId === 'mock_delhi') base = (hash % 10) * (item.isDcrEligible ? 5 : 15);
      else if (whId === 'mock_meerut') base = (hash % 8) * (item.isDcrEligible ? 4 : 12);
      else if (whId === 'mock_lucknow') base = (hash % 5) * (item.isDcrEligible ? 3 : 8);
      else if (whId === 'mock_noida') base = (hash % 3) * (item.isDcrEligible ? 1 : 4);
      if (hash % 7 === 0 && whId !== 'WH001') return 0;
      return base;
    }
    return Math.max(0, item.inventory[whId]?.qty || 0);
  };

  const meaningfulWarehouses = useMemo(() => {
    return visibleWarehouses.filter(wh => {
      for (const item of effectiveItems) {
        if (getQty(item, wh.id) > 0) return true;
      }
      return false;
    });
  }, [effectiveItems, visibleWarehouses, activeDrilldown]);

  const handleCellClick = (dim: SolarPanelDrilldown) => setActiveDrilldown(dim);

  const whDcrCols: PivotColumnDef[] = meaningfulWarehouses.map(wh => ({
    id: wh.id, label: wh.name, isWarehouseGroup: true,
    subColumns: [{ id: 'DCR', label: 'DCR' }, { id: 'Non-DCR', label: 'Non-DCR' }],
  }));
  const gtDcrCol: PivotColumnDef = {
    id: 'GT', label: 'Grand Total', isGrandTotal: true,
    subColumns: [{ id: 'DCR', label: 'DCR' }, { id: 'Non-DCR', label: 'Non-DCR' }, { id: 'Total', label: 'Total', isTotal: true }],
  };
  const cols12: PivotColumnDef[] = [...whDcrCols, gtDcrCol];

  // Pivot 1: Brand + Wattage
  const pivot1Rows = useMemo<PivotRowDef[]>(() => {
    const bm = new Map<string, { brandId: string|null; totalDcr: number; totalNonDcr: number; wattages: Map<string, { data: Record<string, PivotCellDef>; totalDcr: number; totalNonDcr: number }>; }>();
    let gtDcr = 0, gtNonDcr = 0;
    const colTotals: Record<string, number> = {};
    
    effectiveItems.forEach(item => {
      const brand = item.brand || 'Unbranded';
      const wattage = item.wattage?.trim() || 'Unknown';
      const isDcr = !!item.isDcrEligible;
      if (!bm.has(brand)) bm.set(brand, { brandId: item.brandId || null, totalDcr: 0, totalNonDcr: 0, wattages: new Map() });
      const b = bm.get(brand)!;
      if (!b.wattages.has(wattage)) b.wattages.set(wattage, { data: {}, totalDcr: 0, totalNonDcr: 0 });
      const w = b.wattages.get(wattage)!;
      meaningfulWarehouses.forEach(wh => {
        const qty = getQty(item, wh.id);
        if (qty > 0) {
          const ck = `${wh.id}_${isDcr ? 'DCR' : 'Non-DCR'}`;
          const currentCell = w.data[ck];
          w.data[ck] = { 
            value: (currentCell?.value || 0) + qty, 
            dimensions: { brandId: brand, wattage, warehouseId: wh.id, dcrStatus: isDcr ? 'DCR' : 'Non-DCR' } 
          };
          if (isDcr) { w.totalDcr += qty; b.totalDcr += qty; gtDcr += qty; }
          else { w.totalNonDcr += qty; b.totalNonDcr += qty; gtNonDcr += qty; }
          colTotals[ck] = (colTotals[ck] || 0) + qty;
        }
      });
    });
    const result: PivotRowDef[] = [];
    Array.from(bm.entries()).sort((a, b) => a[0].localeCompare(b[0])).forEach(([brand, bObj]) => {
      const validWattages = Array.from(bObj.wattages.entries())
        .filter(([w, wObj]) => (wObj.totalDcr + wObj.totalNonDcr) > 0)
        .sort((a, b) => { if (a[0] === 'Unknown') return 1; if (b[0] === 'Unknown') return -1; return (parseInt(a[0]) || 0) - (parseInt(b[0]) || 0); });
      
      if (validWattages.length === 0) return;
      
      result.push({ id: `group_${brand}`, label: brand, isGroupHeader: true, cells: {} });
      validWattages.forEach(([watt, wObj]) => {
          let href;
          if (watt !== 'Unknown' && solarCategory?.id) {
            href = `/staff/dashboard/catalog-pricing/products?categoryId=${solarCategory.id}&search=${encodeURIComponent(watt)}`;
            if (bObj.brandId) href += `&brandId=${bObj.brandId}`;
          }
          result.push({ 
            id: `row_${brand}_child_${watt}`, 
            label: watt, 
            href,
            cells: { 
              ...wObj.data, 
              'GT_DCR': { value: wObj.totalDcr, dimensions: { brandId: brand, wattage: watt, dcrStatus: 'DCR' } }, 
              'GT_Non-DCR': { value: wObj.totalNonDcr, dimensions: { brandId: brand, wattage: watt, dcrStatus: 'Non-DCR' } }, 
              'GT_Total': { value: wObj.totalDcr + wObj.totalNonDcr, dimensions: { brandId: brand, wattage: watt } } 
            } 
          });
        });
    });
    
    const gtRowCells: Record<string, PivotCellDef> = {};
    Object.keys(colTotals).forEach(ck => {
      const parts = ck.split('_');
      gtRowCells[ck] = { value: colTotals[ck], dimensions: { warehouseId: parts[0], dcrStatus: parts[1] as 'DCR'|'Non-DCR' } };
    });
    gtRowCells['GT_DCR'] = { value: gtDcr, dimensions: { dcrStatus: 'DCR' } };
    gtRowCells['GT_Non-DCR'] = { value: gtNonDcr, dimensions: { dcrStatus: 'Non-DCR' } };
    gtRowCells['GT_Total'] = { value: gtDcr + gtNonDcr, dimensions: {} };

    result.push({ id: 'gt_row', label: 'Grand Total', isGrandTotal: true, cells: gtRowCells });
    return result;
  }, [effectiveItems, meaningfulWarehouses, solarCategory]);

  // Pivot 2: Product Series
  const pivot2Rows = useMemo<PivotRowDef[]>(() => {
    const sm = new Map<string, { data: Record<string, PivotCellDef>; totalDcr: number; totalNonDcr: number }>();
    let gtDcr = 0, gtNonDcr = 0;
    const ct: Record<string, number> = {};
    effectiveItems.forEach(item => {
      if (!item.parentProductName) return;
      const series = item.parentProductName;
      if (!sm.has(series)) sm.set(series, { data: {}, totalDcr: 0, totalNonDcr: 0 });
      const s = sm.get(series)!;
      const isDcr = !!item.isDcrEligible;
      meaningfulWarehouses.forEach(wh => {
        const qty = getQty(item, wh.id);
        if (qty > 0) {
          const ck = `${wh.id}_${isDcr ? 'DCR' : 'Non-DCR'}`;
          const currentCell = s.data[ck];
          s.data[ck] = {
            value: (currentCell?.value || 0) + qty,
            dimensions: { seriesId: series, warehouseId: wh.id, dcrStatus: isDcr ? 'DCR' : 'Non-DCR' }
          };
          if (isDcr) { s.totalDcr += qty; gtDcr += qty; } else { s.totalNonDcr += qty; gtNonDcr += qty; }
          ct[ck] = (ct[ck] || 0) + qty;
        }
      });
    });
    const result: PivotRowDef[] = Array.from(sm.entries()).filter(([s, sObj]) => (sObj.totalDcr + sObj.totalNonDcr) > 0).sort((a, b) => a[0].localeCompare(b[0])).map(([series, sObj]) => ({
      id: `series_${series}`, label: series, 
      cells: { 
        ...sObj.data, 
        'GT_DCR': { value: sObj.totalDcr, dimensions: { seriesId: series, dcrStatus: 'DCR' } }, 
        'GT_Non-DCR': { value: sObj.totalNonDcr, dimensions: { seriesId: series, dcrStatus: 'Non-DCR' } }, 
        'GT_Total': { value: sObj.totalDcr + sObj.totalNonDcr, dimensions: { seriesId: series } } 
      }
    }));
    
    const gtRowCells: Record<string, PivotCellDef> = {};
    Object.keys(ct).forEach(ck => {
      const parts = ck.split('_');
      gtRowCells[ck] = { value: ct[ck], dimensions: { warehouseId: parts[0], dcrStatus: parts[1] as 'DCR'|'Non-DCR' } };
    });
    gtRowCells['GT_DCR'] = { value: gtDcr, dimensions: { dcrStatus: 'DCR' } };
    gtRowCells['GT_Non-DCR'] = { value: gtNonDcr, dimensions: { dcrStatus: 'Non-DCR' } };
    gtRowCells['GT_Total'] = { value: gtDcr + gtNonDcr, dimensions: {} };

    result.push({ id: 'gt_row', label: 'Grand Total', isGrandTotal: true, cells: gtRowCells });
    return result;
  }, [effectiveItems, meaningfulWarehouses]);

  // Pivot 3: Brand x Warehouse
  const pivot3Cols: PivotColumnDef[] = [...meaningfulWarehouses.map(wh => ({ id: wh.id, label: wh.name })), { id: 'GT', label: 'Grand Total', isGrandTotal: true }];
  const pivot3Rows = useMemo<PivotRowDef[]>(() => {
    const bm = new Map<string, { data: Record<string, PivotCellDef>; total: number }>();
    let total = 0; const ct: Record<string, number> = {};
    effectiveItems.forEach(item => {
      const brand = item.brand || 'Unbranded';
      if (!bm.has(brand)) bm.set(brand, { data: {}, total: 0 });
      const b = bm.get(brand)!;
      meaningfulWarehouses.forEach(wh => {
        const qty = getQty(item, wh.id);
        if (qty > 0) { 
          const current = b.data[wh.id];
          b.data[wh.id] = { value: (current?.value || 0) + qty, dimensions: { brandId: brand, warehouseId: wh.id } }; 
          b.total += qty; ct[wh.id] = (ct[wh.id] || 0) + qty; total += qty; 
        }
      });
    });
    const result: PivotRowDef[] = Array.from(bm.entries()).filter(([b, bObj]) => bObj.total > 0).sort((a, b) => a[0].localeCompare(b[0])).map(([brand, bObj]) => ({ 
      id: `b_${brand}`, label: brand, cells: { ...bObj.data, 'GT': { value: bObj.total, dimensions: { brandId: brand } } } 
    }));

    const gtRowCells: Record<string, PivotCellDef> = {};
    Object.keys(ct).forEach(whId => { gtRowCells[whId] = { value: ct[whId], dimensions: { warehouseId: whId } }; });
    gtRowCells['GT'] = { value: total, dimensions: {} };

    result.push({ id: 'gt_row', label: 'Grand Total', isGrandTotal: true, cells: gtRowCells });
    return result;
  }, [effectiveItems, meaningfulWarehouses]);

  // Pivot 4: Summary (New Orientation: Y = DCR/Non-DCR/Total, X = Warehouses)
  const pivot4Cols: PivotColumnDef[] = [
    ...meaningfulWarehouses.map(wh => ({ id: wh.id, label: wh.name, isWarehouseGroup: true })),
    { id: 'GT', label: 'Grand Total', isGrandTotal: true }
  ];
  const pivot4Rows = useMemo<PivotRowDef[]>(() => {
    const dcrCells: Record<string, PivotCellDef> = {};
    const nonDcrCells: Record<string, PivotCellDef> = {};
    const totalCells: Record<string, PivotCellDef> = {};
    let gtDcr = 0, gtNonDcr = 0;
    
    effectiveItems.forEach(item => {
      const isDcr = !!item.isDcrEligible;
      meaningfulWarehouses.forEach(wh => {
        const qty = getQty(item, wh.id);
        if (qty > 0) {
          if (isDcr) { 
            const curr = dcrCells[wh.id];
            dcrCells[wh.id] = { value: (curr?.value || 0) + qty, dimensions: { warehouseId: wh.id, dcrStatus: 'DCR' } }; 
            gtDcr += qty; 
          } else { 
            const curr = nonDcrCells[wh.id];
            nonDcrCells[wh.id] = { value: (curr?.value || 0) + qty, dimensions: { warehouseId: wh.id, dcrStatus: 'Non-DCR' } }; 
            gtNonDcr += qty; 
          }
          const currT = totalCells[wh.id];
          totalCells[wh.id] = { value: (currT?.value || 0) + qty, dimensions: { warehouseId: wh.id } };
        }
      });
    });
    dcrCells['GT'] = { value: gtDcr, dimensions: { dcrStatus: 'DCR' } }; 
    nonDcrCells['GT'] = { value: gtNonDcr, dimensions: { dcrStatus: 'Non-DCR' } }; 
    totalCells['GT'] = { value: gtDcr + gtNonDcr, dimensions: {} };
    
    const rows: PivotRowDef[] = [];
    if (gtDcr > 0) rows.push({ id: 'r_dcr', label: 'DCR', cells: dcrCells });
    if (gtNonDcr > 0) rows.push({ id: 'r_nondcr', label: 'Non-DCR', cells: nonDcrCells });
    rows.push({ id: 'r_total', label: 'TOTAL', isGrandTotal: true, cells: totalCells });
    return rows;
  }, [effectiveItems, meaningfulWarehouses]);

  const handleTakeScreenshot = async () => {
    if (!pivot1Ref.current) return;
    setIsExporting(true);
    const tid = toast.loading('Capturing screenshot...');
    try {
      const node = pivot1Ref.current;
      // Use html-to-image style overrides to expand the node without a visible DOM jump
      const canvas = await toCanvas(node, { 
        pixelRatio: 1.5, 
        backgroundColor: '#ffffff',
        width: node.scrollWidth,
        height: node.scrollHeight,
        style: {
          width: `${node.scrollWidth}px`,
          maxWidth: 'none',
          overflow: 'visible'
        }
      });
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
      
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timestamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
      
      let suffix = '';
      if (activeDrilldown) {
        const parts = [];
        if (activeDrilldown.brandId) parts.push(activeDrilldown.brandId);
        if (activeDrilldown.wattage) parts.push(`${activeDrilldown.wattage}w`);
        if (parts.length > 0) {
           suffix = '-' + parts.join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        }
      }

      const link = document.createElement('a');
      link.download = `solar-panel-stock-brand-wattage${suffix}-${timestamp}.jpg`;
      link.href = dataUrl;
      link.click();
      toast.success('Screenshot captured', { id: tid });
    } catch (err) {
      console.error(err);
      toast.error('Failed to capture screenshot', { id: tid });
    } finally {
      setIsExporting(false);
    }
  };

  const renderDrilldownBar = () => {
    if (!activeDrilldown) return null;
    const chips: { label: string; key: keyof SolarPanelDrilldown }[] = [];
    if (activeDrilldown.brandId) chips.push({ label: `Brand: ${activeDrilldown.brandId}`, key: 'brandId' });
    if (activeDrilldown.wattage) chips.push({ label: `Wattage: ${activeDrilldown.wattage}`, key: 'wattage' });
    if (activeDrilldown.seriesId) chips.push({ label: `Series: ${activeDrilldown.seriesId}`, key: 'seriesId' });
    if (activeDrilldown.warehouseId) {
      const wName = operationalWarehouses.find(w => w.id === activeDrilldown.warehouseId)?.name || activeDrilldown.warehouseId;
      chips.push({ label: `Warehouse: ${wName}`, key: 'warehouseId' });
    }
    if (activeDrilldown.dcrStatus) chips.push({ label: activeDrilldown.dcrStatus, key: 'dcrStatus' });

    if (chips.length === 0) return null;

    return (
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-3 shrink-0">
        <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wide">Active Drill-down:</span>
        <div className="flex flex-wrap items-center gap-2">
          {chips.map(c => (
            <div key={c.key} className="flex items-center gap-1 bg-white border border-blue-200 text-blue-700 text-xs px-2 py-1 rounded-md font-medium shadow-sm">
              {c.label}
              <button onClick={() => {
                const next = { ...activeDrilldown };
                delete next[c.key];
                setActiveDrilldown(Object.keys(next).length ? next : null);
              }} className="hover:bg-blue-100 rounded text-blue-500 hover:text-blue-700 transition-colors">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => setActiveDrilldown(null)} className="ml-auto text-xs font-semibold text-blue-600 hover:text-blue-800 underline decoration-blue-300 hover:decoration-blue-500 underline-offset-2 transition-colors">
          Clear Filter
        </button>
      </div>
    );
  };

  return (
    <div className="flex h-full gap-5">
      <CurrentStockSidebar activeView="solar" />
      <div className="flex-1 flex flex-col h-full min-w-0 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between shrink-0 rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1A2766]/10 flex items-center justify-center">
              <Box size={17} className="text-[#1A2766]" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold tracking-tight text-gray-900 leading-tight">Solar Panel Stock</h1>
              <div className="text-[11px] text-blue-600 font-medium">Category: Solar Panel · {effectiveItems.length} SKUs {effectiveItems.length !== items.length && '(Filtered)'}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-gray-400 font-medium">Last updated: {formatStockDate(new Date())}</span>
          </div>
        </div>

        <div className="px-4 py-2.5 border-b border-gray-100 bg-white flex flex-wrap items-center gap-2 shrink-0">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input type="text" placeholder="Search product or SKU…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 bg-gray-50 border border-gray-200 rounded-md text-[13px] text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors h-8" />
          </div>
          <MultiSelectFilter label="Warehouses" options={operationalWarehouses.map(w => ({ id: w.id, name: w.name }))} selected={selectedWarehouses} onToggle={id => toggle(setSelectedWarehouses, id)} prefix={<Box size={13} className="text-gray-400" />} />
          <MultiSelectFilter label="Brands" options={availableBrands} selected={selectedBrands} onToggle={id => toggle(setSelectedBrands, id)} />
          <MultiSelectFilter label="DCR Status" options={[{ id: 'DCR', name: 'DCR' }, { id: 'Non-DCR', name: 'Non-DCR' }]} selected={selectedDcr} onToggle={id => toggle(setSelectedDcr, id)} />
          <MultiSelectFilter label="Series" options={availableSeries.map(s => ({ id: s, name: s }))} selected={selectedSeries} onToggle={id => toggle(setSelectedSeries, id)} wideMenu />
          <MultiSelectFilter label="Wattage" options={availableWattages.map(w => ({ id: w, name: `${w}W` }))} selected={selectedWattages} onToggle={id => toggle(setSelectedWattages, id)} />
        </div>

        {renderDrilldownBar()}

        <div className="flex-1 overflow-y-auto p-5 bg-[#f7f8fb] min-h-0 relative">
          {(!meaningfulWarehouses.length || effectiveItems.length === 0) ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400">
              <AlertTriangle size={32} className="text-amber-400" />
              <div className="text-lg font-semibold text-gray-700">No Solar Panel stock found</div>
              <p className="text-sm">Try adjusting your filters or drill-down context.</p>
            </div>
          ) : (
            <div className="flex flex-col max-w-full">
              <PivotTable 
                containerRef={pivot1Ref}
                title="Brand & Wattage Breakdown" 
                subtitle="Rows: Brand → Wattage  |  Columns: Warehouse → DCR / Non-DCR  |  Grand Total pinned right" 
                firstColLabel="Brand / Wattage" 
                columns={cols12} 
                rows={pivot1Rows} 
                firstColWidth={220}
                activeDrilldown={activeDrilldown}
                onCellClick={handleCellClick}
                headerRight={
                  <button 
                    onClick={handleTakeScreenshot} 
                    disabled={isExporting}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-200 transition-colors ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isExporting ? <Loader2 size={13} className="animate-spin text-gray-500" /> : <Camera size={13} className="text-gray-500" />}
                    {isExporting ? 'Capturing...' : 'Screenshot'}
                  </button>
                }
              />
              <PivotTable 
                title="Product Series Breakdown" 
                subtitle="Rows: Product Series (Parent Products)  |  Columns: Warehouse → DCR / Non-DCR" 
                firstColLabel="Product Series" 
                columns={cols12} 
                rows={pivot2Rows} 
                firstColWidth={310} 
                activeDrilldown={activeDrilldown}
                onCellClick={handleCellClick}
              />
              <PivotTable 
                title="Brand × Warehouse Stock" 
                subtitle="Rows: Brand  |  Columns: Warehouse total  |  Grand Total pinned right" 
                firstColLabel="Brand" 
                columns={pivot3Cols} 
                rows={pivot3Rows} 
                firstColWidth={220} 
                activeDrilldown={activeDrilldown}
                onCellClick={handleCellClick}
              />
              <PivotTable 
                title="Total Panels Summary" 
                subtitle="Summary: all panels per Warehouse by DCR / Non-DCR / Total" 
                firstColLabel="Metric" 
                columns={pivot4Cols} 
                rows={pivot4Rows} 
                firstColWidth={180} 
                activeDrilldown={activeDrilldown}
                onCellClick={handleCellClick}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
