'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTransition, useState } from 'react';
import ProductCard, { ProductData } from '@/components/ProductCard';
import CartPanel from '@/components/CartPanel';
import { useCartStore } from '@/store/cartStore';
import { ShoppingCart, X, Search } from 'lucide-react';
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
    <div className="max-w-[1680px] mx-auto px-4 py-4 flex gap-4 relative h-full min-h-[calc(100vh-3.5rem)]">

      {/* ── Left: Category sidebar (220px) ────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-[220px] flex-shrink-0">
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden sticky top-4 shadow-sm">
          <div className="px-3 py-2 bg-[#1A2766]">
            <p className="text-[11px] font-bold text-white uppercase tracking-wider">Categories</p>
          </div>
          <nav className="overflow-y-auto max-h-[calc(100vh-10rem)]">
            <button
              onClick={() => navigate({ q: searchQuery })}
              className={`w-full text-left px-3 py-2 text-[15px] font-medium transition-colors border-b border-gray-50 ${!selectedCategoryId ? 'bg-[#AE1B1E]/5 text-[#AE1B1E] font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              All Products
              <span className="float-right text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{totalSkuCount}</span>
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => navigate({ category: cat.id, q: searchQuery })}
                className={`w-full text-left px-3 py-2 text-[15px] font-medium transition-colors border-b border-gray-50 ${selectedCategoryId === cat.id ? 'bg-[#AE1B1E]/5 text-[#AE1B1E] font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {cat.name}
                <span className="float-right text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{cat.count}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* ── Center: Product grid (Fluid) ────────────────────────────────── */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Result toolbar (Dense: 44px) */}
        <div className="flex items-center justify-between h-[44px] mb-2 px-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] font-bold text-gray-400 uppercase tracking-tight">{products.length} Items Found</p>
            {selectedCategoryId && (
              <span className="inline-flex items-center gap-1.5 text-[12px] bg-red-50 text-[#AE1B1E] px-2.5 py-0.5 rounded-full font-bold border border-red-100">
                {categories.find(c => c.id === selectedCategoryId)?.name}
                <button onClick={() => navigate({ q: searchQuery })} className="hover:text-red-900">
                  <X size={12} strokeWidth={3} />
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1.5 text-[12px] bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-bold border border-blue-100">
                &quot;{searchQuery}&quot;
                <button onClick={() => navigate({ category: selectedCategoryId })} className="hover:text-blue-900">
                  <X size={12} strokeWidth={3} />
                </button>
              </span>
            )}
          </div>
          {isPending && <span className="text-[12px] text-gray-400 font-bold animate-pulse">REVALIDATING...</span>}
        </div>

        {/* Product list (High Density) */}
        {products.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 py-12 text-center shadow-sm">
            <p className="text-gray-400 font-medium text-sm">No results found</p>
            <button onClick={() => navigate({})} className="mt-2 text-xs font-bold text-[#AE1B1E] uppercase tracking-wider">Reset Filters</button>
          </div>
        ) : (
          <div className="flex flex-col gap-[10px]">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>

      {/* ── Right: Sticky cart panel (320px) ────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-[320px] flex-shrink-0">
        <div className="bg-white rounded-xl border border-gray-100 sticky top-4 flex flex-col shadow-sm" style={{ maxHeight: 'calc(100vh - 5rem)' }}>
          <div className="px-3 py-2 bg-[#1A2766] rounded-t-xl flex items-center justify-between">
            <p className="text-[11px] font-bold text-white uppercase tracking-wider">Your Inquiry</p>
            {totalItems > 0 && (
              <span className="bg-[#AE1B1E] text-white text-[10px] font-black px-2 py-0.5 rounded-full">{totalItems}</span>
            )}
          </div>
          <div className="flex-1 overflow-hidden p-0">
            <CartPanel />
          </div>
        </div>
      </aside>

      {/* Mobile drawer logic remains (scaled correctly via shared components) */}
      {totalItems > 0 && (
        <div className="md:hidden fixed bottom-3 left-3 right-3 z-40">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full h-[54px] flex items-center justify-between bg-[#1A2766] text-white rounded-full px-5 shadow-lg"
          >
            <div className="flex items-center gap-2">
              <span className="bg-white/20 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black">{totalItems}</span>
              <span className="font-bold text-sm">Checkout</span>
            </div>
            <span className="text-[15px] font-black">{formatCurrency(items.reduce((a, i) => a + (i.qty * i.price), 0))}</span>
          </button>
        </div>
      )}

      {cartOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white rounded-t-3xl p-4 max-h-[92vh] h-[92vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-lg">Your Order</h3>
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
