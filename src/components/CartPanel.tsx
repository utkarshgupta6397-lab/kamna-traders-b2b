'use client';

import { useCartStore, CartItem } from '@/store/cartStore';
import { Minus, Plus, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useState, useEffect } from 'react';

// Sub-component for individual rows to manage local edit state
function CartRow({ item, index, updateQty, removeItem }: { 
  item: CartItem, 
  index: number, 
  updateQty: (id: string, q: number) => void,
  removeItem: (id: string) => void
}) {
  const [editValue, setEditValue] = useState(item.qty.toString());

  // Sync local state when external qty changes (e.g. from ProductCard)
  useEffect(() => {
    setEditValue(item.qty.toString());
  }, [item.qty]);

  const commitChange = () => {
    const num = parseInt(editValue, 10);
    // If empty or invalid, revert to previous valid qty
    if (isNaN(num) || editValue === '') {
      setEditValue(item.qty.toString());
      return;
    }
    // If 0 or negative, revert to previous (User said revert gracefully, don't delete)
    if (num <= 0) {
      setEditValue(item.qty.toString());
      return;
    }
    updateQty(item.skuId, num);
  };

  const handleInputChange = (val: string) => {
    // Only allow digits or empty string
    const sanitized = val.replace(/\D/g, '');
    setEditValue(sanitized);
  };

  return (
    <div className="grid grid-cols-[16px_1fr_64px_34px_18px] gap-2 px-3 py-1.5 border-b border-[#F1F5F9] hover:bg-[#F1F5F9]/50 transition-colors group items-center">
      {/* 1. Sequence */}
      <div className="text-[10px] font-bold text-slate-300 tabular-nums">
        {index + 1}
      </div>

      {/* 2. Product Column — Dominant */}
      <div className="min-w-0 flex flex-col justify-center">
        <p className="text-[12.5px] font-[700] text-slate-900 leading-[1.2] break-words whitespace-normal" title={item.name}>
          {item.name}
        </p>
        <p className="text-[9.5px] text-slate-400 font-mono font-bold uppercase tracking-tight leading-none mt-0.5">
          {item.skuId}
        </p>
      </div>

      {/* 3. Compact Qty Controls — Stable local state */}
      <div className="flex items-center gap-1">
        <button 
          onClick={() => updateQty(item.skuId, item.qty - (item.stepQty || 1))}
          className="w-[18px] h-[18px] flex items-center justify-center rounded bg-red-50 text-red-600 hover:bg-red-100 active:scale-90 transition-all"
        >
          <Minus size={10} strokeWidth={4} />
        </button>
        
        <input
          type="text"
          value={editValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={commitChange}
          onKeyDown={(e) => e.key === 'Enter' && commitChange()}
          className="w-[24px] h-[18px] text-center text-[11px] font-black text-slate-800 bg-slate-50 border border-slate-200 rounded outline-none tabular-nums focus:border-slate-400 focus:bg-white transition-colors"
          maxLength={3}
        />

        <button 
          onClick={() => updateQty(item.skuId, item.qty + (item.stepQty || 1))}
          className="w-[18px] h-[18px] flex items-center justify-center rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 active:scale-90 transition-all"
        >
          <Plus size={10} strokeWidth={4} />
        </button>
      </div>
      
      {/* 4. Dedicated UOM Column — No Overlap */}
      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter opacity-70 truncate text-center">
        {item.unit ? item.unit.slice(0, 4) : 'UNIT'}
      </div>

      {/* 5. Tiny Remove Utility */}
      <div className="flex justify-end">
        <button 
          onClick={() => removeItem(item.skuId)}
          className="text-slate-300 hover:text-red-500 transition-colors p-0.5"
          title="Remove"
        >
          <X size={12} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}

export default function CartPanel() {
  const { items, updateQty, removeItem, getTotalPrice, clearCart } = useCartStore();

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 px-6 text-center opacity-40">
        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
          <X size={20} className="text-gray-300" />
        </div>
        <p className="text-[11px] font-[800] text-gray-400 uppercase tracking-widest">Bin is Empty</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden select-none">
      {/* ERP Style Header — Ultra Dense 5-Column Grid */}
      <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-3 py-1 grid grid-cols-[16px_1fr_64px_34px_18px] gap-2 items-center">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">#</span>
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Product & SKU</span>
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter text-center">Qty</span>
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter text-center">UOM</span>
        <span className="text-right"></span>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {items.map((item, index) => (
          <CartRow 
            key={item.skuId} 
            item={item} 
            index={index} 
            updateQty={updateQty} 
            removeItem={removeItem} 
          />
        ))}
      </div>

      {/* Bottom Summary */}
      <div className="p-3 border-t border-[#E2E8F0] bg-white flex-shrink-0">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Value</span>
          <span className="text-[18px] font-black text-slate-900 tabular-nums tracking-tighter">
            {formatCurrency(getTotalPrice())}
          </span>
        </div>
        <div className="flex justify-between items-center text-[9.5px] font-bold text-slate-400 uppercase tracking-tight">
          <div className="flex items-center gap-2">
            <span>{items.length} SKUs</span>
            <span className="text-slate-200">|</span>
            <span>{items.reduce((acc, i) => acc + i.qty, 0)} Items</span>
          </div>
          <button 
            onClick={clearCart}
            className="text-slate-300 hover:text-red-500 transition-colors hover:underline underline-offset-2"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
}
