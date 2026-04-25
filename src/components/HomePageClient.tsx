'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTransition, useState } from 'react';
import ProductCard, { ProductData } from '@/components/ProductCard';
import CartPanel from '@/components/CartPanel';
import { useCartStore } from '@/store/cartStore';
import { X, Search } from 'lucide-react';
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
    <div className="w-full min-h-screen bg-[#F8F9FB] px-4 py-6">
      {/* 3-COLUMN PREMIUM LAYOUT */}
      <div className="max-w-[1600px] mx-auto flex gap-6 items-start">

        {/* ── LEFT: STICKY CATEGORIES (240px) ─────────────────────────── */}
        <aside className="hidden lg:block w-[240px] sticky top-6 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-[#1A2766]">
              <h2 className="text-[12px] font-black text-white uppercase tracking-[0.1em]">Categories</h2>
            </div>
            <nav className="p-2 space-y-1 max-h-[calc(100vh-12rem)] overflow-y-auto custom-scrollbar">
              <button
                onClick={() => navigate({ q: searchQuery })}
                className={`w-full flex items-center justify-between px-4 h-11 rounded-xl text-[14px] font-bold transition-all ${!selectedCategoryId ? 'bg-red-50 text-[#AE1B1E]' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <span>All Products</span>
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

        {/* ── CENTER: RESPONSIVE PRODUCT GRID ───────────────────────────── */}
        <main className="flex-1 min-w-0">
          {/* Status Toolbar */}
          <div className="flex items-center justify-between mb-6 px-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-black text-gray-900 tracking-tight">
                {selectedCategoryId ? categories.find(c => c.id === selectedCategoryId)?.name : 'Storefront'}
              </h1>
              <span className="text-[13px] font-bold text-gray-400">({products.length} Items)</span>
            </div>
            {isPending && <div className="h-2 w-24 bg-gray-100 rounded-full animate-pulse" />}
          </div>

          {/* Grid Layout Implementation */}
          {products.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center shadow-sm">
              <p className="text-gray-400 font-bold">No products found for this filter.</p>
              <button onClick={() => navigate({})} className="mt-4 text-[13px] font-black text-[#AE1B1E] uppercase hover:underline">Reset Storefront</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {products.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </main>

        {/* ── RIGHT: STICKY INQUIRY PANEL (340px) ──────────────────────── */}
        <aside className="hidden xl:block w-[340px] sticky top-6 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 3rem)' }}>
            <div className="px-5 py-4 bg-[#1A2766] flex items-center justify-between">
              <h2 className="text-[12px] font-black text-white uppercase tracking-[0.1em]">Your Inquiry</h2>
              {totalItems > 0 && (
                <span className="bg-[#AE1B1E] text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm">{totalItems}</span>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <CartPanel />
            </div>
          </div>
        </aside>

      </div>

      {/* Mobile Cart Floating View */}
      {totalItems > 0 && (
        <div className="lg:hidden fixed bottom-6 left-4 right-4 z-40">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full h-14 flex items-center justify-between bg-[#1A2766] text-white rounded-2xl px-6 shadow-xl active:scale-95 transition-transform"
          >
            <div className="flex items-center gap-3">
              <span className="bg-white/20 px-2 py-0.5 rounded text-[11px] font-black">{totalItems} ITEMS</span>
              <span className="font-bold text-[15px]">View Inquiry</span>
            </div>
            <span className="text-[16px] font-black">{formatCurrency(items.reduce((a, i) => a + (i.qty * i.price), 0))}</span>
          </button>
        </div>
      )}

      {/* Mobile Sidebar / Cart Drawers logic would go here if needed, but keeping core structure clean */}
      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white rounded-t-[32px] p-6 max-h-[92vh] h-[92vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-gray-900 text-lg uppercase tracking-tight">Your Inquiry</h3>
              <button onClick={() => setCartOpen(false)} className="text-gray-400 bg-gray-100 p-2 rounded-full"><X size={20} /></button>
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
