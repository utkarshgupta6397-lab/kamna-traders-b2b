'use client';

import { useCartStore } from '@/store/cartStore';
import { Minus, Plus, ShoppingBag } from 'lucide-react';
import { useState } from 'react';

export interface ProductData {
  id: string;
  name: string;
  brand: string | null;
  unit: string | null;
  moq: number;
  price: number;
  isOos: boolean; // stock status — independent of isActive
  category?: { name: string } | null;
}

export default function ProductCard({ product }: { product: ProductData }) {
  const addItem = useCartStore((state) => state.addItem);
  const items = useCartStore((state) => state.items);

  const cartItem = items.find(i => i.skuId === product.id);
  const currentQtyInCart = cartItem ? cartItem.qty : 0;

  const [qtyToAdd, setQtyToAdd] = useState(product.moq);

  const handleAdd = () => {
    if (product.isOos) return;
    addItem({
      skuId: product.id,
      name: product.name,
      price: product.price,
      qty: qtyToAdd,
      moq: product.moq,
    });
  };

  return (
    <div className={`bg-white rounded-xl border overflow-hidden flex flex-col group transition-shadow hover:shadow-md ${product.isOos ? 'border-gray-100 opacity-80' : 'border-gray-100'}`}>
      {/* Compact Image strip */}
      <div className="relative h-28 bg-gray-50 flex items-center justify-center">
        <ShoppingBag size={36} className="text-gray-200" />

        {/* OOS badge top-right */}
        {product.isOos && (
          <span className="absolute top-2 right-2 bg-[#AE1B1E] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            Out of Stock
          </span>
        )}

        {/* Brand badge top-left */}
        {product.brand && (
          <span className="absolute top-2 left-2 bg-white text-gray-600 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-gray-200">
            {product.brand}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col flex-1 gap-1">
        {/* SKU + Category row */}
        <div className="flex justify-between text-[10px] text-gray-400">
          <span className="font-mono">{product.id}</span>
          {product.category && <span>{product.category.name}</span>}
        </div>

        {/* Name */}
        <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">
          {product.name}
        </h3>

        {/* Price + Unit row */}
        <div className="flex items-baseline justify-between mt-0.5">
          <span className="text-base font-black text-[#1A2766]">₹{product.price.toFixed(0)}</span>
          <span className="text-[10px] text-gray-400">/{product.unit || 'PC'}</span>
        </div>

        <div className="flex items-center justify-between text-[10px] text-gray-400 mb-2">
          <span>MOQ: {product.moq}</span>
          {currentQtyInCart > 0 && (
            <span className="text-green-600 font-bold">{currentQtyInCart} in cart</span>
          )}
        </div>

        {/* Action row */}
        {product.isOos ? (
          <div className="mt-auto py-1.5 rounded-lg bg-gray-100 text-gray-400 text-xs text-center font-medium">
            Unavailable
          </div>
        ) : (
          <div className="mt-auto flex gap-1">
            {/* Qty stepper */}
            <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50 h-8">
              <button
                onClick={() => setQtyToAdd(Math.max(product.moq, qtyToAdd - 1))}
                className="px-2 text-gray-400 hover:text-[#AE1B1E] transition-colors disabled:opacity-30"
                disabled={qtyToAdd <= product.moq}
              >
                <Minus size={12} />
              </button>
              <input
                type="number"
                value={qtyToAdd}
                onChange={(e) => setQtyToAdd(Math.max(product.moq, parseInt(e.target.value) || product.moq))}
                className="w-8 text-center bg-transparent text-xs font-medium focus:outline-none"
                min={product.moq}
              />
              <button
                onClick={() => setQtyToAdd(qtyToAdd + 1)}
                className="px-2 text-gray-400 hover:text-[#1A2766] transition-colors"
              >
                <Plus size={12} />
              </button>
            </div>

            <button
              onClick={handleAdd}
              className="flex-1 rounded-lg bg-[#AE1B1E] text-white text-xs font-bold hover:bg-[#900f12] transition-colors h-8"
            >
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
