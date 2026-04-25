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
  const step = product.stepQty || product.moq;

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
    <div className={`group bg-white rounded-[16px] border border-gray-100 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg h-[210px] p-4 flex flex-col relative ${qty > 0 ? 'ring-2 ring-[#1A2766]/10 border-[#1A2766]/20' : ''} ${product.isOos ? 'opacity-60 grayscale' : ''}`}>
      
      {/* Top Section: Image (Small, Top Left) + Status */}
      <div className="flex items-start justify-between mb-2">
        <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain mix-blend-multiply" />
          ) : (
            <Package size={20} className="text-gray-200" />
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {product.isOos ? (
            <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full uppercase tracking-wider">OOS</span>
          ) : (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">In Stock</span>
          )}
          <span className="text-[10px] font-bold text-gray-300 font-mono">#{product.id}</span>
        </div>
      </div>

      {/* Middle Section: Name & Price */}
      <div className="flex-1 min-w-0">
        <h3 className="text-[15px] font-bold text-gray-900 leading-tight line-clamp-2 mb-1" title={product.name}>
          {product.name}
        </h3>
        <div className="flex items-baseline gap-1">
          <span className="text-[20px] font-black text-[#1A2766]">
            {formatCurrency(product.price)}
          </span>
          <span className="text-[12px] font-bold text-gray-400 lowercase">
            /{product.unit || 'pc'}
          </span>
        </div>
      </div>

      {/* Bottom Section: MOQ Chip & Qty Controls */}
      <div className="mt-auto pt-3 flex items-center justify-between border-t border-gray-50">
        <div className="bg-gray-100 px-2 py-1 rounded-lg">
          <span className="text-[11px] font-bold text-gray-500 whitespace-nowrap">MOQ {product.moq} {product.unit}</span>
        </div>

        <div className="flex-shrink-0">
          {qty === 0 ? (
            <button
              onClick={add}
              disabled={product.isOos}
              className="h-8 px-4 bg-[#AE1B1E] text-white rounded-full text-[12px] font-black hover:bg-[#8e1518] shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              ADD
            </button>
          ) : (
            <div className="h-8 flex items-center bg-gray-50 rounded-full border border-gray-100 p-0.5">
              <button
                onClick={subtract}
                className="w-7 h-7 flex items-center justify-center rounded-full text-red-500 hover:bg-white transition-colors"
              >
                <Minus size={14} strokeWidth={3} />
              </button>
              <span className="w-8 text-center text-[13px] font-black text-[#1A2766] tabular-nums">{qty}</span>
              <button
                onClick={add}
                className="w-7 h-7 flex items-center justify-center rounded-full text-[#1A2766] hover:bg-white transition-colors"
              >
                <Plus size={14} strokeWidth={3} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
