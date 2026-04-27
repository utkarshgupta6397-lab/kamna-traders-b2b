import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface StaffCartItem {
  skuId: string;
  name: string;
  qty: number;
}

interface StaffCartStore {
  warehouseId: string;
  customerName: string;
  notes: string;
  items: StaffCartItem[];
  setWarehouseId: (id: string) => void;
  setCustomerName: (name: string) => void;
  setNotes: (notes: string) => void;
  addItem: (item: StaffCartItem) => void;
  removeItem: (skuId: string) => void;
  updateQty: (skuId: string, qty: number) => void;
  clearCart: () => void;
}

export const useStaffCartStore = create<StaffCartStore>()(
  persist(
    (set) => ({
      warehouseId: '',
      customerName: '',
      notes: '',
      items: [],
      setWarehouseId: (warehouseId) => set({ warehouseId }),
      setCustomerName: (customerName) => set({ customerName }),
      setNotes: (notes) => set({ notes }),
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
      updateQty: (skuId, qty) => set((state) => ({
        items: qty <= 0 
          ? state.items.filter(i => i.skuId !== skuId)
          : state.items.map(i => i.skuId === skuId ? { ...i, qty } : i)
      })),
      clearCart: () => set({ items: [], customerName: '', notes: '' }),
    }),
    {
      name: 'kamna-staff-cart',
    }
  )
);
