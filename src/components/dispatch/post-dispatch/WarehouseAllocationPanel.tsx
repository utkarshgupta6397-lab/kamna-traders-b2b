'use client';

import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { validateQuantityPrecision, isValidPrecisionInput } from '@/lib/uom-precision';
import { formatShortUom } from '@/lib/stock-deduction-service';

export default function WarehouseAllocationPanel({ lineData, invoiceId, onSuccess, onCancel }: any) {
  const isDecimal = Boolean(lineData.resolvedSku?.isDecimal);
  const existing = !lineData.allocation?.isExploded ? (lineData.allocation?.allocationData || []) : [];
  
  // Default to expected warehouse if nothing is allocated yet
  const defaultEntries = existing.length > 0 ? existing : (lineData.expectedWarehouse && lineData.resolvedSku ? [{
    skuId: lineData.resolvedSku.id,
    skuName: lineData.resolvedSku.name,
    warehouseId: lineData.expectedWarehouse.id,
    warehouseName: lineData.expectedWarehouse.name,
    qty: lineData.line.quantity,
    uom: lineData.resolvedSku.unit || 'UNIT'
  }] : []);

  const [entries, setEntries] = useState<any[]>(defaultEntries);
  const [loading, setLoading] = useState(false);
  const [activeWarehouses, setActiveWarehouses] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/dispatch/post-dispatch/warehouses')
      .then(res => res.json())
      .then(data => setActiveWarehouses(data))
      .catch(console.error);
  }, []);

  const handleQtyChange = (idx: number, newQty: string) => {
    if (!isValidPrecisionInput(newQty, isDecimal, false)) {
      return;
    }
    const qty = newQty === '' ? '' : (parseFloat(newQty) || 0);
    const newEntries = [...entries];
    newEntries[idx].qty = qty;
    setEntries(newEntries);
  };

  const removeEntry = (idx: number) => {
    setEntries(entries.filter((_, i) => i !== idx));
  };

  const addWarehouse = (whId: string) => {
    const wh = activeWarehouses.find(w => w.id === whId);
    if (!wh) return;
    if (entries.some(e => e.warehouseId === whId)) {
      toast.error('Warehouse already added');
      return;
    }
    setEntries([...entries, {
      skuId: lineData.resolvedSku?.id || '',
      skuName: lineData.resolvedSku?.name || lineData.line.itemName,
      warehouseId: wh.id,
      warehouseName: wh.name,
      qty: 0,
      uom: lineData.resolvedSku?.unit || 'UNIT'
    }]);
  };

  const save = async () => {
    if (!lineData.resolvedSku) {
      toast.error('Item must be mapped to a SKU before allocating');
      return;
    }

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const check = validateQuantityPrecision(e.qty, isDecimal);
      if (!check.valid) {
        toast.error(`Row #${i + 1} (${e.warehouseName}): ${check.error}`);
        return;
      }
      if (Number(e.qty) <= 0) {
        toast.error(`Row #${i + 1}: Quantity must be greater than 0.`);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/dispatch/post-dispatch/${invoiceId}/stock-deduction/${lineData.line.id}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocations: entries,
          isExploded: false,
          expectedSkuId: lineData.resolvedSku.id,
          expectedWarehouseId: lineData.expectedWarehouse?.id || null,
          expectedQty: lineData.line.quantity,
          expectedUom: lineData.resolvedSku.unit || 'UNIT'
        })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to save allocation');
      if (resData.autoDeducted) {
        toast.success('Exact match confirmed: Stock deducted automatically (Auto-Approved)');
      } else {
        toast.success('Allocation saved as draft (Approval Required)');
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setLoading(false); }
  };

  const totalAllocated = entries.reduce((s, e) => s + (Number(e.qty) || 0), 0);
  const remaining = Math.max(0, lineData.line.quantity - totalAllocated);

  if (lineData.mappingRequired) {
    return <div className="text-sm text-red-500 font-bold p-4 bg-red-50 rounded">Cannot allocate: Item mapping required. Please map the Zoho item to a local SKU first.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h5 className="font-bold text-xs text-gray-700">Warehouse Allocation</h5>
        <div className="flex gap-4 text-xs font-mono">
          <span>Expected: <strong>{lineData.line.quantity}</strong></span>
          <span>Allocated: <strong>{totalAllocated}</strong></span>
          <span className={remaining > 0 ? 'text-red-500' : 'text-emerald-500'}>Remaining: <strong>{remaining}</strong></span>
        </div>
      </div>

      <div className="border rounded-lg bg-white overflow-x-auto text-xs">
        <table className="w-full text-left min-w-[360px]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-2 font-semibold min-w-[140px]">Warehouse</th>
              <th className="p-2 font-semibold w-36 sm:w-44">Allocated Qty</th>
              <th className="p-2 font-semibold w-16">UOM</th>
              <th className="p-2 w-10 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((entry, idx) => (
              <tr key={idx}>
                <td className="p-2 font-medium">{entry.warehouseName}</td>
                <td className="p-2">
                  <input
                    type="number"
                    min="0"
                    step={isDecimal ? "0.01" : "1"}
                    value={entry.qty}
                    onChange={e => handleQtyChange(idx, e.target.value)}
                    className="border rounded px-2 py-1 w-20 sm:w-24 outline-none focus:ring-1 font-semibold"
                  />
                </td>
                <td className="p-2 text-gray-500 font-mono font-medium" title={entry.uom}>
                  {formatShortUom(entry.uom)}
                </td>
                <td className="p-2 text-center">
                  <button onClick={() => removeEntry(idx)} className="text-red-400 hover:text-red-600 p-1 inline-flex items-center justify-center">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="p-2 border-t bg-gray-50">
          <select 
            onChange={(e) => { if(e.target.value) addWarehouse(e.target.value); e.target.value = ''; }}
            className="text-xs border rounded p-1 bg-white outline-none"
          >
            <option value="">+ Add Warehouse...</option>
            {activeWarehouses.filter(w => !entries.some(e => e.warehouseId === w.id)).map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-lg">Cancel</button>
        <button onClick={save} disabled={loading || entries.length === 0} className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">
          Save Allocation
        </button>
      </div>
    </div>
  );
}
