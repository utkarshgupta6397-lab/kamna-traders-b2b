'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, SlidersHorizontal, ChevronDown, Check, AlertTriangle } from 'lucide-react';
import MobileWireCableDrilldownSheet, { MobileWireCableDrilldownData } from './MobileWireCableDrilldownSheet';

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
  items: SkuItem[];
}

// Helpers from desktop component
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

const NativeSelect = ({ label, value, options, onChange }: { label: string, value: string, options: {id: string, name: string}[], onChange: (val: string) => void }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full appearance-none bg-white border border-slate-200 text-slate-800 text-[13px] rounded-xl px-3 py-2.5 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium transition-shadow"
    >
      <option value="">All {label}</option>
      {options.map(opt => (
        <option key={opt.id} value={opt.id}>{opt.name}</option>
      ))}
    </select>
    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
  </div>
);

export default function MobileWireCableStockClient({ warehouses, items }: Props) {
  const [measurementUnit, setMeasurementUnit] = useState<'mtr' | 'bdls'>('mtr');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedWireType, setSelectedWireType] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedWidth, setSelectedWidth] = useState('');
  const [selectedColor, setSelectedColor] = useState('');

  const [drilldownData, setDrilldownData] = useState<MobileWireCableDrilldownData | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const operationalWarehouses = useMemo(() => warehouses.filter(w => !w.isSystemWarehouse), [warehouses]);

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
      if (selectedBrand && item.brand !== selectedBrand) return false;
      if (selectedWireType && item.wireType !== selectedWireType) return false;
      if (selectedWidth && item.normalizedWidth !== selectedWidth) return false;
      if (selectedColor && item.normalizedColor !== selectedColor) return false;
      return true;
    });
  }, [processedItems, debouncedSearch, selectedBrand, selectedWireType, selectedWidth, selectedColor]);

  const visibleWarehouses = useMemo(() => selectedWarehouseId ? operationalWarehouses.filter(w => w.id === selectedWarehouseId) : operationalWarehouses, [operationalWarehouses, selectedWarehouseId]);

  const meaningfulWarehouses = useMemo(() => visibleWarehouses.filter(wh => filteredItems.some(item => (item.inventory[wh.id]?.qty || 0) > 0)), [filteredItems, visibleWarehouses]);

  // Hierarchical aggregation: Sub-category -> Brand -> Width
  const { tableData, totalPhysical, totalBundle, activeWhCount } = useMemo(() => {
    const root = new Map<string, Map<string, Map<string, {
      bundleSizeStr: string | null;
      physical: number;
      bundle: number;
      hasNA: boolean;
      // Needed for drilldown:
      items: typeof filteredItems;
    }>>>();

    let gtTotalP = 0;
    let gtTotalB = 0;
    const activeWhs = new Set<string>();

    filteredItems.forEach(item => {
      const type = item.wireType;
      const brand = item.brand || 'Unbranded';
      const width = item.normalizedWidth;
      
      const bSize = parseFloat(item.bundleLength || '0');
      const isNA = bSize <= 0;

      if (!root.has(type)) root.set(type, new Map());
      const tMap = root.get(type)!;
      
      if (!tMap.has(brand)) tMap.set(brand, new Map());
      const bMap = tMap.get(brand)!;
      
      if (!bMap.has(width)) {
        bMap.set(width, { 
          bundleSizeStr: item.bundleLength ? `${item.bundleLength} mtr` : null,
          physical: 0,
          bundle: 0,
          hasNA: false,
          items: []
        });
      } else if (item.bundleLength && !bMap.get(width)!.bundleSizeStr) {
        bMap.get(width)!.bundleSizeStr = `${item.bundleLength} mtr`;
      }
      
      const wObj = bMap.get(width)!;
      wObj.items.push(item);

      let itemPhysical = 0;
      let itemBundle = 0;

      meaningfulWarehouses.forEach(wh => {
        const qty = Math.max(0, item.inventory[wh.id]?.qty || 0);
        if (qty > 0) {
          activeWhs.add(wh.id);
          const bQty = isNA ? 0 : qty / bSize;
          
          itemPhysical += qty;
          itemBundle += bQty;
        }
      });

      if (itemPhysical > 0) {
        wObj.physical += itemPhysical;
        wObj.bundle += itemBundle;
        if (isNA) wObj.hasNA = true;

        gtTotalP += itemPhysical;
        gtTotalB += itemBundle;
      }
    });

    return { 
      tableData: root, 
      totalPhysical: gtTotalP, 
      totalBundle: gtTotalB,
      activeWhCount: activeWhs.size
    };
  }, [filteredItems, meaningfulWarehouses]);

  const handleRowClick = (subCategory: string, brand: string, width: string, wObj: any) => {
    // Compute matrix for drilldown
    const matrix: Record<string, Record<string, { physical: number; bundle: number; hasNA: boolean }>> = {};
    const colTotals: Record<string, { physical: number; bundle: number; hasNA: boolean }> = {};
    const rowTotals: Record<string, { physical: number; bundle: number; hasNA: boolean }> = {};
    const grandTotal = { physical: 0, bundle: 0, hasNA: false };

    wObj.items.forEach((item: typeof filteredItems[0]) => {
      const color = item.normalizedColor;
      const bSize = parseFloat(item.bundleLength || '0');
      const isNA = bSize <= 0;

      if (!matrix[color]) matrix[color] = {};
      if (!rowTotals[color]) rowTotals[color] = { physical: 0, bundle: 0, hasNA: false };

      meaningfulWarehouses.forEach(wh => {
        const qty = Math.max(0, item.inventory[wh.id]?.qty || 0);
        if (qty > 0) {
          const bQty = isNA ? 0 : qty / bSize;

          if (!matrix[color][wh.id]) matrix[color][wh.id] = { physical: 0, bundle: 0, hasNA: false };
          if (!colTotals[wh.id]) colTotals[wh.id] = { physical: 0, bundle: 0, hasNA: false };

          matrix[color][wh.id].physical += qty;
          matrix[color][wh.id].bundle += bQty;
          if (isNA) matrix[color][wh.id].hasNA = true;

          colTotals[wh.id].physical += qty;
          colTotals[wh.id].bundle += bQty;
          if (isNA) colTotals[wh.id].hasNA = true;

          rowTotals[color].physical += qty;
          rowTotals[color].bundle += bQty;
          if (isNA) rowTotals[color].hasNA = true;

          grandTotal.physical += qty;
          grandTotal.bundle += bQty;
          if (isNA) grandTotal.hasNA = true;
        }
      });
    });

    setDrilldownData({
      subCategory,
      brand,
      width,
      bundleSizeStr: wObj.bundleSizeStr,
      matrix,
      colTotals,
      rowTotals,
      grandTotal,
      warehouses: meaningfulWarehouses.filter(wh => colTotals[wh.id]?.physical > 0)
    });
  };

  const displayUnit = measurementUnit === 'bdls' ? 'bdls' : 'mtr';

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F8F9FB]">
      
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2 p-3 pb-2 shrink-0">
        <div className="bg-white rounded-[14px] p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col justify-center">
          <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1 line-clamp-1">Active SKUs</div>
          <div className="text-lg font-black text-slate-800 leading-none">{filteredItems.length}</div>
        </div>
        <div className="bg-white rounded-[14px] p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col justify-center">
          <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1 line-clamp-1">Total Stock</div>
          <div className="text-lg font-black text-blue-600 leading-none">
            {measurementUnit === 'bdls' ? totalBundle.toLocaleString(undefined, { maximumFractionDigits: 1 }) : totalPhysical.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            <span className="text-[10px] font-bold ml-1 text-blue-400">{displayUnit}</span>
          </div>
        </div>
        <div className="bg-white rounded-[14px] p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col justify-center">
          <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1 line-clamp-1">Warehouses</div>
          <div className="text-lg font-black text-slate-800 leading-none">{activeWhCount}</div>
        </div>
      </div>

      {/* Measurement Toggle */}
      <div className="px-3 pb-3 shrink-0">
        <div className="bg-white rounded-xl border border-slate-200 p-1 flex">
          <button
            onClick={() => setMeasurementUnit('mtr')}
            className={`flex-1 py-2 text-[12px] font-bold rounded-lg transition-all ${measurementUnit === 'mtr' ? 'bg-[#1A2766] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Physical Stock (MTR)
          </button>
          <button
            onClick={() => setMeasurementUnit('bdls')}
            className={`flex-1 py-2 text-[12px] font-bold rounded-lg transition-all ${measurementUnit === 'bdls' ? 'bg-[#1A2766] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Bundle Stock (BDLS)
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-3 pb-3 flex flex-col gap-2 shrink-0">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search product or SKU..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 bg-white border border-slate-200 text-slate-800 text-[13px] rounded-xl h-10 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow" 
            />
          </div>
          <button 
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors shrink-0 ${filtersOpen || selectedWarehouseId || selectedWireType || selectedBrand || selectedWidth || selectedColor ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-600'}`}
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>
        
        {filtersOpen && (
          <div className="grid grid-cols-2 gap-2 mt-1 animate-in slide-in-from-top-2 fade-in duration-200">
            <NativeSelect label="Warehouses" value={selectedWarehouseId} options={operationalWarehouses.map(w => ({ id: w.id, name: w.name }))} onChange={setSelectedWarehouseId} />
            <NativeSelect label="Types" value={selectedWireType} options={availableWireTypes} onChange={setSelectedWireType} />
            <NativeSelect label="Brands" value={selectedBrand} options={availableBrands} onChange={setSelectedBrand} />
            <NativeSelect label="Widths" value={selectedWidth} options={availableWidths} onChange={setSelectedWidth} />
            <NativeSelect label="Colors" value={selectedColor} options={availableColors} onChange={setSelectedColor} />
            
            {(selectedWarehouseId || selectedWireType || selectedBrand || selectedWidth || selectedColor) && (
              <button 
                onClick={() => { setSelectedWarehouseId(''); setSelectedWireType(''); setSelectedBrand(''); setSelectedWidth(''); setSelectedColor(''); }}
                className="h-[42px] bg-slate-100 hover:bg-slate-200 text-slate-600 text-[13px] font-bold rounded-xl transition-colors flex items-center justify-center"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="flex-1 overflow-y-auto bg-white rounded-t-2xl shadow-[0_-4px_12px_rgba(0,0,0,0.02)] border-t border-slate-200 relative min-h-0">
        {(!meaningfulWarehouses.length || filteredItems.length === 0) ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400 p-6 text-center">
            <AlertTriangle size={36} className="text-slate-300" />
            <div>
              <div className="text-[15px] font-bold text-slate-600 mb-1">No wire stock found</div>
              <p className="text-[13px]">Try adjusting your filters to see more results.</p>
            </div>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-40 bg-white">
              <tr className="h-[42px]">
                <th className="px-4 bg-slate-50 border-b border-slate-200 font-bold text-[11px] text-slate-500 uppercase tracking-wider w-[60%]">
                  Wire Type / Brand / Width
                </th>
                <th className="px-4 bg-slate-50 border-b border-slate-200 font-bold text-[11px] text-slate-500 uppercase tracking-wider text-right w-[40%]">
                  Total Stock
                </th>
              </tr>
            </thead>
            {Array.from(tableData.keys()).sort().map((type, tIdx, tArr) => {
              const typeMap = tableData.get(type)!;
              const isLastType = tIdx === tArr.length - 1;
              return (
                <tbody key={`type_${type}`} className={isLastType ? "pb-[env(safe-area-inset-bottom)]" : ""}>
                  {/* Sub-category Header */}
                  <tr>
                    <td colSpan={2} className="bg-slate-100 border-b border-slate-200 px-4 h-[38px]">
                      <span className="font-bold text-[13px] text-slate-800 uppercase tracking-wider">{type}</span>
                    </td>
                  </tr>
                  
                  {Array.from(typeMap.keys()).sort().map(brand => {
                    const brandMap = typeMap.get(brand)!;
                    return (
                      <React.Fragment key={`brand_${type}_${brand}`}>
                        {/* Brand Header */}
                        <tr>
                          <td colSpan={2} className="bg-slate-50 border-b border-slate-100 px-4 h-[32px]">
                            <div className="pl-3 border-l-2 border-slate-300 h-full flex items-center">
                              <span className="font-bold text-[12px] text-slate-600 uppercase tracking-wider leading-none">{brand}</span>
                            </div>
                          </td>
                        </tr>
                        
                        {Array.from(brandMap.keys()).sort((a,b) => (parseFloat(a) || 0) - (parseFloat(b) || 0)).map((width, wIdx, arr) => {
                          const wObj = brandMap.get(width)!;
                          if (wObj.physical === 0) return null;
                          const isLast = wIdx === arr.length - 1;
                          
                          return (
                            <tr 
                              key={`row_${type}_${brand}_${width}`} 
                              onClick={() => handleRowClick(type, brand, width, wObj)}
                              className={`active:bg-blue-50/50 transition-colors ${!isLast ? 'border-b border-slate-100' : ''} bg-white`}
                            >
                              <td className="px-4 py-3 pl-8">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-[13px] text-slate-800">
                                    {width}
                                  </span>
                                  {measurementUnit === 'bdls' && wObj.bundleSizeStr && (
                                    <span className="text-[10px] text-slate-400 font-medium">{wObj.bundleSizeStr}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {measurementUnit === 'bdls' && wObj.hasNA ? (
                                  <span className="text-red-400 font-bold text-[13px]">N/A</span>
                                ) : (
                                  <span className="font-bold text-[14px] text-slate-900">
                                    {(measurementUnit === 'bdls' ? wObj.bundle : wObj.physical).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    <span className="text-[10px] text-slate-400 ml-1 font-semibold uppercase">{displayUnit}</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        )}
      </div>

      <MobileWireCableDrilldownSheet
        data={drilldownData}
        mode={measurementUnit}
        onClose={() => setDrilldownData(null)}
      />
    </div>
  );
}
