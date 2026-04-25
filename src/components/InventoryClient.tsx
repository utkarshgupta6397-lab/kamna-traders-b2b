'use client';

import { useState } from 'react';

interface Warehouse { id: string; name: string; }
interface Sku { id: string; name: string; }

interface Props {
  warehouses: Warehouse[];
  skus: Sku[];
  updateAction: (data: FormData) => Promise<void>;
}

export default function InventoryClient({ warehouses, skus, updateAction }: Props) {
  const [search, setSearch] = useState('');
  const [selectedSku, setSelectedSku] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredSkus = skus.filter(s => 
    s.id.toLowerCase().includes(search.toLowerCase()) || 
    s.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 50); // limit to 50 for performance

  const handleSelectSku = (skuId: string, skuName: string) => {
    setSelectedSku(skuId);
    setSearch(`${skuId} - ${skuName}`);
    setShowDropdown(false);
  };

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
      <h2 className="text-sm font-semibold mb-3 text-gray-600 uppercase tracking-wider">Update Inventory</h2>
      <form action={updateAction} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-start">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Warehouse *</label>
          <select name="warehouseId" required className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none bg-white">
            <option value="">Select Warehouse</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        
        <div className="relative md:col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">SKU *</label>
          <input type="hidden" name="skuId" value={selectedSku} required />
          <input 
            type="text" 
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedSku('');
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search by SKU ID or Name..."
            className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none"
            required={!selectedSku}
          />
          {showDropdown && search && !selectedSku && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredSkus.length > 0 ? (
                filteredSkus.map(s => (
                  <div 
                    key={s.id} 
                    className="p-2 text-sm hover:bg-gray-100 cursor-pointer"
                    onClick={() => handleSelectSku(s.id, s.name)}
                  >
                    <span className="font-mono font-bold text-xs">{s.id}</span> - {s.name}
                  </div>
                ))
              ) : (
                <div className="p-2 text-sm text-gray-500">No SKUs found</div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Quantity *</label>
          <input type="number" min="0" name="qty" required className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none" defaultValue="0" />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Zone (Optional)</label>
          <div className="flex gap-2">
            <input type="text" name="zone" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none" placeholder="e.g. A1" />
            <button type="submit" className="bg-[#1A2766] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#003347] transition-colors whitespace-nowrap">
              Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
