'use client';

import { useCartStore } from '@/store/cartStore';
import { Minus, Plus, Trash2, Printer, MessageSquare, X } from 'lucide-react';
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
      let msg = '*Kamna Traders Industrial Inquiry*\n\n';
      items.forEach(i => { msg += `${i.skuId} | ${i.name} | Qty: ${i.qty}\n`; });
      msg += `\nEST. TOTAL: ${formatCurrency(getTotalPrice())}`;
      clearCart();
      window.open(`https://wa.me/15558246665?text=${encodeURIComponent(msg)}`, '_blank');
    } finally {
      setSubmitting(false);
    }
  };

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center">
        <p className="text-[11px] font-[800] text-gray-300 uppercase tracking-[0.2em]">No Active Inquiry</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Compact Line Items (44px Rows) */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
        {items.map(item => (
          <div key={item.skuId} className="flex items-center gap-2 h-[44px] px-2 bg-gray-50/50 rounded border border-transparent hover:border-gray-100 group transition-all">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-gray-800 truncate leading-none mb-1">{item.name}</p>
              <p className="text-[10px] text-gray-400 font-mono font-bold leading-none">{item.skuId}</p>
            </div>
            
            <div className="flex items-center bg-white border border-gray-100 rounded h-[26px] p-0.5">
              <button onClick={() => updateQty(item.skuId, item.qty - (item.stepQty || item.moq))} className="w-6 h-full flex items-center justify-center text-gray-400 hover:text-red-600 transition-colors">
                <Minus size={10} strokeWidth={4} />
              </button>
              <span className="w-7 text-center text-[11px] font-black text-[#1A2766]">{item.qty}</span>
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

      {/* POS Total Section */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
        <div className="flex justify-between items-baseline mb-4">
          <span className="text-[11px] font-black text-[#1A2766] uppercase tracking-widest">Inquiry Total</span>
          <span className="text-[20px] font-black text-[#AE1B1E] tabular-nums">{formatCurrency(getTotalPrice())}</span>
        </div>

        <button
          onClick={handleWhatsApp}
          disabled={submitting}
          className="w-full h-[46px] flex items-center justify-center gap-2 bg-[#1A2766] text-white rounded-lg font-black text-[13px] uppercase tracking-widest hover:bg-[#003347] transition-all disabled:opacity-50 shadow-md active:scale-95"
        >
          <MessageSquare size={16} strokeWidth={3} />
          {submitting ? '...' : 'Send WhatsApp Inquiry'}
        </button>
        
        <button onClick={clearCart} className="w-full mt-3 text-[9px] text-gray-300 hover:text-red-500 font-black uppercase tracking-[0.2em] transition-colors">Reset Inquiry</button>
      </div>
    </div>
  );
}
