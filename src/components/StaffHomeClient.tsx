'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTransition, useState } from 'react';
import ProductCard, { ProductData } from '@/components/ProductCard';
import { useCartStore } from '@/store/cartStore';
import { Minus, Plus, Trash2, Printer, Search, X, ShoppingBag } from 'lucide-react';
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
  const [localSearch, setLocalSearch] = useState(searchQuery);

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
    <div className="w-full min-h-screen bg-[#F3F4F6] p-4">
      {/* POS CONTAINER */}
      <div className="max-w-[1920px] mx-auto grid grid-cols-[240px_1fr_340px] gap-4 items-start">

        {/* ── COLUMN 1: CATEGORIES ────────────────────────────────────── */}
        <aside className="sticky top-4 h-[calc(100vh-32px)] flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-[#1A2766]">
            <p className="text-[12px] font-black text-white uppercase tracking-widest">POS Categories</p>
          </div>
          <nav className="overflow-y-auto p-2 space-y-1">
            <button
              onClick={() => navigate({ q: searchQuery })}
              className={`w-full flex items-center justify-between px-3 h-10 rounded-md text-[14px] font-bold transition-all ${!selectedCategoryId ? 'bg-[#AE1B1E] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              All SKUs
              <span className="text-[10px] font-bold opacity-70">{totalSkuCount}</span>
            </button>
            <div className="h-px bg-gray-100 my-2" />
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => navigate({ category: cat.id, q: searchQuery })}
                className={`w-full flex items-center justify-between px-3 h-10 rounded-md text-[14px] font-bold transition-all ${selectedCategoryId === cat.id ? 'bg-[#1A2766] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <span className="truncate">{cat.name}</span>
                <span className="text-[10px] font-bold opacity-70">{cat.count}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* ── COLUMN 2: PRODUCTS ────────────────────────────────────────── */}
        <main className="min-w-0">
          {/* POS Staff Toolbar */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-4 h-[48px] flex items-center justify-between mb-3">
            <div className="flex items-center gap-4 flex-1">
              <select
                value={warehouseId}
                onChange={e => setWarehouseId(e.target.value)}
                className="bg-gray-50 border-0 rounded px-3 py-1.5 text-[13px] font-black text-[#1A2766] outline-none"
              >
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <div className="h-4 w-px bg-gray-200" />
              <p className="text-[12px] font-black text-gray-400 uppercase">{products.length} Products Found</p>
            </div>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                navigate({ q: localSearch, category: selectedCategoryId });
              }} 
              className="relative w-64"
            >
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={localSearch}
                onChange={e => setLocalSearch(e.target.value)}
                placeholder="Rapid SKU search..."
                className="w-full pl-9 pr-4 py-1.5 bg-gray-50 border-0 rounded-md text-[13px] outline-none focus:ring-1 focus:ring-[#1A2766]"
              />
            </form>
          </div>

          <div className="flex flex-col gap-2">
            {products.map(p => <ProductCard key={p.id} product={p} />)}
            {products.length === 0 && (
              <div className="bg-white rounded-lg border border-gray-200 py-20 text-center">
                <p className="text-gray-400 font-bold">Terminal empty. Refine search.</p>
              </div>
            )}
          </div>
        </main>

        {/* ── COLUMN 3: STAFF DISPATCH CART ───────────────────────────── */}
        <aside className="sticky top-4 h-[calc(100vh-32px)] flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-[#1A2766] flex items-center justify-between">
            <p className="text-[12px] font-black text-white uppercase tracking-widest">Dispatch Cart</p>
            {totalQty > 0 && <span className="bg-[#AE1B1E] text-white text-[10px] font-black px-2 py-0.5 rounded">{totalQty}</span>}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ShoppingBag size={24} className="text-gray-200 mb-2" />
                <p className="text-[12px] font-black text-gray-400 uppercase tracking-widest">Empty Bin</p>
              </div>
            ) : items.map(item => (
              <div key={item.skuId} className="flex items-center gap-2 h-[42px] px-2 bg-gray-50 rounded border border-gray-100 group">
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-gray-800 truncate leading-tight">{item.name}</p>
                  <p className="text-[9px] text-gray-400 font-mono font-bold uppercase">{item.skuId}</p>
                </div>
                <div className="flex items-center bg-white border border-gray-200 rounded px-0.5 h-[28px]">
                  <button onClick={() => updateQty(item.skuId, item.qty - (item.stepQty || item.moq))} className="w-6 h-full flex items-center justify-center text-gray-400 hover:text-red-600 transition-colors">
                    <Minus size={10} strokeWidth={4} />
                  </button>
                  <span className="w-8 text-center text-[12px] font-black text-[#1A2766]">{item.qty}</span>
                  <button onClick={() => updateQty(item.skuId, item.qty + (item.stepQty || item.moq))} className="w-6 h-full flex items-center justify-center text-[#1A2766] hover:bg-blue-50 transition-colors">
                    <Plus size={10} strokeWidth={4} />
                  </button>
                </div>
                <button onClick={() => removeItem(item.skuId)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* POS Staff Checkout Footer */}
          <div className="p-4 border-t border-gray-200 bg-gray-50/50 space-y-3">
            {items.length > 0 && (
              <>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Customer Name *"
                    className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-[#1A2766]"
                  />
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Dispatch Notes"
                    className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-[#1A2766]"
                  />
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !customerName}
                  className="w-full h-[48px] flex items-center justify-center gap-2 bg-[#1A2766] text-white rounded-md font-black text-[14px] uppercase tracking-widest hover:bg-[#003347] transition-all disabled:opacity-50 shadow-md active:scale-[0.98]"
                >
                  <Printer size={18} strokeWidth={3} />
                  {submitting ? 'Printing...' : 'Generate & Print'}
                </button>
                <button onClick={clearCart} className="w-full text-[10px] text-gray-400 hover:text-red-500 font-black uppercase tracking-[0.2em]">Reset Bin</button>
              </>
            )}
          </div>
        </aside>

      </div>
    </div>
  );
}
