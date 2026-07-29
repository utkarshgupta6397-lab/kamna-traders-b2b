'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, RefreshCw, Layers, CheckCircle2, AlertCircle, Archive, Edit2, Eye, RotateCcw, Box, Hash } from 'lucide-react';
import toast from 'react-hot-toast';
import MasterStatusBadge from '../_framework/MasterStatusBadge';

export default function ProductAttributesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [records, setRecords] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, any>>({});
  
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || 'ALL');
  const [dataType, setDataType] = useState(searchParams.get('dataType') || 'ALL');
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);

  // Fetch User Permissions
  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.session) {
          setPermissions(data.session);
        }
      })
      .catch(() => {});
  }, []);

  const canCreate = Boolean(permissions.role === 'ADMIN' || permissions.catalog_product_attributes_create);
  const canModify = Boolean(permissions.role === 'ADMIN' || permissions.catalog_product_attributes_modify);
  const canArchive = Boolean(permissions.role === 'ADMIN' || permissions.catalog_product_attributes_archive);
  const canView = canModify || canCreate || Boolean(permissions.role === 'ADMIN');
  
  const fetchRecords = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setLoading(true);

    try {
      const q = new URLSearchParams();
      if (search) q.set('search', search);
      if (status !== 'ALL') q.set('status', status);
      if (dataType !== 'ALL') q.set('dataType', dataType);
      q.set('page', page.toString());
      
      const [resRecords, resStats] = await Promise.all([
        fetch(`/api/staff/catalog/product-attributes?${q.toString()}`),
        fetch(`/api/staff/catalog/product-attributes/stats?${q.toString()}`)
      ]);

      if (resRecords.ok) {
        const data = await resRecords.json();
        setRecords(data.records || []);
        setTotal(data.total || 0);
      }
      if (resStats.ok) {
        setStats(await resStats.json());
      }
    } catch (e) {
      toast.error('Failed to load attributes');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [search, status, dataType, page]);

  useEffect(() => {
    const delay = setTimeout(() => fetchRecords(), 300);
    return () => clearTimeout(delay);
  }, [fetchRecords]);

  const toggleStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
      const recordToUpdate = records.find(r => r.id === id);
      if (!recordToUpdate) return;
      
      const payload = {
        ...recordToUpdate,
        status: newStatus,
        categories: (recordToUpdate.categories || []).map((c: any) => c.categoryId)
      };

      const res = await fetch(`/api/staff/catalog/product-attributes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Failed to update status');
      toast.success(`Attribute marked ${newStatus}`);
      fetchRecords(true);
    } catch (e: any) {
      toast.error(e.message);
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

  return (
    <div className="min-h-screen bg-[#F6F8FB] pb-24">
      {/* Header */}
      <div className="pt-4 px-6 mb-4 max-w-[1600px] mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Product Attributes</h1>
              <p className="text-sm text-gray-500 mt-1.5">Manage custom attributes mapped to categories</p>
            </div>
            <div className="flex items-center gap-3">
              {canCreate && (
                <button 
                  onClick={() => router.push('/staff/dashboard/catalog-pricing/product-attributes/create')}
                  className="h-10 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-[13.5px] transition-colors shadow-sm inline-flex items-center gap-2"
                >
                  <Plus size={16} /> Create Attribute
                </button>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between gap-6">
            <div className="relative w-[500px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="text" 
                placeholder="Search by Attribute Name, Code..."
                className="w-full pl-10 pr-4 h-[44px] text-[14px] bg-white border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/20 shadow-sm transition-all"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            
            <div className="flex flex-1 items-center gap-3">
              <select className="h-10 px-3 text-[13px] border-gray-200 rounded-lg text-gray-700 bg-white cursor-pointer hover:border-gray-300 transition-colors shadow-sm" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="ALL">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              
              <select className="h-10 px-3 text-[13px] border-gray-200 rounded-lg text-gray-700 bg-white cursor-pointer hover:border-gray-300 transition-colors shadow-sm" value={dataType} onChange={e => setDataType(e.target.value)}>
                <option value="ALL">All Data Types</option>
                <option value="Text">Text</option>
                <option value="Number">Number</option>
                <option value="Decimal">Decimal</option>
                <option value="Dropdown">Dropdown</option>
                <option value="Multi Select">Multi Select</option>
                <option value="Date">Date</option>
                <option value="Boolean">Boolean</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => fetchRecords(true)} className="h-10 px-3 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:text-blue-600 transition-colors inline-flex items-center gap-2 shadow-sm">
                <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Total Attributes" value={stats?.total} icon={Layers} color="bg-gray-100 text-gray-600" active={status === 'ALL'} onClick={() => { setStatus('ALL'); setPage(1); }} />
          <KpiCard title="Active" value={stats?.active} icon={CheckCircle2} color="bg-green-100 text-green-600" active={status === 'Active'} onClick={() => { setStatus('Active'); setPage(1); }} />
          <KpiCard title="Inactive" value={stats?.inactive} icon={Archive} color="bg-gray-200 text-gray-700" active={status === 'Inactive'} onClick={() => { setStatus('Inactive'); setPage(1); }} />
          <KpiCard title="Mandatory Rules" value={stats?.mandatory} icon={AlertCircle} color="bg-amber-100 text-amber-600" active={false} onClick={() => {}} />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-[1200px]">
              <thead>
                <tr className="bg-gray-50/80 border-b text-[12px] uppercase tracking-wider text-gray-500 font-semibold select-none sticky top-0 z-10">
                  <th className="px-4 py-3 w-12 text-center">#</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Attribute Name</th>
                  <th className="px-4 py-3">Data Type</th>
                  <th className="px-4 py-3">Mapped Category</th>
                  <th className="px-4 py-3 text-center">Mandatory</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 w-[140px]">Updated By</th>
                  <th className="px-4 py-3 w-[140px]">Updated At</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-[13.5px] text-gray-800">
                {loading && records.length === 0 ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-4 py-2.5"><div className="h-4 w-6 bg-gray-200 rounded"></div></td>
                      <td className="px-4 py-2.5"><div className="h-4 w-16 bg-gray-200 rounded"></div></td>
                      <td className="px-4 py-2.5"><div className="h-4 w-32 bg-gray-200 rounded"></div></td>
                      <td className="px-4 py-2.5"><div className="h-4 w-20 bg-gray-200 rounded"></div></td>
                      <td className="px-4 py-2.5"><div className="h-4 w-24 bg-gray-200 rounded"></div></td>
                      <td className="px-4 py-2.5"><div className="h-4 w-12 bg-gray-200 rounded mx-auto"></div></td>
                      <td className="px-4 py-2.5"><div className="h-5 w-20 bg-gray-200 rounded-full mx-auto"></div></td>
                      <td className="px-4 py-2.5"><div className="h-4 w-24 bg-gray-200 rounded"></div></td>
                      <td className="px-4 py-2.5"><div className="h-4 w-20 bg-gray-200 rounded"></div></td>
                      <td className="px-4 py-2.5"><div className="h-8 w-24 bg-gray-200 rounded ml-auto"></div></td>
                    </tr>
                  ))
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-24 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Hash size={24} className="text-gray-400" />
                      </div>
                      <h3 className="text-gray-900 font-semibold mb-1">No attributes found</h3>
                      <p className="text-gray-500 text-sm mb-4">Try adjusting your filters or create a new attribute.</p>
                      <button onClick={() => { setSearch(''); setStatus('ALL'); setDataType('ALL'); }} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[13px] font-medium transition-colors">
                        Clear Filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  records.map((record, index) => {
                    const rowIndex = (page - 1) * limit + index + 1;
                    const dateObj = new Date(record.updatedAt);
                    const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                    const mappedCatCount = record.categories?.length || 0;
                    const mappedCatNames = (record.categories || []).map((c: any) => c.category?.name || c.categoryId).join(', ');

                    return (
                      <tr key={record.id} className="hover:bg-blue-50/60 transition-colors group">
                        <td className="px-4 py-2.5 text-center text-gray-500 text-[12px]">{rowIndex}</td>
                        <td className="px-4 py-2.5 font-mono text-[13px] font-medium text-gray-700">{record.attributeCode}</td>
                        <td className="px-4 py-2.5 font-semibold text-gray-900">{record.attributeName}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                            {record.dataType}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {mappedCatCount > 0 ? (
                            <div className="flex items-center gap-1.5" title={mappedCatNames}>
                              <span className="font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 text-[11px]">{mappedCatCount} Categories</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic text-[12px]">Unmapped</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {record.mandatory ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-600">
                              <CheckCircle2 size={12} />
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <MasterStatusBadge status={record.status} />
                        </td>
                        <td className="px-4 py-2.5 text-[13px] text-gray-600 truncate max-w-[140px]" title={record.updatedBy?.name || 'System'}>
                          {record.updatedBy?.name || 'System'}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="text-[12px] text-gray-800 font-medium">{dateStr}</div>
                          <div className="text-[11px] text-gray-500">{timeStr}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                            {canView && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); router.push(`/staff/dashboard/catalog-pricing/product-attributes/${record.id}`); }}
                                className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                                title="View Details"
                              >
                                <Eye size={14} />
                              </button>
                            )}
                            {canModify && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); router.push(`/staff/dashboard/catalog-pricing/product-attributes/${record.id}/edit`); }}
                                className="w-8 h-8 flex items-center justify-center rounded border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                                title="Edit Attribute"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                            {canArchive && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); toggleStatus(record.id, record.status); }}
                                className={`w-8 h-8 flex items-center justify-center rounded border transition-colors ${record.status === 'Active' ? 'border-red-200 text-red-600 bg-red-50 hover:bg-red-100' : 'border-green-200 text-green-600 bg-green-50 hover:bg-green-100'}`}
                                title={record.status === 'Active' ? 'Mark Inactive' : 'Mark Active'}
                              >
                                {record.status === 'Active' ? <Archive size={14} /> : <RotateCcw size={14} />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination would go here if implemented on client side, currently server side pagination logic is incomplete in UI for brevity. */}
          {total > limit && (
            <div className="px-6 py-4 border-t flex items-center justify-between bg-gray-50/50">
               <span className="text-[13px] text-gray-500">Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} entries</span>
               <div className="flex items-center gap-2">
                 <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border rounded-lg text-[13px] font-medium disabled:opacity-50">Prev</button>
                 <button disabled={page * limit >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border rounded-lg text-[13px] font-medium disabled:opacity-50">Next</button>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
