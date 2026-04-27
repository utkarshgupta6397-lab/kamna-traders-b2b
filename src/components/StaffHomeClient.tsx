'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo } from 'react';
import ProductCard, { ProductData } from '@/components/ProductCard';
import CartPanel from '@/components/CartPanel';
import { useCartStore } from '@/store/cartStore';
import { useSkuStore } from '@/store/skuStore';
import { Printer, Scan, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
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

export default function StaffHomeClient({ staffId, warehouses, categories }: Props) {
  const router = useRouter();

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

  // Cart
  const { items, addItem, clearCart } = useCartStore();
  const totalQty = items.reduce((a, i) => a + i.qty, 0);

  // Filtered products — recomputes when allSkus, category, or search changes
  const products = useMemo(() => getFiltered(), [getFiltered, allSkus, selectedCategoryId, searchQuery]);

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
          if (p && !p.isOos) {
            addItem({
              skuId: p.id,
              name: p.name,
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
  }, [selectedCategoryId, searchQuery]);

  // ─── Cart Submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!customerName || !warehouseId || items.length === 0) return;
    setSubmitting(true);
    const res = await fetch('/api/staff/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warehouseId, customerName, notes, staffId, items: items.map((i) => ({ skuId: i.skuId, qty: i.qty })) }),
    });
    if (res.ok) {
      const { cartId } = await res.json();
      clearCart();
      router.push(`/staff/dashboard/print/${cartId}`);
    } else {
      alert('Failed to submit cart.');
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
    <div className="w-full min-h-screen bg-[#F6F7FA] p-4">
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
              </button>
              <div className="h-px bg-[#F1F3F7] my-2 mx-1" />
              {categories.map((cat) => (
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
                {searchQuery ? 'Try a different search term' : 'This category is empty'}
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
              {totalQty > 0 && <span className="bg-[#AE1B1E] text-white text-[10px] font-black px-2 py-0.5 rounded shadow-sm">{totalQty}</span>}
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
