'use client';

import { useCartStore } from '@/store/cartStore';
import { Plus, Minus } from 'lucide-react';

export interface ProductData {
  id: string;
  name: string;
  brand: string | null;
  unit: string | null;
  moq: number;
  price: number;
  isOos: boolean;
  category?: { name: string } | null;
}

export default function ProductCard({ product }: { product: ProductData }) {
  const addItem = useCartStore(s => s.addItem);
  const items = useCartStore(s => s.items);
  const updateQty = useCartStore(s => s.updateQty);
  const removeItem = useCartStore(s => s.removeItem);

  const cartItem = items.find(i => i.skuId === product.id);
  const qty = cartItem?.qty ?? 0;

  const add = () => {
    if (product.isOos) return;
    if (qty === 0) {
      addItem({ skuId: product.id, name: product.name, price: product.price, qty: product.moq, moq: product.moq });
    } else {
      updateQty(product.id, qty + 1);
    }
  };

  const subtract = () => {
    if (qty <= product.moq) {
      removeItem(product.id);
    } else {
      updateQty(product.id, qty - 1);
    }
  };

  return (
    <div className={`bg-white rounded-lg border transition-shadow hover:shadow-sm ${product.isOos ? 'border-gray-100 opacity-75' : 'border-gray-100'}`}>
      <div className="flex items-center gap-3 p-2.5">
        {/* Left: compact info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1 mb-0.5">
            <p className="text-xs font-bold text-gray-900 leading-snug line-clamp-2 flex-1">{product.name}</p>
            {product.isOos && (
              <span className="text-[9px] font-bold bg-red-100 text-[#AE1B1E] px-1.5 py-0.5 rounded flex-shrink-0">OOS</span>
            )}
          </div>
          <p className="text-[10px] text-gray-400 font-mono mb-1">{product.id}</p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-[#1A2766]">₹{product.price.toFixed(0)}</span>
            <span className="text-[10px] text-gray-400">/{product.unit || 'pc'}</span>
            <span className="text-[10px] text-gray-300">·</span>
            <span className="text-[10px] text-gray-400">MOQ {product.moq}</span>
          </div>
        </div>

        {/* Right: qty control */}
        <div className="flex-shrink-0">
          {product.isOos ? (
            <div className="w-20 text-center py-1.5 bg-gray-50 rounded-lg text-[10px] text-gray-400 font-medium">
              Unavail.
            </div>
          ) : qty === 0 ? (
            <button
              onClick={add}
              className="w-20 flex items-center justify-center gap-1 py-1.5 bg-[#AE1B1E] text-white rounded-lg text-xs font-bold hover:bg-[#900f12] transition-colors"
            >
              <Plus size={12} /> Add
            </button>
          ) : (
            <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50 overflow-hidden w-20">
              <button onClick={subtract} className="flex-1 flex items-center justify-center py-1.5 text-gray-500 hover:bg-gray-100 transition-colors">
                <Minus size={12} />
              </button>
              <span className="w-7 text-center text-xs font-black text-[#1A2766]">{qty}</span>
              <button onClick={add} className="flex-1 flex items-center justify-center py-1.5 text-gray-500 hover:bg-gray-100 transition-colors">
                <Plus size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
