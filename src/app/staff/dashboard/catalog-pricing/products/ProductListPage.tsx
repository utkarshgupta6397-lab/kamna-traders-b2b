'use client';
import { resolveProductImage } from '@/lib/utils';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, Filter, Settings2, Download, PackageOpen, Package, Box, Boxes, Tag, Layers, CheckCircle2, AlertCircle, RefreshCw, X, SortAsc, SortDesc, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import MasterStatusBadge from '../_framework/MasterStatusBadge';
import ImportFromZohoDialog from './_components/ImportFromZohoDialog';

const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

export default function ProductListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [records, setRecords] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryTotal, setCategoryTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [permissions, setPermissions] = useState<any>(null);
  
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [isFetching, setIsFetching] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState(searchParams.get('status') || 'ALL');
  const [type, setType] = useState(searchParams.get('type') || 'ALL');
  const [itemType, setItemType] = useState(searchParams.get('itemType') || 'ALL');
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') || 'ALL');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [brandId, setBrandId] = useState(searchParams.get('brandId') || '');
  const [manufacturerId, setManufacturerId] = useState(searchParams.get('manufacturerId') || '');
  const [hsnCodeId, setHsnCodeId] = useState(searchParams.get('hsnCodeId') || '');
  const [taxRateId, setTaxRateId] = useState(searchParams.get('taxRateId') || '');
  const [unitId, setUnitId] = useState(searchParams.get('unitId') || '');


  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [limit, setLimit] = useState(Number(searchParams.get('limit')) || 25);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>((searchParams.get('sortOrder') as any) || 'desc');

  useEffect(() => {
    console.log('[PRODUCTS-TRACE] PAGE_LOAD_START', { timestamp: new Date().toISOString() });
    const fetchPerms = async () => {
      const res = await fetch('/api/auth/session');
      if (res.ok) {
        const data = await res.json();
        setPermissions(data.session);
      }
    };
    fetchPerms();

    const fetchStats = async () => {
      try {
        const resStats = await fetch(`/api/staff/catalog/products/stats`);
        if (resStats.ok) {
          setStats(await resStats.json());
        }
      } catch (e) {
        console.error('Failed to load global stats', e);
      }
    };
    fetchStats();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== searchTerm) {
        console.log('[PRODUCTS-TRACE] SEARCH_CHANGED', { search: searchTerm });
        setSearch(searchTerm);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, search]);

  const fetchRecords = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    
    setIsFetching(true);
    if (records.length === 0) setLoading(true);

    if (abortControllerRef.current) {
      console.log('[PRODUCTS-TRACE] REQUEST_ABORTED', { reason: 'new request started' });
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    try {
      const q = new URLSearchParams();
      if (search) q.set('search', search);
      if (status !== 'ALL') q.set('status', status);
      if (type !== 'ALL') q.set('type', type);
      if (itemType !== 'ALL') q.set('itemType', itemType);
      if (categoryId !== 'ALL') q.set('categoryId', categoryId);
      
      q.set('sortBy', sortBy);
      q.set('sortOrder', sortOrder);
      q.set('page', page.toString());
      q.set('limit', limit.toString());

      // Send the exact same filters to category-stats so counts are dynamic
      const catQ = new URLSearchParams(q.toString());
      catQ.delete('categoryId'); // Category stats shouldn't be filtered by categoryId itself

      console.log('[PRODUCTS-TRACE] PRODUCT_REQUEST_START', { 
        search, status, type, itemType, categoryId, page, limit, sortBy, sortOrder 
      });
      const startTime = Date.now();

      const [resRecords, resCats] = await Promise.all([
        fetch(`/api/staff/catalog/products?${q.toString()}`, { signal }),
        fetch(`/api/staff/catalog/products/category-stats?${catQ.toString()}`, { signal })
      ]);

      if (resRecords.ok) {
        const data = await resRecords.json();
        setRecords(data.records);
        setTotal(data.total);
        console.log('[PRODUCTS-TRACE] PRODUCT_REQUEST_END', { 
          durationMs: Date.now() - startTime,
          resultCount: data.records.length,
          total: data.total
        });
      }
      
      if (resCats.ok) {
        const catsData = await resCats.json();
        const catsArray = Array.isArray(catsData) ? catsData : catsData.categories || [];
        setCategories(catsArray);
        
        if (catsData.total !== undefined) {
          setCategoryTotal(catsData.total);
        }

        // Reset categoryId to ALL if the currently selected category is not in the active categories list
        if (categoryId !== 'ALL' && !catsArray.some((c: any) => c.id === categoryId)) {
          setCategoryId('ALL');
        }
      }
      
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error('[PRODUCTS-TRACE] PRODUCT_REQUEST_ERROR', e);
      toast.error('Failed to load products');
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
        setIsFetching(false);
        setIsRefreshing(false);
        console.log('[PRODUCTS-TRACE] PAGE_RENDER_READY', { timestamp: new Date().toISOString() });
      }
    }
  }, [search, status, type, itemType, categoryId, sortBy, sortOrder, page, limit, records.length]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const KpiCard = ({ title, value, icon: Icon, color, onClick, active }: any) => (
    <div 
      onClick={onClick}
      className={`bg-white rounded-xl border p-4 flex items-center gap-4 cursor-pointer transition-all duration-200 hover:shadow-md ${active ? 'ring-2 ring-blue-500 border-blue-500 shadow-sm' : 'border-gray-200'}`}
    >
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={24} />
      </div>
      <div>
        <div className="text-gray-500 text-sm font-medium">{title}</div>
        <div className="text-2xl font-bold text-gray-900">{value ?? '...'}</div>
      </div>
    </div>
  );

  // Dynamic category counting
  const totalVisibleCount = categoryTotal > 0 ? categoryTotal : categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="min-h-screen bg-[#F6F8FB] pb-24">
      {/* Header */}
      <div className="pt-4 px-6 mb-4 max-w-[1600px] mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Products Master</h1>
              <p className="text-sm text-gray-500 mt-1.5">Manage your centralized catalog of goods and services</p>
            </div>
            <div className="flex items-center gap-3">
              {(permissions?.role === 'ADMIN' || permissions?.catalog_products_create) && (
                <>
                  <button 
                    onClick={() => setIsImportModalOpen(true)}
                    className="h-10 px-4 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-[13.5px] transition-colors shadow-sm inline-flex items-center gap-2"
                  >
                    <Download size={16} /> Import from Zoho
                  </button>
                  <button 
                    onClick={() => router.push('/staff/dashboard/catalog-pricing/products/create')}
                    className="h-10 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-[13.5px] transition-colors shadow-sm inline-flex items-center gap-2"
                  >
                    <Plus size={16} /> Create Product
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between gap-6">
            <div className="relative w-[500px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="text" 
                placeholder="Search by Product Name, SKU, Brand, Manufacturer, Category..."
                className="w-full pl-10 pr-4 h-[44px] text-[14px] bg-white border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/20 shadow-sm transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex flex-1 items-center gap-3">
              <select className="h-10 px-3 text-[13px] border-gray-200 rounded-lg text-gray-700 bg-white cursor-pointer hover:border-gray-300 transition-colors shadow-sm" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="ALL">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Approval Pending">Pending Approval</option>
                <option value="Draft">Draft</option>
                <option value="Archived">Archived</option>
              </select>
              
              <select className="h-10 px-3 text-[13px] border-gray-200 rounded-lg text-gray-700 bg-white cursor-pointer hover:border-gray-300 transition-colors shadow-sm" value={type} onChange={e => setType(e.target.value)}>
                <option value="ALL">All Types</option>
                <option value="Goods">Goods</option>
                <option value="Service">Services</option>
              </select>

              <select className="h-10 px-3 text-[13px] border-gray-200 rounded-lg text-gray-700 bg-white cursor-pointer hover:border-gray-300 transition-colors shadow-sm" value={itemType} onChange={e => setItemType(e.target.value)}>
                <option value="ALL">All Items</option>
                <option value="Standard">Standard</option>
                <option value="Parents">Parents</option>
                <option value="Variants">Variants</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => fetchRecords(true)} className="h-10 px-3 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:text-blue-600 transition-colors inline-flex items-center gap-2 shadow-sm">
                <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /> Refresh
              </button>
              <button className="h-10 px-3 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center gap-2 shadow-sm">
                <Download size={14} /> Export
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Total Products" value={stats?.total} icon={PackageOpen} color="bg-gray-100 text-gray-600" active={status === 'ALL' && type === 'ALL' && itemType === 'ALL'} onClick={() => { setStatus('ALL'); setType('ALL'); setItemType('ALL'); setPage(1); }} />
          <KpiCard title="Active Goods" value={stats?.goods} icon={Box} color="bg-blue-100 text-blue-600" active={type === 'Goods'} onClick={() => { setType('Goods'); setPage(1); }} />
          <KpiCard title="Services" value={stats?.services} icon={Layers} color="bg-purple-100 text-purple-600" active={type === 'Service'} onClick={() => { setType('Service'); setPage(1); }} />
          <KpiCard title="Approval Pending" value={stats?.pending} icon={AlertCircle} color="bg-orange-100 text-orange-600" active={status === 'Approval Pending'} onClick={() => { setStatus('Approval Pending'); setPage(1); }} />
        </div>

        <div className={`flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide transition-opacity duration-200 ${isFetching ? 'opacity-50 pointer-events-none' : ''}`}>
          <button onClick={() => { setCategoryId('ALL'); setPage(1); }} className={`px-3 py-1.5 rounded-full border text-[13px] font-medium whitespace-nowrap transition-colors ${categoryId === 'ALL' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            All ({isFetching ? '...' : totalVisibleCount})
          </button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => { setCategoryId(cat.id); setPage(1); }} className={`px-3 py-1.5 rounded-full border text-[13px] font-medium whitespace-nowrap transition-colors ${categoryId === cat.id ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {cat.name} ({isFetching ? '...' : cat.count})
            </button>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col relative">
          {isFetching && records.length > 0 && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-10 flex items-start justify-center pt-24">
              <div className="bg-white px-4 py-2.5 rounded-full shadow-lg border border-gray-100 flex items-center gap-3">
                <RefreshCw className="animate-spin text-blue-600" size={16} />
                <span className="text-sm font-medium text-gray-700">Updating results...</span>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-[1200px]">
              <thead>
                <tr className="bg-gray-50/80 border-b text-[12px] uppercase tracking-wider text-gray-500 font-semibold select-none">
                  <th className="px-4 py-3 w-12 text-center">#</th>
                  <th className="px-4 py-3 w-16">Img</th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('code')}>
                    <div className="flex items-center gap-1.5">SKU {sortBy === 'code' && (sortOrder === 'asc' ? <SortAsc size={14}/> : <SortDesc size={14}/>)}</div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors w-[300px]" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1.5">Product {sortBy === 'name' && (sortOrder === 'asc' ? <SortAsc size={14}/> : <SortDesc size={14}/>)}</div>
                  </th>
                  <th className="px-4 py-3">Brand & Mfr</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Tax & HSN</th>
                  <th className="px-4 py-3 font-mono">Selling Price</th>
                  <th className="px-4 py-3 text-center">Tracking</th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors text-center" onClick={() => handleSort('status')}>
                    <div className="flex items-center justify-center gap-1.5">Status {sortBy === 'status' && (sortOrder === 'asc' ? <SortAsc size={14}/> : <SortDesc size={14}/>)}</div>
                  </th>
                  <th className="px-4 py-3 w-[140px]">Updated By</th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors w-[140px]" onClick={() => handleSort('updatedAt')}>
                    <div className="flex items-center gap-1.5">Updated At {sortBy === 'updatedAt' && (sortOrder === 'asc' ? <SortAsc size={14}/> : <SortDesc size={14}/>)}</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-[13.5px] text-gray-800">
                {loading && records.length === 0 ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-4 py-2.5"><div className="h-4 w-6 bg-gray-200 rounded"></div></td>
                      <td className="px-4 py-2.5"><div className="h-10 w-10 bg-gray-200 rounded-lg"></div></td>
                      <td className="px-4 py-2.5"><div className="h-4 w-16 bg-gray-200 rounded"></div></td>
                      <td className="px-4 py-2.5"><div className="h-4 w-48 bg-gray-200 rounded mb-1"></div><div className="h-3 w-16 bg-gray-100 rounded"></div></td>
                      <td className="px-4 py-2.5"><div className="h-4 w-24 bg-gray-200 rounded"></div></td>
                      <td className="px-4 py-2.5"><div className="h-4 w-20 bg-gray-200 rounded"></div></td>
                      <td className="px-4 py-2.5"><div className="h-4 w-12 bg-gray-200 rounded"></div></td>
                      <td className="px-4 py-2.5"><div className="h-4 w-16 bg-gray-200 rounded"></div></td>
                      <td className="px-4 py-2.5"><div className="h-4 w-8 bg-gray-200 rounded mx-auto"></div></td>
                      <td className="px-4 py-2.5"><div className="h-5 w-20 bg-gray-200 rounded-full mx-auto"></div></td>
                      <td className="px-4 py-2.5"><div className="h-4 w-24 bg-gray-200 rounded"></div></td>
                      <td className="px-4 py-2.5"><div className="h-4 w-20 bg-gray-200 rounded mb-1"></div><div className="h-3 w-12 bg-gray-100 rounded"></div></td>
                    </tr>
                  ))
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-24 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <PackageOpen size={24} className="text-gray-400" />
                      </div>
                      <h3 className="text-gray-900 font-semibold mb-1">No products found</h3>
                      <p className="text-gray-500 text-sm mb-4">Try adjusting your filters or search query.</p>
                      <button onClick={() => { setSearch(''); setStatus('ALL'); setType('ALL'); setItemType('ALL'); setCategoryId('ALL'); }} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[13px] font-medium transition-colors">
                        Clear All Filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  records.map((product, index) => {
                    const variant = product.variants?.[0] || {};
                    const isGoods = product.type === 'Goods';
                    const isFamily = product.catalogType === 'PRODUCT_FAMILY';
                    const isVariant = !!product.parentProductId;
                    const rowIndex = (page - 1) * limit + index + 1;
                    
                    const dateObj = new Date(product.updatedAt);
                    const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                    const canEdit = permissions?.role === 'ADMIN' || permissions?.catalog_products_modify;
                    
                    let priceDisplay = '-';
                    if (product.variantProducts && product.variantProducts.length > 0) {
                      const prices = product.variantProducts.map((vp: any) => vp.variants?.[0]?.sellingPrice || 0).filter((p: number) => p > 0);
                      if (prices.length > 0) {
                        const min = Math.min(...prices);
                        const max = Math.max(...prices);
                        priceDisplay = min === max ? formatCurrency(min) : `${formatCurrency(min)} - ${formatCurrency(max)}`;
                      }
                    } else if (variant.sellingPrice) {
                      priceDisplay = formatCurrency(variant.sellingPrice);
                    }

                    return (
                      <tr 
                        key={product.id} 
                        className="hover:bg-blue-50/60 transition-colors group cursor-pointer" 
                        onClick={() => router.push(`/staff/dashboard/catalog-pricing/products/${product.id}`)}
                      >
                        <td className="px-4 py-2.5 text-center text-gray-500 text-[12px]">{rowIndex}</td>
                        <td className="px-4 py-2.5">
                          <div className="w-10 h-10 rounded-lg border bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
                            {resolveProductImage(product) ? (
                              <img src={resolveProductImage(product) as string} alt="" className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <Package size={16} className="text-gray-300" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-mono text-[13px] font-medium text-gray-700">{product.code}</div>
                          {isFamily && (
                            <div 
                              className="mt-1 flex items-center gap-1.5 text-indigo-600 w-fit cursor-help" 
                              title="Product Family - This is a parent catalog entry. Products are created inside this family after approval."
                            >
                              <Boxes size={14} className="shrink-0" />
                              <span className="inline-flex items-center px-1.5 py-[2px] rounded text-[10px] font-medium bg-indigo-50 border border-indigo-200 uppercase tracking-wide">
                                Family
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 max-w-[300px]">
                          <div className="font-semibold text-gray-900 truncate" title={product.name}>{product.name}</div>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${isGoods ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-purple-50 text-purple-600 border border-purple-100'}`}>
                              {product.type}
                            </span>
                            {product.variantProducts && product.variantProducts.length > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {product.variantProducts.length} Variants
                              </span>
                            )}
                          </div>
                          {isVariant && product.parentProduct && (
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-indigo-600 cursor-pointer" onClick={(e) => { e.stopPropagation(); router.push(`/staff/dashboard/catalog-pricing/products/${product.parentProductId}`); }}>
                              <Boxes size={12} className="shrink-0 opacity-70" />
                              <span className="hover:underline truncate" title={product.parentProduct.name}>Variant of {product.parentProduct.name}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-[13px] max-w-[160px] truncate">
                          <div className="text-gray-900 truncate" title={product.brand?.name}>{product.brand?.name || '-'}</div>
                          <div className="text-gray-500 text-[12px] truncate" title={product.manufacturer?.name}>{product.manufacturer?.name || '-'}</div>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 truncate max-w-[150px]" title={product.category?.name}>
                          {product.category?.name || '-'}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="text-gray-900 font-mono text-[12px]">{product.hsnCode?.code || '-'}</div>
                          <div className="text-gray-500 text-[12px]">{product.taxRate?.percentage}% GST</div>
                        </td>
                        <td className="px-4 py-2.5 font-mono font-medium text-gray-900">
                          {priceDisplay}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {variant.trackInventory ? <span title="Inventory Tracked"><CheckCircle2 size={16} className="text-indigo-500" /></span> : <span title="Not Tracked"><X size={16} className="text-gray-300" /></span>}
                            {variant.trackSerials && <span title="Serial Enabled"><Tag size={16} className="text-cyan-500" /></span>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <MasterStatusBadge status={product.status} />
                        </td>
                        <td className="px-4 py-2.5 text-gray-700 truncate max-w-[140px]" title={product.updatedBy?.name}>
                          {product.updatedBy?.name || '-'}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="text-gray-600 text-[12.5px] whitespace-nowrap">{dateStr}</div>
                          <div className="text-gray-400 text-[11.5px] whitespace-nowrap">{timeStr}</div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {total > 0 && (
            <div className="flex items-center justify-between px-6 py-3 border-t bg-gray-50/80">
              <div className="text-[13px] text-gray-500">
                Showing <span className="font-medium text-gray-900">{Math.min((page - 1) * limit + 1, total)}</span> to <span className="font-medium text-gray-900">{Math.min(page * limit, total)}</span> of <span className="font-medium text-gray-900">{total}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-gray-500">Rows:</span>
                  <select className="h-8 px-2 py-1 text-[13px] border-gray-200 rounded-md bg-white cursor-pointer hover:border-gray-300" value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 border border-gray-200 rounded-md bg-white text-[13px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Prev</button>
                  <button onClick={() => setPage(p => Math.min(Math.ceil(total/limit), p + 1))} disabled={page >= Math.ceil(total/limit)} className="px-3 py-1.5 border border-gray-200 rounded-md bg-white text-[13px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Next</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <ImportFromZohoDialog
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => {
          setIsImportModalOpen(false);
          fetchRecords(true);
        }}
      />
    </div>
  );
}
