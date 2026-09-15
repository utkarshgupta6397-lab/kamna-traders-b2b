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
import { validateQuantityPrecision, isValidPrecisionInput } from '@/lib/uom-precision';

// All possible movement types for the Type filter
const MOVEMENT_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'POST DISPATCH DEDUCTION', label: 'Post Dispatch Deduction' },
  { value: 'MANUAL ADJUSTMENT', label: 'Manual Adjustment' },
  { value: 'DISPATCH', label: 'Dispatch' },
  { value: 'CART HOLD', label: 'Cart Hold' },
  { value: 'CART RESUME', label: 'Cart Resume' },
  { value: 'STOCK ADD', label: 'Stock Add' },
  { value: 'STOCK LESS', label: 'Stock Less' },
  { value: 'TRANSFER IN', label: 'Transfer In' },
  { value: 'TRANSFER OUT', label: 'Transfer Out' },
  { value: 'RECEIVE', label: 'Receive' },
];

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
  referenceType?: string | null;
  referenceId?: string | null;
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
  unitShort?: string | null;
  isDecimal?: boolean;
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

  // Build a lookup map: skuId -> display UOM string
  const skuUomMap = useMemo(() => {
    const map = new Map<string, string>();
    skus.forEach(s => {
      const uom = s.unitShort || s.unit || '';
      if (uom) map.set(s.id, uom);
    });
    return map;
  }, [skus]);

  // Build unique UOM list for filter dropdown
  const uniqueUoms = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    skus.forEach(s => {
      const uom = s.unitShort || s.unit || '';
      if (uom && !seen.has(uom)) {
        seen.add(uom);
        list.push(uom);
      }
    });
    return list.sort();
  }, [skus]);

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

  // Client-side Type and UOM filter (applied after fetch)
  const [pendingTypeFilter, setPendingTypeFilter] = useState('');
  const [pendingUomFilter, setPendingUomFilter] = useState('');
  const [activeTypeFilter, setActiveTypeFilter] = useState('');
  const [activeUomFilter, setActiveUomFilter] = useState('');

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
    setActiveTypeFilter(pendingTypeFilter);
    setActiveUomFilter(pendingUomFilter);
  };

  const handleReset = () => {
    setPendingQ('');
    setPendingWh('');
    setPendingRemark('');
    setPendingFrom(todayStr);
    setPendingTo(todayStr);
    setSkuSearchText('');
    setWhSearchText('');
    setPendingTypeFilter('');
    setPendingUomFilter('');
    setActiveTypeFilter('');
    setActiveUomFilter('');
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

    if (log.referenceType === 'POST_DISPATCH_DEDUCTION' || remarks.includes('POST-DISPATCH') || remarks.includes('POST_DISPATCH')) {
      return { text: 'POST DISPATCH DEDUCTION', bg: 'bg-purple-50', fg: 'text-purple-700', border: 'border-purple-200' };
    }

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

  // Helper: extract invoice reference from remarks or referenceId
  const getInvoiceRef = (log: LogEntry): string | null => {
    const remarks = log.remarks || '';
    if (remarks.includes('Invoice:')) {
      return remarks.split('Invoice:')[1]?.trim() || null;
    }
    // Also check referenceId for post-dispatch entries
    if (log.referenceType === 'POST_DISPATCH_DEDUCTION' && log.referenceId) {
      return log.referenceId;
    }
    return null;
  };

  // Helper: format timestamp into separated date + time lines
  const formatTimestamp = (isoString: string) => {
    const d = new Date(isoString);
    const dateStr = d.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: '2-digit',
      timeZone: 'Asia/Kolkata'
    });
    const timeStr = d.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
      timeZone: 'Asia/Kolkata'
    }).toLowerCase();
    return { dateStr, timeStr };
  };

  // Apply client-side Type and UOM filters on top of server-fetched logs
  const filteredLogs = useMemo(() => {
    let result = logs;
    if (activeTypeFilter) {
      result = result.filter(log => getMovementType(log).text === activeTypeFilter);
    }
    if (activeUomFilter) {
      result = result.filter(log => {
        const uom = skuUomMap.get(log.skuId) || '';
        return uom === activeUomFilter;
      });
    }
    return result;
  }, [logs, activeTypeFilter, activeUomFilter, skuUomMap]);

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

        {/* Type filter (client-side) */}
        <div className="w-40">
          <select
            value={pendingTypeFilter}
            onChange={(e) => setPendingTypeFilter(e.target.value)}
            className="w-full px-2 py-1 h-7 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#1A2766] outline-none bg-gray-50/50 font-medium"
          >
            {MOVEMENT_TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* UOM filter (client-side) */}
        {uniqueUoms.length > 0 && (
          <div className="w-24">
            <select
              value={pendingUomFilter}
              onChange={(e) => setPendingUomFilter(e.target.value)}
              className="w-full px-2 py-1 h-7 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#1A2766] outline-none bg-gray-50/50 font-medium"
            >
              <option value="">All UOM</option>
              {uniqueUoms.map(uom => (
                <option key={uom} value={uom}>{uom}</option>
              ))}
            </select>
          </div>
        )}

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
          {/* 9 columns: Time | Item | Warehouse | Before | Change | After | UOM | Type | User */}
          <table className="w-full text-left text-xs min-w-[1100px] border-collapse relative">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-500 text-[10px] uppercase tracking-wider font-bold sticky top-0 z-10 shadow-sm">
                <th className="py-2 px-2.5 bg-gray-50 w-24">Time</th>
                <th className="py-2 px-2.5 bg-gray-50">Item</th>
                <th className="py-2 px-2.5 bg-gray-50 w-28">Warehouse</th>
                <th className="py-2 px-2.5 text-right bg-gray-50 w-16">Before</th>
                <th className="py-2 px-2.5 text-center bg-gray-50 w-16">Change</th>
                <th className="py-2 px-2.5 text-right bg-gray-50 w-16">After</th>
                <th className="py-2 px-2.5 bg-gray-50 w-14">UOM</th>
                <th className="py-2 px-2.5 bg-gray-50 w-44">Type</th>
                <th className="py-2 px-2.5 bg-gray-50 w-24">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {filteredLogs.map((log) => {
                const typeInfo = getMovementType(log);
                const invoiceRef = getInvoiceRef(log);
                const uom = skuUomMap.get(log.skuId) || '';
                const { dateStr, timeStr } = formatTimestamp(log.createdAt);
                const changeNum = Number(log.qtyChange);
                return (
                  <tr key={log.id} className="hover:bg-gray-50/70 transition-colors odd:bg-white even:bg-gray-50/10 text-xs">
                    {/* Time: date on top line, time on second line */}
                    <td className="py-1.5 px-2.5 whitespace-nowrap">
                      <div className="text-[10px] font-semibold text-gray-700 leading-tight">{dateStr}</div>
                      <div className="text-[9px] font-medium text-gray-400 leading-tight tabular-nums">{timeStr}</div>
                    </td>

                    {/* Item: Product name prominent, SKU smaller/muted/monospace beneath */}
                    <td className="py-1.5 px-2.5 max-w-xs">
                      <div className="font-semibold text-xs text-gray-800 truncate leading-tight" title={log.productName}>
                        {log.productName}
                      </div>
                      <div className="font-mono text-[9px] text-gray-400 font-medium leading-tight truncate" title={log.skuId}>
                        {log.skuId}
                      </div>
                    </td>

                    {/* Warehouse: compact badge */}
                    <td className="py-1.5 px-2.5 whitespace-nowrap">
                      <span className="inline-block text-[10px] font-bold text-[#1A2766] bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 leading-tight truncate max-w-[7rem]" title={log.warehouse.name}>
                        {log.warehouse.name}
                      </span>
                    </td>

                    {/* Before: secondary/muted */}
                    <td className="py-1.5 px-2.5 text-right font-mono text-gray-400 text-[10px]">
                      {log.beforeQty >= 999999999 ? '∞' : log.beforeQty}
                    </td>

                    {/* Change: green/red/muted with +/- sign */}
                    <td className="py-1.5 px-2.5 text-center font-mono">
                      <span className={`inline-block font-bold text-xs tabular-nums ${
                        changeNum > 0
                          ? 'text-emerald-600'
                          : changeNum < 0
                            ? 'text-red-600'
                            : 'text-gray-400'
                      }`}>
                        {changeNum > 0 ? '+' : ''}{log.qtyChange}
                      </span>
                    </td>

                    {/* After: bold/prominent */}
                    <td className="py-1.5 px-2.5 text-right font-mono font-bold text-gray-900 text-xs tabular-nums">
                      {log.afterQty >= 999999999 ? '∞' : log.afterQty}
                    </td>

                    {/* UOM: immediately after After */}
                    <td className="py-1.5 px-2.5 whitespace-nowrap">
                      {uom ? (
                        <span className="text-[10px] font-semibold text-gray-500">{uom}</span>
                      ) : (
                        <span className="text-[9px] text-gray-300">—</span>
                      )}
                    </td>

                    {/* Type: badge + invoice ref beneath for POST DISPATCH */}
                    <td className="py-1.5 px-2.5">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${typeInfo.bg} ${typeInfo.fg} ${typeInfo.border} leading-tight`}
                        title={log.remarks}
                      >
                        {typeInfo.text}
                      </span>
                      {invoiceRef && (
                        <span className="block text-[9px] text-gray-400 font-mono mt-0.5 truncate max-w-[10rem]" title={invoiceRef}>
                          {invoiceRef}
                        </span>
                      )}
                    </td>

                    {/* User */}
                    <td className="py-1.5 px-2.5 whitespace-nowrap text-[10px] font-bold text-gray-600">
                      {log.user.name}
                    </td>
                  </tr>
                );
              })}

              {!isLoading && filteredLogs.length === 0 && (
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
        <div className="bg-gray-50/50 p-3 border-t flex items-center justify-between">
          <div className="text-xs text-gray-500 font-medium">
            {activeTypeFilter || activeUomFilter ? (
              <>Showing {filteredLogs.length} filtered of {(appliedFilters.page - 1) * appliedFilters.pageSize + 1}–{Math.min(total, appliedFilters.page * appliedFilters.pageSize)} loaded ({total} total)</>
            ) : (
              <>Showing {(appliedFilters.page - 1) * appliedFilters.pageSize + 1} – {Math.min(total, appliedFilters.page * appliedFilters.pageSize)} of {total} rows</>
            )}

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
  const [remarks, setRemarks] = useState('Stock Adjustment');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch current stock when both Wh and SKU are selected
  useEffect(() => {
    if (warehouseId && skuId) {
      setIsLoadingStock(true);
      fetch(`/api/staff/inventory/stock?warehouseId=${warehouseId}&skuId=${skuId}`)
        .then(res => res.json())
        .then(data => {
          const qty = data.qty !== undefined && data.qty !== null ? Number(data.qty) : 0;
          setCurrentQty(qty);
          setAdjustmentQty('');
          setFinalQty(String(qty));
        })
        .finally(() => setIsLoadingStock(false));
    } else {
      setCurrentQty(null);
      setAdjustmentQty('');
      setFinalQty('');
    }
  }, [warehouseId, skuId]);

  // Helper to round floating-point math cleanly to 2 decimals without artifacts
  const roundQty = (val: number): number => {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  };

  const safeCurrentQty = currentQty ?? 0;

  const selectedSku = useMemo(() => skus.find(s => s.id === skuId), [skus, skuId]);
  const isDecimal = Boolean(selectedSku?.isDecimal);
  const unit = selectedSku?.unitShort || selectedSku?.unit || 'Units';

  // Sync Logic: Adjust -> Final (respecting isDecimal: integers only if false, max 2 decimals if true)
  const handleAdjustmentChange = (val: string) => {
    if (!isValidPrecisionInput(val, isDecimal, true)) {
      return;
    }
    setAdjustmentQty(val);
    if (currentQty === null) return;
    if (val === '' || val === '-' || val === '+') {
      setFinalQty(String(safeCurrentQty));
      return;
    }
    const delta = parseFloat(val);
    if (!isNaN(delta)) {
      setFinalQty(String(roundQty(safeCurrentQty + delta)));
    }
  };

  // Sync Logic: Final -> Adjust (respecting isDecimal)
  const handleFinalChange = (val: string) => {
    // Final qty cannot be negative
    if (!isValidPrecisionInput(val, isDecimal, false)) {
      return;
    }
    setFinalQty(val);
    if (currentQty === null) return;
    if (val === '' || val === '-') {
      setAdjustmentQty('');
      return;
    }
    const target = parseFloat(val);
    if (!isNaN(target)) {
      setAdjustmentQty(String(roundQty(target - safeCurrentQty)));
    }
  };

  const parsedDelta = parseFloat(adjustmentQty);
  const isAdjustmentEmptyOrSign = adjustmentQty === '' || adjustmentQty === '-' || adjustmentQty === '+';
  const precisionResult = validateQuantityPrecision(adjustmentQty, isDecimal);
  const hasValidDecimals = precisionResult.valid;
  const afterQty = isAdjustmentEmptyOrSign
    ? safeCurrentQty
    : !isNaN(parsedDelta)
      ? roundQty(safeCurrentQty + parsedDelta)
      : safeCurrentQty;
  const isInvalid = afterQty < 0 || !warehouseId || !skuId || !remarks || remarks.trim().length < 3 || isAdjustmentEmptyOrSign || isNaN(parsedDelta) || !hasValidDecimals;

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
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className={`block text-xs font-bold uppercase tracking-wider ${!skuId ? 'text-gray-300' : 'text-gray-400'}`}>Adjustment Qty</label>
                  {skuId && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isDecimal ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {isDecimal ? 'Max 2 decimals' : 'Integers only'}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step={isDecimal ? "0.01" : "1"}
                  value={adjustmentQty}
                  onChange={(e) => handleAdjustmentChange(e.target.value)}
                  disabled={!skuId || isLoadingStock}
                  placeholder={isDecimal ? "+20 or -5.3" : "+20 or -5"}
                  className="w-full border rounded-xl p-2.5 text-sm font-black focus:ring-2 focus:ring-[#1A2766] outline-none bg-gray-50 disabled:opacity-50"
                />
              </div>
              <div className="space-y-1.5">
                <label className={`block text-xs font-bold uppercase tracking-wider ${!skuId ? 'text-gray-300' : 'text-gray-400'}`}>Final Qty</label>
                <input
                  type="number"
                  step={isDecimal ? "0.01" : "1"}
                  value={finalQty}
                  onChange={(e) => handleFinalChange(e.target.value)}
                  disabled={!skuId || isLoadingStock}
                  placeholder={isDecimal ? "e.g. 100.5" : "e.g. 100"}
                  className="w-full border rounded-xl p-2.5 text-sm font-black focus:ring-2 focus:ring-[#1A2766] outline-none bg-gray-50 disabled:opacity-50"
                />
              </div>
            </div>
            {skuId && !hasValidDecimals && adjustmentQty && !isAdjustmentEmptyOrSign && (
              <p className="text-[11px] text-red-600 font-medium mt-1">
                {precisionResult.error}
              </p>
            )}
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
