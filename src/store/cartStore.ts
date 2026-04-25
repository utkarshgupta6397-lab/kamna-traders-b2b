import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  skuId: string;
  name: string;
  price: number;
  qty: number;
  moq: number;
  stepQty?: number;
  imageUrl?: string;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (skuId: string) => void;
  updateQty: (skuId: string, qty: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => set((state) => {
        const existing = state.items.find(i => i.skuId === item.skuId);
        if (existing) {
          return {
            items: state.items.map(i => 
              i.skuId === item.skuId ? { ...i, qty: i.qty + item.qty } : i
            )
          };
        }
        return { items: [...state.items, item] };
      }),
      removeItem: (skuId) => set((state) => ({
        items: state.items.filter(i => i.skuId !== skuId)
      })),
      updateQty: (skuId, qty) => set((state) => {
        const item = state.items.find(i => i.skuId === skuId);
        if (!item) return state;
        // If qty drops below MOQ, remove item entirely
        if (qty < item.moq) {
          return { items: state.items.filter(i => i.skuId !== skuId) };
        }
        return {
          items: state.items.map(i => 
            i.skuId === skuId ? { ...i, qty } : i
          )
        };
      }),
      clearCart: () => set({ items: [] }),
      getTotalItems: () => get().items.reduce((total, item) => total + item.qty, 0),
      getTotalPrice: () => get().items.reduce((total, item) => total + (item.price * item.qty), 0),
    }),
    {
      name: 'kamna-cart',
    }
  )
);
