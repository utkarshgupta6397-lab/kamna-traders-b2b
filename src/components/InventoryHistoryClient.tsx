'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  X,
  Calendar,
  RefreshCw,
  Check
} from 'lucide-react';
import { adjustInventory } from '@/app/admin/actions';
import { FormSubmit } from './ActionForm';

interface LogEntry {
  id: string;
  warehouseId: string;
  skuId: string;
  productName: string;
  beforeQty: number;
  afterQty: number;
  qtyChange: number;
  remarks: string;
  createdBy: string;
  createdAt: string; // From API it comes as ISO string
  warehouse: { name: string };
  user: { name: string };
}

interface Warehouse {
  id: string;
  name: string;
}

interface Sku {
  id: string;
  name: string;
  unit?: string | null;
}

interface Props {
  warehouses: Warehouse[];
  skus: Sku[];
  canAdjust?: boolean;
}

export default function InventoryHistoryClient({ warehouses, skus, canAdjust = false }: Props) {
  // Helper to get YYYY-MM-DD in local time
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getTodayString();

  // --- Applied Filter States (Actual state of truth for data fetch) ---
  const [appliedFilters, setAppliedFilters] = useState({
    q: '',
    warehouseId: '',
    remark: '',
    from: todayStr,
    to: todayStr,
    page: 1,
    pageSize: 25
  });

  // --- Pending Filter States (Local input values before Apply) ---
  const [pendingQ, setPendingQ] = useState('');
  const [pendingWh, setPendingWh] = useState('');
  const [pendingRemark, setPendingRemark] = useState('');
  const [pendingFrom, setPendingFrom] = useState(todayStr);
  const [pendingTo, setPendingTo] = useState(todayStr);
  const [showFilterSkuDropdown, setShowFilterSkuDropdown] = useState(false);
  const [skuSearchText, setSkuSearchText] = useState('');

  // Searchable Warehouse Dropdown States
  const [showWhDropdown, setShowWhDropdown] = useState(false);
  const [whSearchText, setWhSearchText] = useState('');

  // --- Data State ---
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // --- Modal State ---
  const [showModal, setShowModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [selectedSkuId, setSelectedSkuId] = useState('');
  const [showSkuDropdown, setShowSkuDropdown] = useState(false);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.wh-dropdown-container')) {
        setShowWhDropdown(false);
      }
      if (!target.closest('.sku-dropdown-container')) {
        setShowFilterSkuDropdown(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Fetch Logic
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        q: appliedFilters.q,
        warehouseId: appliedFilters.warehouseId,
        remark: appliedFilters.remark,
        from: appliedFilters.from,
        to: appliedFilters.to,
        page: appliedFilters.page.toString(),
        pageSize: appliedFilters.pageSize.toString()
      });
      const res = await fetch(`/api/staff/inventory/history?${params.toString()}`);
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
        setTotal(data.total);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Actions
  const handleApply = () => {
    setAppliedFilters(prev => ({
      ...prev,
      q: pendingQ,
      warehouseId: pendingWh,
      remark: pendingRemark,
      from: pendingFrom,
      to: pendingTo,
      page: 1 // Reset to first page on new filter
    }));
  };

  const handleReset = () => {
    setPendingQ('');
    setPendingWh('');
    setPendingRemark('');
    setPendingFrom(todayStr);
    setPendingTo(todayStr);
    setSkuSearchText('');
    setWhSearchText('');
    setAppliedFilters({
      q: '',
      warehouseId: '',
      remark: '',
      from: todayStr,
      to: todayStr,
      page: 1,
      pageSize: 25
    });
  };

  // SKU Dropdown logic (Reusable)
  const filterSkus = (search: string) => {
    if (!search) return [];
    return skus.filter(s => 
      s.id.toLowerCase().includes(search.toLowerCase()) || 
      s.name.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 10);
  };

  const filteredSkusForFilter = useMemo(() => filterSkus(skuSearchText), [skuSearchText]);
  const filteredSkusForModal = useMemo(() => filterSkus(modalSearch), [modalSearch]);

  const filteredWarehouses = useMemo(() => {
    return warehouses.filter(w => w.name.toLowerCase().includes(whSearchText.toLowerCase()));
  }, [warehouses, whSearchText]);

  const totalPages = Math.ceil(total / appliedFilters.pageSize);

  // Helper to map log remarks to movement badges
  const getMovementType = (log: LogEntry) => {
    const remarks = (log.remarks || '').toUpperCase();
    const change = log.qtyChange;

    if (remarks.includes('DISPATCH HOLD')) {
      return { text: 'CART HOLD', bg: 'bg-amber-50', fg: 'text-amber-700', border: 'border-amber-100' };
    }
    if (remarks.includes('DISPATCH RESUME')) {
      return { text: 'CART RESUME', bg: 'bg-amber-50', fg: 'text-amber-700', border: 'border-amber-100' };
    }
    if (remarks.includes('CART EDIT')) {
      return change > 0 
        ? { text: 'STOCK ADD', bg: 'bg-emerald-50', fg: 'text-emerald-700', border: 'border-emerald-100' }
        : { text: 'STOCK LESS', bg: 'bg-red-50', fg: 'text-red-700', border: 'border-red-100' };
    }
    if (remarks.includes('CART DELETION')) {
      return { text: 'STOCK ADD', bg: 'bg-emerald-50', fg: 'text-emerald-700', border: 'border-emerald-100' };
    }
    if (remarks.includes('MANUAL ADJUSTMENT')) {
      return { text: 'MANUAL ADJUSTMENT', bg: 'bg-gray-50', fg: 'text-gray-700', border: 'border-gray-100' };
    }
    if (remarks.includes('TRANSFER_DISPATCH') || remarks.includes('TRANSFER_DISPATCH_IN')) {
      return change < 0 
        ? { text: 'TRANSFER OUT', bg: 'bg-blue-50', fg: 'text-blue-700', border: 'border-blue-100' }
        : { text: 'TRANSFER IN', bg: 'bg-blue-50', fg: 'text-blue-700', border: 'border-blue-100' };
    }
    if (remarks.includes('TRANSFER_RECEIVE_OUT')) {
      return { text: 'TRANSFER OUT', bg: 'bg-blue-50', fg: 'text-blue-700', border: 'border-blue-100' };
    }
    if (remarks.includes('TRANSFER_RECEIVE')) {
      return { text: 'RECEIVE', bg: 'bg-blue-50', fg: 'text-blue-700', border: 'border-blue-100' };
    }
    if (remarks.startsWith('DISPATCH') || remarks.includes('DISPATCH ')) {
      return { text: 'DISPATCH', bg: 'bg-red-50', fg: 'text-red-700', border: 'border-red-100' };
    }

    return change > 0 
      ? { text: 'STOCK ADD', bg: 'bg-emerald-50', fg: 'text-emerald-700', border: 'border-emerald-100' }
      : { text: 'STOCK LESS', bg: 'bg-red-50', fg: 'text-red-700', border: 'border-red-100' };
  };

  return (
    <div className="max-w-screen-2xl mx-auto space-y-3 pb-8 px-4 mt-4">
      {/* Header & Adjust Button */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-1.5 leading-none">
            <History className="text-[#1A2766]" size={20} />
            Inventory History
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Audit trail of stock deductions and manual adjustments.</p>
        </div>
        {canAdjust && (
          <button 
            onClick={() => setShowModal(true)}
            className="bg-[#1A2766] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-[#AE1B1E] transition-all shadow-sm active:scale-95 h-7"
          >
            <Plus size={14} />
            Adjust Inventory
          </button>
        )}
      </div>

      {/* Compact Toolbar Layout (Height ~ 40px) */}
      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-2 text-xs">
        {/* Search SKU/Product */}
        <div className="relative w-44 sku-dropdown-container">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
          <input 
            type="text" 
            placeholder="Search SKU, Product, ref..."
            value={skuSearchText}
            onChange={(e) => {
              setSkuSearchText(e.target.value);
              setShowFilterSkuDropdown(true);
            }}
            onFocus={() => setShowFilterSkuDropdown(true)}
            className="w-full pl-7 pr-6 py-1 h-7 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#1A2766] outline-none bg-gray-50/50 font-medium"
          />
          {(skuSearchText || pendingQ) && (
            <button 
              onClick={() => { setPendingQ(''); setSkuSearchText(''); }} 
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
            >
              <X size={12} />
            </button>
          )}
          {showFilterSkuDropdown && skuSearchText && (
            <div className="absolute z-[20] mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredSkusForFilter.map(s => (
                <div 
                  key={s.id} 
                  className="p-2 text-xs hover:bg-gray-50 cursor-pointer border-b last:border-0"
                  onClick={() => {
                    setPendingQ(s.id);
                    setSkuSearchText(s.id);
                    setShowFilterSkuDropdown(false);
                  }}
                >
                  <div className="font-bold text-[#1A2766]">{s.id}</div>
                  <div className="text-gray-500 truncate">{s.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Compact Searchable Warehouse Dropdown */}
        <div className="relative w-36 wh-dropdown-container">
          <button 
            type="button"
            onClick={() => setShowWhDropdown(!showWhDropdown)}
            className="w-full text-left px-2.5 py-1 h-7 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#1A2766] outline-none bg-gray-50/50 font-medium truncate flex items-center justify-between"
          >
            <span>{warehouses.find(w => w.id === pendingWh)?.name || 'All Warehouses'}</span>
            <span className="text-gray-400 text-[9px]">▼</span>
          </button>
          {showWhDropdown && (
            <div className="absolute z-[20] mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto p-1">
              <input 
                type="text" 
                placeholder="Search..." 
                value={whSearchText}
                onChange={(e) => setWhSearchText(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded mb-1 outline-none focus:ring-1 focus:ring-[#1A2766] bg-gray-50"
              />
              <div 
                onClick={() => { setPendingWh(''); setWhSearchText(''); setShowWhDropdown(false); }}
                className={`p-1.5 text-xs hover:bg-gray-50 cursor-pointer rounded ${!pendingWh ? 'font-bold bg-gray-50 text-[#1A2766]' : ''}`}
              >
                All Warehouses
              </div>
              {filteredWarehouses.map(w => (
                <div 
                  key={w.id}
                  onClick={() => { setPendingWh(w.id); setWhSearchText(''); setShowWhDropdown(false); }}
                  className={`p-1.5 text-xs hover:bg-gray-50 cursor-pointer rounded ${pendingWh === w.id ? 'font-bold bg-gray-50 text-[#1A2766]' : ''}`}
                >
                  {w.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Remarks filter */}
        <div className="w-32">
          <input 
            type="text" 
            placeholder="Remarks keyword..."
            value={pendingRemark}
            onChange={(e) => setPendingRemark(e.target.value)}
            className="w-full px-2 py-1 h-7 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#1A2766] outline-none bg-gray-50/50 font-medium"
          />
        </div>

        {/* Dates */}
        <div className="flex items-center gap-1.5 text-gray-500">
          <span>From:</span>
          <input 
            type="date" 
            value={pendingFrom}
            onChange={(e) => setPendingFrom(e.target.value)}
            className="px-1.5 py-1 h-7 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#1A2766] outline-none bg-gray-50/50 font-medium"
          />
          <span>To:</span>
          <input 
            type="date" 
            value={pendingTo}
            onChange={(e) => setPendingTo(e.target.value)}
            className="px-1.5 py-1 h-7 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#1A2766] outline-none bg-gray-50/50 font-medium"
          />
        </div>

        {/* Rows selector */}
        <div className="flex items-center gap-1 text-gray-500">
          <span>Rows:</span>
          <select 
            value={appliedFilters.pageSize}
            onChange={(e) => setAppliedFilters(p => ({ ...p, pageSize: parseInt(e.target.value), page: 1 }))}
            className="px-1 py-1 h-7 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#1A2766] outline-none bg-gray-50/50 font-bold"
          >
            {[25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
          </select>
        </div>

        {/* Buttons */}
        <div className="ml-auto flex items-center gap-1.5">
          <button 
            onClick={handleReset}
            className="px-2.5 h-7 text-xs font-bold text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            Reset
          </button>
          <button 
            onClick={handleApply}
            className="bg-[#1A2766] text-white px-3.5 h-7 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-[#AE1B1E] transition-all shadow-sm active:scale-95"
          >
            <Check size={12} />
            Apply
          </button>
        </div>
      </div>

      {/* Table Section (Operational High Density) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-[30] flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-3 border-[#1A2766]/20 border-t-[#1A2766] rounded-full animate-spin" />
              <span className="text-[9px] font-bold text-[#1A2766] uppercase tracking-widest">Loading...</span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto max-h-[calc(100vh-220px)] overflow-y-auto">
          <table className="w-full text-left text-xs min-w-[1100px] border-collapse relative">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-500 text-[10px] uppercase tracking-wider font-bold sticky top-0 z-10 shadow-sm">
                <th className="py-2 px-2.5 bg-gray-50">Time</th>
                <th className="py-2 px-2.5 bg-gray-50">SKU</th>
                <th className="py-2 px-2.5 bg-gray-50">Product</th>
                <th className="py-2 px-2.5 bg-gray-50">Warehouse</th>
                <th className="py-2 px-2.5 text-right bg-gray-50">Before</th>
                <th className="py-2 px-2.5 text-center bg-gray-50">Change</th>
                <th className="py-2 px-2.5 text-right bg-gray-50">After</th>
                <th className="py-2 px-2.5 bg-gray-50">Type</th>
                <th className="py-2 px-2.5 bg-gray-50">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {logs.map((log) => {
                const typeInfo = getMovementType(log);
                return (
                  <tr key={log.id} className="hover:bg-gray-50/70 transition-colors odd:bg-white even:bg-gray-50/10 text-xs">
                    <td className="py-1.5 px-2.5 whitespace-nowrap text-[10px] font-medium text-gray-400">
                      {new Date(log.createdAt).toLocaleString('en-IN', { 
                        day: '2-digit', month: 'short',
                        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
                        timeZone: 'Asia/Kolkata'
                      }).toLowerCase()}
                    </td>
                    <td className="py-1.5 px-2.5 whitespace-nowrap font-mono font-bold text-xs text-[#1A2766]">
                      {log.skuId}
                    </td>
                    <td className="py-1.5 px-2.5 font-medium text-xs text-gray-800 truncate max-w-xs" title={log.productName}>
                      {log.productName}
                    </td>
                    <td className="py-1.5 px-2.5 whitespace-nowrap font-bold text-xs text-gray-700">
                      {log.warehouse.name}
                    </td>
                    <td className="py-1.5 px-2.5 text-right font-mono text-gray-400 text-xs">
                      {log.beforeQty >= 999999999 ? '∞' : log.beforeQty}
                    </td>
                    <td className="py-1.5 px-2.5 text-center font-mono">
                      <span className={`inline-block font-bold text-xs ${log.qtyChange > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {log.qtyChange > 0 ? '+' : ''}{log.qtyChange}
                      </span>
                    </td>
                    <td className="py-1.5 px-2.5 text-right font-mono font-bold text-gray-900 text-xs">
                      {log.afterQty >= 999999999 ? '∞' : log.afterQty}
                    </td>
                    <td className="py-1.5 px-2.5 whitespace-nowrap">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${typeInfo.bg} ${typeInfo.fg} ${typeInfo.border}`} title={log.remarks}>
                        {typeInfo.text}
                      </span>
                    </td>
                    <td className="py-1.5 px-2.5 whitespace-nowrap text-[10px] font-bold text-gray-600">
                      {log.user.name}
                    </td>
                  </tr>
                );
              })}

              {!isLoading && logs.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-gray-400">
                    <History size={48} strokeWidth={1} className="mx-auto mb-2 opacity-10" />
                    <p className="text-sm font-medium text-gray-300 uppercase tracking-widest">No matching history found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination UI */}
        <div className="bg-gray-50/50 p-4 border-t flex items-center justify-between">
          <div className="text-xs text-gray-500 font-medium">
            Showing {(appliedFilters.page - 1) * appliedFilters.pageSize + 1} – {Math.min(total, appliedFilters.page * appliedFilters.pageSize)} of {total} rows
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setAppliedFilters(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
              disabled={appliedFilters.page === 1 || isLoading}
              className="p-1.5 rounded-lg border bg-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="text-xs font-bold text-gray-600 px-3 py-1 bg-white border rounded-lg">
              Page {appliedFilters.page} of {Math.max(1, totalPages)}
            </div>
            <button 
              onClick={() => setAppliedFilters(p => ({ ...p, page: Math.min(totalPages, p.page + 1) }))}
              disabled={appliedFilters.page === totalPages || isLoading || totalPages === 0}
              className="p-1.5 rounded-lg border bg-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Adjust Inventory Modal (Enhanced UX) */}
      {showModal && (
        <InventoryAdjustModal 
          warehouses={warehouses}
          skus={skus}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            fetchLogs();
          }}
        />
      )}
    </div>
  );
}

// ─── INTERNAL MODAL COMPONENT ──────────────────────────────────────────────
function InventoryAdjustModal({ warehouses, skus, onClose, onSuccess }: { 
  warehouses: Warehouse[], 
  skus: Sku[], 
  onClose: () => void, 
  onSuccess: () => void 
}) {
  const [warehouseId, setWarehouseId] = useState('');
  const [skuId, setSkuId] = useState('');
  const [skuSearch, setSkuSearch] = useState('');
  const [showSkuDropdown, setShowSkuDropdown] = useState(false);
  
  const [currentQty, setCurrentQty] = useState<number | null>(null);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  
  const [adjustmentQty, setAdjustmentQty] = useState<string>('');
  const [finalQty, setFinalQty] = useState<string>('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch current stock when both Wh and SKU are selected
  useEffect(() => {
    if (warehouseId && skuId) {
      setIsLoadingStock(true);
      fetch(`/api/staff/inventory/stock?warehouseId=${warehouseId}&skuId=${skuId}`)
        .then(res => res.json())
        .then(data => {
          setCurrentQty(data.qty ?? 0);
          setAdjustmentQty('');
          setFinalQty(String(data.qty ?? 0));
        })
        .finally(() => setIsLoadingStock(false));
    } else {
      setCurrentQty(null);
      setAdjustmentQty('');
      setFinalQty('');
    }
  }, [warehouseId, skuId]);

  // Sync Logic: Adjust -> Final
  const handleAdjustmentChange = (val: string) => {
    setAdjustmentQty(val);
    if (currentQty === null) return;
    const delta = parseInt(val) || 0;
    setFinalQty(String(currentQty + delta));
  };

  // Sync Logic: Final -> Adjust
  const handleFinalChange = (val: string) => {
    setFinalQty(val);
    if (currentQty === null) return;
    const target = parseInt(val) || 0;
    setAdjustmentQty(String(target - currentQty));
  };

  const selectedSku = useMemo(() => skus.find(s => s.id === skuId), [skus, skuId]);
  const unit = selectedSku?.unit || 'Units';

  const afterQty = (currentQty ?? 0) + (parseInt(adjustmentQty) || 0);
  const isInvalid = afterQty < 0 || !warehouseId || !skuId || !remarks || remarks.trim().length < 3;

  const filteredSkus = useMemo(() => {
    if (!skuSearch || skuSearch.length < 2) return [];
    return skus.filter(s => 
      s.id.toLowerCase().includes(skuSearch.toLowerCase()) || 
      s.name.toLowerCase().includes(skuSearch.toLowerCase())
    ).slice(0, 10);
  }, [skuSearch, skus]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-[#1A2766] p-4 flex items-center justify-between text-white">
          <h2 className="font-bold flex items-center gap-2 text-lg">
            <Plus size={20} />
            Adjust Inventory
          </h2>
          <button onClick={onClose} className="hover:bg-white/10 p-1 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form 
          onSubmit={async (e) => {
            e.preventDefault();
            if (isInvalid || isSubmitting) return;
            setIsSubmitting(true);
            try {
              const fd = new FormData();
              fd.append('warehouseId', warehouseId);
              fd.append('skuId', skuId);
              fd.append('delta', adjustmentQty || '0');
              fd.append('remarks', remarks);
              
              const result = await adjustInventory(fd);
              onSuccess();
            } catch (err: any) {
              alert(err.message || 'Failed to adjust inventory');
            } finally {
              setIsSubmitting(false);
            }
          }} 
          className="p-6 space-y-5"
        >
          {/* 1. Warehouse (Enabled First) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Warehouse *</label>
            <select 
              value={warehouseId} 
              onChange={(e) => {
                setWarehouseId(e.target.value);
                setSkuId('');
                setSkuSearch('');
              }}
              required 
              className="w-full border rounded-xl p-2.5 text-sm font-bold focus:ring-2 focus:ring-[#1A2766] outline-none bg-gray-50"
            >
              <option value="">Select Warehouse</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          {/* 2. SKU (Enabled after Warehouse) */}
          <div className="relative space-y-1.5">
            <label className={`block text-xs font-bold uppercase tracking-wider ${!warehouseId ? 'text-gray-300' : 'text-gray-400'}`}>
              SKU / Product * {!warehouseId && '(Select Warehouse First)'}
            </label>
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${!warehouseId ? 'text-gray-200' : 'text-gray-400'}`} size={14} />
              <input 
                type="text" 
                value={skuSearch}
                disabled={!warehouseId}
                onChange={(e) => {
                  setSkuSearch(e.target.value);
                  setSkuId('');
                  setShowSkuDropdown(true);
                }}
                onFocus={() => setShowSkuDropdown(true)}
                placeholder={warehouseId ? "Search SKU ID or Name..." : "---"}
                className="w-full border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none bg-gray-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                autoComplete="off"
              />
            </div>
            {showSkuDropdown && skuSearch && !skuId && (
              <div className="absolute z-[110] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                {filteredSkus.map(s => (
                  <div 
                    key={s.id} 
                    className="p-3 text-xs hover:bg-gray-50 cursor-pointer border-b last:border-0"
                    onClick={() => {
                      setSkuId(s.id);
                      setSkuSearch(`${s.id} - ${s.name}`);
                      setShowSkuDropdown(false);
                    }}
                  >
                    <div className="font-bold text-[#1A2766]">{s.id}</div>
                    <div className="text-gray-500 truncate text-[10px]">{s.name}</div>
                  </div>
                ))}
                {filteredSkus.length === 0 && (
                  <div className="p-4 text-center text-gray-400 text-xs italic">No matching SKUs found</div>
                )}
              </div>
            )}
          </div>

          {/* 3. Stock Context (Visible after SKU) */}
          {skuId && (
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Current Qty:</span>
              <span className={`text-sm font-black ${isLoadingStock ? 'animate-pulse text-gray-300' : 'text-[#1A2766]'}`}>
                {isLoadingStock ? 'Fetching...' : `${currentQty} ${unit}`}
              </span>
            </div>
          )}

          {/* 4. Adjustment Inputs (Enabled after SKU) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={`block text-xs font-bold uppercase tracking-wider ${!skuId ? 'text-gray-300' : 'text-gray-400'}`}>Adjustment Qty</label>
              <input 
                type="number" 
                value={adjustmentQty}
                onChange={(e) => handleAdjustmentChange(e.target.value)}
                disabled={!skuId || isLoadingStock}
                placeholder="+20 or -5"
                className="w-full border rounded-xl p-2.5 text-sm font-black focus:ring-2 focus:ring-[#1A2766] outline-none bg-gray-50 disabled:opacity-50" 
              />
            </div>
            <div className="space-y-1.5">
              <label className={`block text-xs font-bold uppercase tracking-wider ${!skuId ? 'text-gray-300' : 'text-gray-400'}`}>Final Qty</label>
              <input 
                type="number" 
                value={finalQty}
                onChange={(e) => handleFinalChange(e.target.value)}
                disabled={!skuId || isLoadingStock}
                placeholder="e.g. 100"
                className="w-full border rounded-xl p-2.5 text-sm font-black focus:ring-2 focus:ring-[#1A2766] outline-none bg-gray-50 disabled:opacity-50" 
              />
            </div>
          </div>

          {/* 5. Remarks */}
          <div className="space-y-1.5">
            <label className={`block text-xs font-bold uppercase tracking-wider ${!skuId ? 'text-gray-300' : 'text-gray-400'}`}>Remarks *</label>
            <textarea 
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={!skuId || isLoadingStock}
              rows={2}
              placeholder="Reason for adjustment..."
              className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none bg-gray-50 disabled:opacity-50"
            />
          </div>

          {/* 6. Live Preview & Validation */}
          {skuId && !isLoadingStock && (
            <div className={`p-3 rounded-xl border flex items-center justify-between transition-all ${afterQty < 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-100'}`}>
              <div className="flex flex-col">
                <span className={`text-[10px] font-black uppercase tracking-widest ${afterQty < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  After Qty
                </span>
                {afterQty < 0 && (
                  <span className="text-[10px] font-bold text-red-600 mt-0.5">Critical: Cannot have negative stock</span>
                )}
              </div>
              <span className={`text-lg font-black tabular-nums ${afterQty < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                {afterQty} {unit}
              </span>
            </div>
          )}


          {/* 7. Submit */}
          <div className="pt-2">
            <button 
              type="submit"
              disabled={isInvalid || isSubmitting || isLoadingStock}
              className="w-full bg-[#1A2766] text-white py-3.5 rounded-xl font-bold hover:bg-[#AE1B1E] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Adjusting Inventory...
                </>
              ) : (
                'Confirm Adjustment'
              )}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
