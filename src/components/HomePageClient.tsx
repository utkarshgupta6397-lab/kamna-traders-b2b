'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTransition, useState } from 'react';
import ProductCard, { ProductData } from '@/components/ProductCard';
import CartPanel from '@/components/CartPanel';
import { useCartStore } from '@/store/cartStore';
import { ShoppingCart, X, Search } from 'lucide-react';

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
    <div className="max-w-screen-2xl mx-auto px-3 py-3 flex gap-4 relative">

      {/* ── Left: Category sidebar ───────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-48 flex-shrink-0">
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden sticky top-16 shadow-sm">
          <div className="px-3 py-2.5 bg-[#1A2766]">
            <p className="text-xs font-bold text-white uppercase tracking-wider">Categories</p>
          </div>
          <nav className="overflow-y-auto max-h-[calc(100vh-7rem)]">
            <button
              onClick={() => navigate({ q: searchQuery })}
              className={`w-full text-left px-3 py-2.5 text-xs font-medium transition-colors border-b border-gray-50 ${!selectedCategoryId ? 'bg-[#AE1B1E]/10 text-[#AE1B1E] font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              All Products
              <span className="float-right text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{totalSkuCount}</span>
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => navigate({ category: cat.id, q: searchQuery })}
                className={`w-full text-left px-3 py-2.5 text-xs font-medium transition-colors border-b border-gray-50 ${selectedCategoryId === cat.id ? 'bg-[#AE1B1E]/10 text-[#AE1B1E] font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {cat.name}
                <span className="float-right text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{cat.count}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* ── Center: Product grid ─────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile Sticky Search */}
        <div className="md:hidden sticky top-[52px] z-40 bg-[#f8f9fb] pt-2 pb-2 mx-[-12px] px-[12px]">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ q: localSearch, category: selectedCategoryId });
            }} 
            className="relative"
          >
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              placeholder="Search products, SKUs…"
              className="w-full pl-9 pr-9 h-[44px] text-[14px] rounded-full border border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-[#1A2766] outline-none"
            />
            {localSearch && (
              <button 
                type="button" 
                onClick={() => {
                  setLocalSearch('');
                  navigate({ q: '', category: selectedCategoryId });
                }} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-2"
              >
                <X size={16} />
              </button>
            )}
          </form>
        </div>

        {/* Mobile category chips - horizontal scrolling */}
        <div className="md:hidden sticky top-[112px] z-30 bg-[#f8f9fb] pt-1 pb-3 mx-[-12px] px-[12px] overflow-x-auto whitespace-nowrap scrollbar-hide shadow-[0_4px_6px_-6px_rgba(0,0,0,0.1)]">
          <div className="flex gap-2">
            <button
              onClick={() => navigate({ q: searchQuery })}
              className={`flex-shrink-0 text-[13px] px-[14px] h-[40px] rounded-full font-bold transition-colors ${!selectedCategoryId ? 'bg-[#1A2766] text-white shadow-sm' : 'bg-white border border-[#E5E7EB] text-gray-600'}`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => navigate({ category: cat.id, q: searchQuery })}
                className={`flex-shrink-0 text-[13px] px-[14px] h-[40px] rounded-full font-bold transition-colors ${selectedCategoryId === cat.id ? 'bg-[#1A2766] text-white shadow-sm' : 'bg-white border border-[#E5E7EB] text-gray-600'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Result header */}
        <div className="flex items-center justify-between mt-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-500">{products.length} product{products.length !== 1 ? 's' : ''}</p>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                &quot;{searchQuery}&quot;
                <button onClick={() => navigate({ category: selectedCategoryId })} className="hover:text-blue-900 ml-1">
                  <X size={12} />
                </button>
              </span>
            )}
            {selectedCategoryId && (
              <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full font-medium">
                {categories.find(c => c.id === selectedCategoryId)?.name}
                <button onClick={() => navigate({ q: searchQuery })} className="hover:text-purple-900 ml-1">
                  <X size={12} />
                </button>
              </span>
            )}
          </div>
          {isPending && <span className="text-sm text-gray-400 font-medium animate-pulse">Loading…</span>}
        </div>

        {/* Product list */}
        {products.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 py-16 text-center mt-2 shadow-sm">
            <p className="text-gray-400 font-medium text-sm">No products found for your criteria</p>
            <button onClick={() => navigate({})} className="mt-3 text-sm font-bold text-[#AE1B1E] hover:underline">Clear all filters</button>
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
        <div className="md:hidden fixed bottom-3 left-3 right-3 z-40">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full h-[54px] flex items-center justify-between bg-[#1A2766] text-white rounded-full px-5 shadow-[0_8px_20px_-6px_rgba(26,39,102,0.4)]"
          >
            <div className="flex items-center gap-2">
              <span className="bg-white/20 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black">{totalItems}</span>
              <span className="font-bold text-sm">View Cart</span>
            </div>
            <span className="text-[15px] font-black">₹{items.reduce((a, i) => a + (i.qty * i.price), 0).toFixed(0)} <span className="text-xl ml-1 leading-none">→</span></span>
          </button>
        </div>
      )}

      {/* Mobile cart drawer */}
      {cartOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white rounded-t-3xl p-5 max-h-[92vh] h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="font-bold text-gray-900 text-lg">Your Order</h3>
              <button onClick={() => setCartOpen(false)} className="text-gray-400 bg-gray-100 p-2 rounded-full"><X size={18} /></button>
            </div>
            <CartPanel />
          </div>
        </div>
      )}
    </div>
  );
}
