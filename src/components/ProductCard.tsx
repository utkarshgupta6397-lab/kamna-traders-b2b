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
    <div className={`group bg-white rounded-xl border transition-all duration-200 hover:shadow-xl w-full md:h-[124px] overflow-hidden flex flex-col md:flex-row items-stretch md:items-center px-4 md:px-6 py-4 md:py-0 gap-4 md:gap-0 ${qty > 0 ? 'border-[#1A2766]/40 ring-1 ring-[#1A2766]/5 bg-blue-50/10' : 'border-gray-100'} ${product.isOos ? 'opacity-60 bg-gray-50/50' : 'hover:-translate-y-0.5'}`}>
      
      {/* SECTION 1: LEFT - IMAGE (72px) */}
      <div className="flex-shrink-0 w-[72px] h-[72px] rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain mix-blend-multiply" />
        ) : (
          <Package size={28} className="text-gray-200" />
        )}
      </div>

      {/* SECTION 2: CENTER - CONTENT (FLEX) */}
      <div className="flex-1 min-w-0 md:px-6 flex flex-col justify-center">
        {/* Top Row: Name & SKU */}
        <div className="flex flex-col md:flex-row md:items-baseline md:gap-3 mb-1">
          <h3 className="text-[18px] font-bold text-[#111827] leading-tight line-clamp-2 md:line-clamp-1 flex-1" title={product.name}>
            {product.name}
          </h3>
          <span className="text-[12px] font-mono font-medium text-gray-400 mt-0.5 md:mt-0">{product.id}</span>
        </div>

        {/* Middle Row: Price & Unit */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-[30px] font-black text-[#1A2766] tracking-tight leading-none">
            {formatCurrency(product.price)}
          </span>
          <span className="text-[16px] font-semibold text-gray-400 lowercase">
            /{product.unit || 'pc'}
          </span>
        </div>

        {/* Bottom Row: MOQ & Stock */}
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[13px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
            MOQ {product.moq} {product.unit}
          </span>
          {product.isOos ? (
            <span className="text-[11px] font-black text-red-500 uppercase tracking-wider">Out of Stock</span>
          ) : (
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">● In Stock</span>
          )}
        </div>
      </div>

      {/* SECTION 3: RIGHT - ACTIONS (140px) */}
      <div className="w-full md:w-[140px] flex items-center justify-center md:justify-end flex-shrink-0 mt-3 md:mt-0">
        {product.isOos ? (
          <div className="w-[132px] h-[48px] flex items-center justify-center bg-gray-100 rounded-full text-[13px] font-bold text-gray-400 border border-gray-200">
            Unavailable
          </div>
        ) : qty === 0 ? (
          <button
            onClick={add}
            className="w-[132px] h-[48px] bg-[#AE1B1E] text-white rounded-full text-[15px] font-black shadow-md hover:bg-[#8e1518] hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Plus size={18} strokeWidth={3} /> ADD
          </button>
        ) : (
          <div className="w-[132px] h-[48px] flex items-center justify-between bg-white border-2 border-[#1A2766]/10 rounded-full shadow-inner p-1.5">
            <button
              onClick={subtract}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors active:scale-90"
              title="Decrease Quantity"
            >
              <Minus size={18} strokeWidth={3} />
            </button>
            <span className="text-[16px] font-black text-[#1A2766] tabular-nums">{qty}</span>
            <button
              onClick={add}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-50 text-[#1A2766] hover:bg-blue-100 transition-colors active:scale-90"
              title="Increase Quantity"
            >
              <Plus size={18} strokeWidth={3} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
