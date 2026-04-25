'use client';

import { useCartStore } from '@/store/cartStore';
import { Plus, Minus, Package } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

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
    <div className={`bg-white rounded-lg border transition-all hover:shadow-md ${qty > 0 ? 'border-[#1A2766]/30 ring-1 ring-[#1A2766]/10' : 'border-gray-100'} ${product.isOos ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3 p-2.5">
        {/* Product Image */}
        <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-100">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover rounded-lg" />
          ) : (
            <Package size={20} className="text-gray-300" />
          )}
        </div>

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1 mb-0.5">
            <p className="text-xs font-bold text-gray-900 leading-snug truncate flex-1" title={product.name}>{product.name}</p>
            {product.isOos && (
              <span className="text-[9px] font-bold bg-red-100 text-[#AE1B1E] px-1.5 py-0.5 rounded flex-shrink-0">OOS</span>
            )}
          </div>
          <p className="text-[10px] text-gray-400 font-mono mb-1">{product.id}</p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-black text-[#1A2766]">{formatCurrency(product.price)}</span>
            <span className="text-[10px] text-gray-400">/{product.unit || 'pc'}</span>
            <span className="text-[10px] text-gray-300">·</span>
            <span className="text-[10px] text-gray-400">MOQ {product.moq}{product.unit ? ` ${product.unit}` : ''}</span>
          </div>
        </div>

        {/* Qty Control */}
        <div className="flex-shrink-0">
          {product.isOos ? (
            <div className="w-[76px] text-center py-1.5 bg-gray-50 rounded-lg text-[10px] text-gray-400 font-medium">
              Unavail.
            </div>
          ) : qty === 0 ? (
            <button
              onClick={add}
              className="w-[76px] flex items-center justify-center gap-1 py-2 bg-[#AE1B1E] text-white rounded-lg text-xs font-bold hover:bg-[#900f12] transition-colors active:scale-95"
            >
              <Plus size={12} /> Add
            </button>
          ) : (
            <div className="flex items-center border-2 border-[#1A2766]/20 rounded-lg bg-white overflow-hidden w-[76px]">
              <button
                onClick={subtract}
                className="flex-1 flex items-center justify-center py-1.5 text-[#AE1B1E] hover:bg-red-50 transition-colors active:scale-95"
              >
                <Minus size={12} strokeWidth={3} />
              </button>
              <span className="w-8 text-center text-xs font-black text-[#1A2766] select-none">{qty}</span>
              <button
                onClick={add}
                className="flex-1 flex items-center justify-center py-1.5 text-[#1A2766] hover:bg-blue-50 transition-colors active:scale-95"
              >
                <Plus size={12} strokeWidth={3} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
