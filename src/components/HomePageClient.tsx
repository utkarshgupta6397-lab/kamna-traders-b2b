'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTransition, useState } from 'react';
import ProductCard, { ProductData } from '@/components/ProductCard';
import CartPanel from '@/components/CartPanel';
import { useCartStore } from '@/store/cartStore';
import { ShoppingCart, X } from 'lucide-react';

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
  const items = useCartStore(s => s.items);
  const totalItems = items.reduce((a, i) => a + i.qty, 0);

  const navigate = (params: Record<string, string>) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); });
    const qs = sp.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-3 py-3 flex gap-3 relative">

      {/* ── Left: Category sidebar ───────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-44 flex-shrink-0">
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden sticky top-16">
          <div className="px-3 py-2.5 bg-[#1A2766]">
            <p className="text-xs font-bold text-white uppercase tracking-wider">Categories</p>
          </div>
          <nav className="overflow-y-auto max-h-[calc(100vh-7rem)]">
            <button
              onClick={() => navigate({ q: searchQuery })}
              className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors border-b border-gray-50 ${!selectedCategoryId ? 'bg-[#AE1B1E]/10 text-[#AE1B1E] font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              All Products
              <span className="float-right text-[10px] text-gray-400">{totalSkuCount}</span>
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => navigate({ category: cat.id, q: searchQuery })}
                className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors border-b border-gray-50 ${selectedCategoryId === cat.id ? 'bg-[#AE1B1E]/10 text-[#AE1B1E] font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {cat.name}
                <span className="float-right text-[10px] text-gray-400">{cat.count}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* ── Center: Product grid ─────────────────────────────────────────── */}
      <main className="flex-1 min-w-0">
        {/* Mobile category chips */}
        <div className="lg:hidden flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
          <button
            onClick={() => navigate({ q: searchQuery })}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium ${!selectedCategoryId ? 'bg-[#1A2766] text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => navigate({ category: cat.id, q: searchQuery })}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap ${selectedCategoryId === cat.id ? 'bg-[#1A2766] text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Result header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-gray-400">{products.length} product{products.length !== 1 ? 's' : ''}</p>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                &quot;{searchQuery}&quot;
                <button onClick={() => navigate({ category: selectedCategoryId })} className="hover:text-blue-900">
                  <X size={12} />
                </button>
              </span>
            )}
            {selectedCategoryId && (
              <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                {categories.find(c => c.id === selectedCategoryId)?.name}
                <button onClick={() => navigate({ q: searchQuery })} className="hover:text-purple-900">
                  <X size={12} />
                </button>
              </span>
            )}
          </div>
          {isPending && <span className="text-xs text-gray-400 animate-pulse">Loading…</span>}
        </div>

        {/* Product list */}
        {products.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
            <p className="text-gray-400 font-medium">No products found</p>
            <button onClick={() => navigate({})} className="mt-3 text-xs text-[#AE1B1E] hover:underline">Clear all filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>

      {/* ── Right: Sticky cart panel (desktop) ──────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0">
        <div className="bg-white rounded-xl border border-gray-100 sticky top-16 flex flex-col" style={{ maxHeight: 'calc(100vh - 5rem)' }}>
          <div className="px-3 py-2.5 bg-[#1A2766] rounded-t-xl flex items-center justify-between">
            <p className="text-xs font-bold text-white uppercase tracking-wider">Your Order</p>
            {totalItems > 0 && (
              <span className="bg-[#AE1B1E] text-white text-[10px] font-black px-2 py-0.5 rounded-full">{totalItems}</span>
            )}
          </div>
          <div className="flex-1 overflow-hidden p-3">
            <CartPanel />
          </div>
        </div>
      </aside>

      {/* ── Mobile: floating cart CTA ─────────────────────────────────────── */}
      {totalItems > 0 && (
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full flex items-center justify-between bg-[#1A2766] text-white rounded-2xl px-5 py-3.5 shadow-xl"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} />
              <span className="font-bold text-sm">{totalItems} items</span>
            </div>
            <span className="text-sm font-bold">View Cart →</span>
          </button>
        </div>
      )}

      {/* Mobile cart drawer */}
      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Your Order</h3>
              <button onClick={() => setCartOpen(false)} className="text-gray-400 text-sm">Close</button>
            </div>
            <CartPanel />
          </div>
        </div>
      )}
    </div>
  );
}
