'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Filter, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import MasterStatusBadge from '../_framework/MasterStatusBadge';

export default function ProductAttributesPage() {
  const router = useRouter();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [permissions, setPermissions] = useState<Record<string, any>>({});
  
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
  
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search) q.set('search', search);
      
      const res = await fetch(`/api/staff/catalog/product-attributes?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
      }
    } catch (e) {
      toast.error('Failed to load attributes');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const delay = setTimeout(() => fetchRecords(), 300);
    return () => clearTimeout(delay);
  }, [fetchRecords]);

  return (
    <div className="flex flex-col min-h-full bg-[#F6F8FB]">
      <div className="px-6 py-5 border-b border-gray-200 bg-white flex items-center justify-between sticky top-0 z-20">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Product Attributes</h1>
          <p className="text-[13px] text-gray-500 mt-1">Manage dynamic attributes mapped to categories</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchRecords}
            className="h-[36px] px-3 border border-gray-200 text-gray-600 rounded-lg bg-white hover:bg-gray-50 flex items-center justify-center transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          {canCreate && (
            <button
              onClick={() => router.push('/staff/dashboard/catalog-pricing/product-attributes/create')}
              className="h-[36px] pl-3 pr-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2 text-[13px] font-medium shadow-sm shadow-blue-600/20"
            >
              <Plus size={16} />
              <span>Create Attribute</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 overflow-hidden flex flex-col h-full">
          <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center justify-between bg-gray-50/50">
            <div className="relative w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search attributes..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 h-[36px] text-[13px] rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto min-h-[400px]">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-gray-50/80 text-gray-500 text-[12px] uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-3 font-medium border-b border-gray-100">Code</th>
                  <th className="px-5 py-3 font-medium border-b border-gray-100">Attribute Name</th>
                  <th className="px-5 py-3 font-medium border-b border-gray-100">Data Type</th>
                  <th className="px-5 py-3 font-medium border-b border-gray-100">Mapped Categories</th>
                  <th className="px-5 py-3 font-medium border-b border-gray-100">Mandatory</th>
                  <th className="px-5 py-3 font-medium border-b border-gray-100">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-700">
                {loading && records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-gray-400">Loading attributes...</td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 text-gray-400 mb-3">
                        <Filter size={20} />
                      </div>
                      <p className="text-gray-500 font-medium">No attributes found</p>
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr 
                      key={r.id} 
                      onClick={() => router.push(`/staff/dashboard/catalog-pricing/product-attributes/${r.id}`)}
                      className="hover:bg-blue-50/30 cursor-pointer transition-colors group"
                    >
                      <td className="px-5 py-3 font-medium text-blue-600">{r.attributeCode}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">{r.attributeName}</td>
                      <td className="px-5 py-3 text-gray-500">{r.dataType}</td>
                      <td className="px-5 py-3 text-gray-500">
                        {r.categories?.length > 0 
                          ? r.categories.map((c: any) => c.category?.name).join(', ') 
                          : <span className="text-gray-400 italic">None</span>}
                      </td>
                      <td className="px-5 py-3">
                        {r.mandatory ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-700">Yes</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600">No</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <MasterStatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
