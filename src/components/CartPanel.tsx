'use client';

import { useCartStore } from '@/store/cartStore';
import { Minus, Plus, Trash2, MessageCircle, ShoppingBag } from 'lucide-react';
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
      let msg = '*Kamna Traders Inquiry*\n\n';
      items.forEach(i => { msg += `${i.skuId} - ${i.name} x${i.qty}\n`; });
      msg += `\nTotal: ${formatCurrency(getTotalPrice())}`;
      clearCart();
      window.open(`https://wa.me/15558246665?text=${encodeURIComponent(msg)}`, '_blank');
    } finally {
      setSubmitting(false);
    }
  };

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8 text-center px-4">
        <ShoppingBag size={32} className="text-gray-200 mb-2" />
        <p className="text-[13px] font-bold text-gray-400">Cart is empty</p>
        <p className="text-[11px] text-gray-300 mt-1 leading-tight">Add products to start your wholesale inquiry</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-3">
      {/* Items (Dense) */}
      <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
        {items.map(item => (
          <div key={item.skuId} className="flex items-center gap-2 py-1 border-b border-gray-50 last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-gray-800 truncate leading-tight" title={item.name}>{item.name}</p>
              <p className="text-[10px] text-gray-400 font-mono">{item.skuId}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => updateQty(item.skuId, item.qty - (item.stepQty || item.moq))}
                className="w-5 h-5 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100"
              >
                <Minus size={10} />
              </button>
              <span className="w-6 text-center text-[12px] font-bold text-gray-800">{item.qty}</span>
              <button
                onClick={() => updateQty(item.skuId, item.qty + (item.stepQty || item.moq))}
                className="w-5 h-5 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100"
              >
                <Plus size={10} />
              </button>
            </div>
            <div className="w-[70px] text-right">
              <p className="text-[12px] font-black text-[#1A2766]">{formatCurrency(item.price * item.qty)}</p>
            </div>
            <button onClick={() => removeItem(item.skuId)} className="text-gray-300 hover:text-red-400 p-1">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Summary (Compact) */}
      <div className="pt-2 border-t border-gray-100 space-y-2 mt-2">
        <div className="flex justify-between items-baseline text-[13px]">
          <span className="text-gray-500 font-medium">{totalQty} items</span>
          <span className="font-black text-[#1A2766] text-[15px]">{formatCurrency(getTotalPrice())}</span>
        </div>
        <button
          onClick={handleWhatsApp}
          disabled={submitting}
          className="w-full h-[44px] flex items-center justify-center gap-2 bg-[#25D366] text-white rounded-xl font-black text-[14px] hover:bg-[#1da851] transition-all disabled:opacity-50 shadow-sm"
        >
          <MessageCircle size={16} />
          {submitting ? 'Connecting...' : 'Order on WhatsApp'}
        </button>
        <button onClick={clearCart} className="w-full text-[10px] text-gray-400 hover:text-red-400 font-bold uppercase tracking-wider">
          Clear Order
        </button>
      </div>
    </div>
  );
}
