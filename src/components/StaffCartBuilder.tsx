'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Printer, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useStaffCartStore } from '@/store/staffCartStore';

type WarehouseOption = {
  id: string;
  name: string;
};

type StaffSku = {
  id: string;
  name: string;
  isOos?: boolean;
};

type CartItem = {
  skuId: string;
  name: string;
  qty: number;
};

type StaffCartBuilderProps = {
  warehouses: WarehouseOption[];
  skus: StaffSku[];
  staffId: string;
};

export default function StaffCartBuilder({ warehouses, skus, staffId }: StaffCartBuilderProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { 
    warehouseId, setWarehouseId, 
    customerName, setCustomerName, 
    notes, setNotes, 
    items: cartItems, addItem: storeAddItem, 
    removeItem, updateQty: storeUpdateQty, 
    clearCart 
  } = useStaffCartStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!warehouseId && warehouses.length > 0) {
      setWarehouseId(warehouses[0].id);
    }
  }, [warehouseId, warehouses, setWarehouseId]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (!mounted) return null;

  // Filter SKUs based on debounced search
  const filteredSkus = skus.filter((sku) =>
    sku.id.toLowerCase().includes(debouncedQuery.toLowerCase()) || 
    sku.name.toLowerCase().includes(debouncedQuery.toLowerCase())
  ).slice(0, 10);

  const addItem = (sku: StaffSku) => {
    storeAddItem({ skuId: sku.id, name: sku.name, qty: 1 });
    setSearchQuery('');
  };

  const updateQty = (skuId: string, qty: number) => {
    storeUpdateQty(skuId, qty);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId || !customerName || cartItems.length === 0) {
      toast.error('Required fields missing. Please select a warehouse and enter customer name.');
      return;
    }
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/staff/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId,
          customerName,
          notes,
          staffId,
          items: cartItems
        })
      });

      if (res.ok) {
        const data = await res.json();
        clearCart();
        // Redirect to print slip page
        router.push(`/staff/dashboard/print/${data.cartId}`);
      } else {
        toast.error('Unable to submit cart. Please check your connection and try again.');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error(error);
      toast.error('Network error. Unable to connect to server.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Cart Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse *</label>
              <select 
                value={warehouseId} 
                onChange={e => setWarehouseId(e.target.value)}
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#1A2766] outline-none bg-white"
                required
              >
                <option value="">Select Warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
              <input 
                type="text" 
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#1A2766] outline-none"
                placeholder="Enter customer name"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
              <input 
                type="text" 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#1A2766] outline-none"
                placeholder="Any special instructions..."
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Add Items</h2>
          <div className="relative mb-6">
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 pl-10 focus:ring-2 focus:ring-[#1A2766] outline-none"
              placeholder="Search by SKU ID or Name..."
            />
            <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
            
            {searchQuery && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredSkus.map((sku) => (
                  <div
                    key={sku.id}
                    className="px-3 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100 flex justify-between items-center gap-2"
                    onClick={() => addItem(sku)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 text-sm truncate">{sku.name}</p>
                        {sku.isOos && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-[#AE1B1E] flex-shrink-0">
                            OOS
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 font-mono">{sku.id}</p>
                    </div>
                    <Plus size={16} className="text-[#1A2766] flex-shrink-0" />
                  </div>
                ))}
                {filteredSkus.length === 0 && (
                  <div className="p-4 text-center text-gray-500 text-sm">No products found.</div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {cartItems.map(item => (
              <div key={item.skuId} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{item.skuId}</p>
                </div>
                <div className="flex items-center gap-4">
                  <input 
                    type="number" 
                    value={item.qty}
                    onChange={e => updateQty(item.skuId, parseInt(e.target.value) || 0)}
                    className="w-16 border rounded p-1 text-center font-medium"
                    min="1"
                  />
                  <button 
                    onClick={() => updateQty(item.skuId, 0)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
            {cartItems.length === 0 && (
              <p className="text-center text-gray-500 py-8 border-2 border-dashed border-gray-200 rounded-lg">
                No items added yet. Search and click to add.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-1">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-24">
          <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-4">Action</h2>
          
          <div className="space-y-4 mb-6">
            <div className="flex justify-between text-gray-600">
              <span>Total Items</span>
              <span className="font-medium text-gray-900">{cartItems.reduce((acc, i) => acc + i.qty, 0)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Unique SKUs</span>
              <span className="font-medium text-gray-900">{cartItems.length}</span>
            </div>
          </div>
          
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting || cartItems.length === 0 || !warehouseId || !customerName}
            className={`w-full flex items-center justify-center space-x-2 py-3 rounded-xl font-bold transition-colors ${
              isSubmitting || cartItems.length === 0 || !warehouseId || !customerName 
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                : 'bg-[#1A2766] text-white hover:bg-[#003347]'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Printer size={18} />
                <span>Generate & Print Slips</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
