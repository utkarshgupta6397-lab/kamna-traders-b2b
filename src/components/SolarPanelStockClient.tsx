'use client';

import dynamic from 'next/dynamic';
const PdfViewer = dynamic(() => import('./PdfViewer'), { ssr: false });
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, Box, ChevronDown, ChevronRight, Check, Loader2, AlertTriangle, ExternalLink, X, Camera
} from 'lucide-react';
import CurrentStockSidebar from './CurrentStockSidebar';
import { formatStockDate } from '@/lib/date-utils';

import toast from 'react-hot-toast';

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
  autoCapture?: boolean;
  onCaptured?: (dataUrl: string) => void;
  onCaptureError?: (err: any) => void;
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
  isExpanded?: boolean;
  onToggle?: () => void;
  href?: string;
  cells: Record<string, PivotCellDef | number>;
}
interface PivotTableProps {
  title: string; subtitle: string; firstColLabel: string;
  columns: PivotColumnDef[]; rows: PivotRowDef[];
  activeDrilldown: SolarPanelDrilldown | null;
  onCellClick: (dimensions: SolarPanelDrilldown) => void;
  headerRight?: React.ReactNode;
  isExportMode?: boolean;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  reportId?: string;
}

// ─── Wattage formatter ───────────────────────────────────────────────────────

/**
 * Returns a display string with a W suffix for plain-numeric wattage values.
 * Never appends W twice. Preserves unknown/non-numeric labels.
 */
function formatWattageDisplay(raw: string | null | undefined): string {
  if (!raw || raw.trim() === '') return 'Unknown';
  const v = raw.trim();
  if (/^[\d.]+$/.test(v)) return `${v} W`;          // plain number → append W
  if (/\bW$/i.test(v)) return v;                     // already ends with unit
  return v;                                           // non-numeric label
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────

const colors = [
  { r: 236, g: 253, b: 245 },
  { r: 167, g: 243, b: 208 },
  { r: 253, g: 230, b: 138 },
  { r: 251, g: 146, b: 60 },
  { r: 239, g: 68,  b: 68  },
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
  return Object.keys(active).every(k => (active as any)[k] === (cellDim as any)[k]);
}

// ─── PivotTable component ─────────────────────────────────────────────────────

function PivotTable({ title, subtitle, firstColLabel, columns, rows, activeDrilldown, onCellClick, headerRight, containerRef, isExportMode }: PivotTableProps) {
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
  const { getStyle } = buildHeatmap(rows);
  const GT_BG = '#1A2766';

  const LS = (z: number): React.CSSProperties => isExportMode ? {} : ({ position: "sticky", left: 0, zIndex: z });
  const RS = (right: number, z: number): React.CSSProperties => isExportMode ? {} : ({ position: "sticky", right, zIndex: z });
  const groupBorder = (l: Leaf) =>
    l.isFirstInGroup && !l.isGrandTotal ? 'border-l-2 border-l-slate-300'
    : l.isGrandTotal && l.isFirstInGroup ? 'border-l-4 border-l-[#1A2766]/40'
    : 'border-l border-l-gray-200/50';

  return (
    <div ref={containerRef} className={`bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col mb-6 ${isExportMode ? "export-container" : "overflow-hidden"}`} style={isExportMode ? { overflow: "visible" } : { overflow: "hidden" }}>
      <div className="px-4 py-3 border-b border-gray-100 bg-white shrink-0 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900 text-[13px] uppercase tracking-wide">{title}</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        {headerRight && <div>{headerRight}</div>}
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
                        <span className="truncate">{row.label}</span>
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
                <tr key={row.id} className={`border-b border-gray-100 transition-all ${row.isGrandTotal ? 'font-bold text-[12px] text-white' : 'hover:brightness-95 group'} ${isAlt ? 'bg-[#fcfdfd]' : 'bg-white'}`} style={row.isGrandTotal && !isExportMode ? { position: "sticky", bottom: 0, zIndex: 30 } : {}}>
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
                      
                      {!row.isGrandTotal && row.id.includes('_child_Unknown') && (
                        <span style={{ fontSize: 10, color: '#f59e0b', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 3, padding: '1px 4px', whiteSpace: 'nowrap' }}>
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
                        style={leaf.isGrandTotal ? { ...RS(leaf.rightOffset!, row.isGrandTotal ? 35 : 20), ...cs, ...interactiveStyle, width: isExportMode ? 'auto' : leaf.width, minWidth: isExportMode ? 'auto' : leaf.width } : { ...cs, ...interactiveStyle, width: isExportMode ? 'auto' : leaf.width, minWidth: isExportMode ? 'auto' : leaf.width }}
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function SolarPanelStockClient({ warehouses, categories, brands, items, isExportMode = false, autoCapture = false, onCaptured, onCaptureError }: Props) {
  const dcrRef  = useRef<HTMLDivElement>(null);
  const nonDcrRef = useRef<HTMLDivElement>(null);
  
  // ── Filter state ────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedDcr, setSelectedDcr] = useState<string[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [selectedWattages, setSelectedWattages] = useState<string[]>([]);
  const [exportingReportId, setExportingReportId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // ── Drilldown state ─────────────────────────────────────────────────────────
  const [activeDrilldown, setActiveDrilldown] = useState<SolarPanelDrilldown | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => setActiveDrilldown(null), [debouncedSearch, selectedWarehouses, selectedBrands, selectedDcr, selectedSeries, selectedWattages]);

  const solarCategory = categories.find(c => c.name.toLowerCase() === 'solar panel');

  const operationalWarehouses = useMemo(() => {
    let whs = warehouses.filter(w => !w.isSystemWarehouse);
    if (process.env.NODE_ENV === 'development' && whs.length < 4) {
      const mockWhs = [
        { id: 'mock_budh_vihar', name: 'Budh Vihar' },
        { id: 'mock_mohanpuri', name: 'Mohanpuri' },
        { id: 'mock_rithani', name: 'Rithani' },
        { id: 'mock_main', name: 'Main Solar Warehouse' },
      ];
      whs = [...whs, ...mockWhs.slice(0, 4 - whs.length)];
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

  // Effective items — filtered + drilldown
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

  // Fixture-mode quantity resolver
  const getQty = (item: SkuItem, whId: string): number => {
    if (activeDrilldown?.warehouseId && activeDrilldown.warehouseId !== whId) return 0;
    if (process.env.NODE_ENV === 'development' && item.id.startsWith('mock_')) {
      const whIndex = operationalWarehouses.findIndex(w => w.id === whId);
      if (whIndex === -1) return 0;
      
      const hash = Array.from(item.id).reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const multipliers = [8, 7, 5, 4, 6, 3, 2];
      const modulos = [15, 11, 9, 7, 13, 8, 5];
      
      const mult = multipliers[whIndex % multipliers.length];
      const mod = modulos[whIndex % modulos.length];
      
      let base = (hash % mod) * mult;
      
      // Introduce zero stock cases dynamically based on hash + whIndex
      if ((hash + whIndex) % 6 === 0) return 0;
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

  // ── Column set: one column per warehouse + Grand Total ──────────────────────
  const matrixCols: PivotColumnDef[] = useMemo(() => [
    ...meaningfulWarehouses.map(wh => ({ id: wh.id, label: wh.name })),
    { id: 'GT', label: 'Grand Total', isGrandTotal: true },
  ], [meaningfulWarehouses]);

  // ── Single-pass grouped data ────────────────────────────────────────────────
  // Shape: Map< 'DCR'|'Non-DCR',  Map< series, Map< wattage, { whQtys, gt, wattageNum } > > >
  type WattageEntry = { whQtys: Record<string, number>; gt: number; wattageNum: number; };
  type GroupedData = Map<'DCR' | 'Non-DCR', Map<string, Map<string, WattageEntry>>>;

  const groupedData = useMemo<GroupedData>(() => {
    const root: GroupedData = new Map([['DCR', new Map()], ['Non-DCR', new Map()]]);

    effectiveItems.forEach(item => {
      const classification: 'DCR' | 'Non-DCR' = item.isDcrEligible ? 'DCR' : 'Non-DCR';
      const series = item.parentProductName?.trim() || '(No Series)';
      const wattage = item.wattage?.trim() || 'Unknown';
      const wattageNum = wattage === 'Unknown' ? Infinity : (parseFloat(wattage) || Infinity);

      const classMap = root.get(classification)!;
      if (!classMap.has(series)) classMap.set(series, new Map());
      const seriesMap = classMap.get(series)!;

      if (!seriesMap.has(wattage)) seriesMap.set(wattage, { whQtys: {}, gt: 0, wattageNum });
      const entry = seriesMap.get(wattage)!;

      meaningfulWarehouses.forEach(wh => {
        const qty = getQty(item, wh.id);
        if (qty > 0) {
          entry.whQtys[wh.id] = (entry.whQtys[wh.id] || 0) + qty;
          entry.gt += qty;
        }
      });
    });

    return root;
  }, [effectiveItems, meaningfulWarehouses, activeDrilldown]);

  // ── Row builder ─────────────────────────────────────────────────────────────
  const buildMatrixRows = (classification: 'DCR' | 'Non-DCR'): PivotRowDef[] => {
    const classMap = groupedData.get(classification)!;
    const result: PivotRowDef[] = [];
    let gtTotal = 0;
    const gtWhQtys: Record<string, number> = {};

    const sortedSeries = Array.from(classMap.keys()).sort((a, b) => a.localeCompare(b));

    sortedSeries.forEach(series => {
      const seriesMap = classMap.get(series)!;

      // Compute series grand total and prune zero wattages
      const validWattages = Array.from(seriesMap.entries())
        .filter(([, entry]) => entry.gt > 0)
        .sort(([, a], [, b]) => a.wattageNum - b.wattageNum);

      if (validWattages.length === 0) return; // skip empty series

      let seriesTotalQty = 0;
      const seriesWhQtys: Record<string, number> = {};

      validWattages.forEach(([, entry]) => {
        seriesTotalQty += entry.gt;
        meaningfulWarehouses.forEach(wh => {
          const q = entry.whQtys[wh.id] || 0;
          if (q > 0) seriesWhQtys[wh.id] = (seriesWhQtys[wh.id] || 0) + q;
        });
      });

      const groupId = `group_${classification}_${series}`;
      const isExpanded = isExportMode || expandedGroups.has(groupId);
      
      const seriesCells: Record<string, PivotCellDef> = {};
      meaningfulWarehouses.forEach(wh => {
        const q = seriesWhQtys[wh.id] || 0;
        seriesCells[wh.id] = { value: q };
      });
      seriesCells['GT'] = { value: seriesTotalQty };

      // Series group header row
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

      // Wattage child rows (only if expanded or in export mode)
      if (isExpanded) {
        validWattages.forEach(([wattage, entry]) => {
          let href: string | undefined;
          if (wattage !== 'Unknown' && solarCategory?.id) {
            href = `/staff/dashboard/catalog-pricing/products?categoryId=${solarCategory.id}&search=${encodeURIComponent(wattage)}`;
          }

          const cells: Record<string, PivotCellDef> = {};
          meaningfulWarehouses.forEach(wh => {
            const qty = entry.whQtys[wh.id] || 0;
            cells[wh.id] = { value: qty, dimensions: { seriesId: series, wattage, warehouseId: wh.id, dcrStatus: classification } };
            // accumulate grand total row qtys
            if (qty > 0) gtWhQtys[wh.id] = (gtWhQtys[wh.id] || 0) + qty;
          });
          cells['GT'] = { value: entry.gt, dimensions: { seriesId: series, wattage, dcrStatus: classification } };
          gtTotal += entry.gt;

          result.push({
            id: `row_${classification}_${series}_child_${wattage}`,
            label: formatWattageDisplay(wattage),
            href,
            cells,
          });
        });
      } else {
        // Even if collapsed, we must accumulate the grand total row numbers
        validWattages.forEach(([, entry]) => {
          meaningfulWarehouses.forEach(wh => {
            const qty = entry.whQtys[wh.id] || 0;
            if (qty > 0) gtWhQtys[wh.id] = (gtWhQtys[wh.id] || 0) + qty;
          });
          gtTotal += entry.gt;
        });
      }
    });

    // Grand total row
    const gtCells: Record<string, PivotCellDef> = {};
    meaningfulWarehouses.forEach(wh => {
      gtCells[wh.id] = { value: gtWhQtys[wh.id] || 0, dimensions: { warehouseId: wh.id, dcrStatus: classification } };
    });
    gtCells['GT'] = { value: gtTotal, dimensions: { dcrStatus: classification } };
    result.push({ id: `gt_${classification}`, label: 'Grand Total', isGrandTotal: true, cells: gtCells });

    return result;
  };

  const dcrRows  = useMemo(() => buildMatrixRows('DCR'),     [groupedData, meaningfulWarehouses, expandedGroups, isExportMode]);
  const nonDcrRows = useMemo(() => buildMatrixRows('Non-DCR'), [groupedData, meaningfulWarehouses, expandedGroups, isExportMode]);

  // ── Screenshot / export ─────────────────────────────────────────────────────
  const handleTakeScreenshot = async (reportId: string) => {
    setExportingReportId(reportId);
    const tid = toast.loading('Generating PDF report...');
    try {
      const res = await fetch('/api/staff/operations/solar-panel-stock/export');
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewImage(url);
      toast.success('Report generated', { id: tid });
      if (onCaptured) onCaptured(url);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to generate report', { id: tid });
      if (onCaptureError) onCaptureError(err);
    } finally {
      setExportingReportId(null);
    }
  };

  const hasCaptured = useRef(false);
  useEffect(() => {
    if (autoCapture && !hasCaptured.current && !isExportMode) {
      hasCaptured.current = true;
      handleTakeScreenshot('auto-export');
    }
  }, [autoCapture, isExportMode]);

  const renderScreenshotBtn = (reportId: string) => (
    <button 
      onClick={() => handleTakeScreenshot(reportId)} 
      disabled={exportingReportId !== null}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-200 transition-colors ${exportingReportId !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {exportingReportId === reportId ? <Loader2 size={13} className="animate-spin text-gray-500" /> : <Camera size={13} className="text-gray-500" />}
      {exportingReportId === reportId ? 'Capturing...' : 'Screenshot'}
    </button>
  );

  // ── Drilldown bar ───────────────────────────────────────────────────────────
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

  // ── Export mode ─────────────────────────────────────────────────────────────
  if (isExportMode) {
    return (
      <div style={{ width: "100%", backgroundColor: "#fff", padding: 0 }}>
        <div className="print-page-break-after">
          <PivotTable 
            title="DCR Stock" 
            subtitle="Solar Panel DCR Inventory  |  Rows: Series → Wattage  |  Columns: Warehouse + Grand Total" 
            firstColLabel="Series / Wattage" 
            columns={matrixCols} 
            rows={dcrRows} 
            activeDrilldown={activeDrilldown}
            onCellClick={handleCellClick}
            isExportMode={true}
          />
        </div>
        <div>
          <PivotTable 
            title="Non-DCR Stock" 
            subtitle="Solar Panel Non-DCR Inventory  |  Rows: Series → Wattage  |  Columns: Warehouse + Grand Total" 
            firstColLabel="Series / Wattage" 
            columns={matrixCols} 
            rows={nonDcrRows} 
            activeDrilldown={activeDrilldown}
            onCellClick={handleCellClick}
            isExportMode={true}
          />
        </div>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  // Determine which tables have data (using group headers since child rows are collapsed by default)
  const hasDcrData    = dcrRows.some(r => r.isGroupHeader);
  const hasNonDcrData = nonDcrRows.some(r => r.isGroupHeader);
  const hasAnyData    = hasDcrData || hasNonDcrData;

  return (
    <div className="flex h-full gap-5">
      {previewImage && <PdfViewer url={previewImage} onClose={() => setPreviewImage(null)} />}
      <CurrentStockSidebar activeView="solar" />
      <div className="flex-1 flex flex-col h-full min-w-0 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
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

        {/* Filters */}
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
          <MultiSelectFilter label="Wattage" options={availableWattages.map(w => ({ id: w, name: `${w} W` }))} selected={selectedWattages} onToggle={id => toggle(setSelectedWattages, id)} />
        </div>

        {renderDrilldownBar()}

        {/* Tables */}
        <div className="flex-1 overflow-y-auto p-5 bg-[#f7f8fb] min-h-0 relative">
          {(!meaningfulWarehouses.length || !hasAnyData) ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400">
              <AlertTriangle size={32} className="text-amber-400" />
              <div className="text-lg font-semibold text-gray-700">No Solar Panel stock found</div>
              <p className="text-sm">Try adjusting your filters or drill-down context.</p>
            </div>
          ) : (
            <div className="flex flex-col max-w-full">
              {hasDcrData && (
                <PivotTable 
                  containerRef={dcrRef}
                  title="DCR Stock" 
                  subtitle="Solar Panel DCR Inventory  |  Rows: Series → Wattage  |  Columns: Warehouse + Grand Total" 
                  firstColLabel="Series / Wattage" 
                  columns={matrixCols} 
                  rows={dcrRows} 
                  activeDrilldown={activeDrilldown}
                  onCellClick={handleCellClick}
                  headerRight={renderScreenshotBtn('dcr-stock')}
                />
              )}
              {hasNonDcrData && (
                <PivotTable 
                  containerRef={nonDcrRef}
                  title="Non-DCR Stock" 
                  subtitle="Solar Panel Non-DCR Inventory  |  Rows: Series → Wattage  |  Columns: Warehouse + Grand Total" 
                  firstColLabel="Series / Wattage" 
                  columns={matrixCols} 
                  rows={nonDcrRows} 
                  activeDrilldown={activeDrilldown}
                  onCellClick={handleCellClick}
                  headerRight={renderScreenshotBtn('non-dcr-stock')}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
