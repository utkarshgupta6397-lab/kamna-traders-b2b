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
    setTimeout(() => {
      document.getElementById('global-search')?.focus();
    }, 10);
  };

  const subtract = () => {
    if (qty <= product.moq) {
      removeItem(product.id);
    } else {
      updateQty(product.id, qty - step);
    }
  };

  return (
    <div className={`group bg-white rounded-[12px] border border-[#E5E7EB] shadow-sm flex flex-col h-[168px] min-h-[168px] max-h-[168px] p-3 relative transition-all hover:border-[#1A2766]/30 ${qty > 0 ? 'ring-2 ring-[#1A2766]/10 border-[#1A2766]/20' : ''} ${product.isOos ? 'opacity-50 grayscale' : ''}`}>
      
      {/* Top Row: Brand + Status */}
      <div className="flex items-center justify-between mb-1.5 h-4">
        <span className="text-[11px] font-bold text-[#AE1B1E] uppercase tracking-wider truncate max-w-[100px]">{product.brand || 'Generic'}</span>
        {product.isOos ? (
          <span className="text-[9px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded uppercase">OOS</span>
        ) : (
          <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">Stock</span>
        )}
      </div>

      {/* Middle: Product Name (2-line clamp) */}
      <h3 className="text-[14px] md:text-[15px] font-bold text-gray-900 leading-[1.2] line-clamp-2 h-[36px] mb-1" title={product.name}>
        {product.name}
      </h3>

      {/* SKU Row */}
      <div className="text-[11px] font-medium text-[#6B7280] font-mono leading-none mb-2">#{product.id}</div>

      {/* Price Row */}
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-[16px] font-[800] text-[#1A2766] leading-none">
          {formatCurrency(product.price)}
        </span>
        <span className="text-[11px] font-bold text-gray-400 lowercase tracking-tighter">/{product.unit || 'pc'}</span>
      </div>

      {/* Bottom Action Row: Fixed Spacing */}
      <div className="mt-auto pt-2 flex items-center justify-between border-t border-gray-50 gap-2">
        <div className="bg-gray-100 px-2 py-1 rounded flex-shrink-0">
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">MOQ {product.moq}</span>
        </div>

        <div className="flex-shrink-0">
          {qty === 0 ? (
            <button
              onClick={add}
              disabled={product.isOos}
              className="w-[82px] h-[34px] bg-[#AE1B1E] text-white rounded-full text-[13px] font-bold hover:bg-[#8e1518] shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center"
            >
              ADD
            </button>
          ) : (
            <div className="w-[96px] h-[34px] flex items-center bg-gray-50 rounded-full border border-gray-100 p-0.5">
              <button
                onClick={subtract}
                className="w-8 h-full flex items-center justify-center rounded-full text-red-500 hover:bg-white"
              >
                <Minus size={14} strokeWidth={4} />
              </button>
              <span className="flex-1 text-center text-[13px] font-black text-[#1A2766] tabular-nums">{qty}</span>
              <button
                onClick={add}
                className="w-8 h-full flex items-center justify-center rounded-full text-[#1A2766] hover:bg-white"
              >
                <Plus size={14} strokeWidth={4} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
