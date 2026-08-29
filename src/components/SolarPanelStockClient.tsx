'use client';

import dynamic from 'next/dynamic';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, Box, ChevronDown, ChevronRight, Check, AlertTriangle, ExternalLink
} from 'lucide-react';
import CurrentStockSidebar from './CurrentStockSidebar';
import { formatStockDate } from '@/lib/date-utils';
import { StockPageShell, StockHeader, StockFilterBar, StockEmptyState } from './CurrentStockShared';

// ─── Types ───────────────────────────────────────────────────────────────────

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
  isExportMode?: boolean;
}

export interface PivotCellDef {
  value: number;
}

export interface PivotColumnDef {
  id: string; label: string; isGrandTotal?: boolean; isWarehouseGroup?: boolean;
  subColumns?: { id: string; label: string; isTotal?: boolean; }[];
}
export interface PivotRowDef {
  id: string; label: string; isGroupHeader?: boolean; isGrandTotal?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  href?: string;
  cells: Record<string, PivotCellDef | number>;
}
interface PivotTableProps {
  title: string; subtitle: string; firstColLabel: string;
  columns: PivotColumnDef[]; rows: PivotRowDef[];
  isExportMode?: boolean;
}

// ─── Wattage formatter ───────────────────────────────────────────────────────

function formatWattageDisplay(raw: string | null | undefined): string {
  if (!raw || raw.trim() === '') return 'Unknown';
  const v = raw.trim();
  if (/^[\d.]+$/.test(v)) return `${v} W`;
  if (/\bW$/i.test(v)) return v;
  return v;
}


// ─── Heatmap ─────────────────────────────────────────────────────────────────

function buildHeatmap(rows: PivotRowDef[]) {
  const whValues: number[] = [];
  const gtValues: number[] = [];

  rows.forEach(row => {
    if (row.isGrandTotal) return;
    Object.entries(row.cells).forEach(([colId, cell]) => {
      const val = typeof cell === 'number' ? cell : cell?.value;
      const n = Number(val);
      if (!isNaN(n) && n > 0) {
        if (colId === 'GT' || colId.startsWith('GT_')) {
          gtValues.push(n);
        } else {
          whValues.push(n);
        }
      }
    });
  });

  whValues.sort((a, b) => a - b);
  gtValues.sort((a, b) => a - b);

  const getRankRatio = (n: number, values: number[]): number => {
    if (values.length === 0 || n <= 0) return 0;
    if (values.length === 1) return 1;
    
    let left = 0, right = values.length - 1;
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (values[mid] === n) {
        let start = mid;
        while (start > 0 && values[start - 1] === n) start--;
        let end = mid;
        while (end < values.length - 1 && values[end + 1] === n) end++;
        return ((start + end) / 2) / (values.length - 1);
      } else if (values[mid] < n) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    return left / values.length;
  };

  const getInterpolatedColor = (ratio: number, colors: {r:number,g:number,b:number}[]) => {
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
    return { r, g, b };
  };

  const getStyle = (val: number, isGTRow: boolean, isGTCol: boolean): React.CSSProperties => {
    const n = Number(val) || 0;
    
    if (isGTRow) {
      return { backgroundColor: '#1e2b6d', color: '#fff' };
    }
    
    if (n <= 0) {
      if (isGTCol) return { backgroundColor: '#f8fafc', color: '#94a3b8' };
      return {};
    }

    if (isGTCol) {
      const ratio = getRankRatio(n, gtValues);
      const heatColors = [
        { r: 255, g: 255, b: 255 }, // White
        { r: 254, g: 226, b: 226 }, // Red 100
        { r: 252, g: 165, b: 165 }, // Red 300
        { r: 239, g: 68,  b: 68 },  // Red 500
      ];
      const { r, g, b } = getInterpolatedColor(ratio, heatColors);
      const isDark = (r * 0.299 + g * 0.587 + b * 0.114) < 150;
      return { 
        backgroundColor: `rgb(${r},${g},${b})`, 
        color: isDark ? '#fff' : '#0f172a', 
        fontWeight: ratio > 0.4 ? 700 : 600 
      };
    }

    // Warehouse cells
    const ratio = getRankRatio(n, whValues);
    const heatColors = [
      { r: 255, g: 255, b: 255 }, // White / Blank
      { r: 187, g: 247, b: 208 }, // Light Green (Green 200)
      { r: 74,  g: 222, b: 128 }, // Green 400
      { r: 251, g: 146, b: 60 },  // Orange 400
      { r: 239, g: 68,  b: 68 },  // Red 500
    ];
    
    const { r, g, b } = getInterpolatedColor(ratio, heatColors);
    const isDark = (r * 0.299 + g * 0.587 + b * 0.114) < 150;
    return { 
      backgroundColor: `rgb(${r},${g},${b})`, 
      color: isDark ? '#fff' : '#0f172a', 
      fontWeight: ratio > 0.4 ? 600 : 500 
    };
  };
  return { getStyle };
}
// ─── PivotTable component ─────────────────────────────────────────────────────

function PivotTable({ title, subtitle, firstColLabel, columns, rows, isExportMode }: PivotTableProps) {
  type Leaf = { id: string; label: string; width: number; isGrandTotal: boolean; isTotal: boolean; parentId?: string; isFirstInGroup: boolean; rightOffset?: number; };
  const flatLeaves: Leaf[] = [];
  columns.forEach(col => {
    const isGT = !!col.isGrandTotal;
    if (col.subColumns?.length) {
      col.subColumns.forEach((sc, si) => {
        flatLeaves.push({ id: `${col.id}_${sc.id}`, label: sc.label, width: sc.isTotal ? 85 : 70, isGrandTotal: isGT, isTotal: !!sc.isTotal, parentId: col.id, isFirstInGroup: si === 0 });
      });
    } else {
      flatLeaves.push({ id: col.id, label: col.label, width: isGT ? 85 : 72, isGrandTotal: isGT, isTotal: false, isFirstInGroup: true });
    }
  });

  let offset = 0;
  for (let i = flatLeaves.length - 1; i >= 0; i--) {
    if (flatLeaves[i].isGrandTotal) { flatLeaves[i].rightOffset = offset; offset += flatLeaves[i].width; }
  }
  const gtTotalWidth = offset;
  const hasSubCols = columns.some(c => c.subColumns?.length);
  const { getStyle } = useMemo(() => buildHeatmap(rows), [rows]);
  const GT_BG = '#1A2766';

  const LS = (z: number): React.CSSProperties => isExportMode ? {} : ({ position: "sticky", left: 0, zIndex: z });
  const RS = (right: number, z: number): React.CSSProperties => isExportMode ? {} : ({ position: "sticky", right, zIndex: z });
  const groupBorder = (l: Leaf) =>
    l.isFirstInGroup && !l.isGrandTotal ? 'border-l-2 border-l-slate-300'
    : l.isGrandTotal && l.isFirstInGroup ? 'border-l-4 border-l-[#1A2766]/40'
    : 'border-l border-l-gray-200/50';

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col mb-6 ${isExportMode ? "export-container" : "overflow-hidden"}`} style={isExportMode ? { overflow: "visible" } : { overflow: "hidden" }}>
      <div className="px-4 py-3 border-b border-gray-100 bg-white shrink-0 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900 text-[13px] uppercase tracking-wide">{title}</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className={`relative bg-white pivot-scroll-container ${isExportMode ? "" : "overflow-x-auto overflow-y-auto max-h-[560px]"}`}>
        <table className={`text-sm text-left ${isExportMode ? "export-table" : ""}`} style={isExportMode ? { width: "100%", maxWidth: "100%", borderCollapse: "separate", borderSpacing: 0 } : { minWidth: "max-content", width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          
          {isExportMode && (
            <colgroup>
              <col style={{ width: "23%" }} />
              {flatLeaves.map((leaf, idx) => {
                let p = "5%";
                if (leaf.isTotal) p = "7%";
                return <col key={`col_${idx}`} style={{ width: p }} />;
              })}
            </colgroup>
          )}
          <thead>
            <tr className="bg-[#f8f9fb]">
              <th
                className="px-3 py-2.5 font-bold text-[11px] text-gray-600 uppercase tracking-wide border-b-2 border-b-gray-300 border-r border-r-gray-200 bg-[#f8f9fb] text-left"
                style={{ ...LS(40), whiteSpace: isExportMode ? 'normal' : 'nowrap', width: 'auto' }}
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
                    style={isGT ? { ...RS(0, 35), backgroundColor: GT_BG, minWidth: isExportMode ? "auto" : gtTotalWidth } : (isExportMode ? { backgroundColor: "#EEF2FF" } : { position: "sticky", top: 0, zIndex: 30, backgroundColor: "#EEF2FF" })}
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
                      className={`px-1 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-center border-b-2 border-b-gray-300 ${isGT ? 'text-blue-100 border-l border-l-white/10' : leaf.isFirstInGroup ? 'text-sky-700 border-l-2 border-l-slate-300' : 'text-gray-500 border-l border-l-gray-200'} ${leaf.isTotal && !isGT ? 'bg-[#EEF2FF] text-indigo-700 font-bold' : ''}`}
                      style={isGT ? { ...RS(leaf.rightOffset!, 35), backgroundColor: GT_BG, width: isExportMode ? "auto" : leaf.width, minWidth: isExportMode ? "auto" : leaf.width } : (isExportMode ? { backgroundColor: leaf.isTotal ? "#EEF2FF" : "#f8f9fb", width: "auto" } : { position: "sticky", top: 37, zIndex: 30, backgroundColor: leaf.isTotal ? "#EEF2FF" : "#f8f9fb", width: leaf.width, minWidth: leaf.width, maxWidth: leaf.width })}
                    >
                      {leaf.label}
                    </th>
                  );
                })}
              </tr>
            )}
          </thead>
          <tbody>
            {(() => {
              let groupRowIndex = 0;
              return rows.map(row => {
                const isAlt = !row.isGrandTotal && !row.isGroupHeader && (groupRowIndex % 2 !== 0);
                if (!row.isGroupHeader && !row.isGrandTotal) {
                  groupRowIndex++;
                }
              if (row.isGroupHeader) {
                return (
                  <tr key={row.id} className="bg-slate-50/80 border-b border-slate-200">
                    <td className="px-3 py-2 font-bold text-[12px] text-slate-700 uppercase tracking-wide border-r border-slate-200 bg-slate-50/80" style={LS(20)}>
                      <div className={`flex items-center gap-1.5 ${row.onToggle ? 'cursor-pointer hover:text-blue-700 select-none' : ''}`} onClick={row.onToggle}>
                        {row.onToggle && (
                          row.isExpanded ? <ChevronDown size={15} className="text-slate-400 shrink-0" /> : <ChevronRight size={15} className="text-slate-400 shrink-0" />
                        )}
                        <span className="truncate" title={row.label}>{row.label}</span>
                      </div>
                    </td>
                    {flatLeaves.map((leaf, idx) => {
                      const cellData = row.cells?.[leaf.id];
                      const val = typeof cellData === 'number' ? cellData : cellData?.value || 0;
                      const cs = getStyle(val, false, leaf.isGrandTotal);
                      
                      return (
                        <td key={idx} className={`px-2 py-1.5 text-center text-[13px] font-bold ${groupBorder(leaf)}`}
                          style={leaf.isGrandTotal ? { ...RS(leaf.rightOffset!, 15), ...cs, width: isExportMode ? 'auto' : leaf.width, minWidth: isExportMode ? 'auto' : leaf.width } : { ...cs, width: isExportMode ? 'auto' : leaf.width, minWidth: isExportMode ? 'auto' : leaf.width }}
                        >
                          {val === 0 ? <span className="opacity-40">—</span> : val.toLocaleString()}
                        </td>
                      );
                    })}
                  </tr>
                );
              }
              
              return (
                <tr key={row.id} className={`border-b border-gray-100 transition-all ${row.isGrandTotal ? 'font-bold text-[12px] text-white' : 'hover:brightness-95'} ${isAlt ? 'bg-[#fcfdfd]' : 'bg-white'}`} style={row.isGrandTotal && !isExportMode ? { position: "sticky", bottom: 0, zIndex: 30 } : {}}>
                  <td
                    className={`px-3 py-1.5 font-medium border-r border-gray-200 transition-colors ${row.isGrandTotal ? 'text-[11px] font-black uppercase tracking-wider border-t-2 border-t-white/10 border-r border-r-white/20' : `text-[13px] text-gray-700 ${isAlt ? 'bg-[#fcfdfd]' : 'bg-white'} ${row.id.includes('_child_') ? 'pl-8 text-gray-600 text-[12px]' : ''}`}`}
                    style={row.isGrandTotal ? { ...LS(40), backgroundColor: GT_BG, color: '#fff', whiteSpace: isExportMode ? 'normal' : 'nowrap' } : { ...LS(20), whiteSpace: isExportMode ? 'normal' : 'nowrap' }}
                  >
                    <div className="flex items-center gap-1.5" title={row.label}>
                      {row.href && !row.isGrandTotal ? (
                        <a href={row.href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 hover-group truncate font-semibold cursor-pointer">
                          <span className={isExportMode ? "whitespace-normal break-words" : "truncate"}>{row.label}</span>
                          <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </a>
                      ) : (
                        <span className={isExportMode ? "whitespace-normal break-words" : "truncate"}>{row.label}</span>
                      )}
                    </div>
                  </td>
                  {flatLeaves.map((leaf, idx) => {
                    const cellData = row.cells[leaf.id];
                    const val = typeof cellData === 'number' ? cellData : cellData?.value || 0;
                    const cs = getStyle(val, !!row.isGrandTotal, leaf.isGrandTotal);

                    return (
                      <td key={idx}
                        className={`px-2 py-1.5 text-center transition-all ${row.isGrandTotal ? `border-t-2 border-t-white/10 py-2.5 ${leaf.isFirstInGroup && !leaf.isGrandTotal ? 'border-l-2 border-l-white/20' : ''} ${leaf.isGrandTotal && leaf.isFirstInGroup ? 'border-l-4 border-l-white/30' : ''}` : `text-[13px] ${groupBorder(leaf)}`}`}
                        style={leaf.isGrandTotal ? { ...RS(leaf.rightOffset!, row.isGrandTotal ? 35 : 20), ...cs, width: isExportMode ? 'auto' : leaf.width, minWidth: isExportMode ? 'auto' : leaf.width } : { ...cs, width: isExportMode ? 'auto' : leaf.width, minWidth: isExportMode ? 'auto' : leaf.width }}
                      >
                        {val === 0 ? <span className={row.isGrandTotal ? "opacity-40" : "text-gray-200 select-none"}>—</span> : val.toLocaleString()}
                      </td>
                    );
                  })}
                </tr>
              );
            });
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── MultiSelectFilter ────────────────────────────────────────────────────────

const MultiSelectFilter = ({ label, options, selected, onToggle, prefix, wideMenu = false }: {
  label: string; options: { id: string; name: string }[]; selected: string[];
  onToggle: (id: string) => void; prefix?: React.ReactNode; wideMenu?: boolean;
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-[13px] font-medium border border-gray-200 text-gray-700 rounded-md h-8 px-3 bg-white hover:bg-gray-50 focus:outline-none transition-colors whitespace-nowrap"
      >
        {prefix}
        <span>{selected.length > 0 ? `${selected.length} ${label}` : `All ${label}`}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>
      {isOpen && (
        <div className="absolute left-0 mt-1 z-[200] bg-white border border-gray-200 rounded-md shadow-lg transition-all"
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
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function SolarPanelStockClient({ warehouses, categories, brands, items, isExportMode = false }: Props) {
  // ── Filter state ────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedDcr, setSelectedDcr] = useState<string[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [selectedWattages, setSelectedWattages] = useState<string[]>([]);
  
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const solarCategory = categories.find(c => c.name.toLowerCase() === 'solar panel');

  const operationalWarehouses = useMemo(() => {
    let whs = warehouses.filter(w => !w.isSystemWarehouse);
    if (process.env.NODE_ENV === 'development') {
      const mockWhs = [
        { id: 'mock_mohanpuri', name: 'Mohanpuri' },
        { id: 'mock_rithani', name: 'Rithani' },
        { id: 'mock_budh_vihar', name: 'Budh Vihar' },
        { id: 'mock_main', name: 'Main Solar Warehouse' },
        { id: 'mock_delhi', name: 'Delhi Hub' },
      ];
      // Keep only first 5 warehouses total to avoid overly wide matrices in testing
      whs = [...whs, ...mockWhs].slice(0, 5);
    }
    return whs;
  }, [warehouses]);
  
  // Seed richer test items if in development mode
  const effectiveItemsSource = useMemo(() => {
    if (process.env.NODE_ENV === 'development') {
      const mockItems: SkuItem[] = [];
      const testSeries = [
        { name: 'TEST_SP_SERIES_TEST_BRAND_1', isDcr: true, wattages: ['405', '410', '415', '425', '430', '440', '455', '460', '465', '475', '485', '490'] },
        { name: 'TEST_SP_SERIES_TEST_BRAND_2', isDcr: true, wattages: ['535', '540', '545', '550', '555'] },
        { name: 'ADANI BIFACIAL SERIES', isDcr: true, wattages: ['450', '500', '550'] },
        { name: 'HAVELLS TOPCON SERIES', isDcr: true, wattages: ['550', '580', '600'] },
        { name: 'WAAREE EXPERT SERIES', isDcr: false, wattages: ['540', '545', '550'] },
        { name: 'VIKRAM SOLAR PRO', isDcr: false, wattages: ['400', '450'] }
      ];
      testSeries.forEach((series, sIdx) => {
        series.wattages.forEach((w, wIdx) => {
          mockItems.push({
            id: `mock_${sIdx}_${wIdx}`,
            name: `${series.name} ${w}W Panel`,
            brandId: 'brand_1',
            brand: 'Test Brand',
            categoryId: 'cat_1',
            categoryName: 'Solar Panel',
            isDcrEligible: series.isDcr,
            wattage: w,
            parentProductId: `series_${sIdx}`,
            parentProductName: series.name,
            inventory: {} // computed in getQty
          });
        });
      });
      // Add multiple No Series SKUs
      mockItems.push({
        id: 'mock_noseries_1',
        name: 'GENERIC SOLAR SKU 100W',
        brandId: 'brand_unbranded',
        brand: 'Generic',
        categoryId: 'cat_1',
        categoryName: 'Solar Panel',
        isDcrEligible: false,
        wattage: '100',
        parentProductId: null,
        parentProductName: null,
        inventory: {}
      });
      mockItems.push({
        id: 'mock_noseries_2',
        name: 'GENERIC SOLAR SKU 200W',
        brandId: 'brand_unbranded',
        brand: 'Generic',
        categoryId: 'cat_1',
        categoryName: 'Solar Panel',
        isDcrEligible: false,
        wattage: '200',
        parentProductId: null,
        parentProductName: null,
        inventory: {}
      });
      // Another no-series with same wattage to test differentiation
      mockItems.push({
        id: 'mock_noseries_3',
        name: 'GENERIC BIFACIAL SKU 200W',
        brandId: 'brand_unbranded',
        brand: 'Generic',
        categoryId: 'cat_1',
        categoryName: 'Solar Panel',
        isDcrEligible: false,
        wattage: '200',
        parentProductId: null,
        parentProductName: null,
        inventory: {}
      });
      // A DCR no-series
      mockItems.push({
        id: 'mock_noseries_4',
        name: 'TEST BRAND DCR PANEL 400W',
        brandId: 'brand_1',
        brand: 'Test Brand',
        categoryId: 'cat_1',
        categoryName: 'Solar Panel',
        isDcrEligible: true,
        wattage: '400',
        parentProductId: null,
        parentProductName: null,
        inventory: {}
      });

      return [...items, ...mockItems];
    }
    return items;
  }, [items]);

  // ── Filter option derivation ────────────────────────────────────────────────
  const availableBrands = useMemo(() => {
    const m = new Map<string, string>();
    effectiveItemsSource.forEach(item => { if (item.brandId && item.brand) m.set(item.brandId, item.brand); });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [effectiveItemsSource]);

  const availableSeries = useMemo(() => {
    const s = new Set<string>();
    effectiveItemsSource.forEach(i => { if (i.parentProductName) s.add(i.parentProductName); });
    return Array.from(s).sort();
  }, [effectiveItemsSource]);

  const availableWattages = useMemo(() => {
    const s = new Set<string>();
    effectiveItemsSource.forEach(i => { if (i.wattage) s.add(i.wattage); });
    return Array.from(s).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
  }, [effectiveItemsSource]);

  // ── Filtered items ──────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    return effectiveItemsSource.filter(item => {
      if (q && !item.name.toLowerCase().includes(q) && !item.id.toLowerCase().includes(q)) return false;
      if (selectedBrands.length > 0 && (!item.brandId || !selectedBrands.includes(item.brandId))) return false;
      const dcrStatus = item.isDcrEligible ? 'DCR' : 'Non-DCR';
      if (selectedDcr.length > 0 && !selectedDcr.includes(dcrStatus)) return false;
      if (selectedSeries.length > 0 && (!item.parentProductName || !selectedSeries.includes(item.parentProductName))) return false;
      if (selectedWattages.length > 0 && (!item.wattage || !selectedWattages.includes(item.wattage))) return false;
      return true;
    });
  }, [effectiveItemsSource, debouncedSearch, selectedBrands, selectedDcr, selectedSeries, selectedWattages]);

  const visibleWarehouses = useMemo(() =>
    selectedWarehouses.length > 0 ? operationalWarehouses.filter(w => selectedWarehouses.includes(w.id)) : operationalWarehouses,
    [operationalWarehouses, selectedWarehouses]);

  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>, val: string) =>
    set(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  const getQty = (item: SkuItem, whId: string): number => {
    if (process.env.NODE_ENV === 'development' && item.id.startsWith('mock_')) {
      const whIndex = operationalWarehouses.findIndex(w => w.id === whId);
      if (whIndex === -1) return 0;
      
      const hash = Array.from(item.id).reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const multipliers = [8, 7, 5, 4, 6, 3, 2];
      const modulos = [15, 11, 9, 7, 13, 8, 5];
      
      const mult = multipliers[whIndex % multipliers.length];
      const mod = modulos[whIndex % modulos.length];
      
      let base = (hash % mod) * mult;
      
      if ((hash + whIndex) % 6 === 0) return 0;
      return base;
    }
    return Math.max(0, item.inventory[whId]?.qty || 0);
  };

  // ── Single-pass grouped data ────────────────────────────────────────────────
  type ChildEntry = { whQtys: Record<string, number>; gt: number; sortValue: number; label: string; href?: string; };
  type GroupedData = Map<'DCR' | 'Non-DCR', Map<string, Map<string, ChildEntry>>>;

  const groupedData = useMemo<GroupedData>(() => {
    const root: GroupedData = new Map([['DCR', new Map()], ['Non-DCR', new Map()]]);

    filteredItems.forEach(item => {
      const classification: 'DCR' | 'Non-DCR' = item.isDcrEligible ? 'DCR' : 'Non-DCR';
      const series = item.parentProductName?.trim() || '(NO SERIES)';
      
      let childKey: string, label: string, sortValue: number, href: string | undefined;

      if (series === '(NO SERIES)') {
        childKey = item.id;
        label = item.name;
        sortValue = 0; 
      } else {
        childKey = item.wattage?.trim() || 'Unknown';
        label = formatWattageDisplay(childKey);
        sortValue = childKey === 'Unknown' ? Infinity : (parseFloat(childKey) || Infinity);
        if (childKey !== 'Unknown' && solarCategory?.id) {
          href = `/staff/dashboard/catalog-pricing/products?categoryId=${solarCategory.id}&search=${encodeURIComponent(childKey)}`;
        }
      }

      const classMap = root.get(classification)!;
      if (!classMap.has(series)) classMap.set(series, new Map());
      const seriesMap = classMap.get(series)!;

      if (!seriesMap.has(childKey)) seriesMap.set(childKey, { whQtys: {}, gt: 0, sortValue, label, href });
      const entry = seriesMap.get(childKey)!;

      visibleWarehouses.forEach(wh => {
        const qty = getQty(item, wh.id);
        if (qty > 0) {
          entry.whQtys[wh.id] = (entry.whQtys[wh.id] || 0) + qty;
          entry.gt += qty;
        }
      });
    });

    return root;
  }, [filteredItems, visibleWarehouses, solarCategory]);

  // Determine which warehouses actually have data per table independently
  const dcrWarehouses = useMemo(() => {
    const whMap = new Map<string, boolean>();
    const dcrData = groupedData.get('DCR')!;
    dcrData.forEach(seriesMap => {
      seriesMap.forEach(child => {
        visibleWarehouses.forEach(wh => {
          if ((child.whQtys[wh.id] || 0) > 0) whMap.set(wh.id, true);
        });
      });
    });
    return visibleWarehouses.filter(w => whMap.get(w.id));
  }, [groupedData, visibleWarehouses]);

  const nonDcrWarehouses = useMemo(() => {
    const whMap = new Map<string, boolean>();
    const nonDcrData = groupedData.get('Non-DCR')!;
    nonDcrData.forEach(seriesMap => {
      seriesMap.forEach(child => {
        visibleWarehouses.forEach(wh => {
          if ((child.whQtys[wh.id] || 0) > 0) whMap.set(wh.id, true);
        });
      });
    });
    return visibleWarehouses.filter(w => whMap.get(w.id));
  }, [groupedData, visibleWarehouses]);

  // ── Row builder ─────────────────────────────────────────────────────────────
  const buildMatrixRows = (classification: 'DCR' | 'Non-DCR', activeWhs: Warehouse[]): PivotRowDef[] => {
    const classMap = groupedData.get(classification)!;
    const result: PivotRowDef[] = [];
    let gtTotal = 0;
    const gtWhQtys: Record<string, number> = {};

    const sortedSeries = Array.from(classMap.keys()).sort((a, b) => a.localeCompare(b));

    sortedSeries.forEach(series => {
      const seriesMap = classMap.get(series)!;

      const validChildren = Array.from(seriesMap.entries())
        .filter(([, entry]) => entry.gt > 0)
        .sort(([, a], [, b]) => {
          if (series === '(NO SERIES)') return a.label.localeCompare(b.label);
          return a.sortValue - b.sortValue;
        });

      if (validChildren.length === 0) return;

      let seriesTotalQty = 0;
      const seriesWhQtys: Record<string, number> = {};

      validChildren.forEach(([, entry]) => {
        seriesTotalQty += entry.gt;
        activeWhs.forEach(wh => {
          const q = entry.whQtys[wh.id] || 0;
          if (q > 0) seriesWhQtys[wh.id] = (seriesWhQtys[wh.id] || 0) + q;
        });
      });

      const groupId = `group_${classification}_${series}`;
      const isExpanded = isExportMode || expandedGroups.has(groupId);
      
      const seriesCells: Record<string, PivotCellDef> = {};
      activeWhs.forEach(wh => {
        const q = seriesWhQtys[wh.id] || 0;
        seriesCells[wh.id] = { value: q };
      });
      seriesCells['GT'] = { value: seriesTotalQty };

      result.push({
        id: groupId,
        label: series,
        isGroupHeader: true,
        isExpanded,
        onToggle: () => {
          setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
          });
        },
        cells: seriesCells,
      });

      if (isExpanded) {
        validChildren.forEach(([childKey, entry]) => {
          const cells: Record<string, PivotCellDef> = {};
          activeWhs.forEach(wh => {
            const qty = entry.whQtys[wh.id] || 0;
            cells[wh.id] = { value: qty };
            if (qty > 0) gtWhQtys[wh.id] = (gtWhQtys[wh.id] || 0) + qty;
          });
          cells['GT'] = { value: entry.gt };
          gtTotal += entry.gt;

          result.push({
            id: `row_${classification}_${series}_child_${childKey}`,
            label: entry.label,
            href: entry.href,
            cells,
          });
        });
      } else {
        validChildren.forEach(([, entry]) => {
          activeWhs.forEach(wh => {
            const qty = entry.whQtys[wh.id] || 0;
            if (qty > 0) gtWhQtys[wh.id] = (gtWhQtys[wh.id] || 0) + qty;
          });
          gtTotal += entry.gt;
        });
      }
    });

    const gtCells: Record<string, PivotCellDef> = {};
    activeWhs.forEach(wh => {
      gtCells[wh.id] = { value: gtWhQtys[wh.id] || 0 };
    });
    gtCells['GT'] = { value: gtTotal };
    result.push({ id: `gt_${classification}`, label: 'Grand Total', isGrandTotal: true, cells: gtCells });

    return result;
  };

  const dcrRows = useMemo(() => buildMatrixRows('DCR', dcrWarehouses), [groupedData, dcrWarehouses, expandedGroups, isExportMode]);
  const nonDcrRows = useMemo(() => buildMatrixRows('Non-DCR', nonDcrWarehouses), [groupedData, nonDcrWarehouses, expandedGroups, isExportMode]);

  const dcrCols: PivotColumnDef[] = useMemo(() => [
    ...dcrWarehouses.map(wh => ({ id: wh.id, label: wh.name })),
    { id: 'GT', label: 'Grand Total', isGrandTotal: true },
  ], [dcrWarehouses]);

  const nonDcrCols: PivotColumnDef[] = useMemo(() => [
    ...nonDcrWarehouses.map(wh => ({ id: wh.id, label: wh.name })),
    { id: 'GT', label: 'Grand Total', isGrandTotal: true },
  ], [nonDcrWarehouses]);

  const hasDcrData    = dcrRows.some(r => r.isGroupHeader);
  const hasNonDcrData = nonDcrRows.some(r => r.isGroupHeader);
  const hasAnyData    = hasDcrData || hasNonDcrData;

  const [isExporting, setIsExporting] = useState(false);
  const [isScreenshotting, setIsScreenshotting] = useState(false);

  const handleExportRawData = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const XLSX = await import('xlsx');
      const rows = filteredItems.map(item => {
        const row: Record<string, string | number> = {
          'SKU': item.id,
          'Product Name': item.name,
          'Brand': item.brand || 'Unknown',
          'Series': item.parentProductName || 'No Series',
          'Wattage': item.wattage || 'Unknown',
          'DCR Status': item.isDcrEligible ? 'DCR' : 'Non-DCR'
        };
        let gt = 0;
        visibleWarehouses.forEach(wh => {
          const q = item.inventory[wh.id]?.qty || 0;
          row[wh.name] = q;
          gt += q;
        });
        row['Grand Total'] = gt;
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Solar Panel Stock");
      XLSX.writeFile(wb, `KAMNA_Solar_Panel_Stock_${new Date().getTime()}.xlsx`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (isScreenshotting) return;
    setIsScreenshotting(true);
    try {
      const { generateStockScreenshotPDF } = await import('./current-stock/screenshot');
      const filters = [];
      if (selectedWarehouses.length) filters.push(`Warehouses: ${selectedWarehouses.length}`);
      if (selectedBrands.length) filters.push(`Brands: ${selectedBrands.length}`);
      if (selectedDcr.length) filters.push(`DCR: ${selectedDcr.join(', ')}`);
      if (selectedSeries.length) filters.push(`Series: ${selectedSeries.length}`);
      if (selectedWattages.length) filters.push(`Wattages: ${selectedWattages.length}`);

      const tables = [];
      
      const buildTableBody = (cols: PivotColumnDef[], pRows: PivotRowDef[]) => {
        return pRows.map(r => {
          const cells = cols.map(c => {
             const cell = r.cells[c.id];
             const v = typeof cell === 'number' ? cell : (cell?.value || 0);
             return { val: v, bg: [255, 255, 255] as [number, number, number], text: [50, 50, 50] as [number, number, number] };
          });
          const gtCell = r.cells['GT'];
          const gtVal = typeof gtCell === 'number' ? gtCell : (gtCell?.value || 0);
          cells.push({ val: gtVal, bg: [255, 255, 255] as [number, number, number], text: [50, 50, 50] as [number, number, number] });
          return {
             isGroupHeader: r.isGroupHeader,
             isGrandTotal: r.isGrandTotal,
             label: r.label,
             cells
          };
        });
      };

      if (hasDcrData) {
         tables.push({
           title: 'DCR Solar Panel Stock',
           head: [['Series / SKU', '', ...dcrCols.map(c => c.label), 'Grand Total']],
           body: buildTableBody(dcrCols, dcrRows).map(r => {
             const rowArr: any[] = [];
             
             let cellBg = [255,255,255];
             let textColor = [50,50,50];
             let fontStyle = 'normal';
             if (r.isGroupHeader) { cellBg = [241,245,249]; textColor = [30,41,59]; fontStyle = 'bold'; }
             else if (r.isGrandTotal) { cellBg = [26,39,102]; textColor = [255,255,255]; fontStyle = 'bold'; }

             rowArr.push({ content: r.isGroupHeader || r.isGrandTotal ? r.label : `   ${r.label}`, styles: { fillColor: cellBg, textColor, fontStyle, halign: 'left' } });
             rowArr.push({ content: '—', styles: { fillColor: cellBg, textColor: r.isGroupHeader ? cellBg : textColor, fontStyle, halign: 'center' } }); // UOM filler
             
             if (r.isGroupHeader) {
               r.cells.forEach(() => rowArr.push({ content: '', styles: { fillColor: cellBg } }));
             } else {
               r.cells.forEach(c => {
                 let content = '—';
                 if (c.val > 0) content = c.val.toLocaleString();
                 rowArr.push({ content, styles: { fillColor: cellBg, textColor, fontStyle, halign: 'center' } });
               });
             }
             return rowArr;
           })
         });
      }
      
      if (hasNonDcrData) {
         tables.push({
           title: 'Non-DCR Solar Panel Stock',
           head: [['Series / SKU', '', ...nonDcrCols.map(c => c.label), 'Grand Total']],
           body: buildTableBody(nonDcrCols, nonDcrRows).map(r => {
             const rowArr: any[] = [];
             let cellBg = [255,255,255];
             let textColor = [50,50,50];
             let fontStyle = 'normal';
             if (r.isGroupHeader) { cellBg = [241,245,249]; textColor = [30,41,59]; fontStyle = 'bold'; }
             else if (r.isGrandTotal) { cellBg = [26,39,102]; textColor = [255,255,255]; fontStyle = 'bold'; }

             rowArr.push({ content: r.isGroupHeader || r.isGrandTotal ? r.label : `   ${r.label}`, styles: { fillColor: cellBg, textColor, fontStyle, halign: 'left' } });
             rowArr.push({ content: '—', styles: { fillColor: cellBg, textColor: r.isGroupHeader ? cellBg : textColor, fontStyle, halign: 'center' } });
             
             if (r.isGroupHeader) {
               r.cells.forEach(() => rowArr.push({ content: '', styles: { fillColor: cellBg } }));
             } else {
               r.cells.forEach(c => {
                 let content = '—';
                 if (c.val > 0) content = c.val.toLocaleString();
                 rowArr.push({ content, styles: { fillColor: cellBg, textColor, fontStyle, halign: 'center' } });
               });
             }
             return rowArr;
           })
         });
      }

      await generateStockScreenshotPDF({
        title: 'KAMNA ERP — Solar Panel Stock',
        filters,
        tables,
        filename: `KAMNA_SolarPanelStock_${new Date().getTime()}.pdf`
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsScreenshotting(false);
    }
  };

  if (isExportMode) {
    return (
      <div className="bg-white">
        {!hasAnyData ? (
          <div className="text-center py-8 text-gray-500">No Solar Panel stock found.</div>
        ) : (
          <div className="space-y-8 pb-10">
            {hasDcrData && (
              <PivotTable
                title="DCR Solar Panel Stock" subtitle="Current inventory by warehouse"
                firstColLabel="Series / SKU" columns={dcrCols} rows={dcrRows}
                isExportMode={true}
              />
            )}
            {hasNonDcrData && (
              <PivotTable
                title="Non-DCR Solar Panel Stock" subtitle="Current inventory by warehouse"
                firstColLabel="Series / SKU" columns={nonDcrCols} rows={nonDcrRows}
                isExportMode={true}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <StockPageShell sidebar={<CurrentStockSidebar activeView="solar" />}>
      <StockHeader
        icon={Box}
        title="Solar Panel Stock"
        subtitle="Real-time DCR and Non-DCR matrix view."
        itemCount={filteredItems.length}
        date={formatStockDate(new Date())}
        onExportRaw={handleExportRawData}
        onScreenshot={handleExportPDF}
        isExporting={isExporting}
        isScreenshotting={isScreenshotting}
      />
      
      <StockFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search product or SKU…"
      >
        <MultiSelectFilter label="Warehouses" options={operationalWarehouses.map(w => ({ id: w.id, name: w.name }))} selected={selectedWarehouses} onToggle={(id) => toggle(setSelectedWarehouses, id)} wideMenu />
        <MultiSelectFilter label="Brands" options={availableBrands} selected={selectedBrands} onToggle={(id) => toggle(setSelectedBrands, id)} />
        <MultiSelectFilter label="DCR Status" options={[{id:'DCR',name:'DCR'},{id:'Non-DCR',name:'Non-DCR'}]} selected={selectedDcr} onToggle={(id) => toggle(setSelectedDcr, id)} />
        <MultiSelectFilter label="Series" options={availableSeries.map(s => ({ id: s, name: s }))} selected={selectedSeries} onToggle={(id) => toggle(setSelectedSeries, id)} wideMenu />
        <MultiSelectFilter label="Wattage" options={availableWattages.map(w => ({ id: w, name: formatWattageDisplay(w) }))} selected={selectedWattages} onToggle={(id) => toggle(setSelectedWattages, id)} />
        {(debouncedSearch || selectedWarehouses.length > 0 || selectedBrands.length > 0 || selectedDcr.length > 0 || selectedSeries.length > 0 || selectedWattages.length > 0) && (
          <button 
            onClick={() => {
              setSearchQuery(''); setDebouncedSearch('');
              setSelectedWarehouses([]); setSelectedBrands([]); setSelectedDcr([]);
              setSelectedSeries([]); setSelectedWattages([]);
            }}
            className="ml-auto text-[13px] text-blue-600 font-medium hover:text-blue-800"
          >
            Clear All
          </button>
        )}
      </StockFilterBar>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 relative">
        {!hasAnyData ? (
          <StockEmptyState 
            icon={Box} 
            title="No Solar Panel stock found" 
            message="Try adjusting your filters or search terms." 
          />
        ) : (
            <div className="space-y-6 max-w-full pb-10">
              {hasDcrData && (
                <PivotTable
                  title="DCR Solar Panel Stock" subtitle="Current inventory distributed across warehouses"
                  firstColLabel="Series / SKU" columns={dcrCols} rows={dcrRows}
                />
              )}
              {hasNonDcrData && (
                <PivotTable
                  title="Non-DCR Solar Panel Stock" subtitle="Current inventory distributed across warehouses"
                  firstColLabel="Series / SKU" columns={nonDcrCols} rows={nonDcrRows}
                />
              )}
            </div>
          )}
        </div>
      </StockPageShell>
  );
}
