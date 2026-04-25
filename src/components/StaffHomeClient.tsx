'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTransition, useState, useEffect } from 'react';
import ProductCard, { ProductData } from '@/components/ProductCard';
import CartPanel from '@/components/CartPanel';
import { useCartStore } from '@/store/cartStore';
import { Printer, Scan, ShoppingBag } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Category { id: string; name: string; count: number }
interface Warehouse { id: string; name: string }

interface Props {
  staffId: string;
  warehouses: Warehouse[];
  categories: Category[];
  products: ProductData[];
  selectedCategoryId: string;
  searchQuery: string;
  totalSkuCount: number;
}

export default function StaffHomeClient({ staffId, warehouses, categories, products, selectedCategoryId, searchQuery, totalSkuCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const { items, addItem, clearCart } = useCartStore();
  const totalQty = items.reduce((a, i) => a + i.qty, 0);

  const navigate = (params: Record<string, string>) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); });
    const qs = sp.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  // Speed Mode Logic
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.id === 'global-search') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, products.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
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

  const handleSubmit = async () => {
    if (!customerName || !warehouseId || items.length === 0) return;
    setSubmitting(true);
    const res = await fetch('/api/staff/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warehouseId, customerName, notes, staffId, items: items.map(i => ({ skuId: i.skuId, qty: i.qty })) }),
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
                onClick={() => navigate({ q: searchQuery })}
                className={`w-full flex items-center justify-between px-3 h-[42px] rounded-lg text-[14px] font-[700] transition-all group ${!selectedCategoryId ? 'bg-[#1A2766] text-white shadow-md' : 'text-gray-500 hover:bg-[#F1F6FF] hover:text-[#1A2766]'}`}
              >
                <span>Full Catalog</span>
              </button>
              <div className="h-px bg-[#F1F3F7] my-2 mx-1" />
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => navigate({ category: cat.id, q: searchQuery })}
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
                onChange={e => setWarehouseId(e.target.value)}
                className="bg-[#F9FAFB] border border-[#E7EAF0] rounded-lg px-3 py-1.5 text-[12px] font-[800] text-[#1A2766] outline-none hover:border-[#1A2766]/30 transition-colors cursor-pointer"
              >
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="h-6 w-px bg-[#F1F3F7]" />
            <div className="flex-1 flex items-center gap-4">
               <span className="text-[11px] font-[800] text-gray-400 uppercase tracking-widest">{products.length} SKUs Listed</span>
               {isPending && <div className="w-4 h-4 border-2 border-[#1A2766] border-t-transparent rounded-full animate-spin" />}
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F9FAFB] border border-[#E7EAF0] rounded-lg group">
              <Scan size={14} className="text-gray-400 group-hover:text-[#1A2766]" />
              <span className="text-[10px] font-[800] text-gray-500 uppercase">Scanner Live</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {products.map((product, idx) => (
              <div key={product.id} className={selectedIndex === idx ? 'ring-2 ring-[#1A2766] rounded-xl' : ''}>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
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
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="Customer Name *"
                      className="w-full bg-white border border-[#E7EAF0] rounded-lg px-3 py-2.5 text-[14px] font-[700] outline-none focus:ring-2 focus:ring-[#1A2766]/10 focus:border-[#1A2766] transition-all"
                    />
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
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
