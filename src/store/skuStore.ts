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
  clearWarehouseState: () => void;

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
    // ── DEFENSIVE QUANTITY NORMALIZATION ──
    // Ensures any SKU with qty <= 0 is treated as OOS regardless of backend flag
    // Bypassed if the SKU is marked isUnlimited
    const normalizedSkus = skus.map(s => {
      const effectiveQty = (typeof s.inventoryQty === 'number' && !isNaN(s.inventoryQty)) ? s.inventoryQty : 0;
      const effectiveIsOos = s.isUnlimited ? false : (s.isOos || effectiveQty <= 0);
      return { ...s, isOos: effectiveIsOos, inventoryQty: effectiveQty };
    });

    // Debug target SKU logging
    const targetSku = normalizedSkus.find(s => s.id === 'R0NQ7L1V');
    if (targetSku) {
      console.log('[DEBUG R0NQ7L1V] setSkus:', {
        sku: targetSku,
        isUnlimited: targetSku.isUnlimited,
        inventoryQty: targetSku.inventoryQty,
        isOos: targetSku.isOos
      });
    }

    set({ 
      allSkus: normalizedSkus, 
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
  clearWarehouseState: () => set({ 
    selectedBrands: [], 
    selectedCaseSizes: [],
    selectedIndex: -1, // Reset keyboard selection if stored (though it's in Client state)
  } as any),

  getFiltered: () => {
    const { allSkus, selectedCategoryId, searchQuery, hideOos, selectedCaseSizes, selectedBrands } = get();
    
    // Pipeline Order: Category -> Hide OOS -> Case Size -> Brand Pills -> Search
    let list = allSkus;

    const debugTarget = allSkus.find(s => s.id === 'R0NQ7L1V');
    if (debugTarget) {
      console.log('[DEBUG R0NQ7L1V] getFiltered - initial:', {
        sku: debugTarget,
        isUnlimited: debugTarget.isUnlimited,
        totalQty: debugTarget.inventoryQty,
        isOos: debugTarget.isOos
      });
    }

    // 1. Category
    if (selectedCategoryId) {
      list = list.filter((s) => s.categoryId === selectedCategoryId);
      if (debugTarget && !list.some(s => s.id === 'R0NQ7L1V')) {
        console.log('[DEBUG R0NQ7L1V] Hidden by: selectedCategoryId mismatch', {
          skuCategory: debugTarget.categoryId,
          selectedCategoryId
        });
      }
    }

    // 2. Hide OOS (Defensive: Re-check effective quantity, bypassed if isUnlimited)
    if (hideOos) {
      list = list.filter((s) => s.isUnlimited || (!s.isOos && (s.inventoryQty ?? 0) > 0));
      if (debugTarget && !list.some(s => s.id === 'R0NQ7L1V')) {
        console.log('[DEBUG R0NQ7L1V] Hidden by: Hide OOS condition', {
          isOos: debugTarget.isOos,
          inventoryQty: debugTarget.inventoryQty,
          isUnlimited: debugTarget.isUnlimited
        });
      }
    }

    // 3. Case Size
    if (selectedCaseSizes.length > 0) {
      list = list.filter((s) => s.caseSize && selectedCaseSizes.includes(s.caseSize));
      if (debugTarget && !list.some(s => s.id === 'R0NQ7L1V')) {
        console.log('[DEBUG R0NQ7L1V] Hidden by: caseSize mismatch', {
          skuCaseSize: debugTarget.caseSize,
          selectedCaseSizes
        });
      }
    }

    // 4. Brand Pills (Multi-select)
    if (selectedBrands.length > 0) {
      list = list.filter((s) => s.brand && selectedBrands.includes(s.brand));
      if (debugTarget && !list.some(s => s.id === 'R0NQ7L1V')) {
        console.log('[DEBUG R0NQ7L1V] Hidden by: brand mismatch', {
          skuBrand: debugTarget.brand,
          selectedBrands
        });
      }
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
      if (debugTarget && !list.some(s => s.id === 'R0NQ7L1V')) {
        console.log('[DEBUG R0NQ7L1V] Hidden by: searchQuery mismatch', {
          searchQuery: q,
          skuName: debugTarget.name,
          skuId: debugTarget.id,
          skuBrand: debugTarget.brand
        });
      }
    }

    return list;
  },
}));
