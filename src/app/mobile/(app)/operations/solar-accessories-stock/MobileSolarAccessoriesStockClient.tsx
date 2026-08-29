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
  Loader2,
  AlertTriangle,
  Wrench,
} from 'lucide-react';

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
  categoryName?: string | null;
  unit?: string | null;
  inventory: SkuInventory;
  sku?: string;
}

interface Props {
  warehouses: Warehouse[];
  items: SkuItem[];
}

// ---------------------------------------------------------------------------
// Formatter
// ---------------------------------------------------------------------------

function formatQty(val: number | null | undefined, unit?: string): string {
  if (val === null || val === undefined || val <= 0) return '—';
  return unit ? `${val.toLocaleString()} ${unit}` : `${val.toLocaleString()}`;
}

// ---------------------------------------------------------------------------
// Overflow menu
// ---------------------------------------------------------------------------

interface OverflowMenuProps {
  onRawData: () => void;
  isExporting: boolean;
}

function OverflowMenu({ onRawData, isExporting }: OverflowMenuProps) {
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
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter bottom sheet
// ---------------------------------------------------------------------------

interface FilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  warehouseOptions: { id: string; name: string }[];
  selectedWarehouses: string[];
  onApply: (warehouses: string[]) => void;
}

function MobileFilterSheet({ isOpen, onClose, warehouseOptions, selectedWarehouses, onApply }: FilterSheetProps) {
  const [draft, setDraft] = useState<string[]>(selectedWarehouses);

  useEffect(() => {
    setDraft(selectedWarehouses);
  }, [isOpen, selectedWarehouses]);

  const toggle = (id: string) =>
    setDraft(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-3xl shadow-2xl max-h-[70vh] flex flex-col pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
          <span className="text-[16px] font-bold text-slate-900">Filters</span>
          <button onClick={onClose} className="p-2 -mr-2 text-slate-400 active:opacity-60">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Warehouses</div>
          <div className="flex flex-col gap-2">
            {warehouseOptions.map(wh => (
              <button
                key={wh.id}
                onClick={() => toggle(wh.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                  draft.includes(wh.id)
                    ? 'bg-[#1A2766]/5 border-[#1A2766]/30 text-[#1A2766]'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                  draft.includes(wh.id) ? 'bg-[#1A2766] border-[#1A2766]' : 'border-slate-300'
                }`}>
                  {draft.includes(wh.id) && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </div>
                <span className="text-[14px] font-medium">{wh.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
          <button
            onClick={() => { setDraft([]); }}
            className="flex-1 py-3 text-[14px] font-bold text-slate-600 bg-slate-100 rounded-xl active:bg-slate-200 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => { onApply(draft); onClose(); }}
            className="flex-1 py-3 text-[14px] font-bold text-white bg-[#1A2766] rounded-xl active:bg-[#1A2766]/90 transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drilldown Sheet (Category Detail)
// ---------------------------------------------------------------------------

interface CategoryData {
  categoryName: string;
  products: {
    name: string;
    sku: string;
    unit: string;
    warehouseEntries: { wh: Warehouse; qty: number }[];
    grandTotal: number;
  }[];
  categoryTotals: Record<string, number>;
  categoryGrandTotal: number;
  categoryUnit: string | undefined;
}

function ProductRow({ product }: { product: CategoryData['products'][0] }) {
  const [expanded, setExpanded] = useState(false);
  const activeEntries = product.warehouseEntries.filter(e => e.qty > 0);

  return (
    <div className="bg-white rounded-[14px] border border-slate-200 shadow-sm overflow-hidden mb-2.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3.5 active:bg-slate-50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0 pr-3">
          <div className="font-bold text-[14px] text-slate-800 break-words leading-snug">
            {product.name}
          </div>
          {product.sku && (
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              {product.sku}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-baseline gap-1 text-right">
            <span className="font-black text-[15px] text-slate-900">{product.grandTotal.toLocaleString()}</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase">{product.unit || 'pcs'}</span>
          </div>
          {expanded ? (
            <ChevronUp size={16} className="text-slate-400" />
          ) : (
            <ChevronDown size={16} className="text-slate-400" />
          )}
        </div>
      </button>

      {expanded && activeEntries.length > 0 && (
        <div className="bg-slate-50 border-t border-slate-100 px-4 py-3 flex flex-col gap-2">
          {activeEntries.map(({ wh, qty }) => (
            <div key={wh.id} className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-slate-600">{wh.name}</span>
              <div className="flex items-baseline gap-1 shrink-0">
                <span className="text-[14px] font-bold text-slate-800">{qty.toLocaleString()}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{product.unit || 'pcs'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CategorySheet({ data, onClose, allWarehouses }: { data: CategoryData | null; onClose: () => void; allWarehouses: Warehouse[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [renderData, setRenderData] = useState<CategoryData | null>(null);
  const [activeTab, setActiveTab] = useState<'Products / SKUs' | 'By Warehouse'>('Products / SKUs');

  useEffect(() => {
    if (data) {
      setRenderData(data);
      setActiveTab('Products / SKUs');
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

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col justify-end bg-black/40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      onClick={handleClose}
    >
      <div
        className={`bg-[#F8F9FB] w-full max-h-[92dvh] rounded-t-2xl shadow-xl flex flex-col transition-transform duration-300 pb-[env(safe-area-inset-bottom)] ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white rounded-t-2xl px-5 pt-4 pb-4 border-b border-slate-200 shrink-0 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-slate-900 text-[18px] tracking-tight leading-snug break-words">
                {d.categoryName}
              </h3>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="font-black text-[#1A2766] text-[20px] leading-none">{d.categoryGrandTotal.toLocaleString()}</span>
                <span className="text-[11px] font-bold text-slate-400 uppercase">{d.categoryUnit || 'pcs'} total</span>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors shrink-0 -mr-1 mt-0.5"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>

          {/* Segmented Control */}
          <div className="mt-4 bg-[#F8F9FB] rounded-xl border border-slate-200 p-1 flex">
            {(['Products / SKUs', 'By Warehouse'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-[12px] font-bold rounded-lg transition-all ${
                  activeTab === tab
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
          {activeTab === 'Products / SKUs' ? (
            <div>
              {d.products.length === 0 ? (
                <div className="text-center text-slate-400 text-[13px] py-8">No products found</div>
              ) : (
                d.products.map(product => (
                  <ProductRow key={product.sku} product={product} />
                ))
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {allWarehouses
                .map(wh => ({ wh, qty: d.categoryTotals[wh.id] || 0 }))
                .filter(e => e.qty > 0)
                .map(({ wh, qty }) => (
                  <div
                    key={wh.id}
                    className="bg-white rounded-[14px] border border-slate-200 shadow-sm flex items-center justify-between px-4 py-3"
                  >
                    <span className="font-semibold text-[14px] text-slate-700 flex-1 min-w-0 pr-4 break-words leading-snug">
                      {wh.name}
                    </span>
                    <div className="flex items-baseline gap-1 shrink-0">
                      <span className="font-black text-[16px] text-slate-900 leading-none">{qty.toLocaleString()}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{d.categoryUnit || 'pcs'}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export default function MobileSolarAccessoriesStockClient({ warehouses, items }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [drilldown, setDrilldown] = useState<CategoryData | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Operational (non-system) warehouses
  const operationalWarehouses = useMemo(
    () => warehouses.filter(w => !w.isSystemWarehouse),
    [warehouses]
  );

  // Filtered items
  const filteredItems = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    return items.filter(item => {
      if (q && !item.name.toLowerCase().includes(q) && !(item.sku || item.id).toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [items, debouncedSearch]);

  // Visible warehouses (filtered or all operational)
  const visibleWarehouses = useMemo(
    () =>
      selectedWarehouses.length > 0
        ? operationalWarehouses.filter(w => selectedWarehouses.includes(w.id))
        : operationalWarehouses,
    [operationalWarehouses, selectedWarehouses]
  );

  // Warehouses with actual stock in filtered items
  const meaningfulWarehouses = useMemo(
    () =>
      visibleWarehouses.filter(wh =>
        filteredItems.some(item => (item.inventory[wh.id]?.qty || 0) > 0)
      ),
    [filteredItems, visibleWarehouses]
  );

  // ---------------------------------------------------------------------------
  // Grouped data: Category → Products with UOM-safe totals
  // ---------------------------------------------------------------------------

  const { categoryCards, totalStock, globalUnit } = useMemo(() => {
    const root = new Map<string, {
      products: SkuItem[];
      cells: Record<string, number>;
      units: Set<string>;
    }>();
    const allUnits = new Set<string>();
    let overallTotal = 0;

    filteredItems.forEach(item => {
      const cat = item.categoryName?.trim() || 'Uncategorized';
      if (!root.has(cat)) root.set(cat, { products: [], cells: {}, units: new Set() });
      const catData = root.get(cat)!;
      catData.products.push(item);

      const itemUnit = item.unit || 'pcs';
      catData.units.add(itemUnit);
      allUnits.add(itemUnit);

      meaningfulWarehouses.forEach(wh => {
        const qty = Math.max(0, item.inventory[wh.id]?.qty || 0);
        if (qty > 0) {
          catData.cells[wh.id] = (catData.cells[wh.id] || 0) + qty;
          catData.cells['GT'] = (catData.cells['GT'] || 0) + qty;
          overallTotal += qty;
        }
      });
    });

    const cards = Array.from(root.entries())
      .filter(([, data]) => (data.cells['GT'] || 0) > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([catName, catData]) => {
        const catUnit = catData.units.size === 1 ? Array.from(catData.units)[0] : undefined;

        const products = catData.products
          .map(item => {
            const itemUnit = item.unit || 'pcs';
            let gt = 0;
            const warehouseEntries = meaningfulWarehouses.map(wh => {
              const qty = Math.max(0, item.inventory[wh.id]?.qty || 0);
              gt += qty;
              return { wh, qty };
            });
            return {
              name: item.name,
              sku: item.sku || item.id,
              unit: itemUnit,
              warehouseEntries,
              grandTotal: gt,
            };
          })
          .filter(p => p.grandTotal > 0)
          .sort((a, b) => a.name.localeCompare(b.name));

        return {
          categoryName: catName,
          products,
          categoryTotals: catData.cells,
          categoryGrandTotal: catData.cells['GT'] || 0,
          categoryUnit: catUnit,
        };
      });

    return {
      categoryCards: cards,
      totalStock: overallTotal,
      globalUnit: allUnits.size === 1 ? Array.from(allUnits)[0] : undefined,
    };
  }, [filteredItems, meaningfulWarehouses]);

  // ---------------------------------------------------------------------------
  // Export
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
          UOM: item.unit || 'pcs',
        };
        let totalQty = 0;
        meaningfulWarehouses.forEach(wh => {
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
      XLSX.writeFile(workbook, `solar-accessories-stock-${dateStr}.xlsx`);
    } catch (e) {
      console.error('Export failed', e);
    } finally {
      setIsExporting(false);
    }
  }, [filteredItems, meaningfulWarehouses, isExporting]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isEmpty = categoryCards.length === 0;
  const activeSkuCount = filteredItems.length;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F8F9FB]">

      {/* KPI cards — Wire & Cable style */}
      <div className="grid grid-cols-3 gap-2 p-3 pb-0 shrink-0">
        <div className="bg-white rounded-[14px] p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col justify-center">
          <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">SKUs</div>
          <div className="text-lg font-black text-slate-800 leading-none">{activeSkuCount}</div>
        </div>
        <div className="bg-white rounded-[14px] p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col justify-center">
          <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Total Stock</div>
          <div className="text-lg font-black text-blue-600 leading-none truncate">
            {totalStock.toLocaleString()}
            <span className="text-[10px] font-bold ml-1 text-blue-400">{globalUnit || 'pcs'}</span>
          </div>
        </div>
        <div className="bg-white rounded-[14px] p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col justify-center">
          <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Warehouses</div>
          <div className="text-lg font-black text-slate-800 leading-none">{meaningfulWarehouses.length}</div>
        </div>
      </div>

      {/* Search + Filters row + Overflow menu */}
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
            selectedWarehouses.length > 0
              ? 'bg-[#1A2766]/10 border-[#1A2766]/30 text-[#1A2766]'
              : 'bg-white border-slate-200 text-slate-600'
          }`}
          aria-label="Open filters"
        >
          <SlidersHorizontal size={18} />
          {selectedWarehouses.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-[#1A2766] text-white text-[9px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
              {selectedWarehouses.length}
            </span>
          )}
        </button>
        <OverflowMenu
          onRawData={handleExportRawData}
          isExporting={isExporting}
        />
      </div>

      {/* Main scrollable list */}
      <div className="flex-1 overflow-y-auto px-3 pb-[env(safe-area-inset-bottom)] pb-6 min-h-0">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 text-slate-400 py-16 text-center">
            <AlertTriangle size={36} className="text-slate-300" />
            <div>
              <div className="text-[15px] font-bold text-slate-600 mb-1">
                No accessories stock found
              </div>
              <p className="text-[13px]">Try adjusting your search or filters.</p>
            </div>
            {selectedWarehouses.length > 0 && (
              <button
                onClick={() => setSelectedWarehouses([])}
                className="mt-2 text-[13px] font-bold text-[#1A2766] active:opacity-60"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 mt-1">
            {/* Grand Total banner */}
            <div className="bg-[#1A2766] rounded-[14px] px-4 py-3.5 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <Wrench size={18} className="text-white/60" />
                <span className="text-[13px] font-bold text-white/70 uppercase tracking-wider">
                  Grand Total
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[18px] font-black text-white leading-none">
                  {totalStock.toLocaleString()}
                </span>
                <span className="text-[10px] font-bold text-white/70 uppercase">{globalUnit || 'pcs'}</span>
              </div>
            </div>

            {/* Category cards */}
            <div className="flex flex-col gap-2">
              {categoryCards.map(card => (
                <button
                  key={card.categoryName}
                  onClick={() => setDrilldown(card)}
                  className="w-full bg-white rounded-[14px] border border-slate-200 shadow-sm flex items-center justify-between px-4 py-3.5 active:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
                    <ChevronRight size={18} className="text-slate-300 shrink-0" />
                    <span className="font-bold text-[14px] text-slate-800 truncate">
                      {card.categoryName}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 shrink-0">
                    <span className="text-[15px] font-black text-[#1A2766] whitespace-nowrap leading-none">
                      {card.categoryGrandTotal.toLocaleString()}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">{card.categoryUnit || 'pcs'}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filter bottom sheet */}
      <MobileFilterSheet
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        warehouseOptions={operationalWarehouses}
        selectedWarehouses={selectedWarehouses}
        onApply={setSelectedWarehouses}
      />

      {/* Category Drilldown bottom sheet */}
      <CategorySheet
        data={drilldown}
        onClose={() => setDrilldown(null)}
        allWarehouses={meaningfulWarehouses}
      />
    </div>
  );
}
