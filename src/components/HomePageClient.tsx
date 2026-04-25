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
  const items = useCartStore(s => s.items);
  const totalItems = items.reduce((a, i) => a + i.qty, 0);

  const navigate = (params: Record<string, string>) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); });
    const qs = sp.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  return (
    <div className="w-full min-h-screen bg-[#F9FAFB] p-4">
      {/* 3-COLUMN FIXED ARCHITECTURE */}
      <div className="max-w-[1920px] mx-auto flex gap-4 items-start">

        {/* ── LEFT: 220px FIXED STICKY ───────────────────────────────── */}
        <aside className="hidden lg:block w-[220px] sticky top-4 flex-shrink-0">
          <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-sm overflow-hidden flex flex-col h-[calc(100vh-32px)]">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-[11px] font-[800] text-[#1A2766] uppercase tracking-widest">Categories</h2>
              <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">{totalSkuCount}</span>
            </div>
            <nav className="p-2 space-y-1 overflow-y-auto custom-scrollbar flex-1">
              <button
                onClick={() => navigate({ q: searchQuery })}
                className={`w-full flex items-center justify-between px-3 h-9 rounded-lg text-[13px] font-bold transition-all ${!selectedCategoryId ? 'bg-[#1A2766] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <span>Full Inventory</span>
              </button>
              <div className="h-px bg-gray-50 my-2 mx-1" />
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => navigate({ category: cat.id, q: searchQuery })}
                  className={`w-full flex items-center justify-between px-3 h-9 rounded-lg text-[13px] font-bold transition-all ${selectedCategoryId === cat.id ? 'bg-[#1A2766] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <span className="truncate">{cat.name}</span>
                  <span className={`text-[10px] font-bold ${selectedCategoryId === cat.id ? 'text-white/60' : 'text-gray-300'}`}>{cat.count}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* ── CENTER: DENSE GRID (Fluid) ────────────────────────────────── */}
        <main className="flex-1 min-w-0">
          {/* Dense Toolbar */}
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-3">
              <h1 className="text-[16px] font-black text-gray-900 uppercase tracking-tight">
                {selectedCategoryId ? categories.find(c => c.id === selectedCategoryId)?.name : 'Active Terminal'}
              </h1>
              {isPending && <span className="w-2 h-2 rounded-full bg-[#AE1B1E] animate-ping" />}
            </div>
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{products.length} Units Found</p>
          </div>

          {/* POS Grid System: Breakpoint Driven Density */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
            {products.length === 0 && (
              <div className="col-span-full bg-white rounded-xl border border-gray-100 py-20 text-center shadow-sm">
                <p className="text-gray-400 font-bold uppercase text-[12px] tracking-widest">Database Empty. Syncing...</p>
              </div>
            )}
          </div>
        </main>

        {/* ── RIGHT: 320px FIXED STICKY ──────────────────────────────── */}
        <aside className="hidden xl:block w-[320px] sticky top-4 flex-shrink-0">
          <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-sm overflow-hidden flex flex-col h-[calc(100vh-32px)]">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-[#1A2766]">
              <h2 className="text-[11px] font-[800] text-white uppercase tracking-widest">Inquiry Bin</h2>
              {totalItems > 0 && (
                <span className="bg-[#AE1B1E] text-white text-[10px] font-black px-2 py-0.5 rounded shadow-sm">{totalItems}</span>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <CartPanel />
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}
