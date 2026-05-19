'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Printer, 
  Search, 
  Calendar, 
  Warehouse as WarehouseIcon, 
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  Eye,
  Trash2,
  Pause,
  Check,
  History,
  RefreshCw,
  Pencil
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import CartManagementModals from './CartManagementModals';
import toast from 'react-hot-toast';

interface CartData {
  id: string;
  status: string;
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
  const [counts, setCounts] = useState<{
    all: number;
    completed: number;
    onHold: number;
    draft: number;
    cancelled: number;
  }>({ all: 0, completed: 0, onHold: 0, draft: 0, cancelled: 0 });

  // Filter states
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [warehouseId, setWarehouseId] = useState(searchParams.get('warehouseId') || '');
  const [staffId, setStaffId] = useState(searchParams.get('staffId') || '');
  const [dateRange, setDateRange] = useState(searchParams.get('dateRange') || 'today');
  const [customStart, setCustomStart] = useState(searchParams.get('startDate')?.split('T')[0] || '');
  const [customEnd, setCustomEnd] = useState(searchParams.get('endDate')?.split('T')[0] || '');
  const [limit, setLimit] = useState(parseInt(searchParams.get('limit') || '25'));
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [status, setStatus] = useState(searchParams.get('status') || '');

  // Modal states
  const [modalType, setModalType] = useState<'view' | 'edit' | 'delete' | null>(null);
  const [selectedCartId, setSelectedCartId] = useState<string | null>(null);

  // Transition states
  const [transitioningCartId, setTransitioningCartId] = useState<string | null>(null);
  const [transitionAction, setTransitionAction] = useState<'hold' | 'resume' | null>(null);

  // Confirmation state for Hold (pause)
  const [confirmHoldCartId, setConfirmHoldCartId] = useState<string | null>(null);

  // History Drawer state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCartId, setHistoryCartId] = useState<string | null>(null);
  const [historyCartSlip, setHistoryCartSlip] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);

  const updateUrl = useCallback((updates: Record<string, any>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, value.toString());
      } else {
        params.delete(key);
      }
    });
    const newQuery = params.toString();
    if (newQuery !== searchParams.toString()) {
      router.push(`?${newQuery}`);
    }
  }, [router, searchParams]);

  // Sync state with URL changes (back navigation support)
  useEffect(() => {
    setSearch(searchParams.get('search') || '');
    setWarehouseId(searchParams.get('warehouseId') || '');
    setStaffId(searchParams.get('staffId') || '');
    setDateRange(searchParams.get('dateRange') || 'today');
    setStatus(searchParams.get('status') || '');
    setLimit(parseInt(searchParams.get('limit') || '25'));
    setPage(parseInt(searchParams.get('page') || '1'));
  }, [searchParams]);

  // Debounced search trigger
  useEffect(() => {
    const currentSearch = searchParams.get('search') || '';
    if (search === currentSearch) return;
    const timer = setTimeout(() => {
      updateUrl({ search, page: 1 });
    }, 400);
    return () => clearTimeout(timer);
  }, [search, searchParams, updateUrl]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(searchParams.toString());
      if (!params.has('limit')) params.set('limit', limit.toString());
      if (!params.has('page')) params.set('page', page.toString());
      
      const activeRange = params.get('dateRange') || dateRange;
      if (!params.has('dateRange') && !params.has('startDate') && !params.has('endDate')) {
        params.set('dateRange', activeRange);
      }

      // Compute actual dates for predefined ranges
      const now = new Date();
      let start = '';
      let end = '';

      if (activeRange === 'today') {
        start = new Date(now.setHours(0,0,0,0)).toISOString();
      } else if (activeRange === 'yesterday') {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        start = new Date(y.setHours(0,0,0,0)).toISOString();
        end = new Date(y.setHours(23,59,59,999)).toISOString();
      } else if (activeRange === '7d') {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        start = d.toISOString();
      } else if (activeRange === '30d') {
        const d = new Date(now);
        d.setDate(d.getDate() - 30);
        start = d.toISOString();
      } else if (activeRange === 'custom') {
        const sDate = params.get('startDate') || customStart;
        const eDate = params.get('endDate') || customEnd;
        if (sDate) start = new Date(sDate).toISOString();
        if (eDate) end = new Date(new Date(eDate).setHours(23,59,59,999)).toISOString();
      }

      if (start) params.set('startDate', start);
      if (end) params.set('endDate', end);

      const res = await fetch(`/api/staff/carts?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch: ${res.status}`);
      }
      const data = await res.json();
      setCarts(data.carts || []);
      setPagination(data.pagination || null);
      if (data.counts) {
        setCounts(data.counts);
      }

    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch carts data');
    } finally {
      setLoading(false);
    }
  }, [searchParams, dateRange, customStart, customEnd, limit, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleHoldToggle = useCallback(async (cartId: string, action: 'hold' | 'resume') => {
    if (transitioningCartId) return;

    setTransitioningCartId(cartId);
    setTransitionAction(action);

    const loadingToast = toast.loading(
      action === 'hold' ? 'Moving to hold & restoring inventory...' : 'Re-completing & deducting inventory...'
    );

    try {
      const res = await fetch(`/api/staff/carts/${cartId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Operation failed');
      }

      toast.success(
        action === 'hold' ? 'Cart moved to Dispatch Hold successfully' : 'Cart completed successfully',
        { id: loadingToast }
      );
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Operation failed', { id: loadingToast });
    } finally {
      setTransitioningCartId(null);
      setTransitionAction(null);
    }
  }, [transitioningCartId, fetchData]);

  const handleOpenHistory = useCallback(async (cartId: string, slipNumber: string) => {
    setHistoryCartId(cartId);
    setHistoryCartSlip(slipNumber);
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryList([]);
    try {
      const res = await fetch(`/api/staff/carts/${cartId}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data.history || []);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load history log');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const cartRows = useMemo(() => {
    return carts.map((cart) => (
      <tr 
        key={cart.id} 
        className={`hover:bg-[#F1F6FF]/30 border-b border-gray-100 transition-colors group ${cart.deletedAt ? 'bg-gray-50/80 opacity-60' : ''}`}
      >
        {/* Slip ID */}
        <td className="px-3 py-1.5" style={{ minWidth: '180px', whiteSpace: 'nowrap' }}>
          <span className={`font-mono font-bold text-[10px] px-2 py-0.5 rounded whitespace-nowrap ${cart.deletedAt ? 'text-gray-400 bg-gray-100 line-through' : 'text-[#1A2766] bg-[#1A2766]/5'}`}>
            {cart.slipNumber}
          </span>
        </td>

        {/* Zoho SO */}
        <td className="px-3 py-1.5">
          {cart.zohoSalesorderNumber && cart.zohoSalesorderId ? (
            <a
              href={`https://books.zoho.in/app#/salesorders/${cart.zohoSalesorderId}?organization_id=${zohoOrgId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] font-bold text-blue-500 hover:underline hover:text-blue-600 transition-colors"
              title="View in Zoho Books"
            >
              {cart.zohoSalesorderNumber}
            </a>
          ) : (
            <span className="font-mono text-[10px] font-bold text-gray-300">
              {cart.zohoSalesorderNumber || '—'}
            </span>
          )}
        </td>

        {/* Customer */}
        <td className="px-3 py-1.5">
          <div className={`text-xs font-bold truncate max-w-[160px] ${cart.deletedAt ? 'text-gray-400 line-through' : 'text-gray-900'}`} title={cart.customerName}>
            {cart.customerName}
          </div>
        </td>

        {/* Warehouse */}
        <td className="px-3 py-1.5">
          <span className="text-[11px] font-bold text-gray-500">{cart.warehouseName}</span>
        </td>

        {/* Staff */}
        <td className="px-3 py-1.5">
          <span className="text-[11px] font-bold text-gray-500">{cart.staffName}</span>
        </td>

        {/* Items counts */}
        <td className="px-3 py-1.5 text-center">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-[#1A2766]">{cart.itemCount} SKUs</span>
            <span className="text-[9px] font-bold text-gray-400 uppercase leading-none mt-0.5">{cart.totalQty} Units</span>
          </div>
        </td>

        {/* Total Value */}
        <td className="px-3 py-1.5 text-right">
          <span className="text-xs font-black text-[#1A2766] tabular-nums">
            {formatCurrency(cart.totalValue)}
          </span>
        </td>

        {/* Status Badge */}
        <td className="px-3 py-1.5">
          {cart.deletedAt ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-[8px] font-black uppercase tracking-wider">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Deleted
            </span>
          ) : cart.status === 'ON_HOLD' ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[8px] font-black uppercase tracking-wider border border-amber-200">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Draft
            </span>
          ) : cart.status === 'DISPATCH_HOLD' ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-50 border border-orange-200 text-orange-700 text-[8px] font-black uppercase tracking-wider">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              ON HOLD
            </span>
          ) : cart.status === 'COMPLETED_FINAL' ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[8px] font-black uppercase tracking-wider border border-emerald-200">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Completed (Final)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[8px] font-black uppercase tracking-wider border border-emerald-100">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Completed
            </span>
          )}
        </td>

        {/* Created At */}
        <td className="px-3 py-1.5">
          <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">
            {new Date(cart.createdAt).toLocaleString('en-IN', {
              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            })}
          </span>
        </td>

        {/* Action icons */}
        <td className="px-3 py-1.5 text-right">
          <div className="flex items-center justify-end gap-1">
            {/* View Details */}
            <button
              onClick={() => {
                setSelectedCartId(cart.id);
                setModalType('view');
              }}
              className="w-7 h-7 rounded border border-gray-200 bg-white text-gray-600 hover:bg-[#1A2766] hover:text-white hover:border-[#1A2766] transition-all shadow-sm flex items-center justify-center"
              title="View Details"
            >
              <Eye size={12} />
            </button>

            {/* Audit History Log */}
            <button
              onClick={() => handleOpenHistory(cart.id, cart.slipNumber)}
              className="w-7 h-7 rounded border border-gray-200 bg-white text-gray-600 hover:bg-[#1A2766] hover:text-white hover:border-[#1A2766] transition-all shadow-sm flex items-center justify-center"
              title="View Audit Logs"
            >
              <History size={12} />
            </button>

            {!cart.deletedAt && (
              <>
                {/* Print (Printer) */}
                {cart.status !== 'ON_HOLD' && (
                  <button
                    onClick={() => router.push(`/staff/dashboard/print/${cart.id}`)}
                    className="w-7 h-7 rounded border border-gray-200 bg-white text-gray-600 hover:bg-[#1A2766] hover:text-white hover:border-[#1A2766] transition-all shadow-sm flex items-center justify-center"
                    title="Print Slip"
                  >
                    <Printer size={12} />
                  </button>
                )}

                {/* Edit Cart */}
                {canManageCarts && (
                  <button
                    onClick={() => {
                      setSelectedCartId(cart.id);
                      setModalType('edit');
                    }}
                    className="w-7 h-7 rounded border border-blue-200 bg-blue-50/30 text-blue-500 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm flex items-center justify-center"
                    title="Edit Cart"
                  >
                    <Pencil size={12} />
                  </button>
                )}

                {/* Hold (Pause) */}
                {cart.status === 'COMPLETED' && (
                  <button
                    onClick={() => setConfirmHoldCartId(cart.id)}
                    disabled={transitioningCartId !== null}
                    className="w-7 h-7 rounded border border-orange-200 bg-orange-50/50 text-orange-600 hover:bg-orange-600 hover:text-white hover:border-orange-600 transition-all disabled:opacity-50 shadow-sm flex items-center justify-center"
                    title="Put On Hold"
                  >
                    {transitioningCartId === cart.id && transitionAction === 'hold' ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Pause size={12} />
                    )}
                  </button>
                )}

                {/* Resume (Check) */}
                {cart.status === 'DISPATCH_HOLD' && (
                  <button
                    onClick={() => handleHoldToggle(cart.id, 'resume')}
                    disabled={transitioningCartId !== null}
                    className="w-7 h-7 rounded border border-emerald-200 bg-emerald-50/50 text-emerald-600 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all disabled:opacity-50 shadow-sm flex items-center justify-center"
                    title="Mark Completed"
                  >
                    {transitioningCartId === cart.id && transitionAction === 'resume' ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} strokeWidth={3} />
                    )}
                  </button>
                )}

                {/* Delete Cart */}
                {canManageCarts && (
                  <button
                    onClick={() => {
                      setSelectedCartId(cart.id);
                      setModalType('delete');
                    }}
                    className="w-7 h-7 rounded border border-red-200 bg-red-50/30 text-red-500 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-sm flex items-center justify-center"
                    title="Delete Cart"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </>
            )}
          </div>
        </td>
      </tr>
    ));
  }, [carts, zohoOrgId, router, canManageCarts, transitioningCartId, transitionAction, handleHoldToggle, handleOpenHistory, setConfirmHoldCartId]);

  return (
    <div className="space-y-4 pb-10">
      
      {/* ── HEADER BLOCK (Row 1) ───────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-[#1A2766] uppercase tracking-tight">Carts Console</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">Warehouse dispatch operations & logistics registry</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Quick Date Range Dropdown */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 shadow-sm">
            <Calendar size={13} className="text-gray-400" />
            <select
              value={dateRange}
              onChange={(e) => {
                const val = e.target.value;
                setDateRange(val);
                if (val !== 'custom') {
                  updateUrl({ dateRange: val, startDate: '', endDate: '', page: 1 });
                }
              }}
              className="bg-transparent border-none text-[11px] font-black text-[#1A2766] outline-none cursor-pointer"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range...</option>
            </select>
          </div>

          {/* Custom Date Inputs */}
          {dateRange === 'custom' && (
            <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2 duration-200">
              <input
                type="date"
                value={customStart}
                onChange={(e) => {
                  setCustomStart(e.target.value);
                  updateUrl({ startDate: e.target.value, page: 1 });
                }}
                className="bg-white border border-gray-200 rounded-xl px-2.5 py-1 text-[11px] font-bold text-[#1A2766] outline-none shadow-sm"
              />
              <span className="text-gray-400 text-[9px] font-bold">TO</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => {
                  setCustomEnd(e.target.value);
                  updateUrl({ endDate: e.target.value, page: 1 });
                }}
                className="bg-white border border-gray-200 rounded-xl px-2.5 py-1 text-[11px] font-bold text-[#1A2766] outline-none shadow-sm"
              />
            </div>
          )}

          {/* Refresh Action */}
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="p-1.5 bg-white hover:bg-gray-50 text-gray-500 hover:text-[#1A2766] rounded-xl border border-gray-200 transition-all active:scale-95 disabled:opacity-50 shadow-sm flex items-center justify-center"
            title="Refresh logs"
          >
            <RefreshCw size={13} className={`${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── STICKY STATUS PILLS (Row 2) ────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm flex items-center gap-2 overflow-x-auto select-none no-scrollbar">
        {[
          { key: '', label: 'All Carts', count: counts.all, color: 'border-gray-200 text-gray-600 hover:bg-gray-50/50' },
          { key: 'COMPLETED', label: 'Completed', count: counts.completed, color: 'border-emerald-200 text-emerald-700 bg-emerald-50/20 hover:bg-emerald-50/50' },
          { key: 'DISPATCH_HOLD', label: 'On Hold', count: counts.onHold, color: 'border-orange-200 text-orange-700 bg-orange-50/20 hover:bg-orange-50/50' },
          { key: 'ON_HOLD', label: 'Drafts', count: counts.draft, color: 'border-amber-200 text-amber-700 bg-amber-50/20 hover:bg-amber-50/50' },
          { key: 'CANCELLED', label: 'Cancelled', count: counts.cancelled, color: 'border-red-200 text-red-700 bg-red-50/20 hover:bg-red-50/50' },
        ].map((pill) => {
          const active = status === pill.key;
          let activeStyles = 'bg-[#1A2766] border-[#1A2766] text-white shadow-md shadow-[#1A2766]/10';
          if (active) {
            if (pill.key === 'COMPLETED') activeStyles = 'bg-emerald-700 border-emerald-700 text-white shadow-md shadow-emerald-700/10';
            else if (pill.key === 'DISPATCH_HOLD') activeStyles = 'bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-600/10';
            else if (pill.key === 'ON_HOLD') activeStyles = 'bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-600/10';
            else if (pill.key === 'CANCELLED') activeStyles = 'bg-red-600 border-red-600 text-white shadow-md shadow-red-600/10';
          }
          return (
            <button
              key={pill.key}
              onClick={() => {
                updateUrl({ status: pill.key, page: 1 });
              }}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all duration-200 ${
                active 
                  ? activeStyles 
                  : `bg-white ${pill.color}`
              }`}
            >
              <span>{pill.label}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {pill.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── SEARCH & FILTERS (Row 3) ───────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm flex flex-wrap gap-4 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
          <input
            type="text"
            placeholder="Search Slip ID, Customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-gray-50/50 border border-gray-200 rounded-xl text-[11px] font-bold focus:ring-1 focus:ring-[#1A2766]/5 focus:border-[#1A2766] focus:bg-white transition-all outline-none"
          />
        </div>

        {/* Warehouse */}
        <div className="flex items-center gap-1.5">
          <WarehouseIcon size={12} className="text-gray-400" />
          <select
            value={warehouseId}
            onChange={(e) => updateUrl({ warehouseId: e.target.value, page: 1 })}
            className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-[11px] font-bold text-[#1A2766] outline-none hover:bg-gray-50 transition-all cursor-pointer shadow-sm"
          >
            <option value="">All Warehouses</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        {/* Staff */}
        <div className="flex items-center gap-1.5">
          <UserIcon size={12} className="text-gray-400" />
          <select
            value={staffId}
            onChange={(e) => updateUrl({ staffId: e.target.value, page: 1 })}
            className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-[11px] font-bold text-[#1A2766] outline-none hover:bg-gray-50 transition-all cursor-pointer shadow-sm"
          >
            <option value="">All Staff</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* ── TABLE CONTAINER ────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto custom-scrollbar relative max-h-[calc(100vh-280px)]">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 bg-gray-55/65 backdrop-blur-sm bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100" style={{ minWidth: '180px', whiteSpace: 'nowrap' }}>Slip ID</th>
                <th className="px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Zoho SO</th>
                <th className="px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Customer</th>
                <th className="px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Warehouse</th>
                <th className="px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Created By</th>
                <th className="px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">Items</th>
                <th className="px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-right">Value</th>
                <th className="px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Status</th>
                <th className="px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Date</th>
                <th className="px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={`skeleton-${i}`} className="animate-pulse">
                    <td className="px-4 py-2"><div className="h-4 w-20 bg-gray-100 rounded" /></td>
                    <td className="px-4 py-2"><div className="h-4 w-24 bg-gray-50 rounded" /></td>
                    <td className="px-4 py-2"><div className="h-3 w-32 bg-gray-100 rounded" /></td>
                    <td className="px-4 py-2"><div className="h-3 w-24 bg-gray-55 rounded" /></td>
                    <td className="px-4 py-2"><div className="h-3 w-24 bg-gray-100 rounded" /></td>
                    <td className="px-4 py-2 text-center"><div className="h-5 w-16 bg-gray-50 rounded mx-auto" /></td>
                    <td className="px-4 py-2 text-right"><div className="h-3 w-20 bg-gray-100 rounded ml-auto" /></td>
                    <td className="px-4 py-2"><div className="h-4 w-20 bg-gray-50 rounded" /></td>
                    <td className="px-4 py-2"><div className="h-3 w-24 bg-gray-100 rounded" /></td>
                    <td className="px-4 py-2 text-right"><div className="h-6 w-20 bg-gray-50 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : cartRows}
            </tbody>
          </table>

          {/* Empty State */}
          {!loading && carts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
              <FileText size={40} className="text-gray-300 mb-3" />
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">No matching carts found</p>
              <p className="text-[10px] text-gray-400 mt-1 font-medium">Try adjusting your filters or search term</p>
            </div>
          )}
        </div>

        {/* ── PAGINATION (Footer) ────────────────────────────────────── */}
        {pagination && (
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs">
            <div className="flex items-center gap-6">
              <div className="font-bold text-gray-400 uppercase tracking-wider text-[9px]">
                Showing <span className="text-[#1A2766]">{carts.length}</span> of <span className="text-[#1A2766]">{pagination.total}</span> Carts
              </div>

              <div className="flex items-center gap-2 border-l border-gray-200 pl-6">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Rows per page</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setLimit(val);
                    updateUrl({ limit: val, page: 1 });
                  }}
                  className="bg-white border border-gray-200 rounded-lg px-2 py-0.5 text-xs font-black text-[#1A2766] outline-none shadow-sm"
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
                className="p-1 rounded hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all border border-transparent hover:border-gray-200"
              >
                <ChevronLeft size={14} />
              </button>
              
              <div className="flex items-center gap-1 px-1">
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
                      className={`w-6 h-6 rounded text-[10px] font-black transition-all ${
                        pagination.page === pageNum 
                          ? 'bg-[#1A2766] text-white shadow-sm' 
                          : 'text-gray-500 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200'
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
                className="p-1 rounded hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all border border-transparent hover:border-gray-200"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── CONFIRM HOLD MODAL ──────────────────────────────────────── */}
      {confirmHoldCartId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center shrink-0">
                  <Pause size={20} />
                </div>
                <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">
                  Confirm Hold
                </h3>
              </div>
              <p className="text-xs font-medium text-gray-500 leading-relaxed">
                Put this completed cart on hold?
                <br />
                Inventory will be restored back to warehouse stock.
              </p>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmHoldCartId(null)}
                className="px-4 py-2 text-[10px] font-black text-gray-400 hover:text-gray-600 uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const id = confirmHoldCartId;
                  setConfirmHoldCartId(null);
                  handleHoldToggle(id, 'hold');
                }}
                className="px-5 py-2 bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-orange-700 hover:shadow-lg hover:shadow-orange-600/10 active:scale-95 transition-all"
              >
                Confirm Hold
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY DRAWER ────────────────────────────────────────── */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden print:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setHistoryOpen(false)}
          />
          
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
              
              {/* Drawer Header */}
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div>
                  <h3 className="text-xs font-black text-[#1A2766] uppercase tracking-wider">
                    Dispatch History
                  </h3>
                  <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5 font-mono">
                    Slip: {historyCartSlip}
                  </p>
                </div>
                <button 
                  onClick={() => setHistoryOpen(false)}
                  className="px-3 py-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors text-[10px] font-black uppercase tracking-wider"
                >
                  Close
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-4">
                {historyLoading ? (
                  <div className="h-full flex items-center justify-center flex-col gap-2">
                    <Loader2 className="animate-spin text-[#1A2766]" size={20} />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Fetching logs...</span>
                  </div>
                ) : historyList.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">No history recorded yet</span>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-[#1A2766]/10 pl-5 ml-2 space-y-4">
                    {historyList.map((log) => {
                      let badgeBg = 'bg-gray-100 text-gray-700';
                      let label = log.action;
                      if (log.action === 'CREATED') badgeBg = 'bg-blue-50 text-blue-700 border-blue-100';
                      else if (log.action === 'COMPLETED') badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                      else if (log.action === 'HOLD') badgeBg = 'bg-orange-50 text-orange-700 border-orange-100';
                      else if (log.action === 'RESUME') badgeBg = 'bg-purple-50 text-purple-700 border-purple-100';
                      else if (log.action === 'PRINTED') badgeBg = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                      else if (log.action === 'DELETED') badgeBg = 'bg-rose-50 text-rose-700 border-rose-100';
                      else if (log.action === 'EDITED') badgeBg = 'bg-amber-50 text-amber-700 border-amber-100';

                      const meta = log.metadata as { added?: any[]; removed?: any[]; updated?: any[] } | null;

                      return (
                        <div key={log.id} className="relative">
                          {/* Timeline dot */}
                          <div className="absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full border-4 border-white bg-[#1A2766] shadow" />
                          
                          <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 hover:bg-gray-100/50 transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${badgeBg}`}>
                                {label}
                              </span>
                              <span className="text-[9px] text-gray-400 font-bold">
                                {new Date(log.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[11px] font-bold text-gray-700">
                                User: <span className="font-black text-[#1A2766]">{log.user?.name || 'Unknown'}</span>
                              </span>
                              <span className="text-[9px] text-gray-400 font-bold">
                                {new Date(log.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                              {log.remarks && (
                                <p className="mt-1 text-[10px] text-gray-500 font-medium italic border-t border-gray-200/60 pt-1 leading-normal">
                                  {log.remarks}
                                </p>
                              )}

                              {/* Structured edit details */}
                              {log.action === 'EDITED' && meta && (
                                <div className="mt-2 border-t border-gray-200/60 pt-2 space-y-1.5">
                                  {meta.removed && meta.removed.length > 0 && (
                                    <div>
                                      <span className="text-[8px] font-black text-rose-600 uppercase tracking-wider">Removed</span>
                                      {meta.removed.map((r: any, i: number) => (
                                        <div key={i} className="text-[10px] text-gray-600 font-mono pl-2">
                                          <span className="text-rose-500">−</span> {r.skuId} <span className="text-gray-400">× {r.qty}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {meta.added && meta.added.length > 0 && (
                                    <div>
                                      <span className="text-[8px] font-black text-emerald-600 uppercase tracking-wider">Added</span>
                                      {meta.added.map((a: any, i: number) => (
                                        <div key={i} className="text-[10px] text-gray-600 font-mono pl-2">
                                          <span className="text-emerald-500">+</span> {a.skuId} <span className="text-gray-400">× {a.qty}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {meta.updated && meta.updated.length > 0 && (
                                    <div>
                                      <span className="text-[8px] font-black text-amber-600 uppercase tracking-wider">Updated</span>
                                      {meta.updated.map((u: any, i: number) => (
                                        <div key={i} className="text-[10px] text-gray-600 font-mono pl-2">
                                          ↻ {u.skuId} <span className="text-gray-400">Qty: {u.oldQty} → {u.newQty}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
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
