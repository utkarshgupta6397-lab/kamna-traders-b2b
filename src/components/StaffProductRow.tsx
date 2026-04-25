'use client';

import { useCartStore } from '@/store/cartStore';
import { Plus, Minus, Package } from 'lucide-react';
import { ProductData } from './ProductCard';

export default function StaffProductRow({ product }: { product: ProductData }) {
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
    <div className={`bg-white rounded-xl shadow-sm border transition-opacity ${qty > 0 ? 'border-[#1A2766]/30 ring-1 ring-[#1A2766]/10' : 'border-gray-100'} ${product.isOos ? 'opacity-60' : ''}`}>
      <div className="flex flex-row items-center gap-3 p-2">
        {/* Product Image */}
        <div className="w-12 h-12 rounded-lg bg-gray-50 flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-100/50">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover mix-blend-multiply" />
          ) : (
            <Package size={20} className="text-gray-300" />
          )}
        </div>

        {/* Product Info - min-w-0 for Safari flex truncation */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-start justify-between gap-1 mb-0.5">
            <h3 className="text-sm font-bold text-gray-900 leading-snug truncate flex-1">{product.name}</h3>
            {product.isOos && (
              <span className="text-[10px] font-bold bg-red-100 text-[#AE1B1E] px-1.5 py-0.5 rounded flex-shrink-0">OOS</span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 font-mono mb-0.5 truncate">{product.id}</p>
          <div className="flex items-baseline gap-2 flex-wrap mt-0.5">
            <span className="text-xs text-gray-400 font-medium">MOQ {product.moq}{product.unit ? ` ${product.unit}` : ''}</span>
          </div>
        </div>

        <div className="flex-shrink-0 w-24">
          {product.isOos ? (
            <div className="w-full text-center py-1.5 bg-gray-50 rounded-lg text-xs text-gray-400 font-medium">
              Unavail.
            </div>
          ) : qty === 0 ? (
            <button
              onClick={add}
              className="w-full h-9 flex items-center justify-center gap-1 bg-[#1A2766] text-white rounded-lg text-sm font-bold hover:bg-[#003347] transition-colors active:scale-95 shadow-sm"
            >
              <Plus size={14} /> Add
            </button>
          ) : (
            <div className="flex items-center justify-between border-2 border-[#1A2766]/20 rounded-lg bg-white overflow-hidden w-full h-9 shadow-sm">
              <button
                onClick={subtract}
                className="w-8 h-full flex items-center justify-center text-[#AE1B1E] active:bg-red-50 transition-colors"
              >
                <Minus size={16} strokeWidth={2.5} />
              </button>
              <span className="flex-1 text-center text-sm font-black text-[#1A2766] select-none">{qty}</span>
              <button
                onClick={add}
                className="w-8 h-full flex items-center justify-center text-[#1A2766] active:bg-blue-50 transition-colors"
              >
                <Plus size={16} strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
