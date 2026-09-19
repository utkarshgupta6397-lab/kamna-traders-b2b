'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Trash2, Search, Plus, AlertCircle, Loader2, PackageCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatShortUom } from '@/lib/stock-deduction-service';
import { validateQuantityPrecision, isValidPrecisionInput } from '@/lib/uom-precision';

interface ManualItemRow {
  skuId: string;
  skuName: string;
  skuCode?: string;
  warehouseId: string;
  warehouseName: string;
  qty: number | string;
  uom: string;
  isDecimal?: boolean;
}

interface Props {
  lineData: any;
  invoiceId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ManualItemSelectionPanel({ lineData, invoiceId, onSuccess, onCancel }: Props) {
  const existing = lineData.allocation?.isExploded ? (lineData.allocation?.allocationData || []) : [];
  const [entries, setEntries] = useState<ManualItemRow[]>(existing);
  const [loading, setLoading] = useState(false);
  const [activeWarehouses, setActiveWarehouses] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const originalQty = Number(lineData.line.quantity) || 0;
  const originalUom = formatShortUom(lineData.line.uom || lineData.resolvedSku?.unit || 'Units');
  const originalItemName = lineData.line.itemName;

  // Calculate cumulative component count and total units
  const totalComponentUnits = useMemo(() => {
    return entries.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  }, [entries]);

  // Check for duplicate SKU + warehouse pairs
  const duplicateIndices = useMemo(() => {
    const seen = new Map<string, number>();
    const dupes = new Set<number>();
    entries.forEach((entry, idx) => {
      if (!entry.skuId || !entry.warehouseId) return;
      const key = `${entry.skuId}___${entry.warehouseId}`;
      if (seen.has(key)) {
        dupes.add(seen.get(key)!);
        dupes.add(idx);
      } else {
        seen.set(key, idx);
      }
    });
    return dupes;
  }, [entries]);

  // Validate each row for saving
  const hasInvalidRows = useMemo(() => {
    if (entries.length === 0) return true;
    if (duplicateIndices.size > 0) return true;
    return entries.some(entry => {
      if (!entry.skuId || !entry.warehouseId) return true;
      const numQty = typeof entry.qty === 'number' ? entry.qty : parseFloat(String(entry.qty));
      if (isNaN(numQty) || numQty <= 0) return true;
      const precisionCheck = validateQuantityPrecision(entry.qty, Boolean(entry.isDecimal));
      return !precisionCheck.valid;
    });
  }, [entries, duplicateIndices]);

  useEffect(() => {
    fetch('/api/dispatch/post-dispatch/warehouses')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setActiveWarehouses(data);
        }
      })
      .catch(console.error);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = search.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearching(false);
      setHasSearched(false);
      setSearchError(null);
      return;
    }

    setSearching(true);
    setSearchError(null);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/dispatch/post-dispatch/skus/search?q=${encodeURIComponent(trimmed)}`);
        if (!res.ok) {
          throw new Error('Failed to search local catalog');
        }
        const data = await res.json();
        const skus = Array.isArray(data?.skus) ? data.skus : (Array.isArray(data) ? data : []);
        setSearchResults(skus);
        setHasSearched(true);
      } catch (e: any) {
        console.error('[ManualItemSearch]', e);
        setSearchError(e.message || 'Error searching ERP items');
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [search]);

  const addSku = (sku: any) => {
    // If the expected warehouse is valid, use it; otherwise leave empty so user explicitly picks
    const initialWhId = lineData.expectedWarehouse?.id || (activeWarehouses.length === 1 ? activeWarehouses[0].id : '');
    const initialWhName = lineData.expectedWarehouse?.name || (activeWarehouses.length === 1 ? activeWarehouses[0].name : '');
    const localUom = sku.unit || 'Units';

    // Prevent duplicate SKU + warehouse if initial warehouse is set
    if (initialWhId) {
      const alreadyExists = entries.some(
        e => e.skuId === sku.id && e.warehouseId === initialWhId
      );
      if (alreadyExists) {
        toast.error('This SKU is already allocated to this warehouse.');
        return;
      }
    }

    // Default to 1 unit per added component (user can adjust per component)
    const defaultQty = 1;

    setEntries(prev => [
      ...prev,
      {
        skuId: sku.id,
        skuName: sku.name,
        skuCode: sku.code || sku.id,
        warehouseId: initialWhId,
        warehouseName: initialWhName,
        qty: defaultQty,
        uom: localUom,
        isDecimal: Boolean(sku.isDecimal),
      }
    ]);
    setSearch('');
    setSearchResults([]);
    setHasSearched(false);
  };

  const updateEntry = (idx: number, field: string, value: any) => {
    if (field === 'warehouseId' && value) {
      const currentSkuId = entries[idx]?.skuId;
      const isDuplicate = entries.some(
        (e, i) => i !== idx && e.skuId === currentSkuId && e.warehouseId === value
      );
      if (isDuplicate) {
        toast.error('This SKU is already allocated to this warehouse.');
        return;
      }
    }

    if (field === 'qty') {
      const isDecimal = Boolean(entries[idx]?.isDecimal);
      const strVal = String(value);
      if (!isValidPrecisionInput(strVal, isDecimal, false)) {
        return;
      }
    }

    setEntries(prev => {
      const updated = [...prev];
      if (field === 'warehouseId') {
        const wh = activeWarehouses.find(w => w.id === value);
        updated[idx] = {
          ...updated[idx],
          warehouseId: wh?.id || '',
          warehouseName: wh?.name || ''
        };
      } else {
        updated[idx] = {
          ...updated[idx],
          [field]: value
        };
      }
      return updated;
    });
  };

  const removeEntry = (idx: number) => {
    setEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (entries.length === 0) {
      toast.error('Please add at least one ERP inventory item.');
      return;
    }

    // Check for duplicate SKU + warehouse pairs
    const seenPairs = new Set<string>();
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.skuId && entry.warehouseId) {
        const pairKey = `${entry.skuId}___${entry.warehouseId}`;
        if (seenPairs.has(pairKey)) {
          toast.error('This SKU is already allocated to this warehouse.');
          return;
        }
        seenPairs.add(pairKey);
      }
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry.skuId) {
        toast.error(`Row #${i + 1}: ERP Item is missing or invalid.`);
        return;
      }
      if (!entry.warehouseId) {
        toast.error(`Row #${i + 1}: Please select a deduction warehouse.`);
        return;
      }
      const numQty = parseFloat(String(entry.qty));
      if (isNaN(numQty) || numQty <= 0) {
        toast.error(`Row #${i + 1}: Quantity must be greater than 0.`);
        return;
      }
      const precisionCheck = validateQuantityPrecision(entry.qty, Boolean(entry.isDecimal));
      if (!precisionCheck.valid) {
        toast.error(`Row #${i + 1} (${entry.skuName}): ${precisionCheck.error}`);
        return;
      }
    }

    setLoading(true);
    try {
      const formattedAllocations = entries.map(e => ({
        ...e,
        qty: typeof e.qty === 'number' ? e.qty : (parseFloat(String(e.qty)) || 0)
      }));

      const res = await fetch(`/api/dispatch/post-dispatch/${invoiceId}/stock-deduction/${lineData.line.id}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocations: formattedAllocations,
          isExploded: true,
          expectedSkuId: lineData.resolvedSku?.id || null,
          expectedWarehouseId: lineData.expectedWarehouse?.id || null,
          expectedQty: originalQty,
          expectedUom: originalUom,
          expectedItemId: lineData.line.itemId,
          expectedItemName: originalItemName
        })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to save manual items');
      toast.success('Manual items saved as draft');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3.5 bg-slate-50/60 p-4 rounded-xl border border-slate-200/80 shadow-xs">
      {/* Header & Source Line Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-200/70">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-[#1A2766]" />
          <h4 className="text-xs font-bold text-slate-800 tracking-tight">
            ADD ITEMS MANUALLY
          </h4>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
            Manual Override
          </span>
          <span className="text-[11px] text-slate-500 font-normal hidden sm:inline">
            — Explode invoice line into local ERP component SKUs and specify deduction warehouses &amp; quantities.
          </span>
        </div>
        
        {/* Source Context & Components Pill */}
        <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-lg shadow-2xs text-xs">
          <span className="text-slate-500">
            Invoice Ref Qty: <strong className="text-slate-800 font-semibold">{originalQty} {originalUom}</strong>
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-600">
            Configured Items: <strong className="text-[#1A2766] font-bold">{entries.length} item{entries.length === 1 ? '' : 's'}</strong>
          </span>
        </div>
      </div>

      {/* Informational Callout: Unrestricted Manual Adjustment */}
      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-purple-50/80 border border-purple-200/90 text-xs text-purple-900">
        <AlertCircle size={15} className="shrink-0 text-purple-600 mt-0.5" />
        <div className="space-y-0.5">
          <div className="font-bold text-purple-950 flex items-center gap-1.5">
            <span>Unrestricted Manual Adjustment Mode</span>
            <span className="text-[10px] font-semibold bg-purple-200/80 text-purple-800 px-1.5 py-0.2 rounded">Reference Only</span>
          </div>
          <div className="text-[11px] text-purple-800 leading-relaxed">
            Invoice line quantity (<strong className="font-semibold text-purple-950">{originalQty} {originalUom}</strong>) serves as context and reference only. In manual mode, you can allocate any local ERP SKU, any warehouse, and any custom deduction quantity (greater than, less than, or equal to the invoice line quantity).
          </div>
        </div>
      </div>

      {/* SKU Search Area (Positioned outside table container so dropdown isn't clipped) */}
      <div className="relative w-full" ref={searchContainerRef}>
        <div className="relative w-full max-w-2xl">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search local ERP SKU, model code, or product name (e.g. ACDB, UTL, Solar)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1A2766] bg-white text-slate-800 placeholder-slate-400 shadow-xs transition-all"
          />
          {searching && (
            <Loader2 size={14} className="animate-spin text-[#1A2766] absolute right-3 top-2.5" />
          )}

          {/* Live Search Results Dropdown */}
          {search.trim().length >= 2 && !searching && searchResults.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden z-50 max-h-72 overflow-y-auto">
              <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex justify-between items-center">
                <span>Select ERP Item</span>
                <span>{searchResults.length} {searchResults.length === 1 ? 'match' : 'matches'}</span>
              </div>
              {searchResults.map(s => (
                <div 
                  key={s.id} 
                  onClick={() => addSku(s)} 
                  className="p-3 border-b border-slate-100 last:border-0 hover:bg-indigo-50/70 cursor-pointer text-xs flex items-center justify-between group transition-colors"
                >
                  <div className="min-w-0 pr-3">
                    <div className="font-bold text-slate-900 group-hover:text-[#1A2766] truncate">{s.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-2">
                      <span>SKU: <strong className="text-slate-700">{s.id}</strong></span>
                      {s.code && s.code !== s.id && (
                        <span>• Code: <strong className="text-slate-600">{s.code}</strong></span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-[11px] text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200" title={s.unit || 'Unit'}>
                      {formatShortUom(s.unit)}
                    </span>
                    <span className="p-1 rounded-md bg-indigo-50 text-[#1A2766] group-hover:bg-[#1A2766] group-hover:text-white transition-colors">
                      <Plus size={13} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {search.trim().length >= 2 && !searching && hasSearched && searchResults.length === 0 && (
            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 shadow-lg rounded-xl p-3.5 z-50 text-xs text-slate-500 text-center">
              No matching ERP items found for &ldquo;<span className="font-semibold text-slate-700">{search}</span>&rdquo;.
            </div>
          )}

          {searchError && (
            <div className="absolute top-full left-0 mt-1 w-full bg-rose-50 border border-rose-200 shadow-md rounded-xl p-3 z-50 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0 text-rose-500" />
              <span>{searchError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Manual Item Rows Table */}
      <div className="border border-slate-200 rounded-lg bg-white overflow-x-auto text-xs shadow-xs">
        <table className="w-full text-left min-w-[550px]">
          <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-[11px] uppercase tracking-wider font-semibold">
            <tr>
              <th className="py-2.5 px-3 min-w-[180px]">ERP Item / Local SKU</th>
              <th className="py-2.5 px-3 w-52 sm:w-60">Deduction Warehouse</th>
              <th className="py-2.5 px-3 w-36 sm:w-44">Deduction Quantity</th>
              <th className="py-2.5 px-2 w-12 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 px-4 text-center text-slate-400">
                  <PackageCheck size={24} className="mx-auto mb-1.5 text-slate-300" />
                  <div className="font-semibold text-slate-600 text-xs">No ERP Items Added</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Use the search field above to find and add local ERP SKUs for this invoice line.</div>
                </td>
              </tr>
            ) : (
              entries.map((entry, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2.5 px-3 min-w-0">
                    <div className="font-semibold text-slate-900 leading-snug break-words">{entry.skuName}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5 break-all flex items-center gap-2">
                      <span>SKU: <span className="font-semibold text-slate-700">{entry.skuId}</span></span>
                      {entry.skuCode && entry.skuCode !== entry.skuId && (
                        <span>• Code: <span className="font-semibold text-slate-600">{entry.skuCode}</span></span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="space-y-1">
                      <select
                        value={entry.warehouseId}
                        onChange={e => updateEntry(idx, 'warehouseId', e.target.value)}
                        className={`border rounded-lg px-2 py-1.5 w-full outline-none focus:ring-2 focus:ring-[#1A2766] bg-white text-xs font-medium transition-all truncate ${
                          duplicateIndices.has(idx) ? 'border-amber-400 bg-amber-50/50 text-amber-900' : 'border-slate-300 text-slate-800'
                        }`}
                      >
                        <option value="">-- Select Warehouse --</option>
                        {activeWarehouses.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                      {duplicateIndices.has(idx) && (
                        <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                          <AlertCircle size={11} className="shrink-0" />
                          <span>This SKU is already allocated to this warehouse.</span>
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <input
                        type="number"
                        min="0"
                        step={entry.isDecimal ? "0.01" : "1"}
                        value={entry.qty}
                        onChange={e => updateEntry(idx, 'qty', e.target.value)}
                        className="border border-slate-300 rounded-lg px-2 py-1.5 w-20 sm:w-24 outline-none focus:ring-2 focus:ring-[#1A2766] font-semibold text-slate-900 bg-white text-xs shrink min-w-0"
                      />
                      <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-1.5 rounded-md border shrink-0 whitespace-nowrap bg-slate-100 text-slate-700 border-slate-200" title={entry.uom}>
                        {formatShortUom(entry.uom)}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    <button 
                      type="button"
                      onClick={() => removeEntry(idx)} 
                      className="text-rose-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors inline-flex items-center justify-center"
                      title="Remove item"
                      aria-label="Remove item"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Status Bar */}
      {entries.length > 0 && (
        <div className="p-2.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 bg-slate-100/70 border-slate-200 text-slate-700">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
            <span>
              Configured Items: <strong className="text-slate-900 font-bold">{entries.length} ERP SKU{entries.length === 1 ? '' : 's'}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span>
              Total Units to Deduct: <strong className="text-slate-900 font-bold">{totalComponentUnits}</strong>
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Invoice Reference Qty: <span className="font-semibold text-slate-700">{originalQty} {originalUom}</span> (Manual Override)
          </div>
        </div>
      )}
      
      {/* Footer Controls */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button 
          type="button"
          onClick={onCancel} 
          disabled={loading}
          className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button 
          type="button"
          onClick={save} 
          disabled={loading || hasInvalidRows} 
          className="px-4 py-1.5 text-xs font-bold text-white bg-[#1A2766] hover:bg-[#121c48] disabled:opacity-50 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
        >
          {loading && <Loader2 size={13} className="animate-spin" />}
          <span>Save Manual Items</span>
        </button>
      </div>
    </div>
  );
}

