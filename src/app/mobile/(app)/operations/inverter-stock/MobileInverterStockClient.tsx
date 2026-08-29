'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  X,
  MoreVertical,
  Download,
  Camera,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatStockDate } from '@/lib/date-utils';

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
// Capacity normalizer  (exact copy from InverterStockClient.tsx)
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

/**
 * Given the already-normalized capacity value string (e.g. "5", "5 kW", "Unknown"),
 * returns a safe display string that always ends with " kW" for purely numeric values.
 * Never appends kW twice. Preserves "Unknown" and other non-numeric labels.
 */
function formatCapacityDisplay(normalizedValue: string): string {
  if (!normalizedValue || normalizedValue === 'Unknown') return normalizedValue;
  if (/[a-zA-Z]/.test(normalizedValue)) return normalizedValue;
  return `${normalizedValue} kW`;
}

// ---------------------------------------------------------------------------
// Subtle mobile heatmap  (intensity-only, no aggressive desktop saturation)
// ---------------------------------------------------------------------------

function getMobileHeatmapStyle(val: number, maxVal: number): React.CSSProperties {
  if (val <= 0 || maxVal <= 0) return {};
  const ratio = Math.min(1, val / maxVal);
  // Subtle indigo opacity tint: 6% → 22%
  const opacity = Math.round((0.06 + ratio * 0.16) * 100) / 100;
  return { backgroundColor: `rgba(99,102,241,${opacity})` };
}

// ---------------------------------------------------------------------------
// Badge component
// ---------------------------------------------------------------------------

const Badge = ({
  children,
  color = 'blue',
}: {
  children: React.ReactNode;
  color?: 'blue' | 'purple' | 'amber' | 'gray';
}) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    gray: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  return (
    <span
      className={`px-1.5 py-0.5 text-[10px] font-semibold border rounded-sm whitespace-nowrap ${colors[color]}`}
    >
      {children}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Overflow menu (three-dot) for actions
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
        className="p-2 rounded-full text-white/80 active:bg-white/10 transition-colors"
        aria-label="More actions"
      >
        <MoreVertical size={22} strokeWidth={2.5} />
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

import { MobileInverterFilterSheet, FilterState } from './MobileInverterFilterSheet';

// ---------------------------------------------------------------------------
// Config card (one per Brand + Capacity + Type + Phase combination)
// ---------------------------------------------------------------------------

interface ConfigCardProps {
  capacity: string;
  invType: string;
  phase: string;
  grandTotal: number;
  warehouseEntries: { wh: Warehouse; qty: number }[];
  maxWhQty: number;
}

function ConfigCard({
  capacity,
  invType,
  phase,
  grandTotal,
  warehouseEntries,
  maxWhQty,
}: ConfigCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Card header — always visible */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 active:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1 mr-3">
          <span className="font-bold text-[15px] text-slate-900 whitespace-nowrap">{formatCapacityDisplay(capacity)}</span>
          <Badge color={invType === 'Unknown' ? 'gray' : 'blue'}>{invType}</Badge>
          <Badge color={phase === 'Unknown' ? 'gray' : 'purple'}>{phase}</Badge>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Grand Total chip */}
          <div className="bg-[#1A2766] text-white rounded-xl px-2.5 py-1 flex items-center">
            <span className="text-[14px] font-black leading-none">{grandTotal}</span>
          </div>
          {expanded ? (
            <ChevronUp size={18} className="text-slate-400" />
          ) : (
            <ChevronDown size={18} className="text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded warehouse list */}
      {expanded && (
        <div className="border-t border-slate-100">
          {warehouseEntries
            .filter(({ qty }) => qty !== null && qty !== undefined && qty !== 0)
            .map(({ wh, qty }) => {
              const heatStyle = getMobileHeatmapStyle(qty, maxWhQty);
              return (
                <div
                  key={wh.id}
                className="flex items-center justify-between px-4 py-2.5 border-b border-slate-50 last:border-0"
                style={heatStyle}
              >
                <span className="text-[13px] text-slate-600 font-medium leading-snug flex-1 min-w-0 pr-2">
                  {wh.name}
                </span>
                <span className="text-[14px] font-bold shrink-0 text-slate-800">
                  {qty}
                </span>
              </div>
            );
          })}
          {/* Grand Total row */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#1A2766]">
            <span className="text-[12px] font-bold text-white/80 uppercase tracking-wider">
              Grand Total
            </span>
            <span className="text-[15px] font-black text-white">{grandTotal}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export default function MobileInverterStockClient({ warehouses, items }: Props) {
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Filters
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    warehouses: [],
    brands: [],
    types: [],
    phases: [],
    capacities: [],
  });

  const clearAll = useCallback(() => {
    setAppliedFilters({
      warehouses: [],
      brands: [],
      types: [],
      phases: [],
      capacities: [],
    });
  }, []);

  const activeFilterCount =
    appliedFilters.warehouses.length +
    appliedFilters.brands.length +
    appliedFilters.types.length +
    appliedFilters.phases.length +
    appliedFilters.capacities.length;

  // Actions
  const [isExporting, setIsExporting] = useState(false);
  const [isScreenshotting, setIsScreenshotting] = useState(false);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  // Normalise each SKU — Core attribute is never read here
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

  // Derive valid warehouses dynamically
  const availableWarehouses = useMemo(() => {
    const valid = warehouses.filter(w => w.id && w.name && w.name.trim() !== '' && !w.isSystemWarehouse);
    const whMap = new Map<string, Warehouse>();
    valid.forEach(w => whMap.set(w.id, w));

    const activeWhIds = new Set<string>();
    processedItems.forEach(item => {
      Object.entries(item.inventory).forEach(([whId, inv]) => {
        if (inv.qty > 0 && whMap.has(whId)) {
          activeWhIds.add(whId);
        }
      });
    });

    return Array.from(activeWhIds)
      .map(id => whMap.get(id)!)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [processedItems, warehouses]);

  // Available filter options
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

  // Active warehouse scope
  const visibleWarehouses = useMemo(
    () =>
      appliedFilters.warehouses.length > 0
        ? availableWarehouses.filter(w => appliedFilters.warehouses.includes(w.id))
        : availableWarehouses,
    [availableWarehouses, appliedFilters.warehouses]
  );

  // Filtered SKU list
  const filteredItems = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    return processedItems.filter(item => {
      if (q && !item.name.toLowerCase().includes(q) && !(item.sku || item.id).toLowerCase().includes(q))
        return false;
      if (appliedFilters.brands.length > 0 && !appliedFilters.brands.includes(item.brandVal)) return false;
      if (appliedFilters.types.length > 0 && !appliedFilters.types.includes(item.invType)) return false;
      if (appliedFilters.phases.length > 0 && !appliedFilters.phases.includes(item.phase)) return false;
      if (appliedFilters.capacities.length > 0 && !appliedFilters.capacities.includes(item.normalizedCapacity))
        return false;
      return true;
    });
  }, [
    processedItems,
    debouncedSearch,
    appliedFilters,
  ]);

  // Warehouses that actually have stock in the filtered set
  const relevantWarehouses = useMemo(
    () =>
      visibleWarehouses.filter(wh =>
        filteredItems.some(item => (item.inventory[wh.id]?.qty || 0) > 0)
      ),
    [filteredItems, visibleWarehouses]
  );

  // ---------------------------------------------------------------------------
  // Grouping: Brand → Map<"cap|type|phase" → aggregated card data>
  // ---------------------------------------------------------------------------

  const groupedData = useMemo(() => {
    type CardEntry = {
      cells: Record<string, number>; // warehouseId → qty
      gt: number;
      cap: string;
      capNum: number;
      invType: string;
      phase: string;
    };

    const root = new Map<string, Map<string, CardEntry>>();

    filteredItems.forEach(item => {
      const brand = item.brandVal;
      const key = `${item.normalizedCapacity}|${item.invType}|${item.phase}`;

      if (!root.has(brand)) root.set(brand, new Map());
      const brandMap = root.get(brand)!;

      if (!brandMap.has(key)) {
        brandMap.set(key, {
          cells: {},
          gt: 0,
          cap: item.normalizedCapacity,
          capNum: item.capacityNum,
          invType: item.invType,
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

    // Prune brands/cards with zero grand total
    for (const [brand, brandMap] of root.entries()) {
      for (const [key, entry] of brandMap.entries()) {
        if (entry.gt === 0) brandMap.delete(key);
      }
      if (brandMap.size === 0) root.delete(brand);
    }

    return root;
  }, [filteredItems, relevantWarehouses]);

  // Calculate matching items count for filter sheet draft
  const getMatchCount = useCallback((draft: FilterState) => {
    const matching = processedItems.filter(item => {
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase().trim();
        if (!item.name.toLowerCase().includes(q) && !(item.sku || item.id).toLowerCase().includes(q))
          return false;
      }
      if (draft.brands.length > 0 && !draft.brands.includes(item.brandVal)) return false;
      if (draft.types.length > 0 && !draft.types.includes(item.invType)) return false;
      if (draft.phases.length > 0 && !draft.phases.includes(item.phase)) return false;
      if (draft.capacities.length > 0 && !draft.capacities.includes(item.normalizedCapacity))
        return false;
      return true;
    });

    const draftVisibleWhs = draft.warehouses.length > 0
      ? availableWarehouses.filter(w => draft.warehouses.includes(w.id))
      : availableWarehouses;

    const uniqueCards = new Set<string>();
    matching.forEach(item => {
      let hasStock = false;
      for (const wh of draftVisibleWhs) {
        if ((item.inventory[wh.id]?.qty || 0) > 0) {
          hasStock = true;
          break;
        }
      }
      if (hasStock) {
        const key = `${item.brandVal}|${item.normalizedCapacity}|${item.invType}|${item.phase}`;
        uniqueCards.add(key);
      }
    });

    return uniqueCards.size;
  }, [processedItems, debouncedSearch, availableWarehouses]);

  // Max per-warehouse qty across all cards (for heatmap scale)
  const maxWhQty = useMemo(() => {
    let max = 0;
    for (const brandMap of groupedData.values()) {
      for (const entry of brandMap.values()) {
        for (const [whId, qty] of Object.entries(entry.cells)) {
          if (whId !== 'GT' && qty > max) max = qty;
        }
      }
    }
    return max;
  }, [groupedData]);

  // Summary stats
  const totalStock = useMemo(() => {
    let sum = 0;
    for (const brandMap of groupedData.values()) {
      for (const entry of brandMap.values()) {
        sum += entry.gt;
      }
    }
    return sum;
  }, [groupedData]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

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
      doc.text('KAMNA ERP — Inverter Stock', 14, 15);

      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Generated: ${formatStockDate(new Date())}`, 14, 22);

      const filterParts: string[] = [];
      if (appliedFilters.warehouses.length) filterParts.push(`Warehouses: ${appliedFilters.warehouses.length}`);
      if (appliedFilters.brands.length) filterParts.push(`Brands: ${appliedFilters.brands.join(', ')}`);
      if (appliedFilters.types.length) filterParts.push(`Types: ${appliedFilters.types.join(', ')}`);
      if (appliedFilters.phases.length) filterParts.push(`Phases: ${appliedFilters.phases.join(', ')}`);
      if (appliedFilters.capacities.length) filterParts.push(`Capacities: ${appliedFilters.capacities.length}`);
      doc.text(
        `Filters: ${filterParts.length ? filterParts.join(' | ') : 'All data (no filters)'}`,
        14,
        28
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: any[][] = [];
      const sortedBrands = Array.from(groupedData.keys()).sort();
      sortedBrands.forEach(brand => {
        const brandMap = groupedData.get(brand)!;
        // Brand header row
        body.push([
          {
            content: brand.toUpperCase(),
            colSpan: relevantWarehouses.length + 2,
            styles: {
              fillColor: [241, 245, 249],
              textColor: [30, 41, 59],
              fontStyle: 'bold',
              halign: 'left',
            },
          },
        ]);

        const combos = Array.from(brandMap.values()).sort((a, b) => {
          if (a.capNum !== b.capNum) return a.capNum - b.capNum;
          if (a.invType !== b.invType) return a.invType.localeCompare(b.invType);
          return a.phase.localeCompare(b.phase);
        });

        combos.forEach(entry => {
          const labelCell = {
            content: `   ${entry.cap}\n   ${entry.invType} | ${entry.phase}`,
            styles: { fillColor: [255, 255, 255], textColor: [50, 50, 50], halign: 'left' },
          };
          const whCells = relevantWarehouses.map(wh => ({
            content: entry.cells[wh.id] > 0 ? String(entry.cells[wh.id]) : '—',
            styles: { halign: 'center' },
          }));
          const gtCell = {
            content: String(entry.gt),
            styles: {
              fillColor: [230, 234, 255],
              textColor: [26, 39, 102],
              fontStyle: 'bold',
              halign: 'center',
            },
          };
          body.push([labelCell, ...whCells, gtCell]);
        });
      });

      autoTable(doc, {
        startY: 34,
        head: [
          ['Configuration', ...relevantWarehouses.map(w => w.name), 'Grand Total'],
        ],
        body,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2, lineWidth: 0.1, lineColor: [220, 220, 220] },
        headStyles: {
          fillColor: [248, 249, 251],
          textColor: [80, 80, 80],
          fontStyle: 'bold',
          halign: 'center',
        },
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
  }, [
    groupedData,
    relevantWarehouses,
    appliedFilters,
    isScreenshotting,
  ]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const sortedBrands = useMemo(
    () => Array.from(groupedData.keys()).sort(),
    [groupedData]
  );

  const isEmpty = sortedBrands.length === 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F8F9FB]">

      {/* Sticky action bar */}
      <div className="bg-[#1A2766] px-3 pt-1 pb-2 shrink-0 flex items-center justify-between">
        {/* Summary chips */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center bg-white/10 rounded-xl px-2.5 py-1.5">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider leading-none">
              SKUs
            </span>
            <span className="text-[14px] font-black text-white leading-none mt-0.5">
              {filteredItems.length}
            </span>
          </div>
          <div className="flex flex-col items-center bg-white/10 rounded-xl px-2.5 py-1.5">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider leading-none">
              Stock
            </span>
            <span className="text-[14px] font-black text-white leading-none mt-0.5">
              {totalStock.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col items-center bg-white/10 rounded-xl px-2.5 py-1.5">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider leading-none">
              WH
            </span>
            <span className="text-[14px] font-black text-white leading-none mt-0.5">
              {relevantWarehouses.length}
            </span>
          </div>
        </div>

        {/* Overflow menu */}
        <OverflowMenu
          onRawData={handleExportRawData}
          onScreenshot={handleScreenshot}
          isExporting={isExporting}
          isScreenshotting={isScreenshotting}
        />
      </div>

      {/* Search + Filters row */}
      <div className="px-3 pt-3 pb-2 flex gap-2 shrink-0">
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
      </div>

      {/* Main scrollable list */}
      <div className="flex-1 overflow-y-auto px-3 pb-[env(safe-area-inset-bottom)] pb-6">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 text-slate-400 py-16 text-center">
            <AlertTriangle size={36} className="text-slate-300" />
            <div>
              <div className="text-[15px] font-bold text-slate-600 mb-1">
                No inverter stock found
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
          sortedBrands.map(brand => {
            const brandMap = groupedData.get(brand)!;
            const combos = Array.from(brandMap.values()).sort((a, b) => {
              if (a.capNum !== b.capNum) return a.capNum - b.capNum;
              if (a.invType !== b.invType) return a.invType.localeCompare(b.invType);
              return a.phase.localeCompare(b.phase);
            });

            return (
              <div key={brand} className="mb-5">
                {/* Brand section heading — always expanded (non-collapsible) */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">
                    {brand}
                  </span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <div className="flex flex-col gap-2.5">
                  {combos.map(entry => {
                    const warehouseEntries = relevantWarehouses.map(wh => ({
                      wh,
                      qty: entry.cells[wh.id] || 0,
                    }));
                    return (
                      <ConfigCard
                        key={`${entry.cap}|${entry.invType}|${entry.phase}`}
                        capacity={entry.cap}
                        invType={entry.invType}
                        phase={entry.phase}
                        grandTotal={entry.gt}
                        warehouseEntries={warehouseEntries}
                        maxWhQty={maxWhQty}
                      />
                    );
                  })}
                </div>
              </div>
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
    </div>
  );
}
