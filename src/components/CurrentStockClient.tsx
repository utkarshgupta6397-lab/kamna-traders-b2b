'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Filter, Box, ChevronDown, Check, X } from 'lucide-react';
import SkuInsightsDrawer from './SkuInsightsDrawer';
import { formatStockDate } from '@/lib/date-utils';

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
}

interface Props {
  warehouses: Warehouse[];
  categories: Category[];
  brands: Brand[];
  items: (SkuItem & { brandId?: string | null; caseSize: number })[];
}

export default function CurrentStockClient({ warehouses, categories, brands, items }: Props) {
  console.count('Render: CurrentStockClient');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedCaseSizes, setSelectedCaseSizes] = useState<number[]>([]);
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [hideOos, setHideOos] = useState(true);
  const [selectedSku, setSelectedSku] = useState<{
    id: string;
    name: string;
    totalStock: number;
    inventoryByWarehouse: SkuInventory;
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


  // Filter and compute row totals
  const processedItems = useMemo(() => {
    return items.map(item => {
      let rowTotal = 0;
      visibleWarehouses.forEach(wh => {
        rowTotal += item.inventory[wh.id]?.qty || 0;
      });
      return { ...item, rowTotal };
    }).filter(item => {
      // 1. Category Filter
      if (selectedCategories.length > 0 && !selectedCategories.includes(item.categoryId || 'uncategorized')) return false;
      
      // 2. Brand Filter
      if (selectedBrands.length > 0 && !selectedBrands.includes(item.brandId || 'unbranded')) return false;

      // 3. Case Size Filter
      if (selectedCaseSizes.length > 0 && !selectedCaseSizes.includes(item.caseSize)) return false;

      // 4. Search Filter
      if (debouncedSearchQuery) {
        const q = debouncedSearchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchSku = item.id.toLowerCase().includes(q);
        if (!matchName && !matchSku) return false;
      }

      // 5. Hide OOS Filter
      if (hideOos && item.rowTotal <= 0) return false;

      return true;
    });
  }, [items, visibleWarehouses, selectedCategories, selectedBrands, selectedCaseSizes, debouncedSearchQuery, hideOos]);


  // Group by Category and pre-compute subtotals
  const categoryGroups = useMemo(() => {
    const groups: Record<string, { items: typeof processedItems, totals: Record<string, number> }> = {};

    
    processedItems.forEach(item => {
      const catId = item.categoryId || 'uncategorized';
      if (!groups[catId]) {
        groups[catId] = { 
          items: [], 
          totals: { total: 0 } 
        };
        visibleWarehouses.forEach(wh => groups[catId].totals[wh.id] = 0);
      }
      
      groups[catId].items.push(item);
      groups[catId].totals.total += item.rowTotal;
      visibleWarehouses.forEach(wh => {
        groups[catId].totals[wh.id] += item.inventory[wh.id]?.qty || 0;
      });
    });

    return groups;
  }, [processedItems, visibleWarehouses]);




  const categoryMap = useMemo(() => {
    const map: Record<string, string> = { 'uncategorized': 'Uncategorized' };
    categories.forEach(c => map[c.id] = c.name);
    return map;
  }, [categories]);

  // Compute Grand Totals
  const grandTotals = useMemo(() => {
    const totals: Record<string, number> = { total: 0 };
    visibleWarehouses.forEach(wh => totals[wh.id] = 0);

    processedItems.forEach(item => {
      totals.total += item.rowTotal;
      visibleWarehouses.forEach(wh => {
        totals[wh.id] += item.inventory[wh.id]?.qty || 0;
      });
    });

    return totals;
  }, [processedItems, visibleWarehouses]);

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

  const handleSuggestionClick = (item: SkuItem) => {
    let total = 0;
    visibleWarehouses.forEach(wh => {
      total += item.inventory[wh.id]?.qty || 0;
    });
    setSelectedSku({
      id: item.id,
      name: item.name,
      totalStock: total,
      inventoryByWarehouse: item.inventory
    });
    setSearchQuery('');
    setShowSearchSuggestions(false);
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
          <div className="text-[10px] text-gray-500 font-medium">
            Last Updated: {formatStockDate(new Date())}
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
              <th className="px-4 py-2 font-semibold border-b border-gray-200 text-center bg-[#1A2766]/5 min-w-[100px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(categoryGroups).length === 0 ? (
              <tr>
                <td colSpan={visibleWarehouses.length + 3} className="px-4 py-8 text-center text-gray-500">
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
                          {catTotals[wh.id].toLocaleString()}
                        </td>
                      ))}
                      <td className="px-4 py-1.5 text-center bg-[#1A2766]/5">
                        {catTotals.total.toLocaleString()}
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
                            inventoryByWarehouse: item.inventory
                          })}
                        >
                          <div className="flex items-center gap-2 hover:text-[#1A2766] overflow-hidden">
                            <span className="font-medium text-gray-900 truncate group-hover:underline decoration-[#1A2766]/30">{item.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">[{item.id}]</span>
                          </div>
                        </td>
                        {visibleWarehouses.map(wh => {
                          const qty = item.inventory[wh.id]?.qty || 0;
                          return (
                            <td key={wh.id} className={`px-4 py-1.5 text-center border-r border-gray-100 font-mono ${qty > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                              {qty}
                            </td>
                          );
                        })}
                        <td className={`px-4 py-1.5 text-center font-bold font-mono bg-[#1A2766]/5 ${item.rowTotal > 0 ? 'text-[#1A2766]' : 'text-gray-300'}`}>
                          {item.rowTotal}
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
                    {grandTotals[wh.id].toLocaleString()}
                  </td>
                ))}
                <td className="px-4 py-2 text-center text-green-300">
                  {grandTotals.total.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      
      {/* Drawer */}
      <SkuInsightsDrawer 
        isOpen={!!selectedSku} 
        onClose={() => setSelectedSku(null)} 
        sku={selectedSku} 
        warehouses={warehouses} 
      />
    </div>
  );
}
