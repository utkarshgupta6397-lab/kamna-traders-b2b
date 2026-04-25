'use client';

import { useCartStore } from '@/store/cartStore';
import { Minus, Plus, Trash2, ArrowRight, Package } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';

export default function CartPage() {
  const { items, updateQty, removeItem, getTotalPrice, getTotalItems, clearCart } = useCartStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (items.length === 0) return;
    setIsSubmitting(true);

    try {
      // 1. Save Lead to Backend
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await response.json();

      // 2. Build WhatsApp Message
      let message = `*Kamna Traders Inquiry*\n`;
      if (data.leadId) {
        message += `Ref: ${data.leadId}\n\n`;
      } else {
        message += `\n`;
      }
      
      items.forEach(item => {
        message += `${item.skuId} x${item.qty}\n`;
      });

      // 3. Redirect to WhatsApp
      const waNumber = '15558246665';
      const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
      
      clearCart();
      window.location.href = waUrl;
    } catch (error) {
      console.error('Failed to submit lead', error);
      alert('There was an issue processing your request. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
        <p className="text-gray-500 mb-8">Looks like you haven't added any products to your cart yet.</p>
        <Link href="/" className="inline-flex items-center space-x-2 bg-[#1A2766] text-white px-8 py-3 rounded-full font-medium hover:bg-[#003347] transition-colors">
          <span>Browse Products</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 w-full">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 md:mb-8">Shopping Cart</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        <div className="md:col-span-2 space-y-4">
          {items.map(item => (
            <div key={item.skuId} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex-shrink-0 border border-gray-100 flex items-center justify-center overflow-hidden">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <Package size={20} className="text-gray-300" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 truncate">{item.name}</h3>
                <p className="text-[#1A2766] font-bold mt-1">{formatCurrency(item.price)}</p>
                <p className="text-xs text-gray-500 mt-1">MOQ: {item.moq}</p>
              </div>

              <div className="flex flex-col items-end gap-3">
                <button 
                  onClick={() => removeItem(item.skuId)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
                
                <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
                  <button 
                    onClick={() => updateQty(item.skuId, item.qty - (item.stepQty || item.moq))}
                    className="p-2 text-gray-500 hover:text-[#AE1B1E] hover:bg-gray-100 transition-colors"
                    disabled={item.qty <= item.moq}
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-10 text-center font-medium text-sm">{item.qty}</span>
                  <button 
                    onClick={() => updateQty(item.skuId, item.qty + (item.stepQty || item.moq))}
                    className="p-2 text-gray-500 hover:text-[#1A2766] hover:bg-gray-100 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="md:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-24">
            <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-4">Order Summary</h2>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-gray-600">
                <span>Total Items</span>
                <span className="font-medium text-gray-900">{getTotalItems()}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Total Amount (Est.)</span>
                <span className="font-medium text-gray-900">{formatCurrency(getTotalPrice())}</span>
              </div>
            </div>
            
            <div className="border-t pt-4 mb-6">
              <p className="text-xs text-gray-500 mb-4 text-center">
                Submitting will open WhatsApp to send your inquiry directly to our sales team.
              </p>
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`w-full flex items-center justify-center space-x-2 py-3 rounded-xl font-bold transition-colors ${
                  isSubmitting ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-[#AE1B1E] text-white hover:bg-red-800'
                }`}
              >
                <span>{isSubmitting ? 'Redirecting...' : 'Submit via WhatsApp'}</span>
                {!isSubmitting && <ArrowRight size={18} />}
              </button>
            </div>
            
            <button 
              onClick={clearCart}
              className="w-full text-center text-sm text-gray-500 hover:text-red-500 transition-colors"
            >
              Clear Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
