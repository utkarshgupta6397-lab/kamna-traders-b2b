'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTransition, useState } from 'react';
import ProductCard, { ProductData } from '@/components/ProductCard';
import { useCartStore } from '@/store/cartStore';
import { Minus, Plus, Trash2, Printer } from 'lucide-react';

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
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const { items, updateQty, removeItem, clearCart } = useCartStore();
  const totalQty = items.reduce((a, i) => a + i.qty, 0);

  const navigate = (params: Record<string, string>) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); });
    const qs = sp.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

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
    <div className="flex gap-3 h-full">

      {/* ── Left: Category Sidebar ────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-44 flex-shrink-0">
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden sticky top-16">
          <div className="px-3 py-2.5 bg-[#1A2766]">
            <p className="text-xs font-bold text-white uppercase tracking-wider">Categories</p>
          </div>
          <nav className="overflow-y-auto max-h-[calc(100vh-7rem)]">
            <button
              onClick={() => navigate({ q: searchQuery })}
              className={`w-full text-left px-3 py-2 text-xs font-medium border-b border-gray-50 ${!selectedCategoryId ? 'bg-[#AE1B1E]/10 text-[#AE1B1E] font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              All Products
              <span className="float-right text-[10px] text-gray-400">{totalSkuCount}</span>
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => navigate({ category: cat.id, q: searchQuery })}
                className={`w-full text-left px-3 py-2 text-xs font-medium border-b border-gray-50 ${selectedCategoryId === cat.id ? 'bg-[#AE1B1E]/10 text-[#AE1B1E] font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {cat.name}
                <span className="float-right text-[10px] text-gray-400">{cat.count}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* ── Center: Products ──────────────────────────────────────────── */}
      <main className="flex-1 min-w-0">
        {/* Mobile categories */}
        <div className="lg:hidden flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
          <button onClick={() => navigate({ q: searchQuery })} className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium ${!selectedCategoryId ? 'bg-[#1A2766] text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>All</button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => navigate({ category: cat.id, q: searchQuery })} className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap ${selectedCategoryId === cat.id ? 'bg-[#1A2766] text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{cat.name}</button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-400">{products.length} products{isPending && ' · Loading…'}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {products.map(p => <ProductCard key={p.id} product={p} />)}
          {products.length === 0 && (
            <div className="col-span-full bg-white rounded-xl border border-gray-100 py-10 text-center">
              <p className="text-gray-400 text-sm">No products found.</p>
              <button onClick={() => navigate({})} className="mt-2 text-xs text-[#AE1B1E] hover:underline">Clear filters</button>
            </div>
          )}
        </div>
      </main>

      {/* ── Right: Staff Cart & Checkout ──────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0">
        <div className="bg-white rounded-xl border border-gray-100 sticky top-16 flex flex-col" style={{ maxHeight: 'calc(100vh - 5rem)' }}>
          <div className="px-3 py-2.5 bg-[#1A2766] rounded-t-xl flex items-center justify-between">
            <p className="text-xs font-bold text-white uppercase tracking-wider">Dispatch Cart</p>
            {totalQty > 0 && <span className="bg-[#AE1B1E] text-white text-[10px] font-black px-2 py-0.5 rounded-full">{totalQty}</span>}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {items.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-6">Add products from the catalog</p>
            ) : items.map(item => (
              <div key={item.skuId} className="flex items-center gap-2 py-1.5 border-b border-gray-100">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
                  <p className="text-[10px] text-gray-400 font-mono">{item.skuId}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(item.skuId, item.qty - (item.stepQty || item.moq))} className="w-5 h-5 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100">
                    <Minus size={10} />
                  </button>
                  <span className="w-7 text-center text-xs font-bold text-gray-800">{item.qty}</span>
                  <button onClick={() => updateQty(item.skuId, item.qty + (item.stepQty || item.moq))} className="w-5 h-5 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100">
                    <Plus size={10} />
                  </button>
                </div>
                <button onClick={() => removeItem(item.skuId)} className="text-gray-300 hover:text-red-400">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-gray-100 space-y-2">
            {items.length > 0 && (
              <>
                <select
                  value={warehouseId}
                  onChange={e => setWarehouseId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:ring-2 focus:ring-[#1A2766] outline-none"
                >
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Customer Name *"
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-[#1A2766] outline-none"
                />
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-[#1A2766] outline-none"
                />
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !customerName || !warehouseId}
                  className="w-full flex items-center justify-center gap-2 bg-[#1A2766] text-white py-2 rounded-xl font-bold text-xs hover:bg-[#003347] disabled:opacity-50 transition-colors"
                >
                  <Printer size={14} />
                  {submitting ? 'Processing…' : 'Generate & Print Slips'}
                </button>
                <button onClick={clearCart} className="w-full text-[10px] text-gray-400 hover:text-red-400">Clear cart</button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile: floating CTA */}
      {totalQty > 0 && (
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40">
          <button onClick={() => setCheckoutOpen(true)} className="w-full flex items-center justify-between bg-[#1A2766] text-white rounded-2xl px-5 py-3.5 shadow-xl">
            <span className="font-bold text-sm">{totalQty} items in cart</span>
            <span className="text-sm font-bold">Checkout →</span>
          </button>
        </div>
      )}

      {/* Mobile checkout drawer */}
      {checkoutOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCheckoutOpen(false)} />
          <div className="relative bg-white rounded-t-2xl p-5 space-y-3 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-900">Dispatch Cart</h3>
              <button onClick={() => setCheckoutOpen(false)} className="text-gray-400 text-sm">Close</button>
            </div>
            {items.map(item => (
              <div key={item.skuId} className="flex justify-between items-center text-sm border-b border-gray-100 pb-2">
                <div className="flex-1"><p className="font-medium">{item.name}</p><p className="text-xs text-gray-400">{item.skuId}</p></div>
                <span className="font-bold text-[#1A2766]">×{item.qty}</span>
              </div>
            ))}
            <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm bg-white">
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer Name *" className="w-full border rounded-lg p-2.5 text-sm" />
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" className="w-full border rounded-lg p-2.5 text-sm" />
            <button onClick={handleSubmit} disabled={submitting || !customerName} className="w-full flex items-center justify-center gap-2 bg-[#1A2766] text-white py-3 rounded-xl font-bold disabled:opacity-50">
              <Printer size={16} /> {submitting ? 'Processing…' : 'Print Slips'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
