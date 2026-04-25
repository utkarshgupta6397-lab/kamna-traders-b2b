'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTransition, useState } from 'react';
import ProductCard, { ProductData } from '@/components/ProductCard';
import CartPanel from '@/components/CartPanel';
import { useCartStore } from '@/store/cartStore';
import { X, Search, Filter } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Category { id: string; name: string; count: number }

interface Props {
  categories: Category[];
  products: ProductData[];
  selectedCategoryId: string;
  searchQuery: string;
  totalSkuCount: number;
}

export default function HomePageClient({ categories, products, selectedCategoryId, searchQuery, totalSkuCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [cartOpen, setCartOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const items = useCartStore(s => s.items);
  const totalItems = items.reduce((a, i) => a + i.qty, 0);

  const navigate = (params: Record<string, string>) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); });
    const qs = sp.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  return (
    <div className="w-full min-h-screen bg-[#F3F4F6] p-4">
      {/* POS CONTAINER: 3-Column Fixed Grid */}
      <div className="max-w-[1920px] mx-auto grid grid-cols-[240px_1fr_340px] gap-4 items-start">

        {/* ── COLUMN 1: CATEGORIES (240px Fixed) ─────────────────────────── */}
        <aside className="sticky top-4 h-[calc(100vh-32px)] flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-[#1A2766] flex-shrink-0">
            <h2 className="text-[12px] font-black text-white uppercase tracking-widest">POS Categories</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            <button
              onClick={() => navigate({ q: searchQuery })}
              className={`w-full flex items-center justify-between px-3 h-10 rounded-md text-[14px] font-bold transition-all ${!selectedCategoryId ? 'bg-[#AE1B1E] text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <span>All Inventory</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${!selectedCategoryId ? 'bg-white/20' : 'bg-gray-100'}`}>{totalSkuCount}</span>
            </button>
            <div className="h-px bg-gray-100 my-2" />
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => navigate({ category: cat.id, q: searchQuery })}
                className={`w-full flex items-center justify-between px-3 h-10 rounded-md text-[14px] font-bold transition-all ${selectedCategoryId === cat.id ? 'bg-[#1A2766] text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <span className="truncate">{cat.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${selectedCategoryId === cat.id ? 'bg-white/20' : 'bg-gray-100'}`}>{cat.count}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* ── COLUMN 2: PRODUCTS (Fluid Center) ───────────────────────────── */}
        <main className="min-w-0">
          {/* POS Toolbar */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-4 h-[48px] flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-black text-gray-400 uppercase tracking-tight">
                {products.length} SKUs Listed
              </span>
              {selectedCategoryId && (
                <div className="flex items-center gap-2 bg-gray-100 px-2 py-1 rounded text-[12px] font-bold text-[#1A2766]">
                  {categories.find(c => c.id === selectedCategoryId)?.name}
                  <X size={14} className="cursor-pointer hover:text-red-500" onClick={() => navigate({ q: searchQuery })} />
                </div>
              )}
            </div>
            {isPending && <span className="text-[11px] font-black text-[#AE1B1E] animate-pulse">TERMINAL SYNCING...</span>}
          </div>

          {/* Product Terminal List */}
          <div className="space-y-2">
            {products.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 py-20 text-center">
                <p className="text-gray-400 font-bold">No items found in POS database</p>
                <button onClick={() => navigate({})} className="mt-4 text-[12px] font-black text-[#AE1B1E] uppercase border-b-2 border-[#AE1B1E]">Clear Search Terminal</button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {products.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </main>

        {/* ── COLUMN 3: TERMINAL CART (340px Fixed) ──────────────────────── */}
        <aside className="sticky top-4 h-[calc(100vh-32px)] flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-[#1A2766] flex-shrink-0 flex items-center justify-between">
            <h2 className="text-[12px] font-black text-white uppercase tracking-widest">Inquiry Terminal</h2>
            {totalItems > 0 && (
              <span className="bg-[#AE1B1E] text-white text-[10px] font-black px-2 py-0.5 rounded">{totalItems}</span>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <CartPanel />
          </div>
        </aside>

      </div>

      {/* Mobile support remains for fallback, but layout is optimized for Desktop POS */}
      {totalItems > 0 && (
        <div className="md:hidden fixed bottom-3 left-3 right-3 z-40">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full h-[54px] flex items-center justify-between bg-[#1A2766] text-white rounded-full px-5 shadow-2xl"
          >
            <div className="flex items-center gap-2">
              <span className="bg-white/20 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black">{totalItems}</span>
              <span className="font-bold text-sm">View Terminal</span>
            </div>
            <span className="text-[15px] font-black">{formatCurrency(items.reduce((a, i) => a + (i.qty * i.price), 0))}</span>
          </button>
        </div>
      )}

      {cartOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white rounded-t-2xl p-4 max-h-[92vh] h-[92vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-gray-900 text-sm uppercase tracking-widest">Terminal Inquiry</h3>
              <button onClick={() => setCartOpen(false)} className="text-gray-400 bg-gray-100 p-2 rounded-full"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-hidden">
              <CartPanel />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
