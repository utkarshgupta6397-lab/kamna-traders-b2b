'use client';

import { useCartStore } from '@/store/cartStore';
import { Plus, Minus, Package, ShoppingCart } from 'lucide-react';
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
    <div className={`group bg-white border border-gray-100 hover:border-[#1A2766]/30 transition-all duration-75 flex items-center h-[64px] px-3 gap-4 rounded-md ${qty > 0 ? 'bg-blue-50/20 border-l-4 border-l-[#1A2766]' : 'border-l-4 border-l-transparent'} ${product.isOos ? 'opacity-40 grayscale' : 'hover:bg-gray-50'}`}>
      
      {/* 1. Thumbnail (48px) */}
      <div className="flex-shrink-0 w-12 h-12 bg-gray-50 rounded border border-gray-100 flex items-center justify-center overflow-hidden">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain" />
        ) : (
          <Package size={20} className="text-gray-200" />
        )}
      </div>

      {/* 2. Product Name & SKU (Fluid) */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <h3 className="text-[14px] md:text-[15px] font-bold text-gray-900 truncate leading-tight" title={product.name}>
          {product.name}
        </h3>
        <span className="text-[10px] font-mono text-gray-400 font-bold uppercase tracking-tighter">SKU: {product.id}</span>
      </div>

      {/* 3. Price (Fixed width for alignment) */}
      <div className="w-[110px] flex flex-col items-end justify-center">
        <span className="text-[16px] md:text-[18px] font-black text-[#1A2766] leading-none">
          {formatCurrency(product.price)}
        </span>
        <span className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">
          PER {product.unit || 'PC'}
        </span>
      </div>

      {/* 4. MOQ & Stock (Fixed width) */}
      <div className="hidden lg:flex w-[120px] flex-col items-start justify-center pl-4 border-l border-gray-50">
        <span className="text-[11px] font-black text-gray-500 uppercase">MOQ: {product.moq} {product.unit}</span>
        {product.isOos ? (
          <span className="text-[10px] font-black text-red-500">OUT OF STOCK</span>
        ) : (
          <span className="text-[10px] font-black text-emerald-600">AVAILABLE</span>
        )}
      </div>

      {/* 5. POS Action Controls (Fixed width 130px) */}
      <div className="w-[130px] flex items-center justify-end">
        {product.isOos ? (
          <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Locked</div>
        ) : qty === 0 ? (
          <button
            onClick={add}
            className="w-full h-[36px] bg-[#AE1B1E] text-white rounded-md text-[13px] font-black hover:bg-[#8e1518] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <Plus size={14} strokeWidth={4} /> ADD
          </button>
        ) : (
          <div className="w-full h-[36px] flex items-center justify-between bg-white border-2 border-[#1A2766]/10 rounded-md overflow-hidden p-0.5">
            <button
              onClick={subtract}
              className="w-8 h-full flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
            >
              <Minus size={16} strokeWidth={4} />
            </button>
            <span className="flex-1 text-center text-[15px] font-black text-[#1A2766] tabular-nums">{qty}</span>
            <button
              onClick={add}
              className="w-8 h-full flex items-center justify-center text-[#1A2766] hover:bg-blue-50 transition-colors"
            >
              <Plus size={16} strokeWidth={4} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
