'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, Check, X, Infinity, PackageX, Box } from 'lucide-react';
import toast from 'react-hot-toast';

interface Category {
  id: string;
  name: string;
}

interface Brand {
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

export default function UnlimitedSkusClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [unlimitedFilter, setUnlimitedFilter] = useState('ALL'); // ALL, UNLIMITED, NORMAL
  const [searchQuery, setSearchQuery] = useState('');
  
  const [skus, setSkus] = useState<SkuInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ totalSkus: 0, unlimitedSkus: 0 });
  const [loading, setLoading] = useState(true);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Bulk Edit
  const [selectedSkuIds, setSelectedSkuIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchSkus();
  }, [selectedCategory, selectedBrand, unlimitedFilter, searchQuery, currentPage, pageSize]);

  const fetchMetadata = async () => {
    try {
      const res = await fetch('/api/staff/zone-mapping/metadata'); // Reuse metadata API for dropdowns
      const data = await res.json();
      setCategories(data.categories || []);
      // Quick way to get brands is usually through another API, but we might just have it or skip if not easily available
      // Actually `zone-mapping/metadata` returns warehouses & categories. Let's rely on categories.
    } catch (err) {
      console.error('Failed to fetch metadata:', err);
    }
  };

  const fetchSkus = async () => {
    setLoading(true);
    setSelectedSkuIds(new Set());
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        categoryId: selectedCategory,
        brandId: selectedBrand,
        unlimitedFilter,
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
    try {
      const res = await fetch('/api/staff/unlimited-skus/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skuIds: [skuId], isUnlimited })
      });
      if (res.ok) {
        toast.success(`SKU marked as ${isUnlimited ? 'Unlimited' : 'Normal'}`);
        fetchSkus();
      } else {
        throw new Error('Failed to update');
      }
    } catch (err) {
      toast.error('Update failed');
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
        fetchSkus();
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
    if (selectedSkuIds.size === skus.length && skus.length > 0) {
      setSelectedSkuIds(new Set());
    } else {
      setSelectedSkuIds(new Set(skus.map(m => m.id)));
    }
  };

  const toggleSelect = (skuId: string) => {
    const newSet = new Set(selectedSkuIds);
    if (newSet.has(skuId)) newSet.delete(skuId);
    else newSet.add(skuId);
    setSelectedSkuIds(newSet);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* 1. Header & Filters */}
      <div className="p-4 border-b border-gray-100 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Infinity className="text-emerald-500" size={24} />
              Unlimited Inventory SKUs
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Mark SKUs to bypass inventory tracking and always remain in stock.
            </p>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-center min-w-[100px]">
              <div className="text-2xl font-bold text-gray-900">{stats.totalSkus}</div>
              <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Total SKUs</div>
            </div>
            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 text-center min-w-[100px]">
              <div className="text-2xl font-bold text-emerald-700">{stats.unlimitedSkus}</div>
              <div className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider">Unlimited</div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-gray-50/50 p-3 rounded-lg border border-gray-100">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by SKU ID or Name..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:border-[#1A2766]"
            value={unlimitedFilter}
            onChange={(e) => setUnlimitedFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="UNLIMITED">Only Unlimited</option>
            <option value="NORMAL">Only Normal</option>
          </select>

          <select
            className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:border-[#1A2766] max-w-[200px]"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="ALL">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Bulk Action Bar */}
      {selectedSkuIds.size > 0 && (
        <div className="bg-[#1A2766] px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-md">
          <div className="flex items-center gap-3">
            <span className="bg-white/20 text-white text-xs font-bold px-2 py-1 rounded">
              {selectedSkuIds.size} Selected
            </span>
            <span className="text-white/80 text-sm">Choose bulk action:</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkToggle(true)}
              disabled={isBulkUpdating}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold rounded shadow flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {isBulkUpdating ? <Loader2 size={16} className="animate-spin" /> : <Infinity size={16} />}
              Mark Unlimited
            </button>
            <button
              onClick={() => handleBulkToggle(false)}
              disabled={isBulkUpdating}
              className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-sm font-semibold rounded shadow flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {isBulkUpdating ? <Loader2 size={16} className="animate-spin" /> : <PackageX size={16} />}
              Remove Unlimited
            </button>
          </div>
        </div>
      )}

      {/* 3. Table */}
      <div className="overflow-x-auto min-h-[400px]">
        {loading && skus.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-gray-400 flex-col gap-3">
            <Loader2 className="animate-spin" size={32} />
            <p className="text-sm font-medium">Loading SKUs...</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={skus.length > 0 && selectedSkuIds.size === skus.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-[#1A2766] focus:ring-[#1A2766]"
                  />
                </th>
                <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">SKU Details</th>
                <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">Status</th>
                <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Updated</th>
                <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {skus.map((sku) => (
                <tr 
                  key={sku.id} 
                  className={`hover:bg-gray-50/50 transition-colors ${selectedSkuIds.has(sku.id) ? 'bg-blue-50/30' : ''}`}
                >
                  <td className="p-3 text-center align-middle">
                    <input
                      type="checkbox"
                      checked={selectedSkuIds.has(sku.id)}
                      onChange={() => toggleSelect(sku.id)}
                      className="rounded border-gray-300 text-[#1A2766] focus:ring-[#1A2766]"
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs font-bold text-[#1A2766]">{sku.id}</span>
                      <span className="text-sm font-medium text-gray-900 mt-0.5">{sku.name}</span>
                      <span className="text-[10px] font-medium text-gray-500 uppercase mt-0.5 tracking-wider bg-gray-100 px-1.5 py-0.5 rounded w-max">
                        {sku.category?.name || 'Uncategorized'}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    {sku.isUnlimited ? (
                      <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md text-xs font-bold tracking-wide">
                        <Infinity size={14} />
                        UNLIMITED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 border border-gray-200 px-2.5 py-1 rounded-md text-xs font-semibold">
                        <Box size={14} />
                        NORMAL
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-gray-900">{formatDateCompact(sku.updatedAt)}</span>
                      {sku.updatedBy?.name && (
                        <span className="text-[10px] text-gray-500 font-medium mt-0.5">{sku.updatedBy.name}</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleToggle(sku.id, !sku.isUnlimited)}
                      className={`text-xs font-bold px-3 py-1.5 rounded transition-colors ${
                        sku.isUnlimited 
                          ? 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                          : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                      }`}
                    >
                      {sku.isUnlimited ? 'Set Normal' : 'Set Unlimited'}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && skus.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Box className="opacity-20" size={48} />
                      <p>No SKUs found matching your filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* 4. Pagination */}
      {totalPages > 0 && (
        <div className="border-t border-gray-100 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Rows per page:</span>
            <select
              className="border border-gray-200 rounded px-2 py-1 text-sm bg-white"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, total)} of {total}
            </span>
            <div className="flex gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1 border border-gray-200 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-sm font-medium"
              >
                Prev
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1 border border-gray-200 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-sm font-medium"
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
