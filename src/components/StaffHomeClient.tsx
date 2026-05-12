'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ProductCard, { ProductData } from '@/components/ProductCard';
import CartPanel from '@/components/CartPanel';
import { useCartStore } from '@/store/cartStore';
import { useSkuStore } from '@/store/skuStore';
import { Printer, Scan, Loader2, RefreshCw, AlertTriangle, Eye, EyeOff, ChevronDown, Check } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { qzManager } from '@/lib/print/qz-tray';
import { renderDispatchSlips } from '@/lib/print/slip-renderer';
import toast from 'react-hot-toast';

interface Category { id: string; name: string; count: number }
interface Warehouse { id: string; name: string }

interface Props {
  staffId: string;
  warehouses: Warehouse[];
  categories: Category[];
}

/** Fetch all active SKUs from the lightweight API endpoint */
async function fetchAllSkus(): Promise<ProductData[]> {
  const start = performance.now();
  const res = await fetch('/api/staff/skus');
  if (!res.ok) throw new Error(`Failed to fetch SKUs: ${res.status}`);
  const data = await res.json();
  const end = performance.now();
  console.log(`[PERF] fetchAllSkus: ${(end - start).toFixed(2)}ms`);
  return data;
}

/** Background refresh interval (ms) — 5 minutes (300,000ms) for silent hydration */
const BG_REFRESH_INTERVAL = 300_000;

/** Progressive dispatch loader — fills to ~92% over 10s, completes on API response */
function DispatchProgressOverlay() {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('Validating inventory...');

  useEffect(() => {
    const startTime = Date.now();
    const duration = 10000; // 10 seconds to reach ~92%
    const maxProgress = 92;

    const phases = [
      { at: 0, text: 'Validating inventory...' },
      { at: 15, text: 'Checking warehouse stock...' },
      { at: 35, text: 'Generating dispatch number...' },
      { at: 55, text: 'Writing inventory updates...' },
      { at: 75, text: 'Creating dispatch record...' },
      { at: 88, text: 'Finalizing...' },
    ];

    let raf: number;
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Cubic ease-out: fast start, slow finish
      const eased = 1 - Math.pow(1 - t, 3);
      const current = eased * maxProgress;
      setProgress(current);

      // Update phase text
      for (let i = phases.length - 1; i >= 0; i--) {
        if (current >= phases[i].at) {
          setPhase(phases[i].text);
          break;
        }
      }

      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="fixed inset-0 z-[999] bg-[#1A2766]/60 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-5 max-w-xs w-full">
        <div className="w-16 h-16 rounded-2xl bg-[#1A2766] flex items-center justify-center shadow-lg">
          <Printer size={28} className="text-white" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-[16px] font-[800] text-[#1A2766]">Generating Dispatch Note</p>
          <p className="text-[12px] font-[600] text-gray-400 h-4 transition-all duration-300">{phase}</p>
        </div>
        <div className="w-full space-y-2">
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1A2766] transition-all duration-500 ease-out"
              style={{ 
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #1A2766 0%, #3B5BDB 50%, #5C7CFA 100%)'
              }}
            />
          </div>
          <p className="text-center text-[11px] font-[700] text-[#1A2766]/60 tabular-nums">
            {Math.round(progress)}%
          </p>
        </div>
      </div>
    </div>
  );
}

export default function StaffHomeClient({ staffId, warehouses, categories }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isThermalReady, setIsThermalReady] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Detect Thermal Printer for Silent Printing
  useEffect(() => {
    const checkThermal = async () => {
      try {
        const connected = await qzManager.connect();
        if (connected) {
          const printer = await qzManager.findPrinter();
          setIsThermalReady(!!printer);
        }
      } catch (e) {
        console.warn('[PRINT] Thermal detection failed', e);
      }
    };
    checkThermal();
  }, []);
  const [showCaseFilter, setShowCaseFilter] = useState(false);
  const fetchInProgress = useRef(false);
  const lastFetchTime = useRef(0);

  // SKU store (local cache)
  const status = useSkuStore((s) => s.status);
  const errorMsg = useSkuStore((s) => s.errorMsg);
  const allSkus = useSkuStore((s) => s.allSkus);
  const selectedCategoryId = useSkuStore((s) => s.selectedCategoryId);
  const searchQuery = useSkuStore((s) => s.searchQuery);
  const setSkus = useSkuStore((s) => s.setSkus);
  const setStatus = useSkuStore((s) => s.setStatus);
  const setCategory = useSkuStore((s) => s.setCategory);
  const getFiltered = useSkuStore((s) => s.getFiltered);
  const hideOos = useSkuStore((s) => s.hideOos);
  const setHideOos = useSkuStore((s) => s.setHideOos);
  const selectedCaseSizes = useSkuStore((s) => s.selectedCaseSizes);
  const setSelectedCaseSizes = useSkuStore((s) => s.setSelectedCaseSizes);
  const lastFetchedAt = useSkuStore((s) => s.lastFetchedAt);

  // Cart
  const { items, addItem, clearCart } = useCartStore();
  const totalQty = items.reduce((a, i) => a + i.qty, 0);

  // Derived: Active Category List & Counts based on current Search + OOS state
  const dynamicCategories = useMemo(() => {
    // 1. Filter by Search + OOS only (ignoring category selection)
    let searchFiltered = allSkus;
    if (hideOos) {
      searchFiltered = searchFiltered.filter((s) => !s.isOos);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      searchFiltered = searchFiltered.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          (s.brand ?? '').toLowerCase().includes(q)
      );
    }

    // 2. Count occurrences per category
    const counts: Record<string, number> = {};
    searchFiltered.forEach(s => {
      if (s.categoryId) {
        counts[s.categoryId] = (counts[s.categoryId] || 0) + 1;
      }
    });

    // 3. Build the final visible list
    return {
      fullCount: searchFiltered.length,
      visible: categories
        .map(c => ({ ...c, count: counts[c.id] || 0 }))
        .filter(c => c.count > 0)
    };
  }, [allSkus, searchQuery, hideOos, categories]);

  const selectedBrands = useSkuStore((s) => s.selectedBrands);
  const toggleBrand = useSkuStore((s) => s.toggleBrand);
  const topBrandsByCategory = useSkuStore((s) => s.topBrandsByCategory);
  const topBrandsFullCatalog = useSkuStore((s) => s.topBrandsFullCatalog);

  // Filtered products — recomputes when allSkus, category, search, hideOos, selectedCaseSizes, or selectedBrands change
  const products = useMemo(() => getFiltered(), [getFiltered, allSkus, selectedCategoryId, searchQuery, hideOos, selectedCaseSizes, selectedBrands]);

  // Derived: Unique Case Sizes > 1 for filtering
  const availableCaseSizes = useMemo(() => {
    const sizes = Array.from(new Set(allSkus.map(s => s.caseSize).filter((s): s is number => !!s && s > 1))).sort((a, b) => a - b);
    return sizes;
  }, [allSkus]);

  // Derived: Sizes actually available in the currently selected category (for disabling irrelevant pills)
  const sizesInCategory = useMemo(() => {
    const list = selectedCategoryId 
      ? allSkus.filter(s => s.categoryId === selectedCategoryId)
      : allSkus;
    return new Set(list.map(s => s.caseSize).filter((s): s is number => !!s && s > 1));
  }, [allSkus, selectedCategoryId]);

  // Derived: "Updated X ago" text — Optimized to avoid triggering full component re-renders if possible,
  // though useState in the main component will still cause it.
  const [timeAgo, setTimeAgo] = useState('Just now');
  useEffect(() => {
    if (!lastFetchedAt) return;
    
    const update = () => {
      const sec = Math.floor((Date.now() - lastFetchedAt) / 1000);
      let next = 'Just now';
      if (sec >= 60) next = `${Math.floor(sec / 60)}m ago`;
      else if (sec >= 10) next = `${sec}s ago`;
      
      setTimeAgo(prev => prev === next ? prev : next);
    };

    update();
    const inv = setInterval(update, 10000);
    return () => clearInterval(inv);
  }, [lastFetchedAt]);

  // Derived: Current Brands to show
  const currentTopBrands = useMemo(() => {
    return selectedCategoryId 
      ? (topBrandsByCategory[selectedCategoryId] || [])
      : topBrandsFullCatalog;
  }, [selectedCategoryId, topBrandsByCategory, topBrandsFullCatalog]);

  // ─── Initial Load ──────────────────────────────────────────────
  const loadSkus = useCallback(async (silent = false) => {
    // 1. Prevent overlapping requests
    if (fetchInProgress.current) {
      console.log(`[SYNC] Fetch already in progress, skipping`);
      return;
    }
    
    // 2. Throttle: Don't fetch more than once every 5s
    const now = Date.now();
    if (now - lastFetchTime.current < 5000) {
      console.log(`[SYNC] Throttled (last fetch was ${(now - lastFetchTime.current)/1000}s ago)`);
      return;
    }

    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[SYNC] ${timestamp} - loadSkus start (silent: ${silent})`);
    
    fetchInProgress.current = true;
    if (!silent) setStatus('loading');
    try {
      const data = await fetchAllSkus() as any;
      lastFetchTime.current = Date.now();
      setSkus(data); 
      setStatus('ready');
      console.log(`[SYNC] ${timestamp} - loadSkus success`);
    } catch (err) {
      console.error(`[SYNC] ${timestamp} - loadSkus failed:`, err);
      if (!silent) {
        setStatus('error', err instanceof Error ? err.message : 'Failed to load products');
      }
    } finally {
      fetchInProgress.current = false;
    }
  }, [setSkus, setStatus]);

  useEffect(() => {
    // Only fetch on first mount if not already loaded
    if (status === 'idle') {
      loadSkus();
    }
  }, [status, loadSkus]);

  // ─── Background Refresh (Tab Visibility Aware) ─────────────────
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (interval) return;
      console.log(`[POLLING] Tab visible, starting 5m interval`);
      interval = setInterval(() => {
        console.log(`[TIMER] Triggering scheduled refresh`);
        loadSkus(true);
      }, BG_REFRESH_INTERVAL);
    };

    const stopPolling = () => {
      if (interval) {
        console.log(`[POLLING] Tab hidden, pausing refresh`);
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startPolling();
      } else {
        stopPolling();
      }
    };

    // Initial check on mount
    if (document.visibilityState === 'visible') {
      startPolling();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadSkus]); // loadSkus is stable from useCallback

  // ─── Speed Mode (keyboard nav) ────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.id === 'global-search') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, products.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
          e.preventDefault();
          const p = products[selectedIndex];
          if (p) {
            addItem({
              skuId: p.id,
              name: p.name,
              unit: p.unit,
              price: p.price,
              qty: p.moq,
              moq: p.moq,
              stepQty: p.stepQty,
            });
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, selectedIndex, addItem]);

  // Reset selection when filters change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [selectedCategoryId, searchQuery, hideOos, selectedBrands]);

  // ─── Cart Submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    if (submitting || !customerName || !warehouseId || items.length === 0) return;
    const tClick = Date.now();
    setSubmitting(true);
    try {
      const res = await fetch('/api/staff/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouseId, customerName, notes, staffId, items: items.map((i) => ({ skuId: i.skuId, qty: i.qty })) }),
      });

      if (res.ok) {
        const { cartId, printPayload, perf } = await res.json();
        const tApiEnd = Date.now();
        
        // Comprehensive operational diagnostics persistence
        try {
          const diagnostics = {
            clickTime: tClick,
            apiDuration: tApiEnd - tClick,
            backendPerf: perf,
            payload: printPayload,
          };
          sessionStorage.setItem(`dispatch_diag_${cartId}`, JSON.stringify(diagnostics));
        } catch (e) {
          console.error('[DIAG_ERROR] Failed to save diagnostics', e);
        }

        // 2. Trigger Silent Thermal Print (Background)
        if (isThermalReady && printPayload) {
          const loadingToast = toast.loading('Sending to thermal printer...');
          try {
            const buffer = renderDispatchSlips(printPayload);
            await qzManager.printRaw(buffer);
            toast.success('Dispatch note sent to printer', { id: loadingToast });
          } catch (err: any) {
            console.error('[PRINT_ERROR] Silent thermal print failed', err);
            toast.error('Thermal print failed. You can reprint from the next page.', { id: loadingToast });
          }
        }

        router.push(`/staff/dashboard/print/${cartId}?debugPerf=${searchParams.get('debugPerf') === 'true'}`);
        setTimeout(() => clearCart(), 100);
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'Failed to submit cart.');
        setSubmitting(false);
      }
    } catch (err) {
      console.error('Submission error:', err);
      alert('An unexpected error occurred. Please check your connection.');
      setSubmitting(false);
    }
  };

  // ─── STARTUP LOADER ───────────────────────────────────────────
  if (status === 'loading' || status === 'idle') {
    return (
      <div className="w-full min-h-[80vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-[#1A2766] flex items-center justify-center shadow-lg">
              <Loader2 size={28} className="text-white animate-spin" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#AE1B1E] border-2 border-white animate-pulse" />
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-[15px] font-[800] text-[#1A2766]">Loading products...</p>
            <p className="text-[12px] font-[600] text-gray-400">Preparing terminal for dispatch</p>
          </div>
          <div className="flex gap-1.5 mt-2">
            <div className="w-2 h-2 rounded-full bg-[#1A2766] animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-[#1A2766] animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-[#1A2766] animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  // ─── ERROR STATE ───────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className="w-full min-h-[80vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
            <AlertTriangle size={28} className="text-[#AE1B1E]" />
          </div>
          <div className="space-y-1">
            <p className="text-[15px] font-[800] text-[#1A2766]">Failed to load products</p>
            <p className="text-[12px] font-[600] text-gray-400">{errorMsg || 'Network error. Check your connection.'}</p>
          </div>
          <button
            onClick={() => loadSkus()}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1A2766] text-white rounded-lg text-[13px] font-[700] hover:bg-[#003347] transition-colors"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ─── MAIN POS LAYOUT ──────────────────────────────────────────
  return (
    <div className="w-full min-h-screen bg-[#F6F7FA] p-4 relative">
      {/* ── DISPATCH PROGRESS OVERLAY ──────────────────────────────── */}
      {submitting && (
        <DispatchProgressOverlay />
      )}

      <div className="max-w-[1920px] mx-auto flex gap-4 items-start">

        {/* ── LEFT: 220px REFINED SIDEBAR ─────────────────────────────── */}
        <aside className="hidden lg:block w-[220px] sticky top-4 flex-shrink-0">
          <div className="bg-white rounded-xl border border-[#E7EAF0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col h-[calc(100vh-32px)]">
            <div className="px-4 py-3.5 border-b border-[#F1F3F7]">
              <h2 className="text-[11px] font-[800] text-[#1A2766] uppercase tracking-[0.1em]">Inventory</h2>
            </div>
            <nav className="p-2 space-y-0.5 overflow-y-auto custom-scrollbar flex-1">
              <button
                onClick={() => setCategory('')}
                className={`w-full flex items-center justify-between px-3 h-[42px] rounded-lg text-[14px] font-[700] transition-all group ${!selectedCategoryId ? 'bg-[#1A2766] text-white shadow-md' : 'text-gray-500 hover:bg-[#F1F6FF] hover:text-[#1A2766]'}`}
              >
                <span>Full Catalog</span>
                <span className={`text-[10px] font-bold ${!selectedCategoryId ? 'text-white/60' : 'text-gray-300'}`}>{dynamicCategories.fullCount}</span>
              </button>
              <div className="h-px bg-[#F1F3F7] my-2 mx-1" />
              {dynamicCategories.visible.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`w-full flex items-center justify-between px-3 h-[42px] rounded-lg text-[14px] font-[700] transition-all ${selectedCategoryId === cat.id ? 'bg-[#1A2766] text-white shadow-md' : 'text-gray-500 hover:bg-[#F1F6FF] hover:text-[#1A2766]'}`}
                >
                  <span className="truncate">{cat.name}</span>
                  <span className={`text-[10px] font-bold ${selectedCategoryId === cat.id ? 'text-white/60' : 'text-gray-300'}`}>{cat.count}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* ── CENTER: INDUSTRIAL TERMINAL (Fluid) ───────────────────────── */}
        <main className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-[#E7EAF0] shadow-sm h-[56px] flex items-center px-4 gap-4 mb-5">
            <div className="flex-shrink-0">
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="bg-[#F9FAFB] border border-[#E7EAF0] rounded-lg px-3 py-1.5 text-[12px] font-[800] text-[#1A2766] outline-none hover:border-[#1A2766]/30 transition-colors cursor-pointer"
              >
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="h-6 w-px bg-[#F1F3F7]" />
            <div className="flex-1 flex items-center gap-4">
               <span className="text-[11px] font-[800] text-gray-400 uppercase tracking-widest">{products.length} SKUs Listed</span>
               <div className="h-4 w-px bg-[#F1F3F7]" />
               <button
                 onClick={() => setHideOos(!hideOos)}
                 className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all ${
                   hideOos 
                     ? 'bg-[#F9FAFB] border-[#E7EAF0] text-gray-500 hover:bg-white hover:border-[#1A2766]/30' 
                     : 'bg-[#1A2766]/5 border-[#1A2766]/20 text-[#1A2766] hover:bg-[#1A2766]/10'
                 }`}
                 title={hideOos ? "Show Out of Stock" : "Hide Out of Stock"}
               >
                 {hideOos ? <EyeOff size={13} /> : <Eye size={13} />}
                 <span className="text-[10px] font-[800] uppercase tracking-wider">
                   {hideOos ? 'Hide OOS' : 'Show OOS'}
                 </span>
               </button>
               <div className="flex items-center gap-1.5 ml-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/40" />
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                   Updated {timeAgo}
                 </span>
               </div>
            </div>
            
            <div className="h-6 w-px bg-[#F1F3F7]" />
            
            {/* ── CASE SIZE FILTER (Conditional) ────────────────────────── */}
            {availableCaseSizes.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowCaseFilter(!showCaseFilter)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                    selectedCaseSizes.length > 0
                      ? 'bg-[#1A2766] border-[#1A2766] text-white shadow-sm'
                      : 'bg-[#F9FAFB] border-[#E7EAF0] text-gray-500 hover:bg-white hover:border-[#1A2766]/30'
                  }`}
                >
                  <span className="text-[10px] font-[800] uppercase tracking-wider">
                    CASE SIZE {selectedCaseSizes.length > 0 && `(${selectedCaseSizes.length})`}
                  </span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${showCaseFilter ? 'rotate-180' : ''}`} />
                </button>

                {showCaseFilter && (
                  <>
                    <div 
                      className="fixed inset-0 z-[100]" 
                      onClick={() => setShowCaseFilter(false)} 
                    />
                    <div className="absolute top-full left-0 mt-1.5 w-40 bg-white border border-[#E7EAF0] rounded-xl shadow-xl z-[101] p-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="max-h-48 overflow-y-auto custom-scrollbar">
                        {availableCaseSizes.map((size) => {
                          const isAvailable = sizesInCategory.has(size);
                          return (
                            <button
                              key={size}
                              disabled={!isAvailable}
                              onClick={() => {
                                const next = selectedCaseSizes.includes(size)
                                  ? selectedCaseSizes.filter(s => s !== size)
                                  : [...selectedCaseSizes, size];
                                setSelectedCaseSizes(next);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors group ${
                                !isAvailable ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#F1F6FF]'
                              }`}
                            >
                              <span className={`text-[12px] font-[700] ${!isAvailable ? 'text-gray-400' : 'text-gray-600 group-hover:text-[#1A2766]'}`}>
                                {size}
                              </span>
                              {selectedCaseSizes.includes(size) && (
                                <Check size={14} className={isAvailable ? 'text-[#1A2766]' : 'text-gray-400'} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {selectedCaseSizes.length > 0 && (
                        <div className="mt-1 pt-1 border-t border-[#F1F3F7]">
                          <button
                            onClick={() => {
                              setSelectedCaseSizes([]);
                              setShowCaseFilter(false);
                            }}
                            className="w-full py-1.5 text-[10px] font-bold text-[#AE1B1E] uppercase tracking-widest hover:bg-red-50 rounded-lg transition-colors"
                          >
                            Clear Filter
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── TOP BRANDS PILLS ROW ────────────────────────────────────── */}
          {currentTopBrands.length > 0 && (
            <div className="flex items-center gap-3 mb-6 overflow-x-auto custom-scrollbar pb-1 no-scrollbar select-none">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 shrink-0">Top Brands</span>
              <div className="flex items-center gap-2">
                {currentTopBrands.map((brand) => (
                  <button
                    key={brand.brandName}
                    onClick={() => toggleBrand(brand.brandName)}
                    className={`h-8 px-4 rounded-full text-[12px] font-[800] transition-all whitespace-nowrap border flex items-center gap-1.5 shadow-sm active:scale-95 transition-all duration-200 ${
                      selectedBrands.includes(brand.brandName)
                        ? 'bg-gradient-to-br from-[#1A2766] to-[#003347] border-[#1A2766] text-white shadow-[#1A2766]/20 shadow-lg scale-[1.02]'
                        : 'bg-white border-[#E7EAF0] text-[#1A2766] hover:border-[#1A2766]/30 hover:bg-[#F9FAFB] hover:shadow-md'
                    }`}
                  >
                    <span>{brand.brandName}</span>
                    <span className={`w-1 h-1 rounded-full ${selectedBrands.includes(brand.brandName) ? 'bg-white/40' : 'bg-[#1A2766]/20'}`} />
                    <span className={`text-[10px] font-black tabular-nums ${selectedBrands.includes(brand.brandName) ? 'text-white/70' : 'text-gray-400'}`}>
                      {brand.activeSkuCount}
                    </span>
                  </button>
                ))}
              </div>
              {selectedBrands.length > 0 && (
                <button
                  onClick={() => useSkuStore.setState({ selectedBrands: [] })}
                  className="h-8 px-4 text-[10px] font-black text-[#AE1B1E] uppercase tracking-widest hover:bg-red-50 rounded-full transition-colors shrink-0 flex items-center"
                >
                  Clear All
                </button>
              )}
            </div>
          )}

          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center opacity-50">
              <p className="text-[14px] font-[700] text-gray-500">No products found</p>
              <p className="text-[12px] text-gray-400 mt-1">
                {searchQuery 
                  ? 'Try a different search term' 
                  : hideOos 
                    ? 'This category is empty or all items are Out of Stock' 
                    : 'This category is empty'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
              {products.map((product, idx) => (
                <div key={product.id} className={selectedIndex === idx ? 'ring-2 ring-[#1A2766] rounded-xl' : ''}>
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          )}
        </main>

        {/* ── RIGHT: 320px REFINED DISPATCH (Sticky) ─────────────────── */}
        <aside className="hidden xl:block w-[320px] sticky top-4 flex-shrink-0">
          <div className="bg-white rounded-xl border border-[#E7EAF0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
            <div className="px-4 py-3.5 border-b border-[#F1F3F7] bg-[#1A2766] flex items-center justify-between">
              <h2 className="text-[11px] font-[800] text-white uppercase tracking-[0.1em]">Dispatch Bin</h2>
              <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded tabular-nums">
                {items.length}
              </span>
            </div>
            
            <div className="flex-1 overflow-hidden">
               <CartPanel />
            </div>

            <div className="p-3.5 border-t border-[#F1F3F7] bg-[#F9FAFB] space-y-2.5">
              {items.length > 0 && (
                <>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Customer Name *"
                      className="w-full bg-white border border-[#E7EAF0] rounded-lg px-3 py-2 text-[14px] font-[700] outline-none focus:ring-2 focus:ring-[#1A2766]/10 focus:border-[#1A2766] transition-all"
                    />
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Dispatch Notes (Optional)"
                      className="w-full bg-white border border-[#E7EAF0] rounded-lg px-3 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-[#1A2766]/10 focus:border-[#1A2766] h-14 resize-none transition-all"
                    />
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !customerName}
                    className="w-full h-11 flex items-center justify-center gap-2 bg-[#1A2766] text-white rounded-lg font-[800] text-[13px] uppercase tracking-widest hover:bg-[#003347] transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
                  >
                    <Printer size={18} strokeWidth={2.5} />
                    {submitting ? 'Processing...' : 'Generate Dispatch Note'}
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}
