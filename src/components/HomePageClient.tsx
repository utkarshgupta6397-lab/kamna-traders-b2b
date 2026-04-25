'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import ProductCard, { ProductData } from '@/components/ProductCard';
import CartPanel from '@/components/CartPanel';
import { useCartStore } from '@/store/cartStore';
import { ShoppingBag } from 'lucide-react';

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
    <div className="w-full min-h-screen bg-[#F6F7FA] p-4">
      <div className="max-w-[1920px] mx-auto flex gap-4 items-start">

        {/* ── LEFT: 220px REFINED SIDEBAR ─────────────────────────────── */}
        <aside className="hidden lg:block w-[220px] sticky top-4 flex-shrink-0">
          <div className="bg-white rounded-xl border border-[#E7EAF0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col h-[calc(100vh-32px)]">
            <div className="px-4 py-3.5 border-b border-[#F1F3F7]">
              <h2 className="text-[11px] font-[800] text-[#1A2766] uppercase tracking-[0.1em]">Catalog</h2>
            </div>
            <nav className="p-2 space-y-0.5 overflow-y-auto custom-scrollbar flex-1">
              <button
                onClick={() => navigate({ q: searchQuery })}
                className={`w-full flex items-center justify-between px-3 h-[42px] rounded-lg text-[14px] font-[700] transition-all group ${!selectedCategoryId ? 'bg-[#1A2766] text-white shadow-md' : 'text-gray-500 hover:bg-[#F1F6FF] hover:text-[#1A2766]'}`}
              >
                <span>Full Inventory</span>
                {!selectedCategoryId && <span className="w-1.5 h-1.5 rounded-full bg-white/40" />}
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

        {/* ── CENTER: HIGH-DENSITY TERMINAL (Fluid) ─────────────────────── */}
        <main className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4 px-1 h-[42px]">
            <div className="flex items-center gap-3">
              <h1 className="text-[16px] font-[800] text-gray-900 uppercase tracking-tight">
                {selectedCategoryId ? categories.find(c => c.id === selectedCategoryId)?.name : 'Active Terminal'}
              </h1>
              {isPending && <div className="w-4 h-4 border-2 border-[#1A2766] border-t-transparent rounded-full animate-spin" />}
            </div>
            <div className="flex items-center gap-2">
               <span className="text-[11px] font-[800] text-gray-400 uppercase tracking-widest bg-white px-2 py-1 rounded border border-[#E7EAF0]">{products.length} SKUs Available</span>
            </div>
          </div>

          {/* Calibrated Breakpoints for 4-Column Flow */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
            {products.length === 0 && (
              <div className="col-span-full bg-white rounded-xl border border-[#E7EAF0] py-24 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShoppingBag size={32} className="text-gray-200" />
                </div>
                <p className="text-gray-400 font-bold uppercase text-[12px] tracking-widest">No Products Matching Criteria</p>
              </div>
            )}
          </div>
        </main>

        {/* ── RIGHT: 320px REFINED INQUIRY ───────────────────────────── */}
        <aside className="hidden xl:block w-[320px] sticky top-4 flex-shrink-0">
          <div className="bg-white rounded-xl border border-[#E7EAF0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col h-[calc(100vh-32px)]">
            <div className="px-4 py-3.5 border-b border-[#F1F3F7] bg-[#1A2766] flex items-center justify-between">
              <h2 className="text-[11px] font-[800] text-white uppercase tracking-[0.1em]">Inquiry Summary</h2>
              {totalItems > 0 && <span className="bg-[#AE1B1E] text-white text-[10px] font-black px-2 py-0.5 rounded shadow-sm">{totalItems}</span>}
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
