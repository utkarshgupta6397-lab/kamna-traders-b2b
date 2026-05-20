'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, Check, X, Infinity, PackageX, Box, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

interface Category {
  id: string;
  name: string;
}

interface SkuInfo {
  id: string;
  name: string;
  isUnlimited: boolean;
  category: { name: string } | null;
  updatedAt: string | null;
  updatedBy: { name: string } | null;
}

const formatDateCompact = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  const day = d.getDate().toString().padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = d.getFullYear();
  const time = d.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${day}-${month}-${year} ${time}`;
};

interface MultiSelectProps {
  label: string;
  placeholder: string;
  options: { id: string; name: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

function MultiSelectDropdown({ label, placeholder, options, selectedIds, onChange }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = useMemo(() => {
    return options.filter(opt => opt.name.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  const toggleOption = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(x => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = () => setIsOpen(false);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [isOpen]);

  return (
    <div className="relative inline-block w-full sm:w-auto text-left" onClick={(e) => e.stopPropagation()}>
      <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded text-xs text-gray-700 cursor-pointer hover:border-gray-300 min-h-[28px] w-full sm:min-w-[130px] select-none"
      >
        <span className="truncate max-w-[100px] font-medium">
          {selectedIds.length === 0 ? placeholder : `${selectedIds.length} Selected`}
        </span>
        <div className="flex items-center gap-1">
          {selectedIds.length > 0 && (
            <X 
              size={11} 
              className="text-gray-400 hover:text-gray-600 cursor-pointer" 
              onClick={handleClearAll}
            />
          )}
          <ChevronDown size={12} className="text-gray-400" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute left-0 mt-0.5 w-52 bg-white border border-gray-250 rounded shadow-lg z-30 py-1">
          <div className="px-2 pb-1 border-b border-gray-100 flex items-center gap-1.5">
            <Search size={11} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs outline-none bg-transparent py-0.5"
              autoFocus
            />
          </div>
          <div className="max-h-40 overflow-y-auto mt-1">
            {filteredOptions.length === 0 ? (
              <div className="px-2.5 py-1.5 text-xs text-gray-400">No results</div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = selectedIds.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    onClick={() => toggleOption(opt.id)}
                    className="flex items-center gap-2 px-2.5 py-1 hover:bg-gray-50 text-xs text-gray-700 cursor-pointer"
                  >
                    <div className={`w-3 h-3 border rounded flex items-center justify-center ${isSelected ? 'bg-[#1A2766] border-[#1A2766]' : 'border-gray-300'}`}>
                      {isSelected && <Check size={8} className="text-white" />}
                    </div>
                    <span className="truncate select-none">{opt.name}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function UnlimitedSkusClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedStatusFilters, setSelectedStatusFilters] = useState<string[]>([]);
  const [searchVal, setSearchVal] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [skus, setSkus] = useState<SkuInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ totalSkus: 0, unlimitedSkus: 0 });
  const [loading, setLoading] = useState(true);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [updatingSkuIds, setUpdatingSkuIds] = useState<Record<string, boolean>>({});

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Bulk Edit
  const [selectedSkuIds, setSelectedSkuIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchMetadata();
  }, []);

  // Debounced input search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchVal);
      setCurrentPage(1);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchVal]);

  // When filters change, reset back to page 1
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategoryIds, selectedStatusFilters, pageSize]);

  useEffect(() => {
    fetchSkus();
  }, [selectedCategoryIds, selectedStatusFilters, searchQuery, currentPage, pageSize]);

  const fetchMetadata = async () => {
    try {
      const res = await fetch('/api/staff/zone-mapping/metadata');
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Failed to fetch metadata:', err);
    }
  };

  const fetchSkus = async () => {
    setLoading(true);
    setSelectedSkuIds(new Set());
    try {
      const categoryParam = selectedCategoryIds.length > 0 ? selectedCategoryIds.join(',') : 'ALL';
      const statusParam = selectedStatusFilters.length > 0 ? selectedStatusFilters.join(',') : 'ALL';

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        categoryId: categoryParam,
        unlimitedFilter: statusParam,
        search: searchQuery
      });
      const res = await fetch(`/api/staff/unlimited-skus?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch SKUs');
      const data = await res.json();
      setSkus(data.skus || []);
      setTotal(data.total || 0);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error('Failed to fetch SKUs:', err);
      toast.error('Failed to load SKUs');
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const handleToggle = async (skuId: string, isUnlimited: boolean) => {
    if (updatingSkuIds[skuId]) return;
    setUpdatingSkuIds(prev => ({ ...prev, [skuId]: true }));
    try {
      const res = await fetch('/api/staff/unlimited-skus/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skuIds: [skuId], isUnlimited })
      });
      if (res.ok) {
        toast.success(`SKU marked as ${isUnlimited ? 'Unlimited' : 'Normal'}`);
        await fetchSkus();
      } else {
        throw new Error('Failed to update');
      }
    } catch (err) {
      toast.error('Update failed');
    } finally {
      setUpdatingSkuIds(prev => {
        const next = { ...prev };
        delete next[skuId];
        return next;
      });
    }
  };

  const handleBulkToggle = async (isUnlimited: boolean) => {
    if (selectedSkuIds.size === 0) return;
    setIsBulkUpdating(true);
    try {
      const res = await fetch('/api/staff/unlimited-skus/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skuIds: Array.from(selectedSkuIds), isUnlimited })
      });
      if (res.ok) {
        toast.success(`Successfully updated ${selectedSkuIds.size} SKUs`);
        await fetchSkus();
        setSelectedSkuIds(new Set());
      } else {
        throw new Error('Bulk update failed');
      }
    } catch (err) {
      toast.error('Bulk update failed');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedSkuIds.size === filteredSkus.length && filteredSkus.length > 0) {
      setSelectedSkuIds(new Set());
    } else {
      setSelectedSkuIds(new Set(filteredSkus.map(m => m.id)));
    }
  };

  const toggleSelect = (skuId: string) => {
    const newSet = new Set(selectedSkuIds);
    if (newSet.has(skuId)) newSet.delete(skuId);
    else newSet.add(skuId);
    setSelectedSkuIds(newSet);
  };

  const resetFilters = () => {
    setSelectedCategoryIds([]);
    setSelectedStatusFilters([]);
    setSearchVal('');
  };

  // Instant client-side fuzzy search on current loaded page for zero-lag filtering
  const filteredSkus = useMemo(() => {
    if (!searchVal.trim()) return skus;
    const val = searchVal.toLowerCase().trim();
    return skus.filter(s => 
      s.id.toLowerCase().includes(val) ||
      s.name.toLowerCase().includes(val) ||
      (s.category?.name || '').toLowerCase().includes(val)
    );
  }, [skus, searchVal]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
      {/* 1. Header Area - Compact */}
      <div className="p-3 border-b border-gray-100 flex flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <Infinity className="text-emerald-500" size={18} />
            Unlimited Inventory SKUs
          </h2>
          <p className="text-[10px] text-gray-500 mt-0.5">
            Manage items that bypass inventory checking and always remain in stock.
          </p>
        </div>
        
        <div className="flex gap-2">
          <div className="bg-gray-50 px-2 py-0.5 rounded border border-gray-150 flex items-center gap-2">
            <span className="text-xs font-bold text-gray-900">{stats.totalSkus}</span>
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Total</span>
          </div>
          <div className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-700">{stats.unlimitedSkus}</span>
            <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Unlimited</span>
          </div>
        </div>
      </div>

      {/* 2. Sticky Filter Bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 py-1.5 px-3 shadow-sm flex flex-col gap-1.5">
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={11} />
              <input
                type="text"
                placeholder="Fuzzy search SKU ID, name..."
                className="w-full pl-7 pr-7 py-1 bg-gray-50/50 border border-gray-200 rounded text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#1A2766] transition-all"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
              />
              {searchVal && (
                <X 
                  size={12} 
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer" 
                  onClick={() => setSearchVal('')}
                />
              )}
            </div>
          </div>

          <MultiSelectDropdown
            label="Category Filter"
            placeholder="All Categories"
            options={categories}
            selectedIds={selectedCategoryIds}
            onChange={setSelectedCategoryIds}
          />

          <MultiSelectDropdown
            label="Status Filter"
            placeholder="All Statuses"
            options={[
              { id: 'UNLIMITED', name: 'UNLIMITED' },
              { id: 'NORMAL', name: 'NORMAL' }
            ]}
            selectedIds={selectedStatusFilters}
            onChange={setSelectedStatusFilters}
          />
        </div>

        {/* Selected chips/tags */}
        {(selectedCategoryIds.length > 0 || selectedStatusFilters.length > 0 || searchVal) && (
          <div className="flex flex-wrap gap-1 items-center pt-0.5">
            <span className="text-[9px] text-gray-500 font-bold uppercase mr-1">Active:</span>
            {searchVal && (
              <span className="inline-flex items-center gap-1 bg-gray-150 text-gray-700 border border-gray-200 rounded px-1.5 py-0.5 text-[9px] font-medium">
                Search: {searchVal}
                <X size={8} className="cursor-pointer hover:text-gray-900" onClick={() => setSearchVal('')} />
              </span>
            )}
            {selectedCategoryIds.map(catId => {
              const cat = categories.find(c => c.id === catId);
              if (!cat) return null;
              return (
                <span key={catId} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-150 rounded px-1.5 py-0.5 text-[9px] font-medium">
                  {cat.name}
                  <X size={8} className="cursor-pointer hover:text-blue-900" onClick={() => setSelectedCategoryIds(selectedCategoryIds.filter(id => id !== catId))} />
                </span>
              );
            })}
            {selectedStatusFilters.map(status => (
              <span key={status} className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-150 rounded px-1.5 py-0.5 text-[9px] font-medium">
                {status}
                <X size={8} className="cursor-pointer hover:text-emerald-900" onClick={() => setSelectedStatusFilters(selectedStatusFilters.filter(s => s !== status))} />
              </span>
            ))}
            <button 
              onClick={resetFilters} 
              className="text-[9px] text-red-600 hover:text-red-800 font-bold uppercase ml-1.5 hover:underline"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* 3. Bulk Action Bar */}
      {selectedSkuIds.size > 0 && (
        <div className="bg-[#1A2766] px-3 py-1.5 flex items-center justify-between sticky top-[68px] z-10 shadow-md">
          <div className="flex items-center gap-2">
            <span className="bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
              {selectedSkuIds.size} Selected
            </span>
            <span className="text-white/80 text-xs">Bulk action:</span>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => handleBulkToggle(true)}
              disabled={isBulkUpdating}
              className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold rounded flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {isBulkUpdating ? <Loader2 size={12} className="animate-spin" /> : <Infinity size={12} />}
              Mark Unlimited
            </button>
            <button
              onClick={() => handleBulkToggle(false)}
              disabled={isBulkUpdating}
              className="px-2.5 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs font-semibold rounded flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {isBulkUpdating ? <Loader2 size={12} className="animate-spin" /> : <PackageX size={12} />}
              Remove Unlimited
            </button>
          </div>
        </div>
      )}

      {/* 4. Table */}
      <div className="overflow-x-auto min-h-[350px]">
        {loading && filteredSkus.length === 0 ? (
          <div className="flex items-center justify-center h-[250px] text-gray-400 flex-col gap-2">
            <Loader2 className="animate-spin text-gray-400" size={24} />
            <p className="text-xs font-medium">Loading SKUs...</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-2 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={filteredSkus.length > 0 && selectedSkuIds.size === filteredSkus.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-[#1A2766] focus:ring-[#1A2766] w-3 h-3 cursor-pointer"
                  />
                </th>
                <th className="p-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">SKU Details</th>
                <th className="p-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-center">Status</th>
                <th className="p-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Last Updated</th>
                <th className="p-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredSkus.map((sku) => (
                <tr 
                  key={sku.id} 
                  className={`hover:bg-gray-50/50 transition-colors ${selectedSkuIds.has(sku.id) ? 'bg-blue-50/20' : ''}`}
                >
                  <td className="py-1 px-2 text-center align-middle">
                    <input
                      type="checkbox"
                      checked={selectedSkuIds.has(sku.id)}
                      onChange={() => toggleSelect(sku.id)}
                      className="rounded border-gray-300 text-[#1A2766] focus:ring-[#1A2766] w-3 h-3 cursor-pointer"
                    />
                  </td>
                  <td className="py-1 px-2 align-middle">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] font-bold text-[#1A2766] bg-gray-100 px-1 py-0.5 rounded select-all">{sku.id}</span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-gray-900 truncate max-w-[240px]" title={sku.name}>{sku.name}</span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                          {sku.category?.name || 'Uncategorized'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-1 px-2 text-center align-middle">
                    {sku.isUnlimited ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-150 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide w-max select-none">
                        <Infinity size={10} />
                        UNLIMITED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-gray-50 text-gray-500 border border-gray-150 px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wide w-max select-none">
                        <Box size={10} />
                        NORMAL
                      </span>
                    )}
                  </td>
                  <td className="py-1 px-2 align-middle">
                    <div className="flex flex-col text-[10px]">
                      <span className="font-medium text-gray-700">{formatDateCompact(sku.updatedAt)}</span>
                      {sku.updatedBy?.name && (
                        <span className="text-gray-400 font-medium text-[9px]">{sku.updatedBy.name}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-1 px-2 text-right align-middle">
                    <button
                      onClick={() => handleToggle(sku.id, !sku.isUnlimited)}
                      disabled={!!updatingSkuIds[sku.id]}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors inline-flex items-center justify-center gap-1 min-w-[90px] ${
                        sku.isUnlimited 
                          ? 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                          : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                      }`}
                    >
                      {updatingSkuIds[sku.id] ? (
                        <Loader2 size={10} className="animate-spin text-gray-400" />
                      ) : sku.isUnlimited ? (
                        'Set Normal'
                      ) : (
                        'Set Unlimited'
                      )}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filteredSkus.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <PackageX className="opacity-30 text-gray-400 animate-pulse" size={32} />
                      <p className="text-xs font-semibold text-gray-700">No SKUs found</p>
                      <p className="text-[10px] text-gray-400">Try adjusting your filters or search query.</p>
                      <button 
                        onClick={resetFilters}
                        className="mt-1 px-3 py-1 bg-[#1A2766] hover:bg-[#152052] text-white text-[10px] font-bold rounded shadow transition-all"
                      >
                        Reset Filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* 5. Pagination */}
      {totalPages > 0 && (
        <div className="border-t border-gray-150 py-1.5 px-3 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <span>Rows:</span>
            <select
              className="border border-gray-200 rounded px-1 py-0.5 text-xs bg-white cursor-pointer focus:outline-none"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
              }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <span>
              {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, total)} of {total}
            </span>
            <div className="flex gap-0.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-2 py-0.5 border border-gray-200 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 text-xs font-semibold"
              >
                Prev
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-2 py-0.5 border border-gray-200 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 text-xs font-semibold"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
