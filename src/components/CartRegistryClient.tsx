'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Printer, 
  ExternalLink, 
  Search, 
  Calendar, 
  Warehouse as WarehouseIcon, 
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  Eye,
  Edit2,
  Trash2
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import CartManagementModals from './CartManagementModals';


interface CartData {
  id: string;
  customerName: string;
  createdAt: string;
  slipNumber: string;
  zohoSalesorderNumber: string | null;
  zohoSalesorderId: string | null;
  warehouseName: string;
  staffName: string;
  itemCount: number;
  totalQty: number;
  totalValue: number;
  deletedAt: string | null;

}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface Props {
  warehouses: { id: string, name: string }[];
  staff: { id: string, name: string }[];
  zohoOrgId: string;
  canManageCarts?: boolean;
}

export default function CartRegistryClient({ warehouses, staff, zohoOrgId, canManageCarts = false }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State synced with URL or defaults
  const [loading, setLoading] = useState(true);
  const [carts, setCarts] = useState<CartData[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);

  // Filter state
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [warehouseId, setWarehouseId] = useState(searchParams.get('warehouseId') || '');
  const [staffId, setStaffId] = useState(searchParams.get('staffId') || '');
  const [dateRange, setDateRange] = useState(searchParams.get('dateRange') || 'all');
  const [customStart, setCustomStart] = useState(searchParams.get('startDate')?.split('T')[0] || '');
  const [customEnd, setCustomEnd] = useState(searchParams.get('endDate')?.split('T')[0] || '');
  const [limit, setLimit] = useState(parseInt(searchParams.get('limit') || '10'));
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));

  // Modal state
  const [modalType, setModalType] = useState<'view' | 'edit' | 'delete' | null>(null);
  const [selectedCartId, setSelectedCartId] = useState<string | null>(null);


  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      updateUrl({ search, page: 1 });
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const updateUrl = useCallback((updates: Record<string, any>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) params.set(key, value.toString());
      else params.delete(key);
    });
    router.push(`?${params.toString()}`);
  }, [router, searchParams]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(searchParams.toString());
      if (!params.has('limit')) params.set('limit', limit.toString());
      
      // Compute actual dates for predefined ranges
      const now = new Date();
      let start = '';
      let end = '';

      if (dateRange === 'today') {
        start = new Date(now.setHours(0,0,0,0)).toISOString();
      } else if (dateRange === 'yesterday') {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        start = new Date(y.setHours(0,0,0,0)).toISOString();
        end = new Date(y.setHours(23,59,59,999)).toISOString();
      } else if (dateRange === '7d') {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        start = d.toISOString();
      } else if (dateRange === '30d') {
        const d = new Date(now);
        d.setDate(d.getDate() - 30);
        start = d.toISOString();
      } else if (dateRange === 'custom') {
        if (customStart) start = new Date(customStart).toISOString();
        if (customEnd) end = new Date(new Date(customEnd).setHours(23,59,59,999)).toISOString();
      }

      if (start) params.set('startDate', start);
      if (end) params.set('endDate', end);

      const res = await fetch(`/api/staff/carts?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch: ${res.status}`);
      }
      const data = await res.json();
      setCarts(data.carts);
      setPagination(data.pagination);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [searchParams, dateRange, customStart, customEnd, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const cartRows = useMemo(() => {
    return carts.map((cart) => (
      <tr 
        key={cart.id} 
        className={`hover:bg-[#F1F6FF]/40 transition-colors group ${cart.deletedAt ? 'bg-gray-50/50' : ''}`}
      >
        <td className="px-4 py-2.5">
          <span className={`font-mono font-bold text-[11px] px-2 py-1 rounded ${cart.deletedAt ? 'text-gray-400 bg-gray-100 line-through' : 'text-[#1A2766] bg-[#1A2766]/5'}`}>
            {cart.slipNumber}
          </span>
        </td>
        <td className="px-4 py-2.5">
          {cart.zohoSalesorderNumber && cart.zohoSalesorderId ? (
            <a
              href={`https://books.zoho.in/app#/salesorders/${cart.zohoSalesorderId}?organization_id=${zohoOrgId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] font-bold text-blue-500 hover:underline hover:text-blue-600 transition-colors"
              title="View in Zoho Books"
            >
              {cart.zohoSalesorderNumber}
            </a>
          ) : (
            <span className="font-mono text-[11px] font-bold text-gray-300">
              {cart.zohoSalesorderNumber || '—'}
            </span>
          )}
        </td>
        <td className="px-4 py-2.5">
          <div className={`text-[13px] font-bold truncate max-w-[180px] ${cart.deletedAt ? 'text-gray-400 line-through' : 'text-gray-900'}`} title={cart.customerName}>
            {cart.customerName}
          </div>
        </td>
        <td className="px-4 py-2.5">
          <span className="text-[12px] font-bold text-gray-500">{cart.warehouseName}</span>
        </td>
        <td className="px-4 py-2.5">
          <span className="text-[12px] font-bold text-gray-500">{cart.staffName}</span>
        </td>
        <td className="px-4 py-2.5 text-center">
          <div className="flex flex-col">
            <span className="text-[11px] font-black text-[#1A2766]">{cart.itemCount} SKUs</span>
            <span className="text-[9px] font-bold text-gray-400 uppercase leading-none mt-0.5">{cart.totalQty} Units</span>
          </div>
        </td>
        <td className="px-4 py-2.5 text-right">
          <span className="text-[13px] font-black text-[#1A2766] tabular-nums">
            {formatCurrency(cart.totalValue)}
          </span>
        </td>
        <td className="px-4 py-2.5">
          {cart.deletedAt ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-50 text-red-700 text-[9px] font-black uppercase tracking-wider">
              <div className="w-1 h-1 rounded-full bg-red-500" />
              Deleted
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-wider">
              <div className="w-1 h-1 rounded-full bg-emerald-500" />
              Completed
            </span>
          )}
        </td>
        <td className="px-4 py-2.5">
          <span className="text-[11px] font-bold text-gray-400 whitespace-nowrap">
            {new Date(cart.createdAt).toLocaleString('en-IN', {
              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            })}
          </span>
        </td>
        <td className="px-4 py-2.5 text-right">
          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => {
                setSelectedCartId(cart.id);
                setModalType('view');
              }}
              className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-[#1A2766] hover:text-white transition-all shadow-sm"
              title="View Details"
            >
              <Eye size={13} />
            </button>
            {!cart.deletedAt && canManageCarts && (
              <>
                <button
                  onClick={() => {
                    setSelectedCartId(cart.id);
                    setModalType('edit');
                  }}
                  className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                  title="Edit Cart"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  onClick={() => {
                    setSelectedCartId(cart.id);
                    setModalType('delete');
                  }}
                  className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                  title="Delete Cart"
                >
                  <Trash2 size={13} />
                </button>
                <div className="w-[1px] h-4 bg-gray-200 mx-0.5" />
                <button
                  onClick={() => router.push(`/staff/dashboard/print/${cart.id}`)}
                  className="p-1.5 rounded-lg bg-[#1A2766] text-white hover:bg-[#003347] transition-all shadow-sm"
                  title="Print Slip"
                >
                  <Printer size={13} />
                </button>
                <a
                  href={`/staff/dashboard/print/${cart.id}`}
                  target="_blank"
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-[#1A2766] hover:border-[#1A2766]/30 transition-all"
                  title="Open in New Tab"
                >
                  <ExternalLink size={13} />
                </a>
              </>
            )}
          </div>
        </td>
      </tr>
    ));
  }, [carts, loading, zohoOrgId, router, canManageCarts]);


  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-160px)]">
      
      {/* ── TOOLBAR ─────────────────────────────────────────────────── */}
      <div className="p-4 border-b border-gray-50 bg-white/50 backdrop-blur-sm sticky top-0 z-10 flex flex-wrap gap-4 items-center">
        
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search Slip ID or Customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border-transparent rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#1A2766]/10 focus:border-[#1A2766] transition-all outline-none"
          />
        </div>

        {/* Warehouse Filter */}
        <div className="flex items-center gap-2">
          <WarehouseIcon size={14} className="text-gray-400" />
          <select
            value={warehouseId}
            onChange={(e) => updateUrl({ warehouseId: e.target.value, page: 1 })}
            className="bg-gray-50 border-transparent rounded-xl px-3 py-2 text-sm font-bold text-[#1A2766] outline-none hover:bg-gray-100 transition-colors"
          >
            <option value="">All Warehouses</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        {/* Staff Filter */}
        <div className="flex items-center gap-2">
          <UserIcon size={14} className="text-gray-400" />
          <select
            value={staffId}
            onChange={(e) => updateUrl({ staffId: e.target.value, page: 1 })}
            className="bg-gray-50 border-transparent rounded-xl px-3 py-2 text-sm font-bold text-[#1A2766] outline-none hover:bg-gray-100 transition-colors"
          >
            <option value="">All Staff</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-gray-400" />
            <select
              value={dateRange}
              onChange={(e) => {
                const val = e.target.value;
                setDateRange(val);
                if (val !== 'custom') {
                  updateUrl({ dateRange: val, startDate: '', endDate: '', page: 1 });
                }
              }}
              className="bg-gray-50 border-transparent rounded-xl px-3 py-2 text-sm font-bold text-[#1A2766] outline-none hover:bg-gray-100 transition-colors"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="custom">Custom Range...</option>
            </select>
          </div>

          {dateRange === 'custom' && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
              <input
                type="date"
                value={customStart}
                onChange={(e) => {
                  setCustomStart(e.target.value);
                  updateUrl({ startDate: e.target.value, page: 1 });
                }}
                className="bg-gray-50 border-transparent rounded-xl px-3 py-1.5 text-[12px] font-bold text-[#1A2766] outline-none"
              />
              <span className="text-gray-300 text-xs font-bold">TO</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => {
                  setCustomEnd(e.target.value);
                  updateUrl({ endDate: e.target.value, page: 1 });
                }}
                className="bg-gray-50 border-transparent rounded-xl px-3 py-1.5 text-[12px] font-bold text-[#1A2766] outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── TABLE ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto custom-scrollbar relative">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead className="sticky top-0 z-20 bg-[#F9FAFB]">
            <tr>
              <th className="px-4 py-3 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Slip ID</th>
              <th className="px-4 py-3 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Zoho SO</th>
              <th className="px-4 py-3 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Customer</th>
              <th className="px-4 py-3 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Warehouse</th>
              <th className="px-4 py-3 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Created By</th>
              <th className="px-4 py-3 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">Items</th>
              <th className="px-4 py-3 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-right">Value</th>
              <th className="px-4 py-3 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Status</th>
              <th className="px-4 py-3 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Date</th>
              <th className="px-4 py-3 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              // ── SKELETON LOADER ─────────────────────────────────────────
              [...Array(limit)].map((_, i) => (
                <tr key={`skeleton-${i}`} className="animate-pulse">
                  <td className="px-4 py-3.5"><div className="h-6 w-20 bg-gray-100 rounded-md" /></td>
                  <td className="px-4 py-3.5"><div className="h-6 w-24 bg-gray-50 rounded-md" /></td>
                  <td className="px-4 py-3.5"><div className="h-4 w-32 bg-gray-100 rounded-md" /></td>
                  <td className="px-4 py-3.5"><div className="h-4 w-24 bg-gray-50 rounded-md" /></td>
                  <td className="px-4 py-3.5"><div className="h-4 w-24 bg-gray-100 rounded-md" /></td>
                  <td className="px-4 py-3.5"><div className="h-8 w-16 bg-gray-50 rounded-md mx-auto" /></td>
                  <td className="px-4 py-3.5 text-right"><div className="h-4 w-20 bg-gray-100 rounded-md ml-auto" /></td>
                  <td className="px-4 py-3.5"><div className="h-6 w-20 bg-gray-50 rounded-md" /></td>
                  <td className="px-4 py-3.5"><div className="h-4 w-24 bg-gray-100 rounded-md" /></td>
                  <td className="px-4 py-3.5 text-right"><div className="h-8 w-16 bg-gray-50 rounded-md ml-auto" /></td>
                </tr>
              ))
            ) : cartRows}

          </tbody>
        </table>

        {/* Empty State */}
        {!loading && carts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
            <FileText size={48} className="text-gray-300 mb-4" />
            <p className="text-[14px] font-bold text-gray-400 uppercase tracking-widest">No matching carts found</p>
            <p className="text-xs text-gray-400 mt-1 font-medium">Try adjusting your filters or search term</p>
          </div>
        )}
      </div>

      {/* ── PAGINATION ─────────────────────────────────────────────── */}
      {pagination && (
        <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Showing <span className="text-[#1A2766]">{carts.length}</span> of <span className="text-[#1A2766]">{pagination.total}</span> Carts
            </div>

            <div className="flex items-center gap-2 border-l border-gray-200 pl-6">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rows per page</span>
              <select
                value={limit}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setLimit(val);
                  updateUrl({ limit: val, page: 1 });
                }}
                className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs font-black text-[#1A2766] outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              disabled={pagination.page <= 1 || loading}
              onClick={() => updateUrl({ page: pagination.page - 1 })}
              className="p-2 rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            
            <div className="flex items-center gap-1 px-2">
              {[...Array(Math.min(5, pagination.pages))].map((_, i) => {
                let pageNum = i + 1;
                if (pagination.pages > 5 && pagination.page > 3) {
                  pageNum = pagination.page - 2 + i;
                }
                if (pageNum > pagination.pages) return null;
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => updateUrl({ page: pageNum })}
                    className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${
                      pagination.page === pageNum 
                        ? 'bg-[#1A2766] text-white shadow-md' 
                        : 'text-gray-500 hover:bg-white hover:shadow-sm'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              disabled={pagination.page >= pagination.pages || loading}
              onClick={() => updateUrl({ page: pagination.page + 1 })}
              className="p-2 rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Cart Management Modals */}
      <CartManagementModals
        cartId={selectedCartId}
        type={modalType}
        onClose={() => {
          setModalType(null);
          setSelectedCartId(null);
        }}
        onSuccess={() => fetchData()}
      />
    </div>

  );
}
