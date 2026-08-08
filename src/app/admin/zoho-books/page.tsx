'use client';

import React, { useState, useEffect } from 'react';
import { Database, Search, Filter, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import ZohoConnectionHealth from '@/components/admin/ZohoConnectionHealth';

export default function ZohoBooksDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/zoho/products?page=${page}&limit=50&status=${status}&search=${encodeURIComponent(search)}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, status]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="text-blue-600" />
            Zoho Books Synchronization
          </h1>
          <p className="text-gray-500 mt-1">Monitor product variant sync status and resolve errors.</p>
        </div>
      </div>

      <ZohoConnectionHealth />

      {data?.stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total Variants</div>
            <div className="text-2xl font-bold text-gray-900">{Number(data.stats.total || 0).toLocaleString()}</div>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
            <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1">Synced</div>
            <div className="text-2xl font-bold text-emerald-800">{Number(data.stats.synced || 0).toLocaleString()}</div>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-200 p-4">
            <div className="text-[11px] font-bold text-red-700 uppercase tracking-wider mb-1">Failed</div>
            <div className="text-2xl font-bold text-red-800">{Number(data.stats.failed || 0).toLocaleString()}</div>
          </div>
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Pending</div>
            <div className="text-2xl font-bold text-gray-700">{Number(data.stats.never_synced || 0).toLocaleString()}</div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between gap-4">
          <form onSubmit={handleSearch} className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search SKU, Product Name, or Zoho ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </form>
          
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select 
              value={status}
              onChange={e => { setStatus(e.target.value); setPage(1); }}
              className="h-10 px-3 text-sm border border-gray-300 rounded-lg focus:border-blue-500 outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="SYNCED">Synced</option>
              <option value="SYNC_FAILED">Failed</option>
              <option value="NEVER_SYNCED">Never Synced</option>
              <option value="SYNCING">Syncing</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
              <tr>
                <th className="px-4 py-3">Product / Variant</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Zoho Item ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Sync</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400"><RefreshCw className="animate-spin mx-auto mb-2" />Loading...</td></tr>
              ) : data?.variants?.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No variants found matching criteria</td></tr>
              ) : (
                data?.variants?.map((v: any) => (
                  <tr key={v.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{v.product?.name}</div>
                      <div className="text-[11px] text-gray-500">{v.variantName} {v.isDefault ? '(Default)' : ''}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px]">{v.sku}</td>
                    <td className="px-4 py-3 font-mono text-[12px]">{v.zohoBookItemId || '-'}</td>
                    <td className="px-4 py-3">
                      {v.zohoSyncStatus === 'SYNCED' && <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold uppercase"><CheckCircle2 size={10} /> Synced</span>}
                      {v.zohoSyncStatus === 'SYNC_FAILED' && <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded font-bold uppercase"><ShieldAlert size={10} /> Failed</span>}
                      {v.zohoSyncStatus === 'NEVER_SYNCED' && <span className="inline-flex items-center gap-1 text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold uppercase">Never Synced</span>}
                      {v.zohoSyncStatus === 'SYNCING' && <span className="inline-flex items-center gap-1 text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold uppercase"><RefreshCw size={10} className="animate-spin" /> Syncing</span>}
                      
                      {v.zohoSyncStatus === 'SYNC_FAILED' && v.zohoLastSyncError && (
                        <div className="text-[10px] text-red-600 mt-1 max-w-xs truncate" title={v.zohoLastSyncError}>
                          {v.zohoLastSyncError}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-gray-500">
                      {v.zohoLastSyncAt ? new Date(v.zohoLastSyncAt).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <Link 
                        href={`/staff/dashboard/catalog-pricing/products/${v.productId}`}
                        className="text-blue-600 hover:text-blue-800 text-[12px] font-semibold"
                        target="_blank"
                      >
                        View Product
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data?.pagination && data.pagination.totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing page {page} of {data.pagination.totalPages}
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-white border border-gray-300 rounded text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button 
                onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page === data.pagination.totalPages}
                className="px-3 py-1 bg-white border border-gray-300 rounded text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
