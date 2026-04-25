'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTransition, useState, useEffect, useRef } from 'react';
import ProductCard, { ProductData } from '@/components/ProductCard';
import { useCartStore } from '@/store/cartStore';
import { Minus, Plus, Trash2, Printer, ShoppingBag, Truck, User, Scan } from 'lucide-react';
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
  
  // Speed Mode State
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const { items, addItem, updateQty, removeItem, clearCart } = useCartStore();
  const totalQty = items.reduce((a, i) => a + i.qty, 0);

  const navigate = (params: Record<string, string>) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); });
    const qs = sp.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  // Keyboard Navigation for Speed Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' && (document.activeElement as HTMLInputElement).placeholder.includes('Search')) {
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
            // Auto-refocus search is handled by global layout after a slight delay
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
    <div className="w-full min-h-screen bg-[#F8F9FB] px-4 py-6">
      {/* POS CONTAINER: 3-COLUMN INDUSTRIAL GRID */}
      <div className="max-w-[1680px] mx-auto flex gap-6 items-start">

        {/* ── COLUMN 1: CATEGORIES (240px) ───────────────────────────── */}
        <aside className="hidden lg:block w-[240px] sticky top-6 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-[#1A2766] flex items-center justify-between">
              <p className="text-[11px] font-black text-white uppercase tracking-widest">Inventory</p>
              <Truck size={14} className="text-white/40" />
            </div>
            <nav className="p-2 space-y-1 max-h-[calc(100vh-14rem)] overflow-y-auto custom-scrollbar">
              <button
                onClick={() => navigate({ q: searchQuery })}
                className={`w-full flex items-center justify-between px-4 h-11 rounded-xl text-[14px] font-bold transition-all ${!selectedCategoryId ? 'bg-red-50 text-[#AE1B1E]' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                All Systems
                <span className="text-[10px] font-bold opacity-60 bg-gray-100 px-2 py-0.5 rounded-full">{totalSkuCount}</span>
              </button>
              <div className="h-px bg-gray-50 my-2 mx-2" />
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => navigate({ category: cat.id, q: searchQuery })}
                  className={`w-full flex items-center justify-between px-4 h-11 rounded-xl text-[14px] font-bold transition-all ${selectedCategoryId === cat.id ? 'bg-red-50 text-[#AE1B1E]' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <span className="truncate">{cat.name}</span>
                  <span className="text-[10px] font-bold opacity-60 bg-gray-100 px-2 py-0.5 rounded-full">{cat.count}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* ── COLUMN 2: INDUSTRIAL GRID (Fluid) ───────────────────────── */}
        <main className="flex-1 min-w-0">
          {/* POS Staff Toolbar (FIXED: 64px, Single Search Logic) */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-16 flex items-center px-5 gap-6 mb-6">
            <div className="flex flex-col flex-shrink-0">
              <span className="text-[9px] font-black text-gray-300 uppercase mb-0.5 tracking-tighter">Warehouse</span>
              <select
                value={warehouseId}
                onChange={e => setWarehouseId(e.target.value)}
                className="bg-transparent border-0 p-0 text-[14px] font-black text-[#1A2766] outline-none cursor-pointer"
              >
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            
            <div className="h-8 w-px bg-gray-100" />
            
            <div className="flex-1 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-black text-gray-900 uppercase">
                  {selectedCategoryId ? categories.find(c => c.id === selectedCategoryId)?.name : 'Full Catalog'}
                </span>
                <span className="text-[12px] font-bold text-gray-300">({products.length} SKUs)</span>
              </div>
              
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group">
                  <Scan size={16} className="text-gray-400 group-hover:text-[#1A2766]" />
                  <span className="text-[11px] font-black text-gray-500 uppercase">Scanner</span>
                </button>
                {isPending && <span className="text-[10px] font-black text-[#AE1B1E] animate-pulse uppercase">Syncing...</span>}
              </div>
            </div>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {products.map((p, idx) => (
              <div key={p.id} className={selectedIndex === idx ? 'ring-2 ring-[#AE1B1E] rounded-[16px] overflow-hidden' : ''}>
                <ProductCard product={p} />
              </div>
            ))}
            {products.length === 0 && (
              <div className="col-span-full bg-white rounded-2xl border border-gray-100 py-24 text-center shadow-sm">
                <p className="text-gray-400 font-bold">No SKUs matched your scan/search.</p>
              </div>
            )}
          </div>
        </main>

        {/* ── COLUMN 3: DISPATCH TERMINAL (340px) ─────────────────────── */}
        <aside className="hidden xl:block w-[340px] sticky top-6 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 3rem)' }}>
            <div className="px-5 py-4 bg-[#1A2766] flex items-center justify-between">
              <p className="text-[12px] font-black text-white uppercase tracking-widest">Dispatch Bin</p>
              {totalQty > 0 && <span className="bg-[#AE1B1E] text-white text-[10px] font-black px-2.5 py-1 rounded-full">{totalQty}</span>}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                    <ShoppingBag size={28} className="text-gray-100" />
                  </div>
                  <p className="text-[12px] font-black text-gray-200 uppercase tracking-widest">Ready for Scan</p>
                </div>
              ) : items.map(item => (
                <div key={item.skuId} className="flex items-center gap-3 p-2.5 bg-gray-50/50 rounded-xl border border-gray-50 group hover:bg-gray-50 transition-all">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-gray-800 truncate leading-tight">{item.name}</p>
                    <p className="text-[10px] text-gray-400 font-mono font-bold uppercase tracking-tighter">{item.skuId}</p>
                  </div>
                  <div className="flex items-center bg-white border border-gray-100 rounded-lg p-0.5 h-8">
                    <button onClick={() => updateQty(item.skuId, item.qty - (item.stepQty || item.moq))} className="w-7 h-full flex items-center justify-center text-gray-400 hover:text-red-600">
                      <Minus size={12} strokeWidth={3} />
                    </button>
                    <span className="w-8 text-center text-[13px] font-black text-[#1A2766]">{item.qty}</span>
                    <button onClick={() => updateQty(item.skuId, item.qty + (item.stepQty || item.moq))} className="w-7 h-full flex items-center justify-center text-[#1A2766] hover:bg-blue-50">
                      <Plus size={12} strokeWidth={3} />
                    </button>
                  </div>
                  <button onClick={() => removeItem(item.skuId)} className="text-gray-200 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Industrial Dispatch Checkout */}
            <div className="p-5 border-t border-gray-100 bg-gray-50/30 space-y-4">
              {items.length > 0 && (
                <>
                  <div className="space-y-3">
                    <div className="relative">
                      <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                      <input
                        type="text"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        placeholder="Customer Name *"
                        className="w-full bg-white border border-gray-100 rounded-xl pl-9 pr-4 py-2.5 text-[14px] font-bold outline-none focus:ring-4 focus:ring-[#1A2766]/5 transition-all"
                      />
                    </div>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Dispatch Instructions / Notes"
                      className="w-full bg-white border border-gray-100 rounded-xl px-4 py-2.5 text-[14px] outline-none focus:ring-4 focus:ring-[#1A2766]/5 resize-none h-20 transition-all"
                    />
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !customerName}
                    className="w-full h-14 flex items-center justify-center gap-3 bg-[#1A2766] text-white rounded-2xl font-black text-[14px] uppercase tracking-widest hover:bg-[#003347] transition-all disabled:opacity-50 shadow-xl active:scale-95"
                  >
                    <Printer size={20} strokeWidth={3} />
                    {submitting ? 'Printing...' : 'Generate Dispatch Note'}
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
