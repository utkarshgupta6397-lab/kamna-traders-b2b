'use client';

import { useCartStore } from '@/store/cartStore';
import { Minus, Plus, Trash2, MessageCircle, ShoppingBag, X } from 'lucide-react';
import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';

export default function CartPanel() {
  const { items, updateQty, removeItem, getTotalPrice, clearCart } = useCartStore();
  const [submitting, setSubmitting] = useState(false);

  const totalQty = items.reduce((a, i) => a + i.qty, 0);

  const handleWhatsApp = async () => {
    if (!items.length) return;
    setSubmitting(true);
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      let msg = '*Kamna Traders Inquiry Terminal*\n\n';
      items.forEach(i => { msg += `${i.skuId} | ${i.name} | Qty: ${i.qty}\n`; });
      msg += `\nESTIMATED TOTAL: ${formatCurrency(getTotalPrice())}`;
      clearCart();
      window.open(`https://wa.me/15558246665?text=${encodeURIComponent(msg)}`, '_blank');
    } finally {
      setSubmitting(false);
    }
  };

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center bg-gray-50/30">
        <div className="w-16 h-16 bg-white border border-gray-100 rounded-lg flex items-center justify-center shadow-sm mb-4">
          <ShoppingBag size={28} className="text-gray-200" />
        </div>
        <p className="text-[14px] font-black text-gray-400 uppercase tracking-widest">No Active Inquiry</p>
        <p className="text-[12px] text-gray-300 mt-2 leading-snug">Add SKUs from the terminal to begin your bulk order process.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Line Items (POS Row Density: 40px) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {items.map(item => (
          <div key={item.skuId} className="flex items-center gap-2 h-[42px] px-2 bg-gray-50/50 hover:bg-gray-100/50 rounded border border-gray-100 group transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-gray-800 truncate leading-tight" title={item.name}>{item.name}</p>
              <p className="text-[9px] text-gray-400 font-mono font-bold">{item.skuId}</p>
            </div>
            
            {/* Minimal Stepper */}
            <div className="flex items-center bg-white border border-gray-200 rounded px-0.5 h-[28px]">
              <button
                onClick={() => updateQty(item.skuId, item.qty - (item.stepQty || item.moq))}
                className="w-6 h-full flex items-center justify-center text-gray-400 hover:text-red-600 transition-colors"
              >
                <Minus size={10} strokeWidth={4} />
              </button>
              <span className="w-8 text-center text-[12px] font-black text-[#1A2766]">{item.qty}</span>
              <button
                onClick={() => updateQty(item.skuId, item.qty + (item.stepQty || item.moq))}
                className="w-6 h-full flex items-center justify-center text-[#1A2766] hover:bg-blue-50 transition-colors"
              >
                <Plus size={10} strokeWidth={4} />
              </button>
            </div>

            <div className="w-[60px] text-right">
              <p className="text-[12px] font-black text-[#1A2766] tabular-nums">{formatCurrency(item.price * item.qty)}</p>
            </div>
            
            <button onClick={() => removeItem(item.skuId)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 p-1 transition-all">
              <X size={14} strokeWidth={3} />
            </button>
          </div>
        ))}
      </div>

      {/* POS Terminal Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50/50 space-y-3 flex-shrink-0">
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-bold text-gray-400 uppercase">
            <span>Total SKUs</span>
            <span>{items.length}</span>
          </div>
          <div className="flex justify-between text-[11px] font-bold text-gray-400 uppercase">
            <span>Total Quantity</span>
            <span>{totalQty}</span>
          </div>
          <div className="flex justify-between items-baseline pt-2">
            <span className="text-[13px] font-black text-[#1A2766] uppercase tracking-tighter">Inquiry Total</span>
            <span className="text-[20px] font-black text-[#AE1B1E] tabular-nums leading-none">{formatCurrency(getTotalPrice())}</span>
          </div>
        </div>

        <button
          onClick={handleWhatsApp}
          disabled={submitting}
          className="w-full h-[48px] flex items-center justify-center gap-2 bg-[#1A2766] text-white rounded-md font-black text-[14px] uppercase tracking-widest hover:bg-[#003347] transition-all disabled:opacity-50 shadow-md active:scale-[0.98]"
        >
          <MessageCircle size={18} strokeWidth={3} />
          {submitting ? 'Connecting...' : 'SUBMIT INQUIRY'}
        </button>
        
        <button 
          onClick={clearCart} 
          className="w-full text-[10px] text-gray-400 hover:text-red-500 font-black uppercase tracking-[0.2em] transition-colors"
        >
          Reset Terminal
        </button>
      </div>
    </div>
  );
}
