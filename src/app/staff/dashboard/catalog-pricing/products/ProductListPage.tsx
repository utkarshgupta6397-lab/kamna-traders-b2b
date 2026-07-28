'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Eye, History, FileDown, Search, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import MasterStatusBadge from '../_framework/MasterStatusBadge';
import MasterKpiCards from '../_framework/MasterKpiCards';

export default function ProductListPage() {
  const router = useRouter();
  const [records, setRecords] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [permissions, setPermissions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number | 'all'>(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/staff/catalog/products/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('page', page.toString());
      qs.set('limit', limit.toString());
      if (search) qs.set('search', search);
      if (status !== 'ALL') qs.set('status', status);
      
      const res = await fetch(`/api/staff/catalog/products?${qs.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch products');
      
      const data = await res.json();
      setRecords(data.records || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, status]);

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data && data.session) {
          setPermissions(data.session);
        }
      })
      .catch(e => console.error(e));

    fetchStats();
    fetchRecords();
  }, [fetchStats, fetchRecords]);

  const canCreate = permissions?.role === 'ADMIN' || permissions?.catalog_products_create;



  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      <div className="p-6 pb-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Products Master</h1>
          <p className="text-sm text-gray-500 mt-1">Manage single products, pricing, and lifecycle approvals.</p>
        </div>
        <div className="flex items-center gap-3">
          {canCreate && (
            <button 
              onClick={() => router.push('/staff/dashboard/catalog-pricing/products/create')}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Create Product
            </button>
          )}
        </div>
      </div>

      <div className="px-6 py-6 border-b border-gray-200">
        <MasterKpiCards 
          stats={{
            total: stats?.total || 0,
            draft: stats?.Draft || 0,
            active: stats?.Active || 0,
            pending: stats?.['Approval Pending'] || 0,
            inactive: stats?.Inactive || 0,
            archived: stats?.Archived || 0,
          }}
          selectedStatus={status} 
          onSelectStatus={(s) => { setStatus(s); setPage(1); }} 
        />
      </div>

      <div className="p-6 flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search products by name, code, brand, category..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  fetchRecords();
                }
              }}
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm flex-1 flex flex-col">
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider sticky top-0 bg-white z-10">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Brand</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">HSN</th>
                  <th className="py-3 px-4">Tax %</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-500">Loading products...</td>
                  </tr>
                ) : stats?.total === 0 && !search && status === 'ALL' ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                          <Database size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">No Products have been initialized yet.</h3>
                        <p className="text-gray-500 text-sm mb-6">
                          The new Product Master is empty. You must initialize it by migrating the legacy SKU database first.
                        </p>
                        {permissions?.role === 'ADMIN' && (
                          <button
                            onClick={() => router.push('/admin/system-utilities')}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
                          >
                            Go to System Utilities
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-500">
                      No products found.
                    </td>
                  </tr>
                ) : (
                  records.map((r, idx) => {
                    const rowNum = (page - 1) * (typeof limit === 'number' ? limit : 0) + idx + 1;
                    return (
                      <tr key={r.id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="py-3 px-4 text-center font-mono text-xs text-gray-400 font-medium">{rowNum}</td>
                        <td className="py-3 px-4 font-mono text-xs text-gray-600">{r.code}</td>
                        <td className="py-3 px-4 font-medium text-gray-900">{r.name}</td>
                        <td className="py-3 px-4 text-gray-600">{r.brand?.name || '-'}</td>
                        <td className="py-3 px-4 text-gray-600">{r.category?.name || '-'}</td>
                        <td className="py-3 px-4 text-gray-600">{r.hsnCode?.code || '-'}</td>
                        <td className="py-3 px-4 text-gray-600">{r.taxRate?.percentage ? `${r.taxRate.percentage}%` : '-'}</td>
                        <td className="py-3 px-4">
                          <MasterStatusBadge status={r.status as any} />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => router.push(`/staff/dashboard/catalog-pricing/products/${r.id}`)}
                            className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                            title="View / Edit"
                          >
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
            <div>
              Showing {records.length} of {total} products
            </div>
            <div className="flex items-center gap-2">
              <button 
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 bg-white border border-gray-300 rounded disabled:opacity-50"
              >
                Prev
              </button>
              <span>{page} / {totalPages}</span>
              <button 
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 bg-white border border-gray-300 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
