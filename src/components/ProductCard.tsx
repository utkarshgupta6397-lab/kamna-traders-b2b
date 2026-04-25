'use client';

import { useCartStore } from '@/store/cartStore';
import { Plus, Minus, Package } from 'lucide-react';

export interface ProductData {
  id: string;
  name: string;
  brand: string | null;
  unit: string | null;
  moq: number;
  stepQty?: number;
  price: number;
  imageUrl?: string | null;
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
  const step = product.stepQty || product.moq; // Each press of + or - adjusts by stepQty, fallback to MOQ

  const add = () => {
    if (product.isOos) return;
    if (qty === 0) {
      addItem({
        skuId: product.id,
        name: product.name,
        price: product.price,
        qty: product.moq,
        moq: product.moq,
        stepQty: product.stepQty,
      });
    } else {
      updateQty(product.id, qty + step);
    }
  };

  const subtract = () => {
    if (qty <= product.moq) {
      removeItem(product.id);
    } else {
      updateQty(product.id, qty - step);
    }
  };

  return (
    <div className={`bg-white rounded-xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col overflow-hidden h-full hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] transition-all ${qty > 0 ? 'ring-2 ring-[#1A2766] border-transparent' : ''} ${product.isOos ? 'opacity-60' : ''}`}>
      <div className="aspect-square bg-gray-50 flex-shrink-0 flex items-center justify-center overflow-hidden border-b border-gray-100 relative group">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain mix-blend-multiply p-4 group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <Package size={32} className="text-gray-300" />
        )}
        {product.isOos && (
          <span className="absolute top-3 left-3 text-[10px] font-bold bg-red-100 text-[#AE1B1E] px-2 py-1 rounded-md shadow-sm">OUT OF STOCK</span>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 mb-1" title={product.name}>{product.name}</h3>
        <p className="text-xs text-gray-400 font-mono mb-3">{product.id}</p>
        
        <div className="mt-auto">
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-xl font-black text-[#1A2766]">₹{product.price.toFixed(0)}</span>
            <span className="text-xs text-gray-500">/{product.unit || 'pc'}</span>
          </div>
          <p className="text-xs text-gray-400 mb-4">MOQ {product.moq}</p>

          <div className="w-full">
            {product.isOos ? (
              <div className="w-full text-center py-2 bg-gray-50 rounded-xl text-xs text-gray-400 font-bold">Unavailable</div>
            ) : qty === 0 ? (
              <button onClick={add} className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border-2 border-[#1A2766] text-[#1A2766] rounded-xl text-sm font-bold hover:bg-[#1A2766] hover:text-white transition-colors active:scale-95">
                <Plus size={16} strokeWidth={2.5} /> Add to Cart
              </button>
            ) : (
              <div className="flex items-center border-2 border-[#1A2766] rounded-xl bg-[#1A2766] text-white overflow-hidden w-full h-[44px] shadow-sm">
                <button onClick={subtract} className="w-12 h-full flex items-center justify-center hover:bg-white/20 active:bg-white/30 transition-colors">
                  <Minus size={16} strokeWidth={2.5} />
                </button>
                <span className="flex-1 text-center text-base font-black select-none">{qty}</span>
                <button onClick={add} className="w-12 h-full flex items-center justify-center hover:bg-white/20 active:bg-white/30 transition-colors">
                  <Plus size={16} strokeWidth={2.5} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
