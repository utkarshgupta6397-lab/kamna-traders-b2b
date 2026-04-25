'use client';

import { useCartStore } from '@/store/cartStore';
import { Plus, Minus, Package } from 'lucide-react';
import { ProductData } from './ProductCard';

export default function MobileProductTile({ product }: { product: ProductData }) {
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
    <div className={`bg-white rounded-xl border border-gray-200 p-2 flex items-center gap-2 h-20 shadow-sm relative transition-opacity ${product.isOos ? 'opacity-60' : ''}`}>
      {/* Fixed left image - 36px */}
      <div className="w-9 h-9 rounded flex-shrink-0 bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover mix-blend-multiply" />
        ) : (
          <Package size={16} className="text-gray-300" />
        )}
      </div>

      {/* Middle content */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <h3 className="text-sm font-bold text-gray-900 leading-tight truncate">{product.name}</h3>
        <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">{product.id}</p>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="text-sm font-black text-[#1A2766]">₹{product.price.toFixed(0)}</span>
          <span className="text-xs text-gray-400">/{product.unit || 'pc'}</span>
          <span className="text-xs text-gray-400 ml-1">MOQ {product.moq}</span>
        </div>
      </div>

      {/* Right qty controls - 72px width */}
      <div className="w-20 flex-shrink-0">
        {product.isOos ? (
          <div className="w-full text-center py-1.5 bg-gray-50 rounded-lg text-xs text-gray-400 font-medium">
            OOS
          </div>
        ) : qty === 0 ? (
          <button
            onClick={add}
            className="w-full h-9 flex items-center justify-center bg-white border border-[#1A2766] text-[#1A2766] rounded-lg text-sm font-bold shadow-sm active:bg-blue-50 transition-colors"
          >
            Add
          </button>
        ) : (
          <div className="flex items-center justify-between border border-[#1A2766]/30 bg-white rounded-lg h-9 overflow-hidden shadow-sm">
            <button onClick={subtract} className="w-7 h-full flex items-center justify-center text-[#AE1B1E] active:bg-red-50 transition-colors">
              <Minus size={16} strokeWidth={2.5} />
            </button>
            <span className="flex-1 text-center text-sm font-black text-[#1A2766] select-none">{qty}</span>
            <button onClick={add} className="w-7 h-full flex items-center justify-center bg-[#1A2766] text-white active:bg-[#003347] transition-colors">
              <Plus size={16} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
