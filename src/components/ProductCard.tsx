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
    <div className={`group bg-white rounded-[14px] border border-[#E5E7EB] transition-all duration-200 hover:shadow-sm w-full md:h-[108px] overflow-hidden flex flex-col md:flex-row items-stretch md:items-center px-3 md:px-4 py-3 md:py-0 gap-3 md:gap-0 ${qty > 0 ? 'border-[#1A2766]/30 bg-blue-50/5' : ''} ${product.isOos ? 'opacity-50' : ''}`}>
      
      {/* SECTION 1: LEFT - COMPACT IMAGE (64px) */}
      <div className="flex-shrink-0 w-[64px] h-[64px] rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain" />
        ) : (
          <Package size={24} className="text-gray-200" />
        )}
      </div>

      {/* SECTION 2: CENTER - DENSE CONTENT */}
      <div className="flex-1 min-w-0 md:px-4 flex flex-col justify-center">
        {/* Row 1: Name & SKU inline */}
        <div className="flex items-baseline gap-2 mb-0.5">
          <h3 className="text-[16px] md:text-[18px] font-bold text-[#111827] leading-tight truncate" title={product.name}>
            {product.name}
          </h3>
          <span className="text-[12px] font-mono text-gray-400 flex-shrink-0">{product.id}</span>
        </div>

        {/* Row 2: Price (20px) & Unit */}
        <div className="flex items-baseline gap-1">
          <span className="text-[18px] md:text-[20px] font-bold text-[#1A2766] leading-none">
            {formatCurrency(product.price)}
          </span>
          <span className="text-[14px] text-gray-500 lowercase">
            /{product.unit || 'pc'}
          </span>
        </div>

        {/* Row 3: Meta (MOQ & Stock) */}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
            MOQ {product.moq} {product.unit}
          </span>
          {!product.isOos && (
            <span className="text-[11px] font-bold text-emerald-600">In Stock</span>
          )}
        </div>
      </div>

      {/* SECTION 3: RIGHT - ACTIONS (150px) */}
      <div className="w-full md:w-[150px] flex items-center justify-center md:justify-end flex-shrink-0">
        {product.isOos ? (
          <div className="w-[128px] h-[40px] flex items-center justify-center bg-gray-100 rounded-full text-[12px] font-bold text-gray-400">
            Out of Stock
          </div>
        ) : qty === 0 ? (
          <button
            onClick={add}
            className="w-[128px] h-[42px] bg-[#AE1B1E] text-white rounded-full text-[16px] font-bold hover:bg-[#8e1518] transition-colors active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Plus size={16} strokeWidth={3} /> ADD
          </button>
        ) : (
          <div className="w-[128px] h-[42px] flex items-center justify-between bg-white border border-gray-200 rounded-full p-1">
            <button
              onClick={subtract}
              className="w-8 h-8 flex items-center justify-center rounded-full text-red-600 hover:bg-red-50 transition-colors"
            >
              <Minus size={16} strokeWidth={3} />
            </button>
            <span className="text-[16px] font-bold text-[#1A2766] tabular-nums">{qty}</span>
            <button
              onClick={add}
              className="w-8 h-8 flex items-center justify-center rounded-full text-[#1A2766] hover:bg-blue-50 transition-colors"
            >
              <Plus size={16} strokeWidth={3} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
