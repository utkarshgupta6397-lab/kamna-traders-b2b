
'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  MoreVertical,
  Download,
  Camera,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatStockDate } from '@/lib/date-utils';
import { MobileInverterFilterSheet, FilterState } from './MobileInverterFilterSheet';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Warehouse {
  id: string;
  name: string;
  isSystemWarehouse?: boolean;
}

interface SkuInventory {
  [warehouseId: string]: { qty: number; isOos: boolean };
}

interface SkuItem {
  id: string;
  name: string;
  brand?: string | null;
  brandId?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  unit?: string | null;
  inventory: SkuInventory;
  sku?: string;
  inverterType?: string | null;
  inverterCapacity?: string | null;
  phaseType?: string | null;
}

interface Props {
  warehouses: Warehouse[];
  items: SkuItem[];
}

// ---------------------------------------------------------------------------
// Capacity normalizer (exact copy from InverterStockClient.tsx)
// ---------------------------------------------------------------------------

function normalizeCapacity(cap: string | null | undefined): {
  value: string;
  num: number;
  unit: string;
} {
  if (!cap || cap.trim() === '') return { value: 'Unknown', num: Infinity, unit: '' };

  const val = cap.trim().replace(/\s+/g, ' ');
  const match = val.match(/^([\d.]+)\s*(kwp?|kVA|va|w|mw|kwh?)$/i);

  if (match) {
    const num = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    let normalizedNum = num;

    if (unit === 'w' || unit === 'va') normalizedNum = num / 1000;
    else if (unit === 'mw') normalizedNum = num * 1000;

    let displayUnit = unit;
    if (unit === 'kw') displayUnit = 'kW';
    else if (unit === 'kwp') displayUnit = 'kWp';
    else if (unit === 'kva') displayUnit = 'kVA';
    else if (unit === 'va') displayUnit = 'VA';
    else if (unit === 'w') displayUnit = 'W';
    else if (unit === 'mw') displayUnit = 'MW';
    else if (unit === 'kwh') displayUnit = 'kWh';

    return { value: `${num} ${displayUnit}`, num: normalizedNum, unit: displayUnit };
  }

  return { value: val.toUpperCase(), num: Infinity, unit: '' };
}

function formatCapacityDisplay(normalizedValue: string): string {
  if (!normalizedValue || normalizedValue === 'Unknown') return normalizedValue;
  if (/[a-zA-Z]/.test(normalizedValue)) return normalizedValue;
  return `${normalizedValue} kW`;
}

// ---------------------------------------------------------------------------
// Grid-type tab order
// ---------------------------------------------------------------------------

const GRID_TABS = ['On-Grid', 'Hybrid', 'Off-Grid'] as const;
type GridTab = typeof GRID_TABS[number];

// ---------------------------------------------------------------------------
// Phase badge
// ---------------------------------------------------------------------------

function PhaseBadge({ phase }: { phase: string }) {
  if (!phase || phase === 'Unknown') return null;
  const isThree = phase.toLowerCase().includes('three') || phase === '3';
  return (
    <span
      className={`px-1.5 py-0.5 text-[10px] font-semibold border rounded-sm whitespace-nowrap ${
        isThree
          ? 'bg-purple-50 text-purple-700 border-purple-200'
          : 'bg-blue-50 text-blue-700 border-blue-200'
      }`}
    >
      {phase}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Overflow menu
// ---------------------------------------------------------------------------

interface OverflowMenuProps {
  onRawData: () => void;
  onScreenshot: () => void;
  isExporting: boolean;
  isScreenshotting: boolean;
}

function OverflowMenu({ onRawData, onScreenshot, isExporting, isScreenshotting }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center shrink-0 active:bg-slate-50 transition-colors"
        aria-label="More actions"
      >
        <MoreVertical size={18} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-[200] w-48">
          <button
            onClick={() => { setOpen(false); onRawData(); }}
            disabled={isExporting}
            className="flex items-center gap-3 w-full px-4 py-3.5 text-[14px] font-semibold text-slate-700 active:bg-slate-50 transition-colors border-b border-slate-50 disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 size={16} className="animate-spin text-slate-400" />
            ) : (
              <Download size={16} className="text-green-600" />
            )}
            Raw Data
          </button>
          <button
            onClick={() => { setOpen(false); onScreenshot(); }}
            disabled={isScreenshotting}
            className="flex items-center gap-3 w-full px-4 py-3.5 text-[14px] font-semibold text-slate-700 active:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {isScreenshotting ? (
              <Loader2 size={16} className="animate-spin text-slate-400" />
            ) : (
              <Camera size={16} className="text-blue-600" />
            )}
            Screenshot
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Warehouse distribution bottom sheet
// ---------------------------------------------------------------------------

interface DrilldownEntry {
  capacity: string;
  phase: string;
  brand: string;
  grandTotal: number;
  warehouseEntries: { wh: Warehouse; qty: number }[];
}

function WarehouseSheet({
  data,
  onClose,
}: {
  data: DrilldownEntry | null;
  onClose: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [renderData, setRenderData] = useState<DrilldownEntry | null>(null);

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
  const activeEntries = d.warehouseEntries.filter(e => e.qty > 0);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col justify-end bg-black/40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      onClick={handleClose}
    >
      <div
        className={`bg-[#F8F9FB] w-full max-h-[85dvh] rounded-t-2xl shadow-xl flex flex-col transition-transform duration-300 pb-[env(safe-area-inset-bottom)] ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white rounded-t-2xl px-5 pt-4 pb-4 border-b border-slate-200 shrink-0 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-slate-900 text-[18px] tracking-tight leading-snug break-words">
                {formatCapacityDisplay(d.capacity)}
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="text-[12px] font-semibold text-slate-500">{d.brand}</span>
                {d.phase && d.phase !== 'Unknown' && (
                  <PhaseBadge phase={d.phase} />
                )}
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="font-black text-[#1A2766] text-[20px] leading-none">{d.grandTotal.toLocaleString()}</span>
                <span className="text-[11px] font-bold text-slate-400 uppercase">pcs total</span>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors shrink-0 -mr-1 mt-0.5"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">
            Warehouse Stock
          </div>
          {activeEntries.length === 0 ? (
            <div className="text-center text-slate-400 text-[13px] py-8">No warehouse data</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {activeEntries.map(({ wh, qty }) => (
                <div
                  key={wh.id}
                  className="bg-white rounded-[14px] border border-slate-200 shadow-sm flex items-center justify-between px-4 py-3"
                >
                  <span className="font-semibold text-[14px] text-slate-700 flex-1 min-w-0 pr-4 break-words leading-snug">
                    {wh.name}
                  </span>
                  <div className="flex items-baseline gap-1 shrink-0">
                    <span className="font-black text-[18px] text-slate-900 leading-none">{qty.toLocaleString()}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">pcs</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-slate-200 px-5 py-4 shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
          <div className="flex justify-between items-center">
            <span className="font-bold text-slate-600 text-[13px] uppercase tracking-wider">Total</span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-black text-[#1A2766] text-[20px] leading-none">{d.grandTotal.toLocaleString()}</span>
              <span className="text-[11px] font-bold text-slate-400 uppercase">pcs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Brand expandable card header
// ---------------------------------------------------------------------------

interface BrandSectionProps {
  brand: string;
  brandTotal: number;
  combos: Array<{
    cap: string;
    capNum: number;
    phase: string;
    gt: number;
    cells: Record<string, number>;
  }>;
  relevantWarehouses: Warehouse[];
  defaultExpanded: boolean;
  onRowTap: (entry: DrilldownEntry) => void;
}

function BrandSection({
  brand,
  brandTotal,
  combos,
  relevantWarehouses,
  defaultExpanded,
  onRowTap,
}: BrandSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="mb-3">
      {/* Brand card header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full bg-white rounded-[14px] border border-slate-200 shadow-sm flex items-center justify-between px-4 py-3 active:bg-slate-50 transition-colors"
      >
        <span className="font-black text-[15px] text-slate-900 flex-1 text-left leading-snug break-words min-w-0 pr-3">
          {brand}
        </span>
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="bg-[#1A2766] text-white rounded-xl px-2.5 py-1 flex items-center gap-1">
            <span className="text-[14px] font-black leading-none">{brandTotal.toLocaleString()}</span>
            <span className="text-[9px] font-bold opacity-70 uppercase">pcs</span>
          </div>
          {expanded ? (
            <ChevronUp size={18} className="text-slate-400" />
          ) : (
            <ChevronDown size={18} className="text-slate-400" />
          )}
        </div>
      </button>

      {/* Capacity/Model rows */}
      {expanded && (
        <div className="mt-1.5 ml-2 flex flex-col gap-1.5">
          {combos.map(entry => {
            const warehouseEntries = relevantWarehouses.map(wh => ({
              wh,
              qty: entry.cells[wh.id] || 0,
            }));
            return (
              <button
                key={`${entry.cap}|${entry.phase}`}
                onClick={() =>
                  onRowTap({
                    capacity: entry.cap,
                    phase: entry.phase,
                    brand,
                    grandTotal: entry.gt,
                    warehouseEntries,
                  })
                }
                className="w-full bg-white rounded-[12px] border border-slate-100 flex items-center justify-between px-4 py-3 active:bg-blue-50/40 transition-colors text-left"
              >
                <div className="flex-1 min-w-0 pr-3">
                  <div className="font-bold text-[14px] text-slate-800 break-words leading-snug">
                    {formatCapacityDisplay(entry.cap)}
                  </div>
                  {entry.phase && entry.phase !== 'Unknown' && (
                    <div className="mt-1">
                      <PhaseBadge phase={entry.phase} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-baseline gap-1 text-right">
                    <span className="font-black text-[16px] text-slate-900">{entry.gt.toLocaleString()}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">pcs</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MobileInverterStockClient({ warehouses, items }: Props) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [activeGridTab, setActiveGridTab] = useState<GridTab>('On-Grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [drilldown, setDrilldown] = useState<DrilldownEntry | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    warehouses: [],
    brands: [],
    types: [],
    phases: [],
    capacities: [],
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isScreenshotting, setIsScreenshotting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const clearAll = useCallback(() => {
    setAppliedFilters({ warehouses: [], brands: [], types: [], phases: [], capacities: [] });
  }, []);

  const activeFilterCount =
    appliedFilters.warehouses.length +
    appliedFilters.brands.length +
    appliedFilters.types.length +
    appliedFilters.phases.length +
    appliedFilters.capacities.length;

  // ── Processed items ────────────────────────────────────────────────────────
  const processedItems = useMemo(
    () =>
      items.map(item => {
        const cap = normalizeCapacity(item.inverterCapacity);
        return {
          ...item,
          normalizedCapacity: cap.value,
          capacityNum: cap.num,
          invType: item.inverterType?.trim() || 'Unknown',
          phase: item.phaseType?.trim() || 'Unknown',
          brandVal: item.brand || 'Unbranded',
        };
      }),
    [items]
  );

  // ── Available warehouses ───────────────────────────────────────────────────
  const availableWarehouses = useMemo(() => {
    const valid = warehouses.filter(w => w.id && w.name && w.name.trim() !== '' && !w.isSystemWarehouse);
    const whMap = new Map<string, Warehouse>();
    valid.forEach(w => whMap.set(w.id, w));
    const activeWhIds = new Set<string>();
    processedItems.forEach(item => {
      Object.entries(item.inventory).forEach(([whId, inv]) => {
        if (inv.qty > 0 && whMap.has(whId)) activeWhIds.add(whId);
      });
    });
    return Array.from(activeWhIds)
      .map(id => whMap.get(id)!)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [processedItems, warehouses]);

  // ── Filter options ─────────────────────────────────────────────────────────
  const availableBrands = useMemo(
    () =>
      Array.from(new Set(processedItems.map(i => i.brandVal)))
        .map(name => ({ id: name, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [processedItems]
  );

  const availableTypes = useMemo(
    () =>
      Array.from(new Set(processedItems.map(i => i.invType)))
        .map(name => ({ id: name, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [processedItems]
  );

  const availablePhases = useMemo(
    () =>
      Array.from(new Set(processedItems.map(i => i.phase)))
        .map(name => ({ id: name, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [processedItems]
  );

  const availableCapacities = useMemo(() => {
    const unique = new Map<string, number>();
    processedItems.forEach(i => {
      if (!unique.has(i.normalizedCapacity)) unique.set(i.normalizedCapacity, i.capacityNum);
    });
    return Array.from(unique.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([name]) => ({ id: name, name }));
  }, [processedItems]);

  // ── Visible warehouses ─────────────────────────────────────────────────────
  const visibleWarehouses = useMemo(
    () =>
      appliedFilters.warehouses.length > 0
        ? availableWarehouses.filter(w => appliedFilters.warehouses.includes(w.id))
        : availableWarehouses,
    [availableWarehouses, appliedFilters.warehouses]
  );

  // ── Filtered items: apply grid tab + search + filters ─────────────────────
  const filteredItems = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    return processedItems.filter(item => {
      // Grid tab filter — primary classification
      if (item.invType !== activeGridTab) return false;
      if (q && !item.name.toLowerCase().includes(q) && !(item.sku || item.id).toLowerCase().includes(q))
        return false;
      if (appliedFilters.brands.length > 0 && !appliedFilters.brands.includes(item.brandVal)) return false;
      // types filter is now redundant when the tab is the source of truth, but
      // we keep it so existing filter state doesn't break anything.
      if (appliedFilters.types.length > 0 && !appliedFilters.types.includes(item.invType)) return false;
      if (appliedFilters.phases.length > 0 && !appliedFilters.phases.includes(item.phase)) return false;
      if (appliedFilters.capacities.length > 0 && !appliedFilters.capacities.includes(item.normalizedCapacity))
        return false;
      return true;
    });
  }, [processedItems, activeGridTab, debouncedSearch, appliedFilters]);

  // ── Relevant warehouses ────────────────────────────────────────────────────
  const relevantWarehouses = useMemo(
    () =>
      visibleWarehouses.filter(wh =>
        filteredItems.some(item => (item.inventory[wh.id]?.qty || 0) > 0)
      ),
    [filteredItems, visibleWarehouses]
  );

  // ── Grouping: Brand → [cap|phase → CardEntry] ─────────────────────────────
  const groupedData = useMemo(() => {
    type CardEntry = {
      cells: Record<string, number>;
      gt: number;
      cap: string;
      capNum: number;
      phase: string;
    };

    const root = new Map<string, Map<string, CardEntry>>();

    filteredItems.forEach(item => {
      const brand = item.brandVal;
      const key = `${item.normalizedCapacity}|${item.phase}`;

      if (!root.has(brand)) root.set(brand, new Map());
      const brandMap = root.get(brand)!;

      if (!brandMap.has(key)) {
        brandMap.set(key, {
          cells: {},
          gt: 0,
          cap: item.normalizedCapacity,
          capNum: item.capacityNum,
          phase: item.phase,
        });
      }

      const entry = brandMap.get(key)!;

      relevantWarehouses.forEach(wh => {
        const qty = Math.max(0, item.inventory[wh.id]?.qty || 0);
        if (qty > 0) {
          entry.cells[wh.id] = (entry.cells[wh.id] || 0) + qty;
          entry.gt += qty;
        }
      });
    });

    // Prune zeros
    for (const [brand, brandMap] of root.entries()) {
      for (const [key, entry] of brandMap.entries()) {
        if (entry.gt === 0) brandMap.delete(key);
      }
      if (brandMap.size === 0) root.delete(brand);
    }

    return root;
  }, [filteredItems, relevantWarehouses]);

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const totalStock = useMemo(() => {
    let sum = 0;
    for (const brandMap of groupedData.values()) {
      for (const entry of brandMap.values()) sum += entry.gt;
    }
    return sum;
  }, [groupedData]);

  const activeSkuCount = filteredItems.length;

  // ── Get-match-count for filter sheet ──────────────────────────────────────
  const getMatchCount = useCallback((draft: FilterState) => {
    const q = debouncedSearch.toLowerCase().trim();
    const matching = processedItems.filter(item => {
      if (item.invType !== activeGridTab) return false;
      if (q && !item.name.toLowerCase().includes(q) && !(item.sku || item.id).toLowerCase().includes(q))
        return false;
      if (draft.brands.length > 0 && !draft.brands.includes(item.brandVal)) return false;
      if (draft.types.length > 0 && !draft.types.includes(item.invType)) return false;
      if (draft.phases.length > 0 && !draft.phases.includes(item.phase)) return false;
      if (draft.capacities.length > 0 && !draft.capacities.includes(item.normalizedCapacity)) return false;
      return true;
    });

    const draftVisibleWhs = draft.warehouses.length > 0
      ? availableWarehouses.filter(w => draft.warehouses.includes(w.id))
      : availableWarehouses;

    const uniqueCards = new Set<string>();
    matching.forEach(item => {
      const hasStock = draftVisibleWhs.some(wh => (item.inventory[wh.id]?.qty || 0) > 0);
      if (hasStock) {
        uniqueCards.add(`${item.brandVal}|${item.normalizedCapacity}|${item.phase}`);
      }
    });
    return uniqueCards.size;
  }, [processedItems, activeGridTab, debouncedSearch, availableWarehouses]);

  // ── Export: raw data ───────────────────────────────────────────────────────
  const handleExportRawData = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const XLSX = await import('xlsx');
      const rows = filteredItems.map(item => {
        const row: Record<string, string | number> = {
          SKU: item.sku || item.id,
          'Product Name': item.name,
          Category: item.categoryName || 'Unknown',
          Brand: item.brandVal,
          'Inverter Capacity': item.normalizedCapacity,
          'Inverter Type': item.invType,
          'Phase Type': item.phase,
        };
        let totalQty = 0;
        relevantWarehouses.forEach(wh => {
          const qty = Math.max(0, item.inventory[wh.id]?.qty || 0);
          row[wh.name] = qty;
          totalQty += qty;
        });
        row['Grand Total'] = totalQty;
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Raw Data');
      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `inverter-stock-raw-data-${dateStr}.xlsx`);
      toast.success('Export downloaded');
    } catch (e) {
      console.error('Export failed', e);
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  }, [filteredItems, relevantWarehouses, isExporting]);

  // ── Export: PDF ────────────────────────────────────────────────────────────
  const handleScreenshot = useCallback(async () => {
    if (isScreenshotting) return;
    setIsScreenshotting(true);
    const tid = toast.loading('Generating PDF report…');
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });

      doc.setFontSize(16);
      doc.setTextColor(26, 39, 102);
      doc.text(`KAMNA ERP — Inverter Stock (${activeGridTab})`, 14, 15);
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Generated: ${formatStockDate(new Date())}`, 14, 22);

      const body: any[][] = [];
      const sortedBrands = Array.from(groupedData.keys()).sort();
      sortedBrands.forEach(brand => {
        const brandMap = groupedData.get(brand)!;
        body.push([{
          content: brand.toUpperCase(),
          colSpan: relevantWarehouses.length + 2,
          styles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', halign: 'left' },
        }]);

        const combos = Array.from(brandMap.values()).sort((a, b) => a.capNum - b.capNum || a.phase.localeCompare(b.phase));
        combos.forEach(entry => {
          const labelCell = {
            content: `   ${formatCapacityDisplay(entry.cap)}\n   ${entry.phase}`,
            styles: { fillColor: [255, 255, 255], textColor: [50, 50, 50], halign: 'left' },
          };
          const whCells = relevantWarehouses.map(wh => ({
            content: entry.cells[wh.id] > 0 ? String(entry.cells[wh.id]) : '—',
            styles: { halign: 'center' },
          }));
          const gtCell = {
            content: String(entry.gt),
            styles: { fillColor: [230, 234, 255], textColor: [26, 39, 102], fontStyle: 'bold', halign: 'center' },
          };
          body.push([labelCell, ...whCells, gtCell]);
        });
      });

      autoTable(doc, {
        startY: 28,
        head: [['Configuration', ...relevantWarehouses.map(w => w.name), 'Grand Total']],
        body,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2, lineWidth: 0.1, lineColor: [220, 220, 220] },
        headStyles: { fillColor: [248, 249, 251], textColor: [80, 80, 80], fontStyle: 'bold', halign: 'center' },
        columnStyles: { 0: { cellWidth: 55, halign: 'left' } },
        showHead: 'everyPage',
        margin: { top: 15, right: 10, bottom: 15, left: 10 },
      });

      doc.save('Inverter_Stock_Mobile.pdf');
      toast.success('Report generated', { id: tid });
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate report', { id: tid });
    } finally {
      setIsScreenshotting(false);
    }
  }, [groupedData, relevantWarehouses, activeGridTab, isScreenshotting]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const sortedBrands = useMemo(() => Array.from(groupedData.keys()).sort(), [groupedData]);
  const isEmpty = sortedBrands.length === 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F8F9FB]">

      {/* KPI cards — Wire & Cable style */}
      <div className="grid grid-cols-3 gap-2 p-3 pb-0 shrink-0">
        <div className="bg-white rounded-[14px] p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col justify-center">
          <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Active SKUs</div>
          <div className="text-lg font-black text-slate-800 leading-none">{activeSkuCount}</div>
        </div>
        <div className="bg-white rounded-[14px] p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col justify-center">
          <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Total Stock</div>
          <div className="text-lg font-black text-blue-600 leading-none">
            {totalStock.toLocaleString()}
            <span className="text-[10px] font-bold ml-1 text-blue-400">pcs</span>
          </div>
        </div>
        <div className="bg-white rounded-[14px] p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col justify-center">
          <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Warehouses</div>
          <div className="text-lg font-black text-slate-800 leading-none">{relevantWarehouses.length}</div>
        </div>
      </div>

      {/* Grid-type segmented control */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="bg-white rounded-xl border border-slate-200 p-1 flex">
          {GRID_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveGridTab(tab)}
              className={`flex-1 py-2 text-[12px] font-bold rounded-lg transition-all ${
                activeGridTab === tab
                  ? 'bg-[#1A2766] text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Search + Filter + Menu */}
      <div className="px-3 pb-3 shrink-0">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search product or SKU…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 bg-white border border-slate-200 text-slate-800 text-[13px] rounded-xl h-10 focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] transition-shadow"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 active:opacity-60"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setFiltersOpen(true)}
            className={`relative w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
              activeFilterCount > 0
                ? 'bg-[#1A2766]/10 border-[#1A2766]/30 text-[#1A2766]'
                : 'bg-white border-slate-200 text-slate-600'
            }`}
            aria-label="Open filters"
          >
            <SlidersHorizontal size={18} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#1A2766] text-white text-[9px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>
          <OverflowMenu
            onRawData={handleExportRawData}
            onScreenshot={handleScreenshot}
            isExporting={isExporting}
            isScreenshotting={isScreenshotting}
          />
        </div>
      </div>

      {/* Brand sections list */}
      <div className="flex-1 overflow-y-auto px-3 pb-6 pb-[env(safe-area-inset-bottom)] min-h-0">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 text-slate-400 py-16 text-center">
            <AlertTriangle size={36} className="text-slate-300" />
            <div>
              <div className="text-[15px] font-bold text-slate-600 mb-1">
                No {activeGridTab} inverter stock found
              </div>
              <p className="text-[13px]">Try adjusting your search or filters.</p>
            </div>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAll}
                className="mt-2 text-[13px] font-bold text-[#1A2766] active:opacity-60"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          sortedBrands.map((brand, idx) => {
            const brandMap = groupedData.get(brand)!;
            const brandTotal = Array.from(brandMap.values()).reduce((s, e) => s + e.gt, 0);
            const combos = Array.from(brandMap.values()).sort(
              (a, b) => a.capNum - b.capNum || a.phase.localeCompare(b.phase)
            );
            return (
              <BrandSection
                key={brand}
                brand={brand}
                brandTotal={brandTotal}
                combos={combos}
                relevantWarehouses={relevantWarehouses}
                defaultExpanded={idx === 0}
                onRowTap={setDrilldown}
              />
            );
          })
        )}
      </div>

      {/* Filter bottom sheet */}
      <MobileInverterFilterSheet
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        options={{
          warehouses: availableWarehouses.map(w => ({ id: w.id, name: w.name })),
          brands: availableBrands,
          types: availableTypes,
          phases: availablePhases,
          capacities: availableCapacities,
        }}
        appliedFilters={appliedFilters}
        onApply={filters => {
          setAppliedFilters(filters);
          setFiltersOpen(false);
        }}
        getMatchCount={getMatchCount}
      />

      {/* Warehouse distribution bottom sheet */}
      <WarehouseSheet data={drilldown} onClose={() => setDrilldown(null)} />
    </div>
  );
}
