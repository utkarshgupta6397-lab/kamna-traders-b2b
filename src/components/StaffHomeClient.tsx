'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo } from 'react';
import ProductCard, { ProductData } from '@/components/ProductCard';
import CartPanel from '@/components/CartPanel';
import { useCartStore } from '@/store/cartStore';
import { useSkuStore } from '@/store/skuStore';
import { Printer, Scan, Loader2, RefreshCw, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Category { id: string; name: string; count: number }
interface Warehouse { id: string; name: string }

interface Props {
  staffId: string;
  warehouses: Warehouse[];
  categories: Category[];
}

/** Fetch all active SKUs from the lightweight API endpoint */
async function fetchAllSkus(): Promise<ProductData[]> {
  const res = await fetch('/api/staff/skus');
  if (!res.ok) throw new Error(`Failed to fetch SKUs: ${res.status}`);
  return res.json();
}

/** Background refresh interval (ms) */
const BG_REFRESH_INTERVAL = 60_000;

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
              className="h-full rounded-full transition-all duration-100 ease-linear"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #1A2766 0%, #3B5BDB 50%, #5C7CFA 100%)',
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
  const [selectedIndex, setSelectedIndex] = useState(-1);

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

  // Filtered products — recomputes when allSkus, category, search, or hideOos changes
  const products = useMemo(() => getFiltered(), [getFiltered, allSkus, selectedCategoryId, searchQuery, hideOos]);

  // ─── Initial Load ──────────────────────────────────────────────
  const loadSkus = useCallback(async (silent = false) => {
    if (!silent) setStatus('loading');
    try {
      const data = await fetchAllSkus();
      setSkus(data);
      setStatus('ready');
    } catch (err) {
      if (!silent) {
        setStatus('error', err instanceof Error ? err.message : 'Failed to load products');
      }
      // On silent (background) failure, keep existing data
    }
  }, [setSkus, setStatus]);

  useEffect(() => {
    // Only fetch on first mount if not already loaded
    if (status === 'idle') {
      loadSkus();
    }
  }, [status, loadSkus]);

  // ─── Background Refresh (every 60s + on tab focus) ─────────────
  useEffect(() => {
    const interval = setInterval(() => loadSkus(true), BG_REFRESH_INTERVAL);

    const onFocus = () => loadSkus(true);
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadSkus]);

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
  }, [selectedCategoryId, searchQuery, hideOos]);

  // ─── Cart Submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!customerName || !warehouseId || items.length === 0) return;
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

        router.push(`/staff/dashboard/print/${cartId}?autoprint=true&debugPerf=${searchParams.get('debugPerf') === 'true'}`);
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
          <div className="bg-white rounded-xl border border-[#E7EAF0] shadow-sm h-[56px] flex items-center px-4 gap-4 mb-4">
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
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F9FAFB] border border-[#E7EAF0] rounded-lg group">
              <Scan size={14} className="text-gray-400 group-hover:text-[#1A2766]" />
              <span className="text-[10px] font-[800] text-gray-500 uppercase">Scanner Live</span>
            </div>
          </div>

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

        {/* ── RIGHT: 320px REFINED DISPATCH ───────────────────────────── */}
        <aside className="hidden xl:block w-[320px] sticky top-4 flex-shrink-0">
          <div className="bg-white rounded-xl border border-[#E7EAF0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col h-[calc(100vh-32px)]">
            <div className="px-4 py-3.5 border-b border-[#F1F3F7] bg-[#1A2766] flex items-center justify-between">
              <h2 className="text-[11px] font-[800] text-white uppercase tracking-[0.1em]">Dispatch Bin</h2>
            </div>
            
            <div className="flex-1 overflow-hidden">
               <CartPanel />
            </div>

            <div className="p-4 border-t border-[#F1F3F7] bg-[#F9FAFB] space-y-3">
              {items.length > 0 && (
                <>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Customer Name *"
                      className="w-full bg-white border border-[#E7EAF0] rounded-lg px-3 py-2.5 text-[14px] font-[700] outline-none focus:ring-2 focus:ring-[#1A2766]/10 focus:border-[#1A2766] transition-all"
                    />
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Dispatch Notes (Optional)"
                      className="w-full bg-white border border-[#E7EAF0] rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#1A2766]/10 focus:border-[#1A2766] h-16 resize-none transition-all"
                    />
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !customerName}
                    className="w-full h-12 flex items-center justify-center gap-2 bg-[#1A2766] text-white rounded-lg font-[800] text-[13px] uppercase tracking-widest hover:bg-[#003347] transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
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
