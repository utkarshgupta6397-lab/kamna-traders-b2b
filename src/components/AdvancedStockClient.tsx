'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Box, Search, Filter, ChevronDown, ChevronRight, 
  Settings2, Loader2, AlertTriangle, FileDown 
} from 'lucide-react';
import { 
  loadGroupingConfig, saveGroupingConfig, 
  getCategoryGrouping, setCategoryGrouping, GroupingConfigStore 
} from '@/lib/inventory/advanced-stock-grouping';
import { 
  buildCategoryHierarchy, HierarchyNode 
} from '@/lib/inventory/advanced-stock-hierarchy';
import CategoryGroupingModal from './CategoryGroupingModal';
import CurrentStockSidebar from './CurrentStockSidebar';

interface Props {
  warehouses: Array<{ id: string; name: string; isSystemWarehouse: boolean }>;
}

export default function AdvancedStockClient({ warehouses }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [groupingStore, setGroupingStore] = useState<GroupingConfigStore>({});
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [configModalFor, setConfigModalFor] = useState<string | null>(null);
  
  const [selectedWarehouseIds, setSelectedWarehouseIds] = useState<string[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Initial Load
  useEffect(() => {
    setGroupingStore(loadGroupingConfig());
  }, []);

  // 2. Fetch Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      selectedWarehouseIds.forEach(id => params.append('warehouseId', id));
      
      const res = await fetch(`/api/staff/inventory/advanced-stock?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      
      const json = await res.json();
      setData(json);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouseIds]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const [hasInitializedExpansion, setHasInitializedExpansion] = useState(false);

  // 3. Process Data -> Hierarchy
  const { displayedCategories, categoryRoots, hierarchyRowCount, productCount } = useMemo(() => {
    if (!data) return { displayedCategories: [], categoryRoots: [], hierarchyRowCount: 0, productCount: 0 };

    // Find leaf categories or those with no children present in the active set
    const parentIds = new Set(data.categories.map((c: any) => c.parentId).filter(Boolean));
    let leafCategories = data.categories.filter((c: any) => !parentIds.has(c.id));

    if (selectedCategoryId) {
      // Find all descendants of the selected category, or just match if it's a leaf itself
      const getDescendants = (parentId: string): string[] => {
        const children = data.categories.filter((c: any) => c.parentId === parentId);
        let ids = children.map((c: any) => c.id);
        children.forEach((c: any) => { ids = [...ids, ...getDescendants(c.id)]; });
        return ids;
      };
      const allowedCatIds = new Set([selectedCategoryId, ...getDescendants(selectedCategoryId)]);
      leafCategories = leafCategories.filter((c: any) => allowedCatIds.has(c.id));
    }

    const roots = leafCategories.map((cat: any) => {
      // Get all SKUs for this category
      let categorySkus = data.skus.filter((s: any) => s.categoryId === cat.id);
      
      // Optional: search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        categorySkus = categorySkus.filter((s: any) => 
          (s.skuId && s.skuId.toLowerCase().includes(q)) || 
          (s.brandName && s.brandName.toLowerCase().includes(q))
        );
      }

      // Valid dimensions for this category (attributes + brand)
      const validDimensions = ['brand', ...cat.attributes.map((a: any) => a.id)];
      const groupBy = getCategoryGrouping(groupingStore, cat.id, validDimensions);

      const rootNode = buildCategoryHierarchy(
        cat.name, 
        cat.id, 
        categorySkus, 
        groupBy, 
        data.config, 
        data.historicalDates,
        warehouses
      );

      return { cat, rootNode };
    });

    // Only return categories that have items
    const activeRoots = roots.filter((r: any) => r.rootNode.skuCount > 0);

    let hierarchyRowCount = 0;
    let productCount = 0;
    const traverse = (node: HierarchyNode) => {
      if (!node.isCategory && !node.isSku) {
        hierarchyRowCount++;
      }
      if (node.isSku) {
        productCount++;
      }
      node.children.forEach(traverse);
    };
    activeRoots.forEach((r: any) => traverse(r.rootNode));

    return { 
      displayedCategories: activeRoots.map((r: any) => r.cat), 
      categoryRoots: activeRoots.map((r: any) => r.rootNode),
      hierarchyRowCount,
      productCount
    };
  }, [data, groupingStore, selectedCategoryId, searchQuery]);

  useEffect(() => {
    if (categoryRoots && categoryRoots.length > 0 && !hasInitializedExpansion) {
      const initial = new Set<string>();
      categoryRoots.forEach((catNode: HierarchyNode) => {
        initial.add(catNode.id); // Expand category
        catNode.children.forEach(child => {
          initial.add(child.id); // Expand first grouping level
        });
      });
      setExpandedNodes(initial);
      setHasInitializedExpansion(true);
    }
  }, [categoryRoots, hasInitializedExpansion]);

  // Expand / Collapse Handlers
  const toggleNode = (id: string) => {
    const next = new Set(expandedNodes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedNodes(next);
  };

  const toggleAll = (expand: boolean) => {
    if (expand) {
      const allIds = new Set<string>();
      const addIds = (nodes: HierarchyNode[]) => {
        nodes.forEach(n => {
          if (n.children.length > 0) {
            allIds.add(n.id);
            addIds(n.children);
          }
        });
      };
      addIds(categoryRoots);
      setExpandedNodes(allIds);
    } else {
      setExpandedNodes(new Set());
    }
  };

  // Grouping Modal Handlers
  const handleApplyGrouping = (categoryId: string, newGroupBy: string[]) => {
    const newStore = setCategoryGrouping(groupingStore, categoryId, newGroupBy);
    setGroupingStore(newStore);
    saveGroupingConfig(newStore);
    setConfigModalFor(null);
  };

  // Rendering Helpers
  const formatQty = (qty: number | null, unit: string | null = null) => {
    if (qty === null) return '—';
    if (qty >= 999999999) return '∞';
    const num = qty.toLocaleString();
    return unit && qty > 0 ? `${num} ${unit.toLowerCase()}` : num;
  };

  const formatCPD = (cpd: number) => {
    if (cpd === 0) return '0';
    return cpd >= 100 ? Math.round(cpd).toString() : cpd.toFixed(1);
  };

  const getHealthStyle = (stock: number | null, maxLevel: number): React.CSSProperties => {
    if (stock === null) return {};
    if (stock <= 0) return { background: '#1F2937', color: '#FFFFFF', fontWeight: 'bold' }; // Stock Out (Dark Neutral)
    if (maxLevel <= 0) return {}; // Neutral
    
    const pct = stock / maxLevel;
    if (pct > 1.0) return { background: '#2563EB', color: '#FFFFFF', fontWeight: 'bold' }; // More Than Max (Strong Blue)
    if (pct >= 0.66) return { background: '#16A34A', color: '#FFFFFF', fontWeight: 'bold' }; // Green Level (Strong Green)
    if (pct >= 0.33) return { background: '#D97706', color: '#FFFFFF', fontWeight: 'bold' }; // Yellow Level (Strong Amber)
    return { background: '#DC2626', color: '#FFFFFF', fontWeight: 'bold' }; // Danger Level (Strong Red)
  };

  const renderNode = (node: HierarchyNode) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;
    const paddingLeft = node.isCategory ? 16 : 16 + (node.depth * 24);

    let textStyle = 'font-medium text-gray-800 text-[13px]'; // default: attribute
    if (node.isCategory) textStyle = 'font-bold text-[#1A2766] text-[14px]';
    else if (node.isWarehouse) textStyle = 'font-medium text-gray-500 text-[12px]';
    else if (node.id.includes('|brand:')) textStyle = 'font-normal text-gray-500 text-[12px]';

    return (
      <React.Fragment key={node.id}>
        <tr className={`border-b border-gray-100 hover:bg-blue-50/40 transition-colors ${node.isCategory ? 'bg-gray-50/60' : ''}`}>
          {/* Hierarchy Column */}
          <td 
            className={`py-2.5 pr-4 border-r border-gray-200 sticky left-0 z-10 bg-white w-[300px] min-w-[300px] max-w-[300px]`}
            style={{ paddingLeft: `${paddingLeft}px` }}
          >
            <div className="flex items-center gap-2">
              <button 
                onClick={() => hasChildren && toggleNode(node.id)}
                className={`p-1 rounded hover:bg-gray-200 transition-colors ${!hasChildren ? 'invisible' : 'text-gray-500'}`}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              
              <div className="flex-1 min-w-0 flex items-center gap-2">
                {node.isWarehouse && <Box size={14} className="text-gray-400 shrink-0" />}
                
                {node.isSku ? (
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-600 text-[11px] truncate">{node.label}</span>
                    <span className="text-[10px] text-gray-400 font-mono truncate">{node.id.split('|sku:')[1]}</span>
                  </div>
                ) : (
                  <span className={`truncate ${textStyle}`}>
                    {node.label}
                  </span>
                )}
                
                {!node.isSku && (
                  <span className="text-[10px] text-gray-400 font-normal">
                    ({node.skuCount} items)
                  </span>
                )}
              </div>

              {node.isCategory && (
                <button 
                  onClick={() => setConfigModalFor(node.id)}
                  className="p-1.5 text-gray-400 hover:text-[#1A2766] hover:bg-blue-50 rounded transition-colors"
                  title="Configure Grouping"
                >
                  <Settings2 size={14} />
                </button>
              )}
            </div>
          </td>

          {/* Current Stock */}
          <td className="px-4 py-2.5 text-center border-r border-gray-200 bg-[#EFF6FF] font-bold text-[#1A2766] whitespace-nowrap sticky left-[300px] z-10 w-[120px] min-w-[120px] max-w-[120px]">
            {formatQty(node.currentStock, node.unitShort)}
          </td>

          {/* Avg Daily Consumption */}
          <td className="px-4 py-2.5 text-center border-r border-gray-200 bg-[#EFF6FF] text-[#1A2766] font-medium whitespace-nowrap sticky left-[420px] z-10 w-[140px] min-w-[140px] max-w-[140px]">
            {formatCPD(node.avgDailyConsumption)}<span className="text-[10px] opacity-70 ml-1">/day</span>
          </td>

          {/* Max Level */}
          <td className="px-4 py-2.5 text-center border-r border-blue-200 bg-[#EFF6FF] text-[#1A2766] font-bold whitespace-nowrap sticky left-[560px] z-10 w-[120px] min-w-[120px] max-w-[120px] shadow-[4px_0_6px_-2px_rgba(0,0,0,0.08)]">
            {Math.round(node.maxLevel).toLocaleString()}
          </td>

          {/* Historical Dates */}
          {data?.historicalDates.map((d: string) => {
            const hQty = node.historicalStock[d];
            return (
              <td 
                key={d} 
                className="px-4 py-2.5 text-center border-r border-gray-200 font-mono text-[13px] whitespace-nowrap transition-colors"
                style={getHealthStyle(hQty, node.maxLevel)}
              >
                {formatQty(hQty)}
              </td>
            );
          })}
        </tr>
        
        {/* Render Children if expanded */}
        {isExpanded && hasChildren && node.children.map(child => renderNode(child))}
      </React.Fragment>
    );
  };

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white rounded-lg border border-gray-200 h-full">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Loader2 size={32} className="animate-spin text-[#1A2766]" />
          <p className="font-medium text-sm">Loading advanced stock data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center bg-white rounded-lg border border-red-200 h-full flex flex-col items-center justify-center">
        <AlertTriangle size={48} className="text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-2">Error Loading Data</h3>
        <p className="text-gray-500">{error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-[#1A2766] text-white rounded-md text-sm font-bold">Retry</button>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-5">
      <CurrentStockSidebar activeView="advanced" />
      <div className="flex-1 flex flex-col h-full min-w-0 bg-white rounded-lg shadow-sm border border-gray-200">
      
      {/* Header & Filters */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col gap-4 shrink-0 rounded-t-lg relative z-[100]">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#1A2766]">
            <Box size={20} />
            <h1 className="text-lg font-bold tracking-tight">Advanced Stock View</h1>
          </div>
          
          <div className="flex items-center gap-4 text-xs font-medium text-gray-500 bg-white px-3 py-1.5 rounded-md border border-gray-200 shadow-sm">
            <span>Lead Time: <strong className="text-gray-900">{data?.config.leadTimeDays} Days</strong></span>
            <div className="w-px h-4 bg-gray-300"></div>
            <span>Safety Factor: <strong className="text-gray-900">{data?.config.safetyFactor}x</strong></span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search SKUs or Brands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-white border border-gray-200 rounded-md text-[13px] text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 h-8"
            />
          </div>

          {/* Category Filter */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 text-[13px] font-medium border border-gray-200 text-gray-700 rounded-md h-8 px-3 bg-white hover:bg-gray-50 max-w-[200px]">
              <Filter size={14} className="text-gray-400 shrink-0" />
              <span className="truncate">{selectedCategoryId ? data?.categories.find((c: any) => c.id === selectedCategoryId)?.name || 'Category' : 'All Categories'}</span>
              <ChevronDown size={14} className="text-gray-400 shrink-0" />
            </button>
            <div className="absolute left-0 mt-1 z-50 w-64 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <div className="p-1 max-h-60 overflow-auto">
                <button
                  onClick={() => setSelectedCategoryId(null)}
                  className={`w-full flex items-center px-3 py-1.5 text-sm hover:bg-gray-50 rounded text-left ${!selectedCategoryId ? 'bg-blue-50/50 text-[#1A2766] font-semibold' : 'text-gray-700'}`}
                >
                  All Categories
                </button>
                <div className="border-t border-gray-100 my-1"></div>
                {data?.categories.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategoryId(c.id)}
                    className={`w-full flex items-center px-3 py-1.5 text-sm hover:bg-gray-50 rounded text-left truncate ${selectedCategoryId === c.id ? 'bg-blue-50/50 text-[#1A2766] font-semibold' : 'text-gray-700'}`}
                    style={{ paddingLeft: c.parentId ? '1.5rem' : '0.75rem' }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Warehouse Filter */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 text-[13px] font-medium border border-gray-200 text-gray-700 rounded-md h-8 px-3 bg-white hover:bg-gray-50">
              <Box size={14} className="text-gray-400" />
              <span>{selectedWarehouseIds.length > 0 ? `${selectedWarehouseIds.length} WH` : 'All Warehouses'}</span>
              <ChevronDown size={14} className="text-gray-400" />
            </button>
            <div className="absolute left-0 mt-1 z-50 w-56 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <div className="p-1 max-h-60 overflow-auto">
                <button
                  onClick={() => setSelectedWarehouseIds([])}
                  className={`w-full flex items-center px-3 py-1.5 text-sm hover:bg-gray-50 rounded text-left ${selectedWarehouseIds.length === 0 ? 'bg-blue-50/50 text-[#1A2766] font-semibold' : 'text-gray-700'}`}
                >
                  All Warehouses
                </button>
                <div className="border-t border-gray-100 my-1"></div>
                {warehouses.filter(w => !w.isSystemWarehouse).map(w => (
                  <label key={w.id} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 rounded text-left cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded text-[#1A2766]"
                      checked={selectedWarehouseIds.includes(w.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedWarehouseIds([...selectedWarehouseIds, w.id]);
                        } else {
                          setSelectedWarehouseIds(selectedWarehouseIds.filter(id => id !== w.id));
                        }
                      }}
                    />
                    <span className="truncate">{w.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-md p-1">
            <button onClick={() => toggleAll(true)} className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">Expand All</button>
            <div className="w-px h-4 bg-gray-200"></div>
            <button onClick={() => toggleAll(false)} className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">Collapse All</button>
          </div>

        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto bg-white rounded-b-lg">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 z-20 shadow-sm">
            <tr>
              <th className="px-4 py-2.5 font-bold border-b border-r border-gray-200 bg-gray-100 sticky left-0 z-30 w-[300px] min-w-[300px] max-w-[300px]">
                Hierarchy
              </th>
              <th className="px-4 py-2.5 font-bold border-b border-r border-blue-200 bg-[#EFF6FF] text-[#1A2766] sticky top-0 left-[300px] z-30 w-[120px] min-w-[120px] max-w-[120px] text-center">
                Current Stock
              </th>
              <th className="px-4 py-2.5 font-bold border-b border-r border-blue-200 bg-[#EFF6FF] text-[#1A2766] sticky top-0 left-[420px] z-30 w-[140px] min-w-[140px] max-w-[140px] text-center" title="15-Day Avg Daily Consumption">
                Avg Daily (15D)
              </th>
              <th className="px-4 py-2.5 font-bold border-b border-r border-blue-200 bg-[#EFF6FF] text-[#1A2766] sticky top-0 left-[560px] z-30 w-[120px] min-w-[120px] max-w-[120px] text-center shadow-[4px_0_6px_-2px_rgba(0,0,0,0.08)]">
                Max Level
              </th>
              
              {data?.historicalDates.map((d: string, i: number) => {
                const dateObj = new Date(d);
                const display = i === 0 ? 'Yesterday' : dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                return (
                  <th key={d} className="px-4 py-2.5 font-semibold border-b border-r border-gray-200 bg-gray-100 min-w-[90px] text-center z-20 sticky top-0">
                    <div className="flex flex-col items-center">
                      <span className="text-[13px] text-gray-800">{display}</span>
                      <span className="text-[10px] font-medium text-gray-500 mt-0.5">{dayName}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {categoryRoots.length === 0 ? (
              <tr>
                <td colSpan={data?.historicalDates.length + 4} className="px-4 py-12 text-center text-gray-500 bg-gray-50">
                  No inventory data matches your filters.
                </td>
              </tr>
            ) : (
              categoryRoots.map((root: any) => renderNode(root))
            )}
          </tbody>
        </table>
      </div>

      {/* Legend Footer */}
      <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between shrink-0 text-xs text-gray-600 font-medium">
        <div className="flex items-center gap-4">
          <span className="text-gray-400 uppercase tracking-wider font-bold text-[10px]">Stock Health:</span>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#2563EB] border border-blue-600 rounded-sm"></div> &gt; 100% Max</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#16A34A] border border-green-600 rounded-sm"></div> &gt; 66% Max</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#D97706] border border-amber-600 rounded-sm"></div> 33% - 66% Max</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#DC2626] border border-red-600 rounded-sm"></div> &lt; 33% Max</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#1F2937] border border-gray-800 rounded-sm"></div> Stock Out</div>
        </div>
        <div className="text-gray-500 text-[11px]">
          Showing {displayedCategories?.length || 0} categories &middot; {hierarchyRowCount || 0} hierarchy rows &middot; {productCount || 0} products
        </div>
      </div>

      {/* Grouping Modal */}
      {configModalFor && (
        <CategoryGroupingModal
          categoryId={configModalFor}
          categoryName={displayedCategories.find((c: any) => c.id === configModalFor)?.name || ''}
          availableAttributes={displayedCategories.find((c: any) => c.id === configModalFor)?.attributes || []}
          currentGroupBy={getCategoryGrouping(
            groupingStore, 
            configModalFor, 
            ['brand', ...(displayedCategories.find((c: any) => c.id === configModalFor)?.attributes.map((a: any) => a.id) || [])]
          )}
          onApply={handleApplyGrouping}
          onClose={() => setConfigModalFor(null)}
        />
      )}

    </div>
    </div>
  );
}
