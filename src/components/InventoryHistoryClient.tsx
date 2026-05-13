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
}

interface Props {
  warehouses: Warehouse[];
  skus: Sku[];
  canAdjust?: boolean;
}

export default function InventoryHistoryClient({ warehouses, skus, canAdjust = false }: Props) {
  // --- Applied Filter States (Actual state of truth for data fetch) ---
  const [appliedFilters, setAppliedFilters] = useState({
    q: '',
    warehouseId: '',
    remark: '',
    from: '',
    to: '',
    page: 1,
    pageSize: 25
  });

  // --- Pending Filter States (Local input values before Apply) ---
  const [pendingQ, setPendingQ] = useState('');
  const [pendingWh, setPendingWh] = useState('');
  const [pendingRemark, setPendingRemark] = useState('');
  const [pendingFrom, setPendingFrom] = useState('');
  const [pendingTo, setPendingTo] = useState('');
  const [showFilterSkuDropdown, setShowFilterSkuDropdown] = useState(false);
  const [skuSearchText, setSkuSearchText] = useState('');

  // --- Data State ---
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // --- Modal State ---
  const [showModal, setShowModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [selectedSkuId, setSelectedSkuId] = useState('');
  const [showSkuDropdown, setShowSkuDropdown] = useState(false);

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
    setPendingFrom('');
    setPendingTo('');
    setSkuSearchText('');
    setAppliedFilters({
      q: '',
      warehouseId: '',
      remark: '',
      from: '',
      to: '',
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

  const totalPages = Math.ceil(total / appliedFilters.pageSize);

  return (
    <div className="max-w-screen-2xl mx-auto space-y-6 pb-20 px-4 mt-6">
      {/* Header & Adjust Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <History className="text-[#1A2766]" size={24} />
            Inventory History
          </h1>
          <p className="text-sm text-gray-500 mt-1">Audit trail of stock deductions and manual adjustments.</p>
        </div>
        {canAdjust && (
          <button 
            onClick={() => setShowModal(true)}
            className="bg-[#1A2766] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#AE1B1E] transition-all shadow-md active:scale-95"
          >
            <Plus size={18} />
            Adjust Inventory
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Product Search (Dropdown) */}
          <div className="relative">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Product / SKU</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input 
                type="text" 
                placeholder={pendingQ || "Search SKU or Name..."}
                value={skuSearchText}
                onChange={(e) => {
                  setSkuSearchText(e.target.value);
                  setShowFilterSkuDropdown(true);
                }}
                onFocus={() => setShowFilterSkuDropdown(true)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#1A2766] outline-none bg-gray-50/50 font-medium"
              />
              {pendingQ && (
                <button onClick={() => { setPendingQ(''); setSkuSearchText(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500">
                  <X size={14} />
                </button>
              )}
            </div>
            {showFilterSkuDropdown && skuSearchText && (
              <div className="absolute z-[20] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                {filteredSkusForFilter.map(s => (
                  <div 
                    key={s.id} 
                    className="p-3 text-xs hover:bg-gray-50 cursor-pointer border-b last:border-0"
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

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Warehouse</label>
            <select 
              value={pendingWh}
              onChange={(e) => setPendingWh(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#1A2766] outline-none bg-gray-50/50 appearance-none font-medium"
            >
              <option value="">All Warehouses</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Remarks Search</label>
            <input 
              type="text" 
              placeholder="e.g. Damaged, Supplier..."
              value={pendingRemark}
              onChange={(e) => setPendingRemark(e.target.value)}
              className="w-full px-4 py-2 text-sm border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#1A2766] outline-none bg-gray-50/50 font-medium"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">From Date</label>
              <input 
                type="date" 
                value={pendingFrom}
                onChange={(e) => setPendingFrom(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#1A2766] outline-none bg-gray-50/50 font-medium"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">To Date</label>
              <input 
                type="date" 
                value={pendingTo}
                onChange={(e) => setPendingTo(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#1A2766] outline-none bg-gray-50/50 font-medium"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Rows:</span>
              <select 
                value={appliedFilters.pageSize}
                onChange={(e) => setAppliedFilters(p => ({ ...p, pageSize: parseInt(e.target.value), page: 1 }))}
                className="text-xs font-bold bg-gray-50 border rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-[#1A2766]"
              >
                {[10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={handleReset}
              className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-900 flex items-center gap-2 transition-colors"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              Reset
            </button>
            <button 
              onClick={handleApply}
              className="bg-[#1A2766] text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#AE1B1E] transition-all shadow-md active:scale-95"
            >
              <Check size={16} />
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-[30] flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 border-4 border-[#1A2766]/20 border-t-[#1A2766] rounded-full animate-spin" />
              <span className="text-[10px] font-bold text-[#1A2766] uppercase tracking-widest">Loading Audit Logs...</span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[1100px] border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b text-gray-500 text-[10px] uppercase tracking-wider font-bold sticky top-0 z-10 backdrop-blur-sm">
                <th className="p-4">Date & Time</th>
                <th className="p-4">Warehouse</th>
                <th className="p-4">SKU ID</th>
                <th className="p-4">Product Name</th>
                <th className="p-4 text-right">Before</th>
                <th className="p-4 text-center">Change</th>
                <th className="p-4 text-right">After</th>
                <th className="p-4">Remarks</th>
                <th className="p-4">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-gray-700">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 whitespace-nowrap text-[11px] font-medium text-gray-400">
                    {new Date(log.createdAt).toLocaleString('en-IN', { 
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
                      timeZone: 'Asia/Kolkata'
                    }).toLowerCase()}
                  </td>
                  <td className="p-4 whitespace-nowrap font-bold text-xs text-gray-700">
                    {log.warehouse.name}
                  </td>
                  <td className="p-4 whitespace-nowrap font-mono font-bold text-xs text-[#1A2766]">
                    {log.skuId}
                  </td>
                  <td className="p-4 font-medium text-xs text-gray-800">
                    {log.productName}
                  </td>
                  <td className="p-4 text-right font-mono text-gray-400 text-xs">
                    {log.beforeQty}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold min-w-[40px] border ${log.qtyChange > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                      {log.qtyChange > 0 ? '+' : ''}{log.qtyChange}
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono font-bold text-gray-900 text-xs">
                    {log.afterQty}
                  </td>
                  <td className="p-4 text-[11px] text-gray-500 leading-relaxed max-w-xs break-words italic">
                    {log.remarks}
                  </td>
                  <td className="p-4 whitespace-nowrap text-[11px] font-bold text-gray-600">
                    {log.user.name}
                  </td>
                </tr>
              ))}

              {!isLoading && logs.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-20 text-center text-gray-400">
                    <History size={64} strokeWidth={1} className="mx-auto mb-4 opacity-10" />
                    <p className="text-lg font-medium text-gray-300 uppercase tracking-widest">No matching history found.</p>
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

      {/* Adjust Inventory Modal (Preserved behavior) */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-[#1A2766] p-4 flex items-center justify-between text-white">
              <h2 className="font-bold flex items-center gap-2 text-lg">
                <Plus size={20} />
                Adjust Inventory
              </h2>
              <button onClick={() => setShowModal(false)} className="hover:bg-white/10 p-1 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form action={async (fd) => { 
              await adjustInventory(fd); 
              setShowModal(false); 
              fetchLogs(); // Refresh logs after adjustment
            }} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Warehouse *</label>
                <select name="warehouseId" required className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none bg-gray-50">
                  <option value="">Select Warehouse</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>

              <div className="relative space-y-1.5">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">SKU / Product *</label>
                <input type="hidden" name="skuId" value={selectedSkuId} required />
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input 
                    type="text" 
                    value={modalSearch}
                    onChange={(e) => {
                      setModalSearch(e.target.value);
                      setSelectedSkuId('');
                      setShowSkuDropdown(true);
                    }}
                    onFocus={() => setShowSkuDropdown(true)}
                    placeholder="Search by SKU ID or Name..."
                    className="w-full border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none bg-gray-50 font-medium"
                    autoComplete="off"
                    required={!selectedSkuId}
                  />
                </div>
                {showSkuDropdown && modalSearch && !selectedSkuId && (
                  <div className="absolute z-[110] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                    {filteredSkusForModal.map(s => (
                      <div 
                        key={s.id} 
                        className="p-3 text-xs hover:bg-gray-50 cursor-pointer border-b last:border-0"
                        onClick={() => {
                          setSelectedSkuId(s.id);
                          setModalSearch(`${s.id} - ${s.name}`);
                          setShowSkuDropdown(false);
                        }}
                      >
                        <div className="font-bold text-[#1A2766]">{s.id}</div>
                        <div className="text-gray-500 truncate text-[10px]">{s.name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Adjustment Qty *</label>
                <input 
                  type="number" 
                  name="delta" 
                  required 
                  placeholder="+20 or -5"
                  className="w-full border rounded-xl p-2.5 text-sm font-bold focus:ring-2 focus:ring-[#1A2766] outline-none bg-gray-50" 
                />
                <p className="text-[10px] text-gray-400 font-medium ml-1 italic">Use +/- for relative change</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Remarks (Mandatory) *</label>
                <textarea 
                  name="remarks" 
                  required 
                  rows={2}
                  placeholder="e.g. Stock recount, Damaged stock, Opening correction..."
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none bg-gray-50"
                />
              </div>

              <div className="pt-2">
                <FormSubmit className="w-full bg-[#1A2766] text-white py-3 rounded-xl font-bold hover:bg-[#AE1B1E] transition-all shadow-lg active:scale-[0.98]">
                  Submit Adjustment
                </FormSubmit>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
