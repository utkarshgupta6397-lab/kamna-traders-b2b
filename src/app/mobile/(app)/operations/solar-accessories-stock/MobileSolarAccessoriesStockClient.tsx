
'use client';
import { getSharedHeatmapStyle } from "@/components/CurrentStockShared";

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
// Types  (mirrors desktop SolarAccessoriesStockClient)
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
// Quantity formatter  (shared logic from desktop)
// ---------------------------------------------------------------------------

function formatQty(val: number | null | undefined, unit?: string): string {
  if (val === null || val === undefined || val <= 0) return '—';
  return unit ? `${val} ${unit}` : `${val}`;
}
// ---------------------------------------------------------------------------
// Overflow menu (three-dot) for actions
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
            className="flex items-center gap-3 w-full px-4 py-3.5 text-[14px] font-semibold text-slate-700 active:bg-slate-50 transition-colors disabled:opacity-50"
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(selectedWarehouses);
  }, [isOpen, selectedWarehouses]);

  const toggle = (id: string) =>
    setDraft(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-end">
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
// Category Card (collapsible, shows products when expanded)
// ---------------------------------------------------------------------------

interface CategoryCardProps {
  categoryName: string;
  products: {
    name: string;
    sku: string;
    unit: string;
    warehouseEntries: { wh: Warehouse; qty: number }[];
    grandTotal: number;
  }[];
  categoryGrandTotal: number;
  categoryUnit: string | undefined;  // undefined = mixed UOMs
  maxWhQty: number;
}

function CategoryCard({
  categoryName,
  products,
  categoryGrandTotal,
  categoryUnit,
  maxWhQty,
}: CategoryCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Category header — always visible */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 active:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-3">
          {expanded ? (
            <ChevronDown size={18} className="text-slate-400 shrink-0" />
          ) : (
            <ChevronRight size={18} className="text-slate-400 shrink-0" />
          )}
          <span className="font-bold text-[14px] text-slate-900 uppercase tracking-wide truncate">
            {categoryName}
          </span>
        </div>
        <div className="bg-[#1A2766] text-white rounded-xl px-2.5 py-1 flex items-center shrink-0">
          <span className="text-[14px] font-black leading-none whitespace-nowrap">
            {formatQty(categoryGrandTotal, categoryUnit)}
          </span>
        </div>
      </button>

      {/* Expanded product list */}
      {expanded && (
        <div className="border-t border-slate-100">
          {products.map(product => (
            <ProductRow
              key={product.sku}
              name={product.name}
              sku={product.sku}
              unit={product.unit}
              warehouseEntries={product.warehouseEntries}
              grandTotal={product.grandTotal}
              maxWhQty={maxWhQty}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product Row (inside expanded category)
// ---------------------------------------------------------------------------

interface ProductRowProps {
  name: string;
  sku: string;
  unit: string;
  warehouseEntries: { wh: Warehouse; qty: number }[];
  grandTotal: number;
  maxWhQty: number;
}

function ProductRow({ name, sku, unit, warehouseEntries, grandTotal, maxWhQty }: ProductRowProps) {
  const [expanded, setExpanded] = useState(false);
  const nonZeroEntries = warehouseEntries.filter(e => e.qty > 0);

  return (
    <div className="border-b border-slate-50 last:border-0">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 active:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-baseline gap-1.5 min-w-0 flex-1 mr-3 overflow-hidden">
          <span className="text-[13px] font-semibold text-slate-800 truncate">{name}</span>
          <span className="text-[10px] text-slate-400 font-mono shrink-0">— {sku}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[13px] font-bold text-[#1A2766] whitespace-nowrap">
            {formatQty(grandTotal, unit)}
          </span>
          {nonZeroEntries.length > 0 && (
            expanded ? (
              <ChevronUp size={14} className="text-slate-400" />
            ) : (
              <ChevronDown size={14} className="text-slate-400" />
            )
          )}
        </div>
      </button>

      {expanded && nonZeroEntries.length > 0 && (
        <div className="bg-slate-50/50">
          {nonZeroEntries.map(({ wh, qty }) => {
            const heatStyle = getSharedHeatmapStyle(qty, maxWhQty);
            return (
              <div
                key={wh.id}
                className="flex items-center justify-between px-6 py-2 border-b border-slate-50 last:border-0"
                style={heatStyle}
              >
                <span className="text-[12px] text-slate-600 font-medium leading-snug flex-1 min-w-0 pr-2">
                  {wh.name}
                </span>
                <span className="text-[13px] font-bold shrink-0 text-slate-800 whitespace-nowrap">
                  {formatQty(qty, unit)}
                </span>
              </div>
            );
          })}
        </div>
      )}
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

  const { categoryCards, totalStock, maxWhQty, globalUnit } = useMemo(() => {
    const root = new Map<string, {
      products: SkuItem[];
      cells: Record<string, number>;
      units: Set<string>;
    }>();
    const allUnits = new Set<string>();
    let overallTotal = 0;
    let maxWh = 0;

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
          maxWh = Math.max(maxWh, qty);
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
      maxWhQty: maxWh,
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

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F8F9FB]">

      {/* Sticky action bar */}
      <div className="bg-[#1A2766] px-3 pt-1 pb-2 shrink-0 flex items-center justify-between">
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
            <span className="text-[14px] font-black text-white leading-none mt-0.5 whitespace-nowrap">
              {globalUnit ? `${totalStock.toLocaleString()} ${globalUnit}` : totalStock.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col items-center bg-white/10 rounded-xl px-2.5 py-1.5">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider leading-none">
              WH
            </span>
            <span className="text-[14px] font-black text-white leading-none mt-0.5">
              {meaningfulWarehouses.length}
            </span>
          </div>
        </div>

        <OverflowMenu
          onRawData={handleExportRawData}
          isExporting={isExporting}
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
      </div>

      {/* Main scrollable list */}
      <div className="flex-1 overflow-y-auto px-3 pb-[env(safe-area-inset-bottom)] pb-6">
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
          <div className="flex flex-col gap-3">
            {/* Grand Total banner */}
            <div className="bg-[#1A2766] rounded-2xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench size={16} className="text-white/60" />
                <span className="text-[12px] font-bold text-white/70 uppercase tracking-wider">
                  Grand Total
                </span>
              </div>
              <span className="text-[16px] font-black text-white whitespace-nowrap">
                {globalUnit ? `${totalStock.toLocaleString()} ${globalUnit}` : totalStock.toLocaleString()}
              </span>
            </div>

            {/* Category cards */}
            {categoryCards.map(card => (
              <CategoryCard
                key={card.categoryName}
                categoryName={card.categoryName}
                products={card.products}
                categoryGrandTotal={card.categoryGrandTotal}
                categoryUnit={card.categoryUnit}
                maxWhQty={maxWhQty}
              />
            ))}
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
    </div>
  );
}
