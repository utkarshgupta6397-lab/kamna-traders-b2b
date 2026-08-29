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
import { MobileSolarPanelFilterSheet, SolarFilterState } from './MobileSolarPanelFilterSheet';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  isDcrEligible?: boolean;
  wattage?: string | null;
  parentProductId?: string | null;
  parentProductName?: string | null;
}

interface Props {
  warehouses: Warehouse[];
  categories: any[];
  brands: any[];
  items: SkuItem[];
  canSync?: boolean;
}

// ─── Wattage formatter ────────────────────────────────────────────────────────

function formatWattageDisplay(raw: string | null | undefined): string {
  if (!raw || raw.trim() === '') return 'Unknown';
  const v = raw.trim();
  if (/^[\d.]+$/.test(v)) return `${v} W`;
  if (/\bW$/i.test(v)) return v;
  return v;
}


// ─── Mobile heatmap ───────────────────────────────────────────────────────────

function getMobileHeatmapStyle(val: number, values: number[]): React.CSSProperties {
  if (val <= 0 || values.length === 0) return {};
  
  const getRankRatio = (n: number): number => {
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

  const ratio = getRankRatio(val);
  const heatColors = [
    { r: 254, g: 226, b: 226 }, // Red 100
    { r: 254, g: 215, b: 170 }, // Orange 200
    { r: 254, g: 240, b: 138 }, // Yellow 200
    { r: 187, g: 247, b: 208 }, // Green 200
    { r: 74,  g: 222, b: 128 }, // Green 400
  ];

  const steps = heatColors.length - 1;
  const scaled = ratio * steps;
  const idx = Math.floor(scaled);
  let r, g, b;
  if (idx >= steps) {
    r = heatColors[steps].r; g = heatColors[steps].g; b = heatColors[steps].b;
  } else {
    const t = scaled - idx;
    const c1 = heatColors[idx];
    const c2 = heatColors[idx + 1];
    r = Math.round(c1.r + (c2.r - c1.r) * t);
    g = Math.round(c1.g + (c2.g - c1.g) * t);
    b = Math.round(c1.b + (c2.b - c1.b) * t);
  }

  const isDark = (r * 0.299 + g * 0.587 + b * 0.114) < 150;
  return { 
    backgroundColor: `rgb(${r},${g},${b})`, 
    color: isDark ? '#fff' : '#0f172a',
    fontWeight: ratio > 0.4 ? 600 : 500
  };
}

// ─── Overflow menu ────────────────────────────────────────────────────────────

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

// ─── DCR badge ────────────────────────────────────────────────────────────────

function DcrBadge({ isDcr }: { isDcr: boolean }) {
  return isDcr ? (
    <span className="px-1.5 py-0.5 text-[10px] font-semibold border rounded-sm whitespace-nowrap bg-green-50 text-green-700 border-green-200">
      DCR
    </span>
  ) : (
    <span className="px-1.5 py-0.5 text-[10px] font-semibold border rounded-sm whitespace-nowrap bg-slate-100 text-slate-500 border-slate-200">
      Non-DCR
    </span>
  );
}

// ─── Wattage card ─────────────────────────────────────────────────────────────

interface WattageCardProps {
  wattage: string;
  grandTotal: number;
  warehouseEntries: { wh: Warehouse; qty: number }[];
  scaleValues: number[];
}

function WattageCard({ wattage, grandTotal, warehouseEntries, scaleValues }: WattageCardProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleWarehouses = warehouseEntries.filter(
    ({ qty }) => qty !== null && qty !== undefined && qty > 0
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Card header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 active:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1 mr-3">
          <span className="font-bold text-[15px] text-slate-900 whitespace-nowrap">
            {formatWattageDisplay(wattage)}
          </span>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Grand total chip */}
          <div className="bg-[#1A2766] text-white rounded-xl px-2.5 py-1 flex items-center">
            <span className="text-[14px] font-black leading-none">{grandTotal.toLocaleString()}</span>
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
          {visibleWarehouses.length === 0 ? (
            <div className="px-4 py-3 text-[13px] text-slate-400 italic">No warehouse data</div>
          ) : (
            visibleWarehouses.map(({ wh, qty }) => {
              const heatStyle = getMobileHeatmapStyle(qty, scaleValues);
              return (
                <div
                  key={wh.id}
                  className="flex items-center justify-between px-4 py-2.5 border-b border-slate-50 last:border-0"
                  style={heatStyle}
                >
                  <span className="text-[13px] text-slate-600 font-medium leading-snug flex-1 min-w-0 pr-2">
                    {wh.name}
                  </span>
                  <span className="text-[14px] font-bold shrink-0 text-slate-800">{qty.toLocaleString()}</span>
                </div>
              );
            })
          )}
          {/* Grand total row */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#1A2766]">
            <span className="text-[12px] font-bold text-white/80 uppercase tracking-wider">Grand Total</span>
            <span className="text-[15px] font-black text-white">{grandTotal.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MobileSolarPanelStockClient({ warehouses, categories, brands, items, canSync }: Props) {
  // ── Search ──────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<SolarFilterState>({
    warehouses: [],
    brands: [],
    dcrStatus: [],
    series: [],
    wattages: [],
  });

  const clearAll = useCallback(() => {
    setAppliedFilters({ warehouses: [], brands: [], dcrStatus: [], series: [], wattages: [] });
  }, []);

  const activeFilterCount =
    appliedFilters.warehouses.length +
    appliedFilters.brands.length +
    appliedFilters.dcrStatus.length +
    appliedFilters.series.length +
    appliedFilters.wattages.length;

  // ── Actions ─────────────────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false);
  const [isScreenshotting, setIsScreenshotting] = useState(false);

  // ── Derived: warehouse pool ─────────────────────────────────────────────────
  const availableWarehouses = useMemo(() => {
    const valid = warehouses.filter(w => w.id && w.name && w.name.trim() !== '' && !w.isSystemWarehouse);
    const whMap = new Map<string, Warehouse>();
    valid.forEach(w => whMap.set(w.id, w));

    const activeWhIds = new Set<string>();
    items.forEach(item => {
      Object.entries(item.inventory).forEach(([whId, inv]) => {
        if (inv.qty > 0 && whMap.has(whId)) activeWhIds.add(whId);
      });
    });

    return Array.from(activeWhIds)
      .map(id => whMap.get(id)!)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, warehouses]);

  // ── Derived: filter options ─────────────────────────────────────────────────
  const availableBrands = useMemo(
    () =>
      Array.from(new Map(items.map(i => [i.brandId ?? i.brand ?? 'Unbranded', i.brand ?? 'Unbranded'])).entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );

  const availableSeries = useMemo(() => {
    const s = new Set<string>();
    items.forEach(i => { if (i.parentProductName) s.add(i.parentProductName); });
    return Array.from(s).sort().map(name => ({ id: name, name }));
  }, [items]);

  const availableWattages = useMemo(() => {
    const s = new Set<string>();
    items.forEach(i => { if (i.wattage) s.add(i.wattage); });
    return Array.from(s)
      .sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0))
      .map(w => ({ id: w, name: formatWattageDisplay(w) }));
  }, [items]);

  // ── Active warehouse scope ──────────────────────────────────────────────────
  const visibleWarehouses = useMemo(
    () =>
      appliedFilters.warehouses.length > 0
        ? availableWarehouses.filter(w => appliedFilters.warehouses.includes(w.id))
        : availableWarehouses,
    [availableWarehouses, appliedFilters.warehouses]
  );

  // ── Filtered SKUs ───────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    return items.filter(item => {
      if (q && !item.name.toLowerCase().includes(q) && !(item.sku || item.id).toLowerCase().includes(q))
        return false;
      if (
        appliedFilters.brands.length > 0 &&
        !appliedFilters.brands.includes(item.brandId ?? item.brand ?? 'Unbranded')
      )
        return false;
      if (appliedFilters.dcrStatus.length > 0) {
        const status = item.isDcrEligible ? 'DCR' : 'Non-DCR';
        if (!appliedFilters.dcrStatus.includes(status)) return false;
      }
      if (
        appliedFilters.series.length > 0 &&
        (!item.parentProductName || !appliedFilters.series.includes(item.parentProductName))
      )
        return false;
      if (
        appliedFilters.wattages.length > 0 &&
        (!item.wattage || !appliedFilters.wattages.includes(item.wattage))
      )
        return false;
      return true;
    });
  }, [items, debouncedSearch, appliedFilters]);

  // ── Relevant warehouses ─────────────────────────────────────────────────────
  const relevantWarehouses = useMemo(
    () =>
      visibleWarehouses.filter(wh =>
        filteredItems.some(item => (item.inventory[wh.id]?.qty || 0) > 0)
      ),
    [filteredItems, visibleWarehouses]
  );

  // ── Single-pass grouped data ────────────────────────────────────────────────
  // Shape: Map< 'DCR'|'Non-DCR', Map< series, Map< childKey, { whQtys, gt, wattageNum, label } > > >
  type WattageEntry = { whQtys: Record<string, number>; gt: number; wattageNum: number; label: string };
  type GroupedData = Map<'DCR' | 'Non-DCR', Map<string, Map<string, WattageEntry>>>;

  const groupedData = useMemo<GroupedData>(() => {
    const root: GroupedData = new Map([['DCR', new Map()], ['Non-DCR', new Map()]]);

    filteredItems.forEach(item => {
      const classification: 'DCR' | 'Non-DCR' = item.isDcrEligible ? 'DCR' : 'Non-DCR';
      const series = item.parentProductName?.trim() || '(NO SERIES)';
      
      let childKey: string, label: string, wattageNum: number;
      if (series === '(NO SERIES)') {
        childKey = item.sku || item.id;
        label = item.name;
        wattageNum = 0;
      } else {
        const wattage = item.wattage?.trim() || 'Unknown';
        childKey = wattage;
        label = formatWattageDisplay(wattage);
        wattageNum = wattage === 'Unknown' ? Infinity : (parseFloat(wattage) || Infinity);
      }

      const classMap = root.get(classification)!;
      if (!classMap.has(series)) classMap.set(series, new Map());
      const seriesMap = classMap.get(series)!;

      if (!seriesMap.has(childKey)) seriesMap.set(childKey, { whQtys: {}, gt: 0, wattageNum, label });
      const entry = seriesMap.get(childKey)!;

      relevantWarehouses.forEach(wh => {
        const qty = Math.max(0, item.inventory[wh.id]?.qty || 0);
        if (qty > 0) {
          entry.whQtys[wh.id] = (entry.whQtys[wh.id] || 0) + qty;
          entry.gt += qty;
        }
      });
    });

    // Prune zero-stock wattages and empty series
    for (const classMap of root.values()) {
      for (const [series, seriesMap] of classMap.entries()) {
        for (const [childKey, entry] of seriesMap.entries()) {
          if (entry.gt === 0) seriesMap.delete(childKey);
        }
        if (seriesMap.size === 0) classMap.delete(series);
      }
    }

    return root;
  }, [filteredItems, relevantWarehouses]);

  // ── Summary stats ───────────────────────────────────────────────────────────
  const totalStock = useMemo(() => {
    let sum = 0;
    for (const classMap of groupedData.values()) {
      for (const seriesMap of classMap.values()) {
        for (const entry of seriesMap.values()) {
          sum += entry.gt;
        }
      }
    }
    return sum;
  }, [groupedData]);


  // ── Heatmap Data ────────────────────────────────────────────────────────────
  const dcrValues = useMemo(() => {
    const vals: number[] = [];
    const classMap = groupedData.get('DCR')!;
    for (const seriesMap of classMap.values()) {
      for (const entry of seriesMap.values()) {
        for (const qty of Object.values(entry.whQtys)) {
          if (qty > 0) vals.push(qty);
        }
      }
    }
    return vals.sort((a, b) => a - b);
  }, [groupedData]);

  const nonDcrValues = useMemo(() => {
    const vals: number[] = [];
    const classMap = groupedData.get('Non-DCR')!;
    for (const seriesMap of classMap.values()) {
      for (const entry of seriesMap.values()) {
        for (const qty of Object.values(entry.whQtys)) {
          if (qty > 0) vals.push(qty);
        }
      }
    }
    return vals.sort((a, b) => a - b);
  }, [groupedData]);

  // ── Match count for filter sheet ────────────────────────────────────────────
  const getMatchCount = useCallback((draft: SolarFilterState): number => {
    const q = debouncedSearch.toLowerCase().trim();
    const matching = items.filter(item => {
      if (q && !item.name.toLowerCase().includes(q) && !(item.sku || item.id).toLowerCase().includes(q))
        return false;
      if (draft.brands.length > 0 && !draft.brands.includes(item.brandId ?? item.brand ?? 'Unbranded'))
        return false;
      if (draft.dcrStatus.length > 0) {
        const status = item.isDcrEligible ? 'DCR' : 'Non-DCR';
        if (!draft.dcrStatus.includes(status)) return false;
      }
      if (draft.series.length > 0 && (!item.parentProductName || !draft.series.includes(item.parentProductName)))
        return false;
      if (draft.wattages.length > 0 && (!item.wattage || !draft.wattages.includes(item.wattage)))
        return false;
      return true;
    });

    const draftWhs = draft.warehouses.length > 0
      ? availableWarehouses.filter(w => draft.warehouses.includes(w.id))
      : availableWarehouses;

    const uniqueCards = new Set<string>();
    matching.forEach(item => {
      const hasStock = draftWhs.some(wh => (item.inventory[wh.id]?.qty || 0) > 0);
      if (hasStock) {
        const series = item.parentProductName?.trim() || '(NO SERIES)';
        const childKey = series === '(NO SERIES)' ? (item.sku || item.id) : (item.wattage?.trim() || 'Unknown');
        const classification = item.isDcrEligible ? 'DCR' : 'Non-DCR';
        uniqueCards.add(`${classification}|${series}|${childKey}`);
      }
    });
    return uniqueCards.size;
  }, [items, debouncedSearch, availableWarehouses]);

  // ── Actions: export raw data ────────────────────────────────────────────────
  const handleExportRawData = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const XLSX = await import('xlsx');
      const rows = filteredItems.map(item => {
        const row: Record<string, string | number> = {
          SKU: item.sku || item.id,
          'Product Name': item.name,
          Brand: item.brand ?? 'Unbranded',
          Series: item.parentProductName ?? '(NO SERIES)',
          Wattage: !item.parentProductName ? item.name : formatWattageDisplay(item.wattage),
          'DCR Status': item.isDcrEligible ? 'DCR' : 'Non-DCR',
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
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Solar Panel Stock');
      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `solar-panel-stock-raw-data-${dateStr}.xlsx`);
      toast.success('Export downloaded');
    } catch (e) {
      console.error('Export failed', e);
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  }, [filteredItems, relevantWarehouses, isExporting]);

  // ── Actions: screenshot / PDF ───────────────────────────────────────────────
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
      doc.text('KAMNA ERP — Solar Panel Stock', 14, 15);

      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Generated: ${formatStockDate(new Date())}`, 14, 22);

      const buildClassBody = (classification: 'DCR' | 'Non-DCR'): any[][] => {
        const classMap = groupedData.get(classification)!;
        const body: any[][] = [];

        // Classification header
        body.push([{
          content: classification === 'DCR' ? 'DCR Stock' : 'Non-DCR Stock',
          colSpan: relevantWarehouses.length + 2,
          styles: { fillColor: [26, 39, 102], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
        }]);

        Array.from(classMap.keys()).sort().forEach(series => {
          const seriesMap = classMap.get(series)!;

          // Series header
          body.push([{
            content: series,
            colSpan: relevantWarehouses.length + 2,
            styles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', halign: 'left' },
          }]);

          Array.from(seriesMap.entries())
            .sort(([, a], [, b]) => a.wattageNum - b.wattageNum)
            .forEach(([childKey, entry]) => {
              const labelCell = {
                content: `   ${entry.label}`,
                styles: { fillColor: [255, 255, 255], textColor: [50, 50, 50], halign: 'left' },
              };
              const whCells = relevantWarehouses.map(wh => ({
                content: entry.whQtys[wh.id] > 0 ? String(entry.whQtys[wh.id]) : '—',
                styles: { halign: 'center' },
              }));
              const gtCell = {
                content: String(entry.gt),
                styles: { fillColor: [230, 234, 255], textColor: [26, 39, 102], fontStyle: 'bold', halign: 'center' },
              };
              body.push([labelCell, ...whCells, gtCell]);
            });
        });

        return body;
      };

      const body: any[][] = [
        ...buildClassBody('DCR'),
        ...buildClassBody('Non-DCR'),
      ];

      autoTable(doc, {
        startY: 28,
        head: [['Series / Wattage', ...relevantWarehouses.map(w => w.name), 'Grand Total']],
        body,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2, lineWidth: 0.1, lineColor: [220, 220, 220] },
        headStyles: { fillColor: [248, 249, 251], textColor: [80, 80, 80], fontStyle: 'bold', halign: 'center' },
        columnStyles: { 0: { cellWidth: 55, halign: 'left' } },
        showHead: 'everyPage',
        margin: { top: 15, right: 10, bottom: 15, left: 10 },
      });

      doc.save('Solar_Panel_Stock_Mobile.pdf');
      toast.success('Report generated', { id: tid });
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate report', { id: tid });
    } finally {
      setIsScreenshotting(false);
    }
  }, [groupedData, relevantWarehouses, isScreenshotting]);

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderSection = (classification: 'DCR' | 'Non-DCR') => {
    const classMap = groupedData.get(classification)!;
    if (classMap.size === 0) return null;

    const sectionLabel = classification === 'DCR' ? 'DCR Stock' : 'Non-DCR Stock';
    const scaleValues = classification === 'DCR' ? dcrValues : nonDcrValues;
    const sectionColor = classification === 'DCR'
      ? 'text-green-700 bg-green-50 border-green-200'
      : 'text-slate-600 bg-slate-100 border-slate-200';

    const sortedSeries = Array.from(classMap.keys()).sort();

    return (
      <div key={classification} className="mb-6">
        {/* Section heading */}
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="h-px flex-1 bg-slate-200" />
          <span className={`text-[11px] font-black uppercase tracking-widest whitespace-nowrap px-2.5 py-1 border rounded-full ${sectionColor}`}>
            {sectionLabel}
          </span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {sortedSeries.map(series => {
          const seriesMap = classMap.get(series)!;
          const sortedWattages = Array.from(seriesMap.entries())
            .sort(([, a], [, b]) => a.wattageNum - b.wattageNum);

          return (
            <div key={series} className="mb-4">
              {/* Series sub-heading */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">
                  {series}
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {/* Wattage cards */}
              <div className="flex flex-col gap-2.5">
                {sortedWattages.map(([childKey, entry]) => {
                  const warehouseEntries = relevantWarehouses.map(wh => ({
                    wh,
                    qty: entry.whQtys[wh.id] || 0,
                  }));
                  return (
                    <WattageCard
                      key={`${classification}|${series}|${childKey}`}
                      wattage={entry.label}
                      grandTotal={entry.gt}
                      warehouseEntries={warehouseEntries}
                      scaleValues={scaleValues}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const isEmpty = groupedData.get('DCR')!.size === 0 && groupedData.get('Non-DCR')!.size === 0;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F8F9FB]">

      {/* Sticky action bar */}
      <div className="bg-[#1A2766] px-3 pt-1 pb-2 shrink-0 flex items-center justify-between">
        {/* Summary chips */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center bg-white/10 rounded-xl px-2.5 py-1.5">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider leading-none">SKUs</span>
            <span className="text-[14px] font-black text-white leading-none mt-0.5">{filteredItems.length}</span>
          </div>
          <div className="flex flex-col items-center bg-white/10 rounded-xl px-2.5 py-1.5">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider leading-none">Stock</span>
            <span className="text-[14px] font-black text-white leading-none mt-0.5">{totalStock.toLocaleString()}</span>
          </div>
          <div className="flex flex-col items-center bg-white/10 rounded-xl px-2.5 py-1.5">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider leading-none">WH</span>
            <span className="text-[14px] font-black text-white leading-none mt-0.5">{relevantWarehouses.length}</span>
          </div>
        </div>

        <OverflowMenu
          onRawData={handleExportRawData}
          onScreenshot={handleScreenshot}
          isExporting={isExporting}
          isScreenshotting={isScreenshotting}
        />
      </div>

      {/* Search + Filter row */}
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
              <div className="text-[15px] font-bold text-slate-600 mb-1">No solar panel stock found</div>
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
          <>
            {renderSection('DCR')}
            {renderSection('Non-DCR')}
          </>
        )}
      </div>

      {/* Filter bottom sheet */}
      <MobileSolarPanelFilterSheet
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        options={{
          warehouses: availableWarehouses.map(w => ({ id: w.id, name: w.name })),
          brands: availableBrands,
          series: availableSeries,
          wattages: availableWattages,
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
