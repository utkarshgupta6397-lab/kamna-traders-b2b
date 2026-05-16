'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, Filter, Box, ChevronDown, Check, X, TrendingUp, AlertTriangle, 
  CheckCircle2, FileDown, RefreshCw, Loader2, Info 
} from 'lucide-react';
import SkuInsightsDrawer from './SkuInsightsDrawer';
import { formatStockDate } from '@/lib/date-utils';
import { DOI_THRESHOLDS } from '@/lib/config';
import { formatCPDValue, calculateDOIInfo, calculateConsumptionDenominator } from '@/lib/inventory/consumption';
import { exportStockToPDF } from '@/lib/inventory/export-pdf';
import toast from 'react-hot-toast';

interface Warehouse {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface Brand {
  id: string;
  name: string;
}

interface SkuInventory {
  [warehouseId: string]: {
    qty: number;
    isOos: boolean;
  }
}

interface SkuItem {
  id: string;
  name: string;
  zohoBooksId2?: string | null;
  categoryId?: string | null;
  inventory: SkuInventory;
  unit?: string | null;
}

interface Props {
  warehouses: Warehouse[];
  categories: Category[];
  brands: Brand[];
  items: (SkuItem & { brandId?: string | null; caseSize: number })[];
  consumptionData: Record<string, any>;
  canSync?: boolean;
}

interface SyncResult {
  created: number;
  updated: number;
  failed: number;
  skipped: number;
  processed: number;
  totalReceived: number;
  duration?: number;
}

export default function CurrentStockClient({ warehouses, categories, brands, items, consumptionData, canSync = false }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedCaseSizes, setSelectedCaseSizes] = useState<number[]>([]);
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [hideOos, setHideOos] = useState(true);

  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);

  const formatDOI = (stock: number, cpd: number) => {
    return calculateDOIInfo(stock, cpd);
  };

  const [selectedSku, setSelectedSku] = useState<{
    id: string;
    name: string;
    totalStock: number;
    inventoryByWarehouse: SkuInventory;
    unit?: string | null;
  } | null>(null);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);


  const searchRef = useRef<HTMLDivElement>(null);


  // Close search suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine which warehouses to show as columns - Memoized to prevent busting down-stream memos
  const visibleWarehouses = useMemo(() => {
    return selectedWarehouses.length > 0
      ? warehouses.filter(w => selectedWarehouses.includes(w.id))
      : warehouses;
  }, [warehouses, selectedWarehouses]);

  // Filter items for suggestions
  const suggestions = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return items.filter(item => 
      item.name.toLowerCase().includes(q) || 
      item.id.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [items, searchQuery]);


  // Unique case sizes for filter
  const caseSizeOptions = useMemo(() => {
    const sizes = new Set(items.map(item => item.caseSize));
    return Array.from(sizes).filter(s => s !== 1).sort((a, b) => a - b);
  }, [items]);


  // Unified computation pass to minimize object creation and property-set pressure (V8 OrderedHashSet growth)
  const { categoryGroups, grandTotals, processedCount } = useMemo(() => {
    const groups: Record<string, { items: any[], totals: Record<string, any> }> = {};
    const grand: Record<string, any> = { total: 0, totalCPD: 0, firstUnit: null, isMixed: false };
    visibleWarehouses.forEach(wh => grand[wh.id] = 0);
    
    let count = 0;
    const q = debouncedSearchQuery.toLowerCase().trim();
    const isSubset = selectedWarehouses.length > 0 && selectedWarehouses.length < warehouses.length;

    // Single pass through items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // 1. Basic Filters (Short-circuit as early as possible)
      if (selectedCategories.length > 0 && !selectedCategories.includes(item.categoryId || 'uncategorized')) continue;
      if (selectedBrands.length > 0 && !selectedBrands.includes(item.brandId || 'unbranded')) continue;
      if (selectedCaseSizes.length > 0 && !selectedCaseSizes.includes(item.caseSize)) continue;
      
      if (q) {
        if (!item.name.toLowerCase().includes(q) && !item.id.toLowerCase().includes(q)) continue;
      }

      // 2. Compute Row Total (Ignore negative values for math)
      let rowTotal = 0;
      for (let j = 0; j < visibleWarehouses.length; j++) {
        const qty = item.inventory[visibleWarehouses[j].id]?.qty || 0;
        rowTotal += Math.max(0, qty);
      }

      // 3. OOS Filter
      if (hideOos && rowTotal <= 0) continue;

      // 4. Compute CPD and DOI (Dynamic based on visibleWarehouses)
      let netCPD = 0;
      const cData = consumptionData[item.id];
      if (cData) {
        if (!isSubset) {
          // Use pre-aggregated overall data for performance when all WHs shown
          const denom = calculateConsumptionDenominator(cData.overallFirstSale, cData.overallActiveDaysCount);
          netCPD = cData.overallOut / denom;
        } else {
          // Aggregate selected warehouses
          let totalOut = 0;
          let firstSale: string | null = null;
          let maxActiveDays = 0;

          selectedWarehouses.forEach(whId => {
            const whData = cData.warehouses[whId];
            if (whData) {
              totalOut += whData.out;
              if (whData.firstSale && (!firstSale || whData.firstSale < firstSale)) {
                firstSale = whData.firstSale;
              }
              maxActiveDays = Math.max(maxActiveDays, whData.activeDaysCount);
            }
          });

          const denom = calculateConsumptionDenominator(firstSale, maxActiveDays);
          netCPD = totalOut / denom;
        }
      }
      const doiInfo = calculateDOIInfo(rowTotal, netCPD);

      // 5. Unit Tracking for Subtotals and Grand Totals
      const unit = item.unit?.toLowerCase().trim() || '';
      if (grand.firstUnit === null) grand.firstUnit = unit;
      else if (grand.firstUnit !== unit) grand.isMixed = true;

      // 6. Aggregation
      const catId = item.categoryId || 'uncategorized';
      if (!groups[catId]) {
        groups[catId] = { 
          items: [], 
          totals: { 
            total: 0, 
            cpd: 0, 
            firstUnit: unit, 
            isMixed: false 
          } 
        };
        visibleWarehouses.forEach(wh => groups[catId].totals[wh.id] = 0);
      } else {
        if (groups[catId].totals.firstUnit !== unit) {
          groups[catId].totals.isMixed = true;
        }
      }
      
      const processedItem = { ...item, rowTotal, netCPD, doiInfo };
      groups[catId].items.push(processedItem);
      groups[catId].totals.total += rowTotal;
      groups[catId].totals.cpd += netCPD;
      grand.total += rowTotal;
      grand.totalCPD += netCPD;

      for (let j = 0; j < visibleWarehouses.length; j++) {
        const whId = visibleWarehouses[j].id;
        const val = item.inventory[whId]?.qty || 0;
        const nonNegativeVal = Math.max(0, val);
        groups[catId].totals[whId] += nonNegativeVal;
        grand[whId] += nonNegativeVal;
      }
      count++;
    }

    // Post-process category DOI and shared units
    Object.values(groups).forEach(g => {
      g.totals.doiInfo = formatDOI(g.totals.total, g.totals.cpd);
      g.totals.sharedUnit = g.totals.isMixed ? null : g.totals.firstUnit;
    });
    grand.sharedUnit = grand.isMixed ? null : grand.firstUnit;
    grand.totalDOIInfo = calculateDOIInfo(grand.total, grand.totalCPD);

    return { categoryGroups: groups, grandTotals: grand, processedCount: count };
  }, [items, visibleWarehouses, selectedWarehouses, warehouses.length, consumptionData, selectedCategories, selectedBrands, selectedCaseSizes, debouncedSearchQuery, hideOos]);




  const categoryMap = useMemo(() => {
    const map: Record<string, string> = { 'uncategorized': 'Uncategorized' };
    categories.forEach(c => map[c.id] = c.name);
    return map;
  }, [categories]);


  const toggleCategory = (id: string) => {
    setSelectedCategories(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleBrand = (id: string) => {
    setSelectedBrands(prev => 
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  };

  const toggleCaseSize = (size: number) => {
    setSelectedCaseSizes(prev => 
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    );
  };

  const toggleWarehouse = (id: string) => {
    setSelectedWarehouses(prev => 
      prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
    );
  };

  const handleCloseDrawer = React.useCallback(() => {
    setSelectedSku(null);
  }, []);

  const handleDownloadPDF = async () => {
    const itemsToExport: any[] = [];
    Object.values(categoryGroups).forEach(g => {
      itemsToExport.push(...g.items);
    });

    await exportStockToPDF({
      warehouses: visibleWarehouses,
      items: itemsToExport,
      filters: {
        categories: selectedCategories,
        brands: selectedBrands,
        search: searchQuery
      }
    });
  };

  const handleSuggestionClick = (item: SkuItem) => {
    let total = 0;
    visibleWarehouses.forEach(wh => {
      total += item.inventory[wh.id]?.qty || 0;
    });
    setSelectedSku({
      id: item.id,
      name: item.name,
      totalStock: total,
      inventoryByWarehouse: item.inventory,
      unit: item.unit
    });
    setSearchQuery('');
    setShowSearchSuggestions(false);
  };

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    setShowSyncModal(true);
    
    const startTime = Date.now();
    
    try {
      const res = await fetch('/api/admin/sku-sync/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'USER' })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Synchronization failed');
      
      const endTime = Date.now();
      const result = data.summary;
      result.duration = (endTime - startTime) / 1000;
      setSyncResult(result);
      toast.success('SKU Sync Complete');
    } catch (err: any) {
      setSyncError(err.message);
      toast.error(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header & Filters */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col gap-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#1A2766]">
            <Box size={20} />
            <h1 className="text-lg font-bold tracking-tight">Current Stock</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-[10px] text-gray-500 font-medium">
              Last Updated: {formatStockDate(new Date())}
            </div>
            {canSync && (
              <button 
                onClick={handleSync}
                disabled={isSyncing}
                className={`flex items-center gap-2 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all shadow-sm ${
                  isSyncing 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-[#1A2766] text-white hover:bg-[#AE1B1E]'
                }`}
              >
                {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Sync SKUs
              </button>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Dropdown */}
          <div className="relative flex-1 min-w-[250px]" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by Product Name or SKU..."
              value={searchQuery}
              onFocus={() => setShowSearchSuggestions(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchSuggestions(true);
              }}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766]"
            />
            {showSearchSuggestions && suggestions.length > 0 && (
              <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                {suggestions.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleSuggestionClick(item)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 flex flex-col border-b border-gray-50 last:border-0"
                  >
                    <span className="text-sm font-medium text-gray-900">{item.name}</span>
                    <span className="text-[10px] text-gray-500 font-mono">[{item.id}]</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Multi-select Category */}
          <div className="relative group">
            <button className="flex items-center gap-2 text-sm border border-gray-300 rounded-md py-2 px-3 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20">
              <Filter size={14} className="text-gray-400" />
              <span>{selectedCategories.length > 0 ? `${selectedCategories.length} Categories` : 'All Categories'}</span>
              <ChevronDown size={14} className="text-gray-400" />
            </button>
            <div className="absolute left-0 mt-1 z-50 w-48 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <div className="p-1 max-h-60 overflow-auto">
                {categories.map(c => (
                  <button
                    key={c.id}
                    onClick={() => toggleCategory(c.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 rounded text-left"
                  >
                    <div className={`w-4 h-4 border rounded shrink-0 flex items-center justify-center ${selectedCategories.includes(c.id) ? 'bg-[#1A2766] border-[#1A2766]' : 'bg-white border-gray-300'}`}>
                      {selectedCategories.includes(c.id) && <Check size={10} className="text-white" />}
                    </div>
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Multi-select Brand */}
          <div className="relative group">
            <button className="flex items-center gap-2 text-sm border border-gray-300 rounded-md py-2 px-3 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20">
              <span className="text-gray-400 font-bold text-xs">B</span>
              <span>{selectedBrands.length > 0 ? `${selectedBrands.length} Brands` : 'All Brands'}</span>
              <ChevronDown size={14} className="text-gray-400" />
            </button>
            <div className="absolute left-0 mt-1 z-50 w-48 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <div className="p-1 max-h-60 overflow-auto">
                {brands.map(b => (
                  <button
                    key={b.id}
                    onClick={() => toggleBrand(b.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 rounded text-left"
                  >
                    <div className={`w-4 h-4 border rounded shrink-0 flex items-center justify-center ${selectedBrands.includes(b.id) ? 'bg-[#1A2766] border-[#1A2766]' : 'bg-white border-gray-300'}`}>
                      {selectedBrands.includes(b.id) && <Check size={10} className="text-white" />}
                    </div>
                    <span className="truncate">{b.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Multi-select Case Size */}
          <div className="relative group">
            <button className="flex items-center gap-2 text-sm border border-gray-300 rounded-md py-2 px-3 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20">
              <span className="text-gray-400 font-bold text-xs">CS</span>
              <span>{selectedCaseSizes.length > 0 ? `${selectedCaseSizes.length} Case Sizes` : 'Case Size'}</span>
              <ChevronDown size={14} className="text-gray-400" />
            </button>
            <div className="absolute left-0 mt-1 z-50 w-40 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <div className="p-1 max-h-60 overflow-auto">
                {caseSizeOptions.map(size => (
                  <button
                    key={size}
                    onClick={() => toggleCaseSize(size)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 rounded"
                  >
                    <div className={`w-4 h-4 border rounded flex items-center justify-center ${selectedCaseSizes.includes(size) ? 'bg-[#1A2766] border-[#1A2766]' : 'bg-white border-gray-300'}`}>
                      {selectedCaseSizes.includes(size) && <Check size={10} className="text-white" />}
                    </div>
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Multi-select Warehouse */}
          <div className="relative group">
            <button className="flex items-center gap-2 text-sm border border-gray-300 rounded-md py-2 px-3 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20">
              <Box size={14} className="text-gray-400" />
              <span>{selectedWarehouses.length > 0 ? `${selectedWarehouses.length} WH` : 'All Warehouses'}</span>
              <ChevronDown size={14} className="text-gray-400" />
            </button>
            <div className="absolute left-0 mt-1 z-50 w-48 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <div className="p-1 max-h-60 overflow-auto">
                {warehouses.map(w => (
                  <button
                    key={w.id}
                    onClick={() => toggleWarehouse(w.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 rounded text-left"
                  >
                    <div className={`w-4 h-4 border rounded shrink-0 flex items-center justify-center ${selectedWarehouses.includes(w.id) ? 'bg-[#1A2766] border-[#1A2766]' : 'bg-white border-gray-300'}`}>
                      {selectedWarehouses.includes(w.id) && <Check size={10} className="text-white" />}
                    </div>
                    <span className="truncate">{w.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer bg-white border border-gray-300 px-3 py-2 rounded-md hover:bg-gray-50 shrink-0">
            <input 
              type="checkbox" 
              checked={hideOos} 
              onChange={(e) => setHideOos(e.target.checked)}
              className="rounded text-[#1A2766] focus:ring-[#1A2766]"
            />
            Hide OOS
          </label>

          <button 
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-bold shadow-sm shrink-0 ml-auto"
          >
            <FileDown size={16} />
            Download PDF
          </button>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-4 py-2 font-semibold border-b border-r border-gray-200 bg-gray-100 sticky left-0 z-20 w-10 text-center">#</th>
              <th className="px-4 py-2 font-semibold border-b border-r border-gray-200 bg-gray-100 sticky left-[40px] z-20 min-w-[300px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Product [SKU]</th>
              {visibleWarehouses.map(wh => (
                <th key={wh.id} className="px-4 py-2 font-semibold border-b border-r border-gray-200 text-center bg-gray-100 min-w-[100px]">
                  {wh.name}
                </th>
              ))}
              <th className="px-4 py-2 font-semibold border-b border-r border-gray-200 text-center bg-[#1A2766]/5 min-w-[100px]">Total</th>
              <th className="px-4 py-2 font-semibold border-b border-r border-gray-200 text-center bg-gray-100 min-w-[90px]">Net CPD</th>
              <th className="px-4 py-2 font-semibold border-b border-gray-200 text-center bg-gray-100 min-w-[90px]">Net DOI</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(categoryGroups).length === 0 ? (
              <tr>
                <td colSpan={visibleWarehouses.length + 5} className="px-4 py-8 text-center text-gray-500">
                  No items found matching your filters.
                </td>
              </tr>
            ) : (
              Object.entries(categoryGroups).map(([categoryId, { items: catItems, totals: catTotals }]) => {
                return (
                  <React.Fragment key={categoryId}>
                    {/* Category Header Row */}
                    <tr className="bg-gray-50/80 font-bold border-b border-gray-200 text-[#1A2766] text-xs">
                      <td colSpan={2} className="px-4 py-1.5 border-r border-gray-200 sticky left-0 z-10 bg-gray-50/90 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        {categoryMap[categoryId] || 'Unknown Category'} <span className="text-[10px] font-normal text-gray-500 ml-2">({catItems.length} items)</span>
                      </td>
                      {visibleWarehouses.map(wh => (
                        <td key={wh.id} className="px-4 py-1.5 text-center border-r border-gray-200">
                          <div className="flex items-baseline justify-center gap-1">
                            <span>{catTotals[wh.id].toLocaleString()}</span>
                            {catTotals[wh.id] > 0 && catTotals.sharedUnit && (
                              <span className="text-[10px] text-gray-400 font-medium opacity-70 lowercase">{catTotals.sharedUnit}</span>
                            )}
                          </div>
                        </td>
                      ))}
                      <td className="px-4 py-1.5 text-center bg-[#1A2766]/5 border-r border-gray-200">
                        <div className="flex items-baseline justify-center gap-1">
                          <span>{catTotals.total.toLocaleString()}</span>
                          {catTotals.total > 0 && catTotals.sharedUnit && (
                            <span className="text-[10px] text-gray-400 font-medium opacity-70 lowercase">{catTotals.sharedUnit}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-1.5 text-center border-r border-gray-200">
                        <div className="flex items-baseline justify-center gap-1">
                          <span>{formatCPDValue(catTotals.cpd)}</span>
                          {catTotals.sharedUnit && (
                            <span className="text-[10px] text-gray-400 font-medium opacity-70 lowercase">{catTotals.sharedUnit}/day</span>
                          )}
                        </div>
                      </td>
                      <td className={`px-4 py-1.5 text-center ${
                        catTotals.doiInfo.status === 'CRITICAL' ? 'text-red-600 bg-red-50/30' : 
                        catTotals.doiInfo.status === 'WARNING' ? 'text-amber-600 bg-amber-50/30' : 
                        'text-green-600 bg-green-50/30'
                      }`}>
                        {catTotals.doiInfo.text}
                      </td>
                    </tr>

                    
                    {/* Item Rows */}
                    {catItems.map((item, idx) => (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors group">
                        <td className="px-4 py-1.5 text-gray-400 text-center border-r border-gray-100 sticky left-0 z-10 bg-white group-hover:bg-blue-50/30">{idx + 1}</td>
                        <td 
                          className="px-4 py-1.5 border-r border-gray-100 sticky left-[40px] z-10 bg-white group-hover:bg-blue-50/30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] cursor-pointer"
                          onClick={() => setSelectedSku({
                            id: item.id,
                            name: item.name,
                            totalStock: item.rowTotal,
                            inventoryByWarehouse: item.inventory,
                            unit: item.unit
                          })}
                        >
                          <div className="flex items-baseline gap-2 overflow-hidden">
                            <span className="font-bold text-gray-900 truncate leading-tight">{item.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono flex-shrink-0 group-hover:text-[#1A2766] transition-colors">[{item.id}]</span>
                          </div>
                        </td>
                        {visibleWarehouses.map(wh => {
                          const qty = item.inventory[wh.id]?.qty || 0;
                          const isNegative = qty < 0;
                          return (
                            <td key={wh.id} className={`px-4 py-1.5 text-center border-r border-gray-100 font-mono ${isNegative ? 'text-red-600' : qty > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                              <div className="flex items-baseline justify-center gap-1">
                                {isNegative && <AlertTriangle size={10} className="text-red-600 mb-0.5" />}
                                <span className="font-bold">{qty.toLocaleString()}</span>
                                {qty !== 0 && item.unit && (
                                  <span className={`text-[10px] font-medium opacity-70 lowercase ${isNegative ? 'text-red-400' : 'text-gray-400'}`}>{item.unit}</span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td className={`px-4 py-1.5 text-center font-bold font-mono bg-[#1A2766]/5 border-r border-gray-100 ${item.rowTotal > 0 ? 'text-[#1A2766]' : 'text-gray-300'}`}>
                          <div className="flex items-baseline justify-center gap-1">
                            <span>{item.rowTotal.toLocaleString()}</span>
                            {item.rowTotal > 0 && item.unit && (
                              <span className="text-[10px] text-gray-400 font-medium opacity-70 lowercase">{item.unit}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-1.5 text-center border-r border-gray-100 text-[13px] font-medium text-gray-600">
                          <div className="flex items-baseline justify-center gap-1">
                            <span>{formatCPDValue(item.netCPD)}</span>
                            {item.unit && (
                              <span className="text-[10px] text-gray-400 font-medium opacity-70 lowercase">{item.unit}/day</span>
                            )}
                          </div>
                        </td>
                        <td className={`px-4 py-1.5 text-center text-[13px] font-black ${
                          item.doiInfo.status === 'CRITICAL' ? 'text-red-600 bg-red-50/30' : 
                          item.doiInfo.status === 'WARNING' ? 'text-amber-600 bg-amber-50/30' : 
                          'text-green-600 bg-green-50/30'
                        }`}>
                          {item.doiInfo.text}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
          {/* Grand Totals Footer */}
          {Object.keys(categoryGroups).length > 0 && (

            <tfoot className="sticky bottom-0 z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
              <tr className="bg-[#1A2766] text-white font-bold">
                <td colSpan={2} className="px-4 py-2 text-right border-r border-white/20 uppercase tracking-wider text-[10px]">
                  Grand Total
                </td>
                {visibleWarehouses.map(wh => (
                  <td key={wh.id} className="px-4 py-2 text-center border-r border-white/20">
                    <div className="flex items-baseline justify-center gap-1">
                      <span>{grandTotals[wh.id].toLocaleString()}</span>
                      {grandTotals[wh.id] > 0 && grandTotals.sharedUnit && (
                        <span className="text-[10px] text-white/50 font-medium lowercase">{grandTotals.sharedUnit}</span>
                      )}
                    </div>
                  </td>
                ))}
                <td className="px-4 py-2 text-center border-r border-white/20 bg-white/10">
                  <div className="flex items-baseline justify-center gap-1">
                    <span>{grandTotals.total.toLocaleString()}</span>
                    {grandTotals.total > 0 && grandTotals.sharedUnit && (
                      <span className="text-[10px] text-white/50 font-medium lowercase">{grandTotals.sharedUnit}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2 text-center border-r border-white/20">
                  <div className="flex items-baseline justify-center gap-1">
                    <span>{formatCPDValue(grandTotals.totalCPD)}</span>
                    {grandTotals.sharedUnit && (
                      <span className="text-[10px] text-white/50 font-medium lowercase">{grandTotals.sharedUnit}/day</span>
                    )}
                  </div>
                </td>
                <td className={`px-4 py-2 text-center ${
                  grandTotals.totalDOIInfo.status === 'CRITICAL' ? 'text-red-300' : 
                  grandTotals.totalDOIInfo.status === 'WARNING' ? 'text-amber-300' : 
                  'text-green-300'
                }`}>
                  {grandTotals.totalDOIInfo.text}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      
      {/* Sync Status Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isSyncing && setShowSyncModal(false)} />
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-[#1A2766] p-4 flex items-center justify-between text-white">
              <h2 className="font-bold flex items-center gap-2 text-lg">
                <RefreshCw size={20} className={isSyncing ? 'animate-spin' : ''} />
                SKU Catalog Sync
              </h2>
              {!isSyncing && (
                <button onClick={() => setShowSyncModal(false)} className="hover:bg-white/10 p-1 rounded-lg transition-colors">
                  <X size={20} />
                </button>
              )}
            </div>

            <div className="p-8">
              {isSyncing ? (
                <div className="flex flex-col items-center gap-6 py-4">
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-gray-100 border-t-[#1A2766] rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <RefreshCw size={24} className="text-[#1A2766] animate-pulse" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-lg font-black text-[#1A2766] uppercase tracking-tight">Syncing in Progress</p>
                    <p className="text-sm text-gray-500 font-medium animate-pulse">Syncing latest stock from source...</p>
                  </div>
                </div>
              ) : syncError ? (
                <div className="flex flex-col items-center gap-6 py-4">
                  <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-600">
                    <AlertTriangle size={40} />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-lg font-black text-red-600 uppercase tracking-tight">Sync Failed</p>
                    <p className="text-sm text-gray-600 font-medium px-4">{syncError}</p>
                  </div>
                  <button 
                    onClick={() => setShowSyncModal(false)}
                    className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black transition-all"
                  >
                    Close
                  </button>
                </div>
              ) : syncResult ? (
                <div className="space-y-6">
                  <div className="flex flex-col items-center gap-4 py-2">
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                      <CheckCircle2 size={32} />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-emerald-600 uppercase tracking-tight">Sync Complete</p>
                      <p className="text-xs text-gray-500 font-bold">Processed in {syncResult.duration?.toFixed(1)}s</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Fetched', value: syncResult.totalReceived, color: 'text-blue-600', bg: 'bg-blue-50' },
                      { label: 'Created', value: syncResult.created, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                      { label: 'Updated', value: syncResult.updated, color: 'text-amber-600', bg: 'bg-amber-50' },
                      { label: 'Skipped', value: syncResult.skipped, color: 'text-gray-600', bg: 'bg-gray-50' },
                      { label: 'Failed', value: syncResult.failed, color: syncResult.failed > 0 ? 'text-red-600' : 'text-gray-600', bg: syncResult.failed > 0 ? 'bg-red-50' : 'bg-gray-50' },
                    ].map(stat => (
                      <div key={stat.label} className={`${stat.bg} p-3 rounded-xl border border-black/5`}>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
                        <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={() => {
                      setShowSyncModal(false);
                      window.location.reload(); // Reload to show new data
                    }}
                    className="w-full bg-[#1A2766] text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-[#AE1B1E] transition-all shadow-lg shadow-[#1A2766]/20 active:scale-[0.98]"
                  >
                    Done
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Drawer */}
      <SkuInsightsDrawer 
        isOpen={!!selectedSku} 
        onClose={handleCloseDrawer} 
        sku={selectedSku} 
        warehouses={warehouses} 
      />
    </div>
  );
}
