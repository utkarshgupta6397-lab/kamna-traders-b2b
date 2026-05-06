'use client';

import { useCartStore } from '@/store/cartStore';
import { Minus, Plus, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function CartPanel() {
  const { items, updateQty, removeItem, getTotalPrice, clearCart } = useCartStore();

  const totalQty = items.reduce((a, i) => a + i.qty, 0);

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
    <div className="flex flex-col h-full bg-white">
      {/* Compact Line Items (42px Rows) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {items.map(item => (
          <div key={item.skuId} className="flex items-center gap-2 h-[42px] px-3 bg-[#F9FAFB] rounded-lg border border-transparent hover:border-[#E7EAF0] group transition-all">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-[700] text-[#111827] truncate leading-tight">{item.name}</p>
              <p className="text-[10px] text-gray-400 font-mono font-bold leading-none">{item.skuId}</p>
            </div>
            
            <div className="flex items-center bg-white border border-[#E7EAF0] rounded-md h-[28px] p-0.5">
              <button onClick={() => updateQty(item.skuId, item.qty - (item.stepQty || item.moq))} className="w-6 h-full flex items-center justify-center text-gray-400 hover:text-[#AE1B1E] transition-colors">
                <Minus size={10} strokeWidth={4} />
              </button>
              <span className="w-7 text-center text-[12px] font-[800] text-[#1A2766] tabular-nums">{item.qty}</span>
              <button onClick={() => updateQty(item.skuId, item.qty + (item.stepQty || item.moq))} className="w-6 h-full flex items-center justify-center text-[#1A2766] hover:bg-blue-50 transition-colors">
                <Plus size={10} strokeWidth={4} />
              </button>
            </div>

            <button onClick={() => removeItem(item.skuId)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 p-1 transition-all">
              <X size={14} strokeWidth={3} />
            </button>
          </div>
        ))}
      </div>

      {/* Production-Ready Total Section */}
      <div className="p-4 border-t border-[#F1F3F7] bg-[#F9FAFB] flex-shrink-0">
        <div className="flex justify-between items-baseline mb-4">
          <span className="text-[11px] font-[800] text-gray-500 uppercase tracking-widest">Total Value</span>
          <span className="text-[18px] font-[800] text-[#111827] tabular-nums">{formatCurrency(getTotalPrice())}</span>
        </div>
        
        <button onClick={clearCart} className="w-full mt-4 text-[10px] text-gray-300 hover:text-red-500 font-bold uppercase tracking-widest transition-colors">Clear Selection</button>
      </div>
    </div>
  );
}
