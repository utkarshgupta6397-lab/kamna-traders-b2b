'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, Filter, Settings2, Download, PackageOpen, Package, Box, Tag, Layers, CheckCircle2, AlertCircle, RefreshCw, X, SortAsc, SortDesc, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import MasterStatusBadge from '../_framework/MasterStatusBadge';

const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

export default function ProductListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [records, setRecords] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [categories, setCategories] = useState<{id: string, name: string, count: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [permissions, setPermissions] = useState<any>(null);
  
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || 'ALL');
  const [type, setType] = useState(searchParams.get('type') || 'ALL');
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') || 'ALL');

  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [limit, setLimit] = useState(Number(searchParams.get('limit')) || 25);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>((searchParams.get('sortOrder') as any) || 'desc');

  useEffect(() => {
    const fetchPerms = async () => {
      const res = await fetch('/api/auth/session');
      if (res.ok) {
        const session = await res.json();
        setPermissions(session);
      }
    };
    fetchPerms();
  }, []);

  const fetchRecords = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setLoading(true);

    try {
      const q = new URLSearchParams();
      if (search) q.set('search', search);
      if (status !== 'ALL') q.set('status', status);
      if (type !== 'ALL') q.set('type', type);
      if (categoryId !== 'ALL') q.set('categoryId', categoryId);
      
      q.set('sortBy', sortBy);
      q.set('sortOrder', sortOrder);
      q.set('page', page.toString());
      q.set('limit', limit.toString());

      // Send the exact same filters to category-stats so counts are dynamic
      const catQ = new URLSearchParams(q.toString());
      catQ.delete('categoryId'); // Category stats shouldn't be filtered by categoryId itself

      const [resRecords, resStats, resCats] = await Promise.all([
        fetch(`/api/staff/catalog/products?${q.toString()}`),
        fetch(`/api/staff/catalog/products/stats`),
        fetch(`/api/staff/catalog/products/category-stats?${catQ.toString()}`)
      ]);

      if (resRecords.ok) {
        const data = await resRecords.json();
        setRecords(data.records);
        setTotal(data.total);
      }
      if (resStats.ok) setStats(await resStats.json());
      if (resCats.ok) setCategories(await resCats.json());
      
    } catch (e) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [search, status, type, categoryId, sortBy, sortOrder, page, limit]);

  useEffect(() => {
    const delay = setTimeout(() => fetchRecords(), 300);
    return () => clearTimeout(delay);
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
  const totalVisibleCount = categories.reduce((sum, c) => sum + c.count, 0);

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
                <button 
                  onClick={() => router.push('/staff/dashboard/catalog-pricing/products/create')}
                  className="h-10 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-[13.5px] transition-colors shadow-sm inline-flex items-center gap-2"
                >
                  <Plus size={16} /> Create Product
                </button>
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
                value={search}
                onChange={e => setSearch(e.target.value)}
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
          <KpiCard title="Total Products" value={stats?.total} icon={PackageOpen} color="bg-gray-100 text-gray-600" active={status === 'ALL' && type === 'ALL'} onClick={() => { setStatus('ALL'); setType('ALL'); setPage(1); }} />
          <KpiCard title="Active Goods" value={stats?.goods} icon={Box} color="bg-blue-100 text-blue-600" active={type === 'Goods'} onClick={() => { setType('Goods'); setPage(1); }} />
          <KpiCard title="Services" value={stats?.services} icon={Layers} color="bg-purple-100 text-purple-600" active={type === 'Service'} onClick={() => { setType('Service'); setPage(1); }} />
          <KpiCard title="Approval Pending" value={stats?.pending} icon={AlertCircle} color="bg-orange-100 text-orange-600" active={status === 'Approval Pending'} onClick={() => { setStatus('Approval Pending'); setPage(1); }} />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button onClick={() => { setCategoryId('ALL'); setPage(1); }} className={`px-3 py-1.5 rounded-full border text-[13px] font-medium whitespace-nowrap transition-colors ${categoryId === 'ALL' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            All ({totalVisibleCount})
          </button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => { setCategoryId(cat.id); setPage(1); }} className={`px-3 py-1.5 rounded-full border text-[13px] font-medium whitespace-nowrap transition-colors ${categoryId === cat.id ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
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
                      <button onClick={() => { setSearch(''); setStatus('ALL'); setType('ALL'); setCategoryId('ALL'); }} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[13px] font-medium transition-colors">
                        Clear All Filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  records.map((product, index) => {
                    const variant = product.variants?.[0] || {};
                    const isGoods = product.type === 'Goods';
                    const rowIndex = (page - 1) * limit + index + 1;
                    
                    const dateObj = new Date(product.updatedAt);
                    const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                    const canEdit = permissions?.role === 'ADMIN' || permissions?.catalog_products_modify;

                    return (
                      <tr 
                        key={product.id} 
                        className="hover:bg-blue-50/60 transition-colors group cursor-pointer" 
                        onClick={() => router.push(canEdit ? `/staff/dashboard/catalog-pricing/products/create?edit=${product.id}` : `/staff/dashboard/catalog-pricing/products/${product.id}`)}
                      >
                        <td className="px-4 py-2.5 text-center text-gray-500 text-[12px]">{rowIndex}</td>
                        <td className="px-4 py-2.5">
                          <div className="w-10 h-10 rounded-lg border bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
                            {product.thumbnailBase64 ? (
                              <img src={product.thumbnailBase64} alt="" className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <Package size={16} className="text-gray-300" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[13px] font-medium text-gray-700">{product.code}</td>
                        <td className="px-4 py-2.5 max-w-[300px]">
                          <div className="font-semibold text-gray-900 truncate" title={product.name}>{product.name}</div>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${isGoods ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-purple-50 text-purple-600 border border-purple-100'}`}>
                              {product.type}
                            </span>
                          </div>
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
                          {variant.sellingPrice ? formatCurrency(variant.sellingPrice) : '-'}
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
    </div>
  );
}
