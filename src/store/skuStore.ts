import { create } from 'zustand';
import type { ProductData } from '@/components/ProductCard';

interface SkuStore {
  /** Full dataset fetched once on load */
  allSkus: ProductData[];
  /** Loading / error state */
  status: 'idle' | 'loading' | 'ready' | 'error';
  errorMsg: string | null;
  /** Active filter state (local only – no network) */
  selectedCategoryId: string;
  searchQuery: string;
  /** Last successful fetch timestamp */
  lastFetchedAt: number | null;

  setSkus: (skus: ProductData[]) => void;
  setStatus: (s: SkuStore['status'], err?: string) => void;
  setCategory: (id: string) => void;
  setSearch: (q: string) => void;

  /** Derived: filtered view (computed on the fly, no extra storage) */
  getFiltered: () => ProductData[];
}

export const useSkuStore = create<SkuStore>((set, get) => ({
  allSkus: [],
  status: 'idle',
  errorMsg: null,
  selectedCategoryId: '',
  searchQuery: '',
  lastFetchedAt: null,

  setSkus: (skus) => set({ allSkus: skus, lastFetchedAt: Date.now() }),
  setStatus: (status, err) => set({ status, errorMsg: err ?? null }),
  setCategory: (id) => set({ selectedCategoryId: id }),
  setSearch: (q) => set({ searchQuery: q }),

  getFiltered: () => {
    const { allSkus, selectedCategoryId, searchQuery } = get();
    let list = allSkus;

    if (selectedCategoryId) {
      list = list.filter((s) => s.categoryId === selectedCategoryId);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          (s.brand ?? '').toLowerCase().includes(q)
      );
    }

    return list;
  },
}));
