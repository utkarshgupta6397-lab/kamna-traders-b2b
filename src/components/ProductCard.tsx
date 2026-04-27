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
    <div className={`group bg-white rounded-xl border border-[#E7EAF0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col h-[148px] max-h-[148px] p-3 relative transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:border-[#1A2766]/20 ${qty > 0 ? 'bg-blue-50/10 border-[#1A2766]/30 shadow-none' : ''} ${product.isOos ? 'opacity-50 grayscale' : ''}`}>
      
      {/* 1. Header: Brand + Stock Badge */}
      <div className="flex items-center justify-between mb-1 h-3.5">
        <span className="text-[10px] font-bold text-[#1A2766] uppercase tracking-[0.05em] truncate pr-2">{product.brand || 'Industrial'}</span>
        {product.isOos ? (
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span className="text-[9px] font-bold text-red-500 uppercase">Out of Stock</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[9px] font-bold text-emerald-600 uppercase">In Stock</span>
          </div>
        )}
      </div>

      {/* 2. Content: Name (2-line clamp) + SKU */}
      <div className="flex-1 mb-1">
        <h3 className="text-[15px] font-[700] text-[#111827] leading-[1.2] line-clamp-2 h-[36px] overflow-hidden" title={product.name}>
          {product.name}
        </h3>
        <div className="text-[11px] font-medium text-gray-400 font-mono mt-0.5">#{product.id}</div>
      </div>

      {/* 3. Action Row: Price + Qty */}
      <div className="mt-auto flex items-center justify-between gap-3 pt-2 border-t border-[#F1F3F7]">
        <div className="flex flex-col">
          <span className="text-[16px] font-[800] text-[#1A2766] leading-none mb-0.5">
            {formatCurrency(product.price)}
          </span>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">MOQ {product.moq} {product.unit}</span>
        </div>

        <div className="flex-shrink-0">
          {qty === 0 ? (
            <button
              onClick={add}
              disabled={product.isOos}
              className="w-[82px] h-[34px] rounded-[10px] text-[14px] font-[700] transition-all active:scale-95 disabled:opacity-50 shadow-sm flex items-center justify-center bg-[#1A2766] text-white hover:bg-[#003347]"
            >
              ADD
            </button>
          ) : (
            <div className="w-[96px] h-[34px] flex items-center bg-[#F1F3F7] rounded-[10px] p-0.5 border border-transparent">
              <button
                onClick={subtract}
                className="w-7 h-full flex items-center justify-center rounded-lg text-[#1A2766] hover:bg-white hover:shadow-sm transition-all disabled:opacity-30"
              >
                <Minus size={14} strokeWidth={3} />
              </button>
              <span className="flex-1 text-center text-[14px] font-[800] text-[#1A2766] tabular-nums">{qty}</span>
              <button
                onClick={add}
                className="w-7 h-full flex items-center justify-center rounded-lg text-[#1A2766] hover:bg-white hover:shadow-sm transition-all disabled:opacity-30"
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
