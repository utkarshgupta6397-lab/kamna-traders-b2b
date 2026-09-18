'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Boxes,
  ListPlus,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Search,
  Plus,
  Loader2,
  Package,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatShortUom } from '@/lib/stock-deduction-service';
import { validateQuantityPrecision, isValidPrecisionInput } from '@/lib/uom-precision';
import type { CardLineItem } from './InvoiceItemCardRibbon';

export interface DirectAllocationEntry {
  skuId: string;
  skuName: string;
  skuCode?: string;
  warehouseId: string;
  warehouseName: string;
  availableStock: number | null; // null if loading
  qty: number | string;
  uom: string;
  isDecimal?: boolean;
}

export interface LineDraftState {
  mode: 'AUTOMATIC' | 'MANUAL';
  autoAllocations: DirectAllocationEntry[];
  manualAllocations: DirectAllocationEntry[];
  isConfigured: boolean;
}

interface Props {
  invoiceId: string;
  lineData: CardLineItem;
  allWarehouses: Array<{ id: string; name: string; zohoLocationId?: string | null }>;
  canEditStockAllocation: boolean;
  canDeductStock: boolean;
  canApproveStockDeduction: boolean;
  draftState: LineDraftState | undefined;
  onUpdateDraftState: (lineId: string, updater: (prev: LineDraftState) => LineDraftState) => void;
  onClearDraft: (lineId: string) => void;
  onSuccess: () => Promise<void>;
}

export default function DirectDeductionWorkspace({
  invoiceId,
  lineData,
  allWarehouses,
  canEditStockAllocation,
  canDeductStock,
  canApproveStockDeduction,
  draftState,
  onUpdateDraftState,
  onClearDraft,
  onSuccess,
}: Props) {
  const lineId = lineData.line.id;
  const isDeducted = lineData.allocation?.status === 'DEDUCTED';
  const isApproved = lineData.allocation?.status === 'APPROVED';
  const isSubmitted = lineData.allocation?.status === 'SUBMITTED_FOR_APPROVAL';
  const isReadOnly = isDeducted || isSubmitted;

  // Local stock cache: `${skuId}___${warehouseId}` -> number
  const [stockCache, setStockCache] = useState<Record<string, number>>({});
  const [loadingStockMap, setLoadingStockMap] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // Manual mode quick-add state
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedQuickSku, setSelectedQuickSku] = useState<any | null>(null);
  const [quickWarehouseId, setQuickWarehouseId] = useState<string>('');
  const [quickQty, setQuickQty] = useState<string | number>('1');
  const [quickStock, setQuickStock] = useState<number | null>(null);
  const [loadingQuickStock, setLoadingQuickStock] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Expected warehouse from invoice line, or first available warehouse
  const defaultWarehouseId = useMemo(() => {
    if (lineData.expectedWarehouse?.id) return lineData.expectedWarehouse.id;
    return allWarehouses[0]?.id || '';
  }, [lineData.expectedWarehouse, allWarehouses]);

  // Seed stock cache from initial lineData.warehouseStocks
  useEffect(() => {
    if (lineData.warehouseStocks && lineData.warehouseStocks.length > 0 && lineData.resolvedSku?.id) {
      const updates: Record<string, number> = {};
      for (const ws of lineData.warehouseStocks) {
        updates[`${lineData.resolvedSku.id}___${ws.warehouseId}`] = ws.availableQty;
      }
      setStockCache(prev => ({ ...prev, ...updates }));
    }
  }, [lineData.warehouseStocks, lineData.resolvedSku]);

  // Fetch live stock helper for a specific SKU and warehouse
  const fetchStock = useCallback(async (skuId: string, whId: string, force = false) => {
    if (!skuId || !whId) return;
    const key = `${skuId}___${whId}`;
    if (!force && stockCache[key] !== undefined) return;

    setLoadingStockMap(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`/api/staff/inventory/stock?warehouseId=${encodeURIComponent(whId)}&skuId=${encodeURIComponent(skuId)}`);
      if (res.ok) {
        const json = await res.json();
        const available = typeof json.qty === 'number' ? json.qty : 0;
        setStockCache(prev => ({ ...prev, [key]: available }));
      }
    } catch (e) {
      console.error('[StockFetchError]', e);
    } finally {
      setLoadingStockMap(prev => ({ ...prev, [key]: false }));
    }
  }, [stockCache]);

  // Initialize draft state if not already set
  useEffect(() => {
    if (!draftState) {
      const existingAlloc = lineData.allocation;
      const isExploded = Boolean(existingAlloc?.isExploded);
      const existingData = Array.isArray(existingAlloc?.allocationData) ? existingAlloc.allocationData : [];

      let initialMode: 'AUTOMATIC' | 'MANUAL' = isExploded ? 'MANUAL' : 'AUTOMATIC';
      let initialAuto: DirectAllocationEntry[] = [];
      let initialManual: DirectAllocationEntry[] = [];

      if (isExploded && existingData.length > 0) {
        initialManual = existingData.map((d: any) => ({
          skuId: d.skuId,
          skuName: d.skuName,
          skuCode: d.skuCode || d.skuId,
          warehouseId: d.warehouseId,
          warehouseName: d.warehouseName,
          availableStock: null,
          qty: d.qty,
          uom: d.uom,
          isDecimal: Boolean(d.isDecimal),
        }));
      } else if (!isExploded && existingData.length > 0) {
        initialAuto = existingData.map((d: any) => ({
          skuId: d.skuId,
          skuName: d.skuName,
          skuCode: d.skuCode || d.skuId,
          warehouseId: d.warehouseId,
          warehouseName: d.warehouseName,
          availableStock: null,
          qty: d.qty,
          uom: d.uom,
          isDecimal: Boolean(d.isDecimal),
        }));
      } else if (lineData.resolvedSku) {
        // Prepare primary automatic direct deduction row
        const whId = defaultWarehouseId;
        const whName = allWarehouses.find(w => w.id === whId)?.name || 'Default Warehouse';
        const initialQty = Number(lineData.line.quantity) || 1;

        initialAuto = [
          {
            skuId: lineData.resolvedSku.id,
            skuName: lineData.resolvedSku.name,
            skuCode: lineData.resolvedSku.id,
            warehouseId: whId,
            warehouseName: whName,
            availableStock: null,
            qty: initialQty,
            uom: lineData.resolvedSku.unit || lineData.line.uom || 'Units',
            isDecimal: lineData.resolvedSku.isDecimal,
          },
        ];
      }

      onUpdateDraftState(lineId, () => ({
        mode: initialMode,
        autoAllocations: initialAuto,
        manualAllocations: initialManual,
        isConfigured: initialAuto.length > 0 || initialManual.length > 0,
      }));
    }
  }, [lineId, draftState, lineData, defaultWarehouseId, allWarehouses, onUpdateDraftState]);

  // Active rows
  const activeMode = draftState?.mode || (lineData.allocation?.isExploded ? 'MANUAL' : 'AUTOMATIC');
  const activeRows = activeMode === 'AUTOMATIC' ? (draftState?.autoAllocations || []) : (draftState?.manualAllocations || []);

  // Fetch stock for active rows
  useEffect(() => {
    activeRows.forEach(row => {
      if (row.skuId && row.warehouseId) {
        fetchStock(row.skuId, row.warehouseId);
      }
    });
  }, [activeRows, fetchStock]);

  // Mode switcher
  const setMode = (newMode: 'AUTOMATIC' | 'MANUAL') => {
    onUpdateDraftState(lineId, prev => {
      let autoRows = prev.autoAllocations;
      if (newMode === 'AUTOMATIC' && autoRows.length === 0 && lineData.resolvedSku) {
        const whId = defaultWarehouseId;
        const whName = allWarehouses.find(w => w.id === whId)?.name || 'Default';
        autoRows = [
          {
            skuId: lineData.resolvedSku.id,
            skuName: lineData.resolvedSku.name,
            skuCode: lineData.resolvedSku.id,
            warehouseId: whId,
            warehouseName: whName,
            availableStock: null,
            qty: Number(lineData.line.quantity) || 1,
            uom: lineData.resolvedSku.unit || lineData.line.uom || 'Units',
            isDecimal: lineData.resolvedSku.isDecimal,
          },
        ];
      }
      return {
        ...prev,
        mode: newMode,
        autoAllocations: autoRows,
      };
    });
  };

  // Close SKU dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search for manual SKU quick-add
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/dispatch/post-dispatch/skus/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const json = await res.json();
          setSearchResults(Array.isArray(json.skus) ? json.skus : []);
        }
      } catch (e) {
        console.error('[SKUSearchError]', e);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Live stock lookup for quick-add form
  useEffect(() => {
    if (selectedQuickSku?.id && quickWarehouseId) {
      const key = `${selectedQuickSku.id}___${quickWarehouseId}`;
      if (stockCache[key] !== undefined) {
        setQuickStock(stockCache[key]);
        return;
      }
      setLoadingQuickStock(true);
      fetch(`/api/staff/inventory/stock?warehouseId=${encodeURIComponent(quickWarehouseId)}&skuId=${encodeURIComponent(selectedQuickSku.id)}`)
        .then(res => res.json())
        .then(data => {
          const qty = typeof data.qty === 'number' ? data.qty : 0;
          setStockCache(prev => ({ ...prev, [key]: qty }));
          setQuickStock(qty);
        })
        .catch(console.error)
        .finally(() => setLoadingQuickStock(false));
    } else {
      setQuickStock(null);
    }
  }, [selectedQuickSku, quickWarehouseId, stockCache]);

  // Update row fields with live warehouse stock refresh
  const updateRow = (idx: number, field: string, value: any) => {
    onUpdateDraftState(lineId, prev => {
      const isAuto = prev.mode === 'AUTOMATIC';
      const targetList = isAuto ? [...prev.autoAllocations] : [...prev.manualAllocations];
      if (!targetList[idx]) return prev;

      if (field === 'warehouseId') {
        const wh = allWarehouses.find(w => w.id === value);
        targetList[idx] = {
          ...targetList[idx],
          warehouseId: value,
          warehouseName: wh?.name || '',
          availableStock: null, // Clear to indicate refreshing
        };
        // Trigger live stock refresh for new warehouse
        if (targetList[idx].skuId && value) {
          fetchStock(targetList[idx].skuId, value, true);
        }
      } else if (field === 'qty') {
        const isDecimal = Boolean(targetList[idx].isDecimal);
        const strVal = String(value);
        if (strVal !== '' && !isValidPrecisionInput(strVal, isDecimal, false)) {
          return prev;
        }
        targetList[idx] = {
          ...targetList[idx],
          qty: value,
        };
      } else {
        targetList[idx] = {
          ...targetList[idx],
          [field]: value,
        };
      }

      return {
        ...prev,
        [isAuto ? 'autoAllocations' : 'manualAllocations']: targetList,
        isConfigured: true,
      };
    });
  };

  const removeManualRow = (idx: number) => {
    onUpdateDraftState(lineId, prev => {
      const updated = prev.manualAllocations.filter((_, i) => i !== idx);
      return {
        ...prev,
        manualAllocations: updated,
        isConfigured: updated.length > 0,
      };
    });
  };

  const handleAddQuickComponent = () => {
    if (!selectedQuickSku) {
      toast.error('Please select an ERP SKU');
      return;
    }
    const whId = quickWarehouseId || defaultWarehouseId;
    if (!whId) {
      toast.error('Please select a warehouse');
      return;
    }
    const numQty = parseFloat(String(quickQty));
    if (isNaN(numQty) || numQty <= 0) {
      toast.error('Please enter a valid quantity greater than 0');
      return;
    }

    const precisionCheck = validateQuantityPrecision(quickQty, Boolean(selectedQuickSku.isDecimal));
    if (!precisionCheck.valid) {
      toast.error(precisionCheck.error || 'Invalid precision');
      return;
    }

    const currentRows = draftState?.manualAllocations || [];
    const isDuplicate = currentRows.some(
      r => r.skuId === selectedQuickSku.id && r.warehouseId === whId
    );
    if (isDuplicate) {
      toast.error('This SKU is already added for this warehouse');
      return;
    }

    const whName = allWarehouses.find(w => w.id === whId)?.name || 'Default';

    onUpdateDraftState(lineId, prev => ({
      ...prev,
      mode: 'MANUAL',
      manualAllocations: [
        ...prev.manualAllocations,
        {
          skuId: selectedQuickSku.id,
          skuName: selectedQuickSku.name,
          skuCode: selectedQuickSku.code || selectedQuickSku.id,
          warehouseId: whId,
          warehouseName: whName,
          availableStock: quickStock,
          qty: numQty,
          uom: selectedQuickSku.unit || 'Units',
          isDecimal: Boolean(selectedQuickSku.isDecimal),
        },
      ],
      isConfigured: true,
    }));

    setSelectedQuickSku(null);
    setSearchQuery('');
    setSearchResults([]);
    setQuickQty('1');
    setQuickStock(null);
  };

  // Enriched rows with live warehouse inventory & shortage checks
  const enrichedRows = useMemo(() => {
    return activeRows.map(row => {
      const key = `${row.skuId}___${row.warehouseId}`;
      const stock = stockCache[key] !== undefined ? stockCache[key] : row.availableStock;
      const isLoading = Boolean(loadingStockMap[key]);
      const numQty = typeof row.qty === 'number' ? row.qty : parseFloat(String(row.qty));
      const isInsufficient = stock !== null && stock !== undefined && !isLoading && !isNaN(numQty) && numQty > stock;
      const isInvalidQty = isNaN(numQty) || numQty <= 0;
      const precisionCheck = validateQuantityPrecision(row.qty, Boolean(row.isDecimal));

      return {
        ...row,
        resolvedStock: stock,
        isLoadingStock: isLoading,
        numQty,
        isInsufficient,
        isInvalidQty: isInvalidQty || !precisionCheck.valid,
        precisionError: precisionCheck.error,
      };
    });
  }, [activeRows, stockCache, loadingStockMap]);

  // Overall validation
  const hasInsufficientStock = useMemo(() => {
    return enrichedRows.some(r => r.isInsufficient);
  }, [enrichedRows]);

  const hasInvalidRows = useMemo(() => {
    if (enrichedRows.length === 0) return true;
    return enrichedRows.some(r => !r.skuId || !r.warehouseId || r.isInvalidQty);
  }, [enrichedRows]);

  const summaryTotalUnits = useMemo(() => {
    return enrichedRows.reduce((sum, r) => sum + (isNaN(r.numQty) ? 0 : r.numQty), 0);
  }, [enrichedRows]);

  // Concurrency ref to guard against rapid double clicks
  const isSubmittingRef = useRef(false);

  // Unified Submit for Approval handler
  const handleSubmitForApproval = async () => {
    if (isSubmittingRef.current || saving) return;

    if (hasInsufficientStock) {
      toast.error('Cannot submit deduction: One or more rows have insufficient stock');
      return;
    }
    if (hasInvalidRows) {
      toast.error('Please provide valid warehouses and positive quantities for all rows');
      return;
    }

    isSubmittingRef.current = true;
    setSaving(true);
    try {
      const isExploded = activeMode === 'MANUAL';
      const formattedAllocations = enrichedRows.map(r => ({
        skuId: r.skuId,
        skuName: r.skuName,
        skuCode: r.skuCode,
        warehouseId: r.warehouseId,
        warehouseName: r.warehouseName,
        qty: r.numQty,
        uom: r.uom,
      }));

      const res = await fetch(`/api/dispatch/post-dispatch/${invoiceId}/stock-deduction/${lineId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocations: formattedAllocations,
          isExploded,
          expectedSkuId: lineData.resolvedSku?.id || null,
          expectedWarehouseId: lineData.expectedWarehouse?.id || null,
          expectedQty: Number(lineData.line.quantity),
          expectedUom: lineData.line.uom,
          expectedItemId: lineData.line.itemId,
          expectedItemName: lineData.line.itemName,
          submitForApproval: true,
        }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to submit deduction for approval');

      onClearDraft(lineId);
      toast.success('Deduction submitted for approval.');
      await onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Submission failed');
    } finally {
      setSaving(false);
      isSubmittingRef.current = false;
    }
  };

  const handleExecuteDeduct = async (endpoint: 'deduct-as-is' | 'deduct-approved') => {
    if (!lineData.allocation) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/dispatch/post-dispatch/${invoiceId}/stock-deduction/${lineId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocationId: lineData.allocation.id }),
      });
      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'Deduction failed');
      toast.success('Stock deducted successfully');
      await onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Deduction failed');
    } finally {
      setSaving(false);
    }
  };

  const originalQtyDisplay = `${lineData.line.quantity} ${formatShortUom(lineData.line.uom || lineData.resolvedSku?.unit || 'Units')}`;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
      {/* 1. Selected Item Header & Workspace Mode Switcher */}
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
              {lineData.line.itemName}
            </h3>
            {isDeducted && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                ✓ DEDUCTED
              </span>
            )}
            {isApproved && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 border border-green-200">
                APPROVED
              </span>
            )}
            {isSubmitted && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                PENDING APPROVAL
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
            <span>
              Invoice Qty: <strong className="text-slate-900 font-semibold">{originalQtyDisplay}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span>
              Expected WH: <strong className="text-slate-800 font-medium">{lineData.expectedWarehouse?.name || 'Unassigned'}</strong>
            </span>
            {lineData.resolvedSku && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-indigo-700 font-medium">
                  SKU: <span className="font-mono font-semibold">{lineData.resolvedSku.id}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Mode Switcher: [ Automatic ] | [ Manual ] */}
        {!isReadOnly && (
          <div className="flex items-center p-1 bg-slate-200/70 rounded-xl shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setMode('AUTOMATIC')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeMode === 'AUTOMATIC'
                  ? 'bg-white text-[#1A2766] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Boxes size={14} />
              <span>Automatic</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('MANUAL')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeMode === 'MANUAL'
                  ? 'bg-white text-purple-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListPlus size={14} />
              <span>Manual</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Workspace Content Area */}
      <div className="p-5 flex-1 space-y-4">
        {/* Mapping Required Alert for Automatic Mode */}
        {activeMode === 'AUTOMATIC' && lineData.mappingRequired && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block text-amber-950">Local SKU Mapping Required</strong>
                <span>This Zoho item is not directly mapped to a local ERP SKU. Switch to Manual mode to explode into local component SKUs.</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMode('MANUAL')}
              className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg text-xs shrink-0 self-start sm:self-auto transition-colors"
            >
              Switch to Manual
            </button>
          </div>
        )}

        {/* MANUAL MODE: COMPACT QUICK-ADD BAR */}
        {activeMode === 'MANUAL' && !isReadOnly && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Quick Add Local ERP Component
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
              {/* SKU Autocomplete Search */}
              <div className="sm:col-span-5 relative" ref={searchContainerRef}>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">
                  Search Product / SKU
                </label>
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search ERP SKU or item name..."
                    value={selectedQuickSku ? selectedQuickSku.name : searchQuery}
                    onChange={e => {
                      setSelectedQuickSku(null);
                      setSearchQuery(e.target.value);
                    }}
                    className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1A2766] bg-white text-slate-900"
                  />
                  {searching && (
                    <Loader2 size={13} className="animate-spin text-slate-400 absolute right-2.5 top-2.5" />
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                {searchQuery.trim().length >= 2 && !searching && searchResults.length > 0 && !selectedQuickSku && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 shadow-lg rounded-xl overflow-hidden z-50 max-h-56 overflow-y-auto">
                    {searchResults.map(s => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSelectedQuickSku(s);
                          setSearchQuery('');
                          setSearchResults([]);
                          if (!quickWarehouseId) {
                            setQuickWarehouseId(defaultWarehouseId);
                          }
                        }}
                        className="p-2.5 border-b border-slate-100 last:border-0 hover:bg-indigo-50/70 cursor-pointer text-xs flex items-center justify-between transition-colors"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-slate-900 truncate">{s.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">SKU: {s.id}</div>
                        </div>
                        <span className="text-[10px] font-bold uppercase bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                          {formatShortUom(s.unit)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Deduction Warehouse */}
              <div className="sm:col-span-4">
                <label className="text-[11px] font-medium text-slate-600 block mb-1">
                  Warehouse
                </label>
                <select
                  value={quickWarehouseId || defaultWarehouseId}
                  onChange={e => setQuickWarehouseId(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1A2766]"
                >
                  {allWarehouses.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Deduction Quantity */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-slate-600">Qty</label>
                  {quickStock !== null && (
                    <span className="text-[10px] text-slate-500 font-semibold">
                      ({quickStock} avail)
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  step={selectedQuickSku?.isDecimal ? '0.01' : '1'}
                  value={quickQty}
                  onChange={e => setQuickQty(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs font-bold text-right bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1A2766]"
                />
              </div>

              {/* Add Button */}
              <div className="sm:col-span-1">
                <button
                  type="button"
                  onClick={handleAddQuickComponent}
                  disabled={!selectedQuickSku}
                  className="w-full py-1.5 bg-[#1A2766] hover:bg-[#121c48] disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center transition-colors shadow-2xs"
                  title="Add component to deduction"
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. DEDUCTION TABLE — ALL IMPORTANT INFORMATION IN ONE ROW */}
        {(!lineData.mappingRequired || activeMode === 'MANUAL') && (
          <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs bg-white">
            <table className="w-full text-left min-w-[700px] border-collapse">
              <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 text-[10px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-3 min-w-[200px]">ERP ITEM / LOCAL SKU</th>
                  <th className="py-2.5 px-3 min-w-[170px]">WAREHOUSE</th>
                  <th className="py-2.5 px-3 min-w-[150px]">CURRENT WH INVENTORY</th>
                  <th className="py-2.5 px-3 w-28 text-right">DEDUCTION QTY</th>
                  <th className="py-2.5 px-3 w-20 text-center">UOM</th>
                  <th className="py-2.5 px-2 w-12 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {enrichedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      <Package size={24} className="mx-auto mb-1 text-slate-300" />
                      <div className="font-semibold text-slate-600 text-xs">No Items Added</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {activeMode === 'MANUAL'
                          ? 'Use the quick-add bar above to explode this invoice item into local ERP SKUs.'
                          : 'Configure direct deduction or switch to Manual mode.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  enrichedRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`transition-colors ${
                        row.isInsufficient
                          ? 'bg-rose-50/70 border-l-4 border-l-rose-500'
                          : 'hover:bg-slate-50/50'
                      }`}
                    >
                      {/* 1. ERP ITEM / LOCAL SKU */}
                      <td className="py-3 px-3 min-w-0">
                        <div className="font-bold text-slate-900 leading-snug break-words">
                          {row.skuName}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          SKU: {row.skuId}
                        </div>
                      </td>

                      {/* 2. WAREHOUSE */}
                      <td className="py-3 px-3">
                        <select
                          value={row.warehouseId}
                          disabled={isReadOnly}
                          onChange={e => updateRow(idx, 'warehouseId', e.target.value)}
                          className="w-full text-xs font-semibold px-2 py-1.5 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1A2766] transition-all truncate"
                        >
                          {allWarehouses.map(w => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* 3. CURRENT WH INVENTORY */}
                      <td className="py-3 px-3">
                        <div className="min-w-0">
                          {row.isLoadingStock ? (
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <Loader2 size={12} className="animate-spin shrink-0" />
                              <span className="text-[11px] font-medium">Refreshing…</span>
                            </div>
                          ) : row.resolvedStock !== null && row.resolvedStock !== undefined ? (
                            <div>
                              <span
                                className={`text-xs ${
                                  row.isInsufficient
                                    ? 'font-extrabold text-rose-600'
                                    : 'font-bold text-slate-800'
                                }`}
                              >
                                {row.resolvedStock} {formatShortUom(row.uom)}
                              </span>
                              {row.isInsufficient && (
                                <div className="text-[10px] font-bold text-rose-600 flex items-center gap-1 mt-0.5">
                                  <AlertTriangle size={11} className="shrink-0" />
                                  <span>
                                    Insufficient stock · {row.resolvedStock} available / {row.numQty} required
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </div>
                      </td>

                      {/* 4. DEDUCTION QTY */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex justify-end">
                          <input
                            type="number"
                            min="0"
                            step={row.isDecimal ? '0.01' : '1'}
                            disabled={isReadOnly}
                            value={row.qty}
                            onChange={e => updateRow(idx, 'qty', e.target.value)}
                            className={`w-20 px-2 py-1.5 text-xs font-bold text-right rounded-lg border outline-none transition-all ${
                              row.isInsufficient
                                ? 'border-rose-400 bg-rose-50 text-rose-900 focus:ring-2 focus:ring-rose-500'
                                : 'border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-[#1A2766]'
                            }`}
                          />
                        </div>
                      </td>

                      {/* 5. UOM */}
                      <td className="py-3 px-3 text-center">
                        <span className="font-bold text-[11px] uppercase px-2 py-1 rounded bg-slate-100 border border-slate-200 text-slate-700 whitespace-nowrap">
                          {formatShortUom(row.uom)}
                        </span>
                      </td>

                      {/* 6. ACTION */}
                      <td className="py-3 px-2 text-center">
                        {activeMode === 'MANUAL' && !isReadOnly ? (
                          <button
                            type="button"
                            onClick={() => removeManualRow(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors inline-flex items-center justify-center"
                            title="Remove item"
                            aria-label="Remove item"
                          >
                            <Trash2 size={15} />
                          </button>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400">
                            {isDeducted ? 'Deducted' : 'Mapped'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Sticky POS Bottom Action Bar */}
      <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Summary Metric */}
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-500 font-medium">
            Configured Deduction:
          </span>
          <span className="font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
            {enrichedRows.length} SKU{enrichedRows.length === 1 ? '' : 's'} · {summaryTotalUnits} Units
          </span>
          {hasInsufficientStock && (
            <span className="text-rose-600 font-bold flex items-center gap-1 text-[11px] bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              <AlertTriangle size={13} />
              <span>Insufficient warehouse inventory</span>
            </span>
          )}
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2">
          {!isReadOnly && draftState?.isConfigured && (
            <button
              type="button"
              onClick={() => onClearDraft(lineId)}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              Reset
            </button>
          )}

          {isDeducted && (
            <div className="px-3.5 py-1.5 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-lg border border-emerald-200 flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              <span>Stock Deducted</span>
            </div>
          )}

          {isApproved && (
            <button
              type="button"
              onClick={() => handleExecuteDeduct('deduct-approved')}
              disabled={saving || !canDeductStock}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors shadow-2xs flex items-center gap-1.5"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              <span>Deduct Approved Stock</span>
            </button>
          )}

          {isSubmitted && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-700 font-semibold px-2.5 py-1 bg-amber-50 rounded-lg border border-amber-200">
                Pending Manager Approval
              </span>
            </div>
          )}

          {!isReadOnly && !isApproved && (
            <button
              type="button"
              onClick={handleSubmitForApproval}
              disabled={saving || hasInsufficientStock || hasInvalidRows || !canEditStockAllocation}
              className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 ${
                hasInsufficientStock || hasInvalidRows || !canEditStockAllocation
                  ? 'bg-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-[#1A2766] hover:bg-[#121c48] active:scale-98'
              }`}
              title={
                hasInsufficientStock
                  ? 'Cannot submit: Insufficient warehouse stock'
                  : hasInvalidRows
                  ? 'Please fill all required rows with positive quantities'
                  : 'Submit for Approval'
              }
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CheckCircle2 size={14} />
              )}
              <span>{saving ? 'Submitting...' : 'Submit for Approval'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
