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
  isOos: boolean;
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
    // Reset to MOQ after adding or keep it? Keeping it is fine.
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col group hover:shadow-md transition-shadow">
      <div className="aspect-square bg-gray-50 flex items-center justify-center p-6 relative">
        {/* Placeholder for Image */}
        <div className="text-gray-300">
          <ShoppingBag size={64} />
        </div>
        
        {/* Stock Badge */}
        <div className="absolute top-3 right-3">
          {product.isOos ? (
            <span className="bg-[#AE1B1E] text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
              Out of Stock
            </span>
          ) : (
            <span className="bg-[#003347] text-white text-xs font-medium px-3 py-1 rounded-full shadow-sm">
              In Stock
            </span>
          )}
        </div>
        
        {/* Brand Badge */}
        {product.brand && (
          <div className="absolute top-3 left-3 bg-white text-gray-800 text-xs font-bold px-2 py-1 rounded border border-gray-200">
            {product.brand}
          </div>
        )}
      </div>
      
      <div className="p-5 flex flex-col flex-1">
        <div className="text-xs text-gray-500 mb-1 flex justify-between">
          <span>{product.id}</span>
          {product.category && <span>{product.category.name}</span>}
        </div>
        <h3 className="font-bold text-gray-900 text-lg mb-1 leading-tight">{product.name}</h3>
        <p className="text-sm text-gray-500 mb-4">Unit: {product.unit || 'PC'}</p>
        
        <div className="mt-auto">
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-2xl font-black text-[#1A2766]">₹{product.price.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">MOQ: {product.moq} {product.unit}</p>
            </div>
            {currentQtyInCart > 0 && (
              <div className="bg-green-50 text-green-700 text-xs font-bold px-2 py-1 rounded">
                {currentQtyInCart} in cart
              </div>
            )}
          </div>

          <div className="flex space-x-2">
            {!product.isOos && (
              <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50">
                <button 
                  onClick={() => setQtyToAdd(Math.max(product.moq, qtyToAdd - 1))}
                  className="p-2 text-gray-500 hover:text-[#AE1B1E] transition-colors"
                  disabled={qtyToAdd <= product.moq}
                >
                  <Minus size={16} />
                </button>
                <input 
                  type="number" 
                  value={qtyToAdd}
                  onChange={(e) => setQtyToAdd(Math.max(product.moq, parseInt(e.target.value) || product.moq))}
                  className="w-12 text-center bg-transparent font-medium focus:outline-none"
                  min={product.moq}
                />
                <button 
                  onClick={() => setQtyToAdd(qtyToAdd + 1)}
                  className="p-2 text-gray-500 hover:text-[#1A2766] transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            )}
            
            <button 
              onClick={handleAdd}
              disabled={product.isOos}
              className={`flex-1 flex items-center justify-center space-x-2 rounded-lg py-2 font-medium transition-colors ${
                product.isOos 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-[#AE1B1E] text-white hover:bg-red-800'
              }`}
            >
              <span>Add</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
