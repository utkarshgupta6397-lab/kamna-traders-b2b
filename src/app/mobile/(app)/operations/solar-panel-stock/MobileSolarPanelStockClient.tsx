
'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  SlidersHorizontal,
  ChevronRight,
  X,
  MoreVertical,
  Download,
  Camera,
  Loader2,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatStockDate } from '@/lib/date-utils';
import { MobileSolarPanelFilterSheet, SolarFilterState } from './MobileSolarPanelFilterSheet';
import MobileSolarPanelDrilldownSheet, { SolarSeriesDetail } from './MobileSolarPanelDrilldownSheet';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Warehouse { id: string; name: string; isSystemWarehouse?: boolean; }
interface SkuInventory { [warehouseId: string]: { qty: number; isOos: boolean } }
interface SkuItem {
  id: string; name: string; brand?: string | null; brandId?: string | null;
  categoryId?: string | null; categoryName?: string | null; unit?: string | null;
  inventory: SkuInventory; sku?: string; isDcrEligible?: boolean;
  wattage?: string | null; parentProductId?: string | null; parentProductName?: string | null;
}

interface Props {
  warehouses: Warehouse[]; categories: any[]; brands: any[];
  items: SkuItem[]; canSync?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatWattageDisplay(raw: string | null | undefined): string {
  if (!raw || raw.trim() === '') return 'Unknown';
  const v = raw.trim();
  if (/^[\d.]+$/.test(v)) return `${v} W`;
  if (/\bW$/i.test(v)) return v;
  return v;
}

// ─── Overflow menu ────────────────────────────────────────────────────────────

interface OverflowMenuProps {
  onRawData: () => void; onScreenshot: () => void;
  isExporting: boolean; isScreenshotting: boolean;
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
      <button onClick={() => setOpen(v => !v)} className="p-2 rounded-full text-white/80 active:bg-white/10 transition-colors" aria-label="More actions">
        <MoreVertical size={22} strokeWidth={2.5} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-[200] w-48">
          <button onClick={() => { setOpen(false); onRawData(); }} disabled={isExporting} className="flex items-center gap-3 w-full px-4 py-3.5 text-[14px] font-semibold text-slate-700 active:bg-slate-50 transition-colors border-b border-slate-50 disabled:opacity-50">
            {isExporting ? <Loader2 size={16} className="animate-spin text-slate-400" /> : <Download size={16} className="text-green-600" />}
            Raw Data
          </button>
          <button onClick={() => { setOpen(false); onScreenshot(); }} disabled={isScreenshotting} className="flex items-center gap-3 w-full px-4 py-3.5 text-[14px] font-semibold text-slate-700 active:bg-slate-50 transition-colors disabled:opacity-50">
            {isScreenshotting ? <Loader2 size={16} className="animate-spin text-slate-400" /> : <Camera size={16} className="text-blue-600" />}
            Screenshot
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MobileSolarPanelStockClient({ warehouses, brands, items }: Props) {
  // ── State ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'DCR' | 'Non-DCR'>('DCR');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [drilldown, setDrilldown] = useState<SolarSeriesDetail | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isScreenshotting, setIsScreenshotting] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<SolarFilterState>({
    warehouses: [], brands: [], dcrStatus: [], series: [], wattages: [],
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Available warehouses ────────────────────────────────────────────────────
  const availableWarehouses = useMemo(() => {
    const valid = warehouses.filter(w => w.id && w.name && w.name.trim() !== '' && !w.isSystemWarehouse);
    const whMap = new Map<string, Warehouse>();
    valid.forEach(w => whMap.set(w.id, w));
    const activeIds = new Set<string>();
    items.forEach(item => {
      Object.entries(item.inventory).forEach(([whId, inv]) => {
        if (inv.qty > 0 && whMap.has(whId)) activeIds.add(whId);
      });
    });
    return Array.from(activeIds).map(id => whMap.get(id)!).sort((a, b) => a.name.localeCompare(b.name));
  }, [items, warehouses]);

  // ── Filter options ──────────────────────────────────────────────────────────
  const availableBrands = useMemo(() =>
    Array.from(new Map(items.map(i => [i.brandId ?? i.brand ?? 'Unbranded', i.brand ?? 'Unbranded'])).entries())
      .map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
  [items]);

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

  // ── Visible warehouses ──────────────────────────────────────────────────────
  const visibleWarehouses = useMemo(() =>
    appliedFilters.warehouses.length > 0
      ? availableWarehouses.filter(w => appliedFilters.warehouses.includes(w.id))
      : availableWarehouses,
  [availableWarehouses, appliedFilters.warehouses]);

  // ── Filtered SKUs ───────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    return items.filter(item => {
      if (q && !item.name.toLowerCase().includes(q) && !(item.sku || item.id).toLowerCase().includes(q)) return false;
      if (appliedFilters.brands.length > 0 && !appliedFilters.brands.includes(item.brandId ?? item.brand ?? 'Unbranded')) return false;
      if (appliedFilters.dcrStatus.length > 0) {
        const status = item.isDcrEligible ? 'DCR' : 'Non-DCR';
        if (!appliedFilters.dcrStatus.includes(status)) return false;
      }
      if (appliedFilters.series.length > 0 && (!item.parentProductName || !appliedFilters.series.includes(item.parentProductName))) return false;
      if (appliedFilters.wattages.length > 0 && (!item.wattage || !appliedFilters.wattages.includes(item.wattage))) return false;
      return true;
    });
  }, [items, debouncedSearch, appliedFilters]);

  const relevantWarehouses = useMemo(() =>
    visibleWarehouses.filter(wh => filteredItems.some(item => (item.inventory[wh.id]?.qty || 0) > 0)),
  [filteredItems, visibleWarehouses]);

  // ── Grouped data: Map<'DCR'|'Non-DCR', Map<series, Map<wattKey, entry>>> ────
  type WattageEntry = { whQtys: Record<string, number>; gt: number; wattageNum: number; label: string };
  type GroupedData = Map<'DCR' | 'Non-DCR', Map<string, Map<string, WattageEntry>>>;

  const groupedData = useMemo<GroupedData>(() => {
    const root: GroupedData = new Map([['DCR', new Map()], ['Non-DCR', new Map()]]);
    filteredItems.forEach(item => {
      const classification: 'DCR' | 'Non-DCR' = item.isDcrEligible ? 'DCR' : 'Non-DCR';
      const series = item.parentProductName?.trim() || '(NO SERIES)';
      let childKey: string, label: string, wattageNum: number;
      if (series === '(NO SERIES)') {
        childKey = item.sku || item.id; label = item.name; wattageNum = 0;
      } else {
        const wattage = item.wattage?.trim() || 'Unknown';
        childKey = wattage; label = formatWattageDisplay(wattage);
        wattageNum = wattage === 'Unknown' ? Infinity : (parseFloat(wattage) || Infinity);
      }
      const classMap = root.get(classification)!;
      if (!classMap.has(series)) classMap.set(series, new Map());
      const seriesMap = classMap.get(series)!;
      if (!seriesMap.has(childKey)) seriesMap.set(childKey, { whQtys: {}, gt: 0, wattageNum, label });
      const entry = seriesMap.get(childKey)!;
      relevantWarehouses.forEach(wh => {
        const qty = Math.max(0, item.inventory[wh.id]?.qty || 0);
        if (qty > 0) { entry.whQtys[wh.id] = (entry.whQtys[wh.id] || 0) + qty; entry.gt += qty; }
      });
    });
    // Prune empty
    for (const classMap of root.values()) {
      for (const [series, seriesMap] of classMap.entries()) {
        for (const [k, e] of seriesMap.entries()) { if (e.gt === 0) seriesMap.delete(k); }
        if (seriesMap.size === 0) classMap.delete(series);
      }
    }
    return root;
  }, [filteredItems, relevantWarehouses]);

  // ── KPIs ────────────────────────────────────────────────────────────────────
  // Compute per active tab
  const { tabTotalStock, tabSkuCount, tabWhCount } = useMemo(() => {
    const classMap = groupedData.get(activeTab)!;
    let total = 0, whSet = new Set<string>();
    let skus = new Set<string>();
    for (const seriesMap of classMap.values()) {
      for (const [k, e] of seriesMap.entries()) {
        total += e.gt;
        skus.add(k);
        Object.keys(e.whQtys).forEach(w => whSet.add(w));
      }
    }
    return { tabTotalStock: total, tabSkuCount: skus.size, tabWhCount: whSet.size };
  }, [groupedData, activeTab]);

  const activeFilterCount = appliedFilters.warehouses.length + appliedFilters.brands.length +
    appliedFilters.dcrStatus.length + appliedFilters.series.length + appliedFilters.wattages.length;

  const clearAll = useCallback(() => {
    setAppliedFilters({ warehouses: [], brands: [], dcrStatus: [], series: [], wattages: [] });
  }, []);

  // ── Row click → drilldown ───────────────────────────────────────────────────
  const handleSeriesClick = (classification: 'DCR' | 'Non-DCR', series: string) => {
    const classMap = groupedData.get(classification)!;
    const seriesMap = classMap.get(series);
    if (!seriesMap) return;

    let totalStock = 0;
    const wattages: SolarSeriesDetail['wattages'] = [];
    const warehouseTotals: Record<string, number> = {};

    Array.from(seriesMap.entries())
      .sort(([, a], [, b]) => a.wattageNum - b.wattageNum)
      .forEach(([key, entry]) => {
        totalStock += entry.gt;
        wattages.push({ key, label: entry.label, gt: entry.gt, whQtys: entry.whQtys });
        Object.entries(entry.whQtys).forEach(([whId, qty]) => {
          warehouseTotals[whId] = (warehouseTotals[whId] || 0) + qty;
        });
      });

    setDrilldown({
      seriesName: series,
      totalStock,
      wattages,
      warehouseTotals,
      warehouses: relevantWarehouses.filter(wh => (warehouseTotals[wh.id] || 0) > 0),
    });
  };

  // ── Export: raw data ────────────────────────────────────────────────────────
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
          row[wh.name] = qty; totalQty += qty;
        });
        row['Grand Total'] = totalQty;
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Solar Panel Stock');
      XLSX.writeFile(wb, `solar-panel-stock-raw-data-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Export downloaded');
    } catch (e) {
      console.error(e); toast.error('Export failed');
    } finally { setIsExporting(false); }
  }, [filteredItems, relevantWarehouses, isExporting]);

  // ── Export: PDF ─────────────────────────────────────────────────────────────
  const handleScreenshot = useCallback(async () => {
    if (isScreenshotting) return;
    setIsScreenshotting(true);
    const tid = toast.loading('Generating PDF…');
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
      doc.setFontSize(16); doc.setTextColor(26, 39, 102);
      doc.text('KAMNA ERP — Solar Panel Stock', 14, 15);
      doc.setFontSize(9); doc.setTextColor(100);
      doc.text(`Generated: ${formatStockDate(new Date())}`, 14, 22);

      const buildBody = (classification: 'DCR' | 'Non-DCR'): any[][] => {
        const classMap = groupedData.get(classification)!;
        const body: any[][] = [];
        body.push([{ content: classification === 'DCR' ? 'DCR Stock' : 'Non-DCR Stock', colSpan: relevantWarehouses.length + 2, styles: { fillColor: [26, 39, 102], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' } }]);
        Array.from(classMap.keys()).sort().forEach(series => {
          const seriesMap = classMap.get(series)!;
          body.push([{ content: series, colSpan: relevantWarehouses.length + 2, styles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', halign: 'left' } }]);
          Array.from(seriesMap.entries()).sort(([, a], [, b]) => a.wattageNum - b.wattageNum).forEach(([, entry]) => {
            const whCells = relevantWarehouses.map(wh => ({ content: entry.whQtys[wh.id] > 0 ? String(entry.whQtys[wh.id]) : '—', styles: { halign: 'center' } }));
            body.push([{ content: `   ${entry.label}`, styles: { halign: 'left' } }, ...whCells, { content: String(entry.gt), styles: { fillColor: [230, 234, 255], textColor: [26, 39, 102], fontStyle: 'bold', halign: 'center' } }]);
          });
        });
        return body;
      };

      autoTable(doc, {
        startY: 28,
        head: [['Series / Wattage', ...relevantWarehouses.map(w => w.name), 'Grand Total']],
        body: [...buildBody('DCR'), ...buildBody('Non-DCR')],
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2, lineWidth: 0.1, lineColor: [220, 220, 220] },
        headStyles: { fillColor: [248, 249, 251], textColor: [80, 80, 80], fontStyle: 'bold', halign: 'center' },
        columnStyles: { 0: { cellWidth: 55, halign: 'left' } },
        showHead: 'everyPage', margin: { top: 15, right: 10, bottom: 15, left: 10 },
      });

      doc.save('Solar_Panel_Stock_Mobile.pdf');
      toast.success('Report generated', { id: tid });
    } catch (err) {
      console.error(err); toast.error('Failed to generate report', { id: tid });
    } finally { setIsScreenshotting(false); }
  }, [groupedData, relevantWarehouses, isScreenshotting]);

  // ── Current tab list ────────────────────────────────────────────────────────
  const activeClassMap = groupedData.get(activeTab)!;
  const sortedSeries = Array.from(activeClassMap.keys()).sort();

  // Series total per entry
  const seriesTotals = useMemo(() => {
    const m: Record<string, number> = {};
    const classMap = groupedData.get(activeTab)!;
    for (const [series, seriesMap] of classMap.entries()) {
      let t = 0;
      for (const e of seriesMap.values()) t += e.gt;
      m[series] = t;
    }
    return m;
  }, [groupedData, activeTab]);

  const isEmpty = activeClassMap.size === 0;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F8F9FB]">

      {/* Sticky action bar */}
      <div className="bg-[#1A2766] px-3 pt-1 pb-2 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center bg-white/10 rounded-xl px-2.5 py-1.5">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider leading-none">SKUs</span>
            <span className="text-[14px] font-black text-white leading-none mt-0.5">{tabSkuCount}</span>
          </div>
          <div className="flex flex-col items-center bg-white/10 rounded-xl px-2.5 py-1.5">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider leading-none">Stock</span>
            <span className="text-[14px] font-black text-white leading-none mt-0.5">{tabTotalStock.toLocaleString()}</span>
          </div>
          <div className="flex flex-col items-center bg-white/10 rounded-xl px-2.5 py-1.5">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider leading-none">WH</span>
            <span className="text-[14px] font-black text-white leading-none mt-0.5">{tabWhCount}</span>
          </div>
        </div>
        <OverflowMenu onRawData={handleExportRawData} onScreenshot={handleScreenshot} isExporting={isExporting} isScreenshotting={isScreenshotting} />
      </div>

      {/* KPI cards — Wire & Cable style */}
      <div className="grid grid-cols-3 gap-2 p-3 pb-0 shrink-0">
        <div className="bg-white rounded-[14px] p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col justify-center">
          <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">SKUs</div>
          <div className="text-lg font-black text-slate-800 leading-none">{tabSkuCount}</div>
        </div>
        <div className="bg-white rounded-[14px] p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col justify-center">
          <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Total Stock</div>
          <div className="text-lg font-black text-blue-600 leading-none">
            {tabTotalStock.toLocaleString()}
            <span className="text-[10px] font-bold ml-1 text-blue-400">pcs</span>
          </div>
        </div>
        <div className="bg-white rounded-[14px] p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col justify-center">
          <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Warehouses</div>
          <div className="text-lg font-black text-slate-800 leading-none">{tabWhCount}</div>
        </div>
      </div>

      {/* DCR / Non-DCR tab switcher */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="bg-white rounded-xl border border-slate-200 p-1 flex">
          <button
            onClick={() => setActiveTab('DCR')}
            className={`flex-1 py-2 text-[12px] font-bold rounded-lg transition-all ${activeTab === 'DCR' ? 'bg-[#1A2766] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            DCR Stock
          </button>
          <button
            onClick={() => setActiveTab('Non-DCR')}
            className={`flex-1 py-2 text-[12px] font-bold rounded-lg transition-all ${activeTab === 'Non-DCR' ? 'bg-[#1A2766] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Non-DCR Stock
          </button>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="px-3 pb-3 shrink-0">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search product or SKU..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 bg-white border border-slate-200 text-slate-800 text-[13px] rounded-xl h-10 focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] transition-shadow"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setFiltersOpen(true)}
            className={`relative w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${activeFilterCount > 0 ? 'bg-[#1A2766]/10 border-[#1A2766]/30 text-[#1A2766]' : 'bg-white border-slate-200 text-slate-600'}`}
          >
            <SlidersHorizontal size={18} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#1A2766] text-white text-[9px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Series list — Wire & Cable table hierarchy style */}
      <div className="flex-1 overflow-y-auto bg-white rounded-t-2xl shadow-[0_-4px_12px_rgba(0,0,0,0.02)] border-t border-slate-200 relative min-h-0">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400 p-6 text-center">
            <AlertTriangle size={36} className="text-slate-300" />
            <div>
              <div className="text-[15px] font-bold text-slate-600 mb-1">No {activeTab} stock found</div>
              <p className="text-[13px]">Try adjusting your filters or search terms.</p>
            </div>
            {activeFilterCount > 0 && (
              <button onClick={clearAll} className="mt-2 text-[13px] font-bold text-[#1A2766] active:opacity-60">
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-40 bg-white">
              <tr className="h-[42px]">
                <th className="px-4 bg-slate-50 border-b border-slate-200 font-bold text-[11px] text-slate-500 uppercase tracking-wider w-[65%]">
                  Series
                </th>
                <th className="px-4 bg-slate-50 border-b border-slate-200 font-bold text-[11px] text-slate-500 uppercase tracking-wider text-right w-[35%]">
                  Total Stock
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedSeries.map((series, idx) => {
                const seriesTotal = seriesTotals[series] || 0;
                const isLast = idx === sortedSeries.length - 1;
                return (
                  <tr
                    key={series}
                    onClick={() => handleSeriesClick(activeTab, series)}
                    className={`active:bg-blue-50/50 transition-colors cursor-pointer ${!isLast ? 'border-b border-slate-100' : ''} bg-white`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[#1A2766]/5 border border-[#1A2766]/10 flex items-center justify-center shrink-0">
                          <Zap size={13} className="text-[#1A2766]/60" />
                        </div>
                        <span className="font-semibold text-[13px] text-slate-800 leading-snug">{series}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="font-bold text-[14px] text-slate-900">{seriesTotal.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">pcs</span>
                        <ChevronRight size={14} className="text-slate-300 ml-0.5 shrink-0" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
        onApply={filters => { setAppliedFilters(filters); setFiltersOpen(false); }}
        getMatchCount={useCallback((draft: SolarFilterState) => {
          const q = debouncedSearch.toLowerCase().trim();
          const matching = items.filter(item => {
            if (q && !item.name.toLowerCase().includes(q) && !(item.sku || item.id).toLowerCase().includes(q)) return false;
            if (draft.brands.length > 0 && !draft.brands.includes(item.brandId ?? item.brand ?? 'Unbranded')) return false;
            if (draft.dcrStatus.length > 0) {
              const status = item.isDcrEligible ? 'DCR' : 'Non-DCR';
              if (!draft.dcrStatus.includes(status)) return false;
            }
            if (draft.series.length > 0 && (!item.parentProductName || !draft.series.includes(item.parentProductName))) return false;
            if (draft.wattages.length > 0 && (!item.wattage || !draft.wattages.includes(item.wattage))) return false;
            return true;
          });
          const draftWhs = draft.warehouses.length > 0
            ? availableWarehouses.filter(w => draft.warehouses.includes(w.id)) : availableWarehouses;
          const unique = new Set<string>();
          matching.forEach(item => {
            const hasStock = draftWhs.some(wh => (item.inventory[wh.id]?.qty || 0) > 0);
            if (hasStock) {
              const series = item.parentProductName?.trim() || '(NO SERIES)';
              const childKey = series === '(NO SERIES)' ? (item.sku || item.id) : (item.wattage?.trim() || 'Unknown');
              unique.add(`${item.isDcrEligible ? 'DCR' : 'Non-DCR'}|${series}|${childKey}`);
            }
          });
          return unique.size;
        }, [items, debouncedSearch, availableWarehouses])}
      />

      {/* Series drilldown sheet */}
      <MobileSolarPanelDrilldownSheet
        data={drilldown}
        onClose={() => setDrilldown(null)}
      />
    </div>
  );
}
