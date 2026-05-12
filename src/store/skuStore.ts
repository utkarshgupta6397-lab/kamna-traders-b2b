import { create } from 'zustand';
import type { ProductData } from '@/components/ProductCard';

interface BrandMetadata {
  brandName: string;
  activeSkuCount: number;
}

interface SkuStore {
  /** Full dataset fetched once on load */
  allSkus: ProductData[];
  /** High-performance index map for brand filtering */
  brandIndexMap: Record<string, ProductData[]>;
  /** Top brands metadata */
  topBrandsByCategory: Record<string, BrandMetadata[]>;
  topBrandsFullCatalog: BrandMetadata[];
  
  /** Loading / error state */
  status: 'idle' | 'loading' | 'ready' | 'error';
  errorMsg: string | null;
  /** Active filter state (local only – no network) */
  selectedCategoryId: string;
  searchQuery: string;
  hideOos: boolean;
  selectedCaseSizes: number[];
  selectedBrands: string[];
  /** Last successful fetch timestamp */
  lastFetchedAt: number | null;

  setSkus: (payload: { skus: ProductData[], topBrandsByCategory: Record<string, BrandMetadata[]>, topBrandsFullCatalog: BrandMetadata[] }) => void;
  setStatus: (s: SkuStore['status'], err?: string) => void;
  setCategory: (id: string) => void;
  setSearch: (q: string) => void;
  setHideOos: (val: boolean) => void;
  setSelectedCaseSizes: (sizes: number[]) => void;
  toggleBrand: (brandName: string) => void;

  /** Derived: filtered view (computed on the fly, no extra storage) */
  getFiltered: () => ProductData[];
}

export const useSkuStore = create<SkuStore>((set, get) => ({
  allSkus: [],
  brandIndexMap: {},
  topBrandsByCategory: {},
  topBrandsFullCatalog: [],
  status: 'idle',
  errorMsg: null,
  selectedCategoryId: '',
  searchQuery: '',
  hideOos: true, // Default: hide OOS
  selectedCaseSizes: [],
  selectedBrands: [],
  lastFetchedAt: null,

  setSkus: ({ skus, topBrandsByCategory, topBrandsFullCatalog }) => {
    set({ 
      allSkus: skus, 
      topBrandsByCategory, 
      topBrandsFullCatalog,
      lastFetchedAt: Date.now() 
    });
  },
  setStatus: (status, err) => set({ status, errorMsg: err ?? null }),
  setCategory: (id) => set({ selectedCategoryId: id, selectedBrands: [] }), // UX Rule: Clear brands when category changes
  setSearch: (q) => set({ searchQuery: q }),
  setHideOos: (val) => set({ hideOos: val }),
  setSelectedCaseSizes: (sizes) => set({ selectedCaseSizes: sizes }),
  toggleBrand: (brandName) => {
    const { selectedBrands } = get();
    const next = selectedBrands.includes(brandName)
      ? selectedBrands.filter(b => b !== brandName)
      : [...selectedBrands, brandName];
    set({ selectedBrands: next });
  },

  getFiltered: () => {
    const { allSkus, selectedCategoryId, searchQuery, hideOos, selectedCaseSizes, selectedBrands } = get();
    
    // Pipeline Order: Category -> Hide OOS -> Case Size -> Brand Pills -> Search
    let list = allSkus;

    // 1. Category
    if (selectedCategoryId) {
      list = list.filter((s) => s.categoryId === selectedCategoryId);
    }

    // 2. Hide OOS
    if (hideOos) {
      list = list.filter((s) => !s.isOos);
    }

    // 3. Case Size
    if (selectedCaseSizes.length > 0) {
      list = list.filter((s) => s.caseSize && selectedCaseSizes.includes(s.caseSize));
    }

    // 4. Brand Pills (Multi-select)
    if (selectedBrands.length > 0) {
      list = list.filter((s) => s.brand && selectedBrands.includes(s.brand));
    }

    // 5. Search
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
