'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Save } from 'lucide-react';

interface InventoryItem {
  id: string;
  warehouse: { name: string };
  sku: { id: string; name: string };
  zone: string | null;
  qty: number;
  isOos: boolean;
}

export default function InventoryTableClient({ items }: { items: InventoryItem[] }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkZone, setBulkZone] = useState('');
  const [updating, setUpdating] = useState(false);

  const toggleAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map(i => i.id));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.length === 0 || updating) return;

    setUpdating(true);
    try {
      const res = await fetch('/api/admin/inventory/update-zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryIds: selectedIds, zone: bulkZone })
      });

      if (res.ok) {
        setSelectedIds([]);
        setBulkZone('');
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Update failed');
      }
    } catch (err: any) {
      alert(err.message || 'Network error');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Bulk Controls */}
      <div className={`flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100 transition-all ${selectedIds.length > 0 ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Bulk Zone:</span>
          <input 
            type="text" 
            placeholder="e.g. A1" 
            value={bulkZone}
            onChange={(e) => setBulkZone(e.target.value.toUpperCase())}
            className="border rounded-lg px-3 py-1.5 text-sm w-32 focus:ring-2 focus:ring-[#1A2766] outline-none"
          />
        </div>
        <button 
          onClick={handleBulkUpdate}
          disabled={updating || selectedIds.length === 0}
          className="bg-[#1A2766] text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-[#003347] disabled:opacity-50"
        >
          {updating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Update {selectedIds.length} Selected
        </button>
        {selectedIds.length > 0 && (
          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
            {selectedIds.length} records active
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-500 text-xs uppercase tracking-wider">
                <th className="p-3 w-10">
                  <input 
                    type="checkbox" 
                    checked={items.length > 0 && selectedIds.length === items.length}
                    onChange={toggleAll}
                    className="rounded border-gray-300 text-[#1A2766] focus:ring-[#1A2766]"
                  />
                </th>
                <th className="p-3">Warehouse</th>
                <th className="p-3">SKU ID</th>
                <th className="p-3">Product</th>
                <th className="p-3">Zone</th>
                <th className="p-3 text-right">Qty</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-gray-700">
              {items.map(item => (
                <tr 
                  key={item.id} 
                  className={`hover:bg-gray-50/50 transition-colors ${selectedIds.includes(item.id) ? 'bg-blue-50/30' : ''}`}
                >
                  <td className="p-3">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleOne(item.id)}
                      className="rounded border-gray-300 text-[#1A2766] focus:ring-[#1A2766]"
                    />
                  </td>
                  <td className="p-3 text-xs">{item.warehouse.name}</td>
                  <td className="p-3 font-mono text-xs font-bold">{item.sku.id}</td>
                  <td className="p-3 text-xs">{item.sku.name}</td>
                  <td className="p-3 text-xs">
                    {item.zone ? (
                      <span className="bg-gray-100 px-2 py-0.5 rounded font-bold text-gray-600">{item.zone}</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-semibold text-xs">{item.qty}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${item.isOos ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {item.isOos ? 'OOS' : 'In Stock'}
                    </span>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400 font-medium">No inventory records found for current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
