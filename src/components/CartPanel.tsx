'use client';

import { useCartStore } from '@/store/cartStore';
import { Minus, Plus, Trash2, MessageCircle, ShoppingBag } from 'lucide-react';
import { useState } from 'react';

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
      msg += `\nTotal: ₹${getTotalPrice().toFixed(0)}`;
      clearCart();
      window.open(`https://wa.me/15558246665?text=${encodeURIComponent(msg)}`, '_blank');
    } finally {
      setSubmitting(false);
    }
  };

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-10 text-center">
        <ShoppingBag size={40} className="text-gray-200 mb-3" />
        <p className="text-sm font-medium text-gray-400">Cart is empty</p>
        <p className="text-xs text-gray-300 mt-1">Add products to get started</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Items */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {items.map(item => (
          <div key={item.skuId} className="flex items-center gap-2 py-1.5 border-b border-gray-100">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
              <p className="text-[10px] text-gray-400 font-mono">{item.skuId}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => updateQty(item.skuId, item.qty - (item.stepQty || item.moq))}
                className="w-5 h-5 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100"
              >
                <Minus size={10} />
              </button>
              <span className="w-7 text-center text-xs font-bold text-gray-800">{item.qty}</span>
              <button
                onClick={() => updateQty(item.skuId, item.qty + (item.stepQty || item.moq))}
                className="w-5 h-5 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100"
              >
                <Plus size={10} />
              </button>
            </div>
            <div className="w-14 text-right">
              <p className="text-xs font-bold text-[#1A2766]">₹{(item.price * item.qty).toFixed(0)}</p>
            </div>
            <button onClick={() => removeItem(item.skuId)} className="text-gray-300 hover:text-red-400 transition-colors">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="pt-3 border-t border-gray-100 space-y-3 mt-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{totalQty} items</span>
          <span className="font-black text-[#1A2766]">₹{getTotalPrice().toFixed(0)}</span>
        </div>
        <button
          onClick={handleWhatsApp}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white py-2.5 rounded-xl font-bold text-sm hover:bg-[#1da851] transition-colors disabled:opacity-50"
        >
          <MessageCircle size={16} />
          {submitting ? 'Opening…' : 'Order via WhatsApp'}
        </button>
        <button onClick={clearCart} className="w-full text-xs text-gray-400 hover:text-red-400 transition-colors">
          Clear cart
        </button>
      </div>
    </div>
  );
}
