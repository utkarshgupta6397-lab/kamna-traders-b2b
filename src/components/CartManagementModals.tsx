'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, Trash2, Save, AlertTriangle, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/lib/utils';

interface CartItem {
  id: string;
  skuId: string;
  qty: number;
  originalQty: number | null;

  sku: {
    id: string;
    name: string;
    unit: string | null;
    price: number;
  };
}

interface Cart {
  id: string;
  customerName: string;
  dispatchSlipNumber: string | null;
  warehouseName: string;
  items: CartItem[];
}

interface Props {
  cartId: string | null;
  type: 'view' | 'edit' | 'delete' | null;
  onClose: () => void;
  onSuccess: () => void;
}

const CartManagementModals = React.memo(({ cartId, type, onClose, onSuccess }: Props) => {

  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<Cart | null>(null);
  const [editItems, setEditItems] = useState<{ skuId: string, qty: number, originalQty: number, name: string, unit: string, price: number }[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (cartId && (type === 'view' || type === 'edit' || type === 'delete')) {
      setLoading(true);
      fetch(`/api/staff/carts/${cartId}`)
        .then(res => res.json())
        .then(data => {
          setCart(data);
          if (type === 'edit') {
            setEditItems(data.items.map((item: any) => ({
              skuId: item.skuId,
              qty: item.qty,
              originalQty: item.originalQty ?? item.qty,
              name: item.sku.name,
              unit: item.sku.unit || 'PCS',
              price: item.sku.price
            })));

          }
        })
        .catch(err => toast.error('Failed to load cart details'))
        .finally(() => setLoading(false));
    } else {
      setCart(null);
      setEditItems([]);
      setConfirmDelete(false);
    }
  }, [cartId, type]);

  const handleUpdate = async () => {
    if (!cart) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/carts/${cart.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          items: editItems.filter(i => i.qty > 0).map(i => ({ skuId: i.skuId, qty: i.qty })) 
        })

      });
      if (!res.ok) throw new Error('Update failed');
      toast.success('Cart updated successfully');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error('Failed to update cart');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!cart) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/staff/carts/${cart.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Cart deleted successfully');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error('Failed to delete cart');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!type || !cartId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="text-lg font-black text-[#1A2766] uppercase tracking-tight">
              {type === 'view' ? 'View Cart' : type === 'edit' ? 'Edit Cart' : 'Delete Cart'}
            </h3>
            {cart && (
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                {cart.dispatchSlipNumber || cart.id} • {cart.customerName}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="animate-spin text-[#1A2766]" size={32} />
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Loading Details...</p>
            </div>
          ) : !cart ? (
            <div className="text-center py-20 text-gray-400">Cart not found</div>
          ) : type === 'view' ? (
            <div className="space-y-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">SKU</th>
                    <th className="py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Product</th>
                    <th className="py-2 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Qty</th>
                    <th className="py-2 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {cart.items.map((item) => (
                    <tr key={item.id} className="group">
                      <td className="py-3 font-mono text-[11px] font-bold text-[#1A2766]">{item.skuId}</td>
                      <td className="py-3">
                        <div className="text-[13px] font-bold text-gray-900">{item.sku.name}</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase">{item.sku.unit || 'PCS'}</div>
                      </td>
                      <td className="py-3 text-center">
                        <span className="text-[13px] font-black text-[#1A2766]">{item.qty}</span>
                      </td>
                      <td className="py-3 text-right">
                        <span className="text-[13px] font-black text-[#1A2766] tabular-nums">
                          {formatCurrency(item.qty * item.sku.price)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-100 bg-gray-50/50">
                    <td colSpan={2} className="py-3 px-2 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Grand Total</td>
                    <td className="py-3 text-center text-[13px] font-black text-[#1A2766]">
                      {cart.items.reduce((acc, item) => acc + item.qty, 0)}
                    </td>
                    <td className="py-3 px-2 text-right text-[15px] font-black text-[#1A2766]">
                      {formatCurrency(cart.items.reduce((acc, item) => acc + (item.qty * item.sku.price), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : type === 'edit' ? (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex gap-3">
                <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] font-bold text-amber-800 leading-relaxed">
                  This tool is for corrections/reversals only. You <b>cannot increase</b> quantities beyond the originally drafted amount.
                </p>
              </div>


              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr>
                    <th className="px-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Product</th>
                    <th className="px-2 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest w-32">Quantity</th>
                    <th className="px-2 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {editItems.map((item, idx) => (
                    <tr key={item.skuId} className={`bg-gray-50 rounded-lg overflow-hidden group transition-all duration-300 ${item.qty === 0 ? 'opacity-40 grayscale' : ''}`}>

                      <td className="px-3 py-3 rounded-l-xl border-y border-l border-transparent group-hover:border-gray-200 group-hover:bg-white transition-all">
                        <div className="text-[11px] font-mono font-bold text-gray-400 leading-none mb-1">{item.skuId}</div>
                        <div className={`text-[13px] font-bold text-gray-900 leading-tight transition-all ${item.qty === 0 ? 'line-through' : ''}`}>
                          {item.name}
                        </div>
                        {item.qty === 0 && (
                          <div className="mt-1">
                            <span className="text-[8px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase tracking-tighter animate-pulse">
                              Removing on Save
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3 border-y border-transparent group-hover:border-gray-200 group-hover:bg-white transition-all">
                        <div className="flex flex-col items-center">
                          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1 shadow-sm focus-within:border-[#1A2766] transition-all">
                            <input
                              type="number"
                              min="0"
                              max={item.originalQty}
                              value={item.qty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                if (val > item.originalQty) {
                                  toast.error(`Cannot exceed original quantity (${item.originalQty})`, { id: `limit-${item.skuId}` });
                                  return;
                                }
                                setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, qty: val } : it));
                              }}
                              className="w-full bg-transparent text-[13px] font-black text-[#1A2766] outline-none text-center"
                            />
                            <span className="text-[10px] font-black text-gray-400 uppercase">{item.unit}</span>
                          </div>
                          <div className="text-[9px] font-black text-gray-300 uppercase tracking-tighter mt-1">
                            Max: {item.originalQty}
                          </div>
                        </div>

                      </td>
                      <td className="px-3 py-3 rounded-r-xl border-y border-r border-transparent group-hover:border-gray-200 group-hover:bg-white transition-all text-right">
                        <button
                          onClick={() => setEditItems(prev => prev.filter((_, i) => i !== idx))}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Remove from cart"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {editItems.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed border-gray-100 rounded-2xl">
                  <p className="text-xs font-black text-gray-300 uppercase tracking-widest">No items in cart</p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-6 space-y-6">
              {!confirmDelete ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
                    <Trash2 size={32} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-lg font-black text-gray-900 uppercase tracking-tight">Delete this cart?</h4>
                    <p className="text-sm text-gray-500 font-medium max-w-sm mx-auto">
                      Deleting this cart will restore all quantities back to the warehouse inventory. This action cannot be undone.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                  <div className="w-16 h-16 bg-red-600 text-white rounded-full flex items-center justify-center mx-auto shadow-xl shadow-red-200">
                    <AlertTriangle size={32} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xl font-black text-red-600 uppercase tracking-tight">Absolute Confirmation</h4>
                    <p className="text-sm text-gray-600 font-black max-w-sm mx-auto">
                      Are you absolutely sure you want to delete <span className="text-gray-900 underline decoration-red-200 decoration-4">{cart.dispatchSlipNumber || cart.id}</span>?
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading || isDeleting}
            className="px-4 py-2 text-[11px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          
          {type === 'edit' && (
            <button
              onClick={handleUpdate}
              disabled={loading || editItems.length === 0}
              className="px-6 py-2 bg-[#1A2766] text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:shadow-lg hover:shadow-blue-900/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Changes
            </button>
          )}

          {type === 'delete' && (
            <button
              onClick={() => {
                if (confirmDelete) handleDelete();
                else setConfirmDelete(true);
              }}
              disabled={isDeleting}
              className={`px-6 py-2 ${confirmDelete ? 'bg-red-600' : 'bg-red-50 text-red-600'} text-[11px] font-black uppercase tracking-widest rounded-xl hover:shadow-lg transition-all flex items-center gap-2`}
            >
              {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {confirmDelete ? 'Yes, Delete Permanently' : 'Delete Cart'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default CartManagementModals;
