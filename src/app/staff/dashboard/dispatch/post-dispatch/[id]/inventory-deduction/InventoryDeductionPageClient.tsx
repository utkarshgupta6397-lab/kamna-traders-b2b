'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  Package,
  PackageCheck,
  PackageX,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Boxes,
  ListPlus,
  Loader2,
  ChevronRight,
  ShieldAlert,
  Info,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import DeductionSummaryPanel from '@/components/dispatch/post-dispatch/DeductionSummaryPanel';
import WarehouseAllocationPanel from '@/components/dispatch/post-dispatch/WarehouseAllocationPanel';
import ManualItemSelectionPanel from '@/components/dispatch/post-dispatch/ManualItemSelectionPanel';

interface Props {
  invoiceId: string;
  canEditStockAllocation: boolean;
  canDeductStock: boolean;
  canApproveStockDeduction: boolean;
  currentUserId: string;
}

export default function InventoryDeductionPageClient({
  invoiceId,
  canEditStockAllocation,
  canDeductStock,
  canApproveStockDeduction,
  currentUserId,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lineQueryParam = searchParams.get('line');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingZoho, setRefreshingZoho] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Currently selected line ID for the Right Panel
  const [selectedLineId, setSelectedLineId] = useState<string | null>(lineQueryParam);
  // Active action mode in the Right Panel: 'ALLOCATE' | 'MANUAL' | 'NONE'
  const [activePanelMode, setActivePanelMode] = useState<'NONE' | 'ALLOCATE' | 'MANUAL'>('NONE');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dispatch/post-dispatch/${invoiceId}/stock-deduction`);
      if (!res.ok) throw new Error('Failed to fetch stock deduction data');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error loading stock deduction');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Keep selected line synced with query param or auto-select first line
  useEffect(() => {
    if (data?.lines && data.lines.length > 0) {
      if (lineQueryParam) {
        const found = data.lines.find((l: any) => l.line.id === lineQueryParam);
        if (found) {
          setSelectedLineId(lineQueryParam);
          return;
        }
      }
      // If no valid lineQueryParam or not set yet, select the first line
      if (!selectedLineId || !data.lines.some((l: any) => l.line.id === selectedLineId)) {
        const firstLineId = data.lines[0].line.id;
        setSelectedLineId(firstLineId);
      }
    }
  }, [data, lineQueryParam, selectedLineId]);

  const handleSelectLine = (lineId: string) => {
    setSelectedLineId(lineId);
    setActivePanelMode('NONE');
    // Shallowly update URL query param
    const params = new URLSearchParams(window.location.search);
    params.set('line', lineId);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleFetchFromZoho = async () => {
    setRefreshingZoho(true);
    try {
      const res = await fetch(`/api/mobile/post-dispatch/invoices/${invoiceId}/refresh-status`, {
        method: 'POST',
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to refresh invoice from Zoho Books');
      toast.success('Invoice lines refreshed from Zoho Books');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to refresh from Zoho');
    } finally {
      setRefreshingZoho(false);
    }
  };

  const lines = useMemo(() => data?.lines || [], [data]);
  const selectedLineData = useMemo(
    () => lines.find((l: any) => l.line.id === selectedLineId) || null,
    [lines, selectedLineId]
  );

  // Workflow actions on the selected line
  const handleDeduct = async (endpoint: 'deduct-as-is' | 'deduct-approved') => {
    if (!selectedLineData?.allocation) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/dispatch/post-dispatch/${invoiceId}/stock-deduction/${selectedLineData.line.id}/${endpoint}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ allocationId: selectedLineData.allocation.id }),
        }
      );
      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'Deduction failed');
      toast.success('Inventory deducted successfully');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Deduction failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitApproval = async () => {
    if (!selectedLineData) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/dispatch/post-dispatch/${invoiceId}/stock-deduction/${selectedLineData.line.id}/submit`,
        { method: 'POST' }
      );
      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'Submission failed');
      toast.success('Submitted for approval');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Submission failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecision = async (action: 'approve' | 'reject') => {
    if (!selectedLineData) return;
    if (action === 'reject') {
      const remarks = window.prompt('Rejection remarks:');
      if (!remarks || remarks.trim().length < 5) {
        toast.error('Rejection remarks required (min 5 chars)');
        return;
      }
      setActionLoading(true);
      try {
        const res = await fetch(
          `/api/dispatch/post-dispatch/${invoiceId}/stock-deduction/${selectedLineData.line.id}/reject`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ remarks: remarks.trim() }),
          }
        );
        const resJson = await res.json();
        if (!res.ok) throw new Error(resJson.error || 'Rejection failed');
        toast.success('Allocation rejected');
        await fetchData();
      } catch (err: any) {
        toast.error(err.message || 'Rejection failed');
      } finally {
        setActionLoading(false);
      }
    } else {
      setActionLoading(true);
      try {
        const res = await fetch(
          `/api/dispatch/post-dispatch/${invoiceId}/stock-deduction/${selectedLineData.line.id}/approve`,
          { method: 'POST' }
        );
        const resJson = await res.json();
        if (!res.ok) throw new Error(resJson.error || 'Approval failed');
        toast.success('Allocation approved');
        await fetchData();
      } catch (err: any) {
        toast.error(err.message || 'Approval failed');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const getStatusBadge = (alloc: any) => {
    const status = alloc?.status || 'NOT_ALLOCATED';
    const classification = alloc?.classification || 'NOT_ALLOCATED';

    if (status === 'DEDUCTED') {
      const isAutoApproved = classification === 'AUTO_APPROVED';
      return {
        label: isAutoApproved ? '✓ AUTO-APPROVED / DEDUCTED' : '✓ DEDUCTED',
        classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
      };
    }
    if (status === 'APPROVED') {
      return {
        label: '🟢 APPROVED',
        classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
      };
    }
    if (status === 'SUBMITTED_FOR_APPROVAL') {
      return {
        label: '🟠 PENDING APPROVAL',
        classes: 'bg-orange-50 text-orange-700 border-orange-200',
        dot: 'bg-orange-500',
      };
    }
    if (status === 'REWORK_REQUIRED') {
      return {
        label: '🔴 REWORK REQUIRED',
        classes: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-500',
      };
    }
    if (status === 'REJECTED') {
      return {
        label: '🔴 REJECTED',
        classes: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-500',
      };
    }
    if (classification === 'AUTO_APPROVED') {
      return {
        label: '🟢 AUTO-APPROVED',
        classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
      };
    }
    if (classification === 'APPROVAL_REQUIRED') {
      return {
        label: '🔴 APPROVAL REQUIRED',
        classes: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-500',
      };
    }
    if (status === 'PARTIALLY_ALLOCATED' || classification === 'PARTIAL') {
      return {
        label: '🟡 PARTIAL',
        classes: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
      };
    }
    if (status === 'DRAFT') {
      return {
        label: '○ DRAFT',
        classes: 'bg-slate-100 text-slate-700 border-slate-200',
        dot: 'bg-slate-400',
      };
    }
    return {
      label: '⚪ NOT ALLOCATED',
      classes: 'bg-slate-50 text-slate-600 border-slate-200',
      dot: 'bg-slate-300',
    };
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50/60 flex flex-col items-center justify-center gap-3">
        <Loader2 size={32} className="animate-spin text-[#1A2766]" />
        <p className="text-xs font-semibold text-slate-600">Loading Inventory Deduction Workspace…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50/60 flex flex-col items-center justify-center p-6 text-center">
        <div className="p-8 max-w-md w-full bg-white rounded-2xl border border-red-200 shadow-sm text-center">
          <AlertCircle size={40} className="text-red-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">Failed to Load Workspace</h2>
          <p className="text-xs text-red-600 mt-1 mb-4">{error}</p>
          <div className="flex items-center justify-center gap-2">
            <Link
              href={`/staff/dashboard/dispatch/post-dispatch/${invoiceId}/review`}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
            >
              Back to Review
            </Link>
            <button
              type="button"
              onClick={fetchData}
              className="px-4 py-2 bg-[#1A2766] hover:bg-[#121c48] text-white rounded-lg text-xs font-bold"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const alloc = selectedLineData?.allocation || null;
  const status = alloc?.status || 'NOT_ALLOCATED';
  const classification = alloc?.classification || 'NOT_ALLOCATED';
  const isDeducted = status === 'DEDUCTED';
  const isMappingRequired = Boolean(selectedLineData?.mappingRequired);
  const manualItems = alloc?.isExploded && Array.isArray(alloc?.allocationData) ? alloc.allocationData : [];
  const directAllocations = !alloc?.isExploded && Array.isArray(alloc?.allocationData) ? alloc.allocationData : [];
  const statusBadge = selectedLineData ? getStatusBadge(alloc) : null;

  return (
    <div className="min-h-screen bg-slate-50/60 pb-20">
      {/* 1. TOP STICKY APP BAR */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/staff/dashboard/dispatch/post-dispatch/${invoiceId}/review`}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              title="Return to Post-Dispatch Review"
            >
              <ArrowLeft size={16} />
            </Link>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Link
                href={`/staff/dashboard/dispatch/post-dispatch/${invoiceId}/review`}
                className="hover:text-slate-900 transition-colors"
              >
                Review
              </Link>
              <span>/</span>
              <span className="font-bold text-gray-900 font-mono">{data?.invoiceNumber || invoiceId}</span>
              <span>/</span>
              <span className="font-semibold text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-100">
                Stock Deduction
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setRefreshing(true);
                fetchData();
              }}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium transition-colors disabled:opacity-50"
              title="Refresh inventory allocation data"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin text-[#1A2766]' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN TWO-PANEL WORKSPACE */}
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 mt-5">
        {/* Global Stats Summary Bar */}
        <div className="mb-5">
          <DeductionSummaryPanel data={data} />
        </div>

        {/* Informative Empty State if no lines present */}
        {lines.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs max-w-2xl mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <PackageX size={28} />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Invoice Lines Not Available</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5 max-w-md mx-auto leading-relaxed">
              No invoice items have been fetched into the local database yet. Pull items directly from Zoho Books to start allocating stock.
            </p>
            <button
              type="button"
              onClick={handleFetchFromZoho}
              disabled={refreshingZoho}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1A2766] hover:bg-[#121c48] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-60"
            >
              <ExternalLink size={14} className={refreshingZoho ? 'animate-spin' : ''} />
              <span>{refreshingZoho ? 'Fetching Line Items…' : 'Fetch Items from Zoho Books'}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ============================================================= */}
            {/* LEFT PANEL: INVOICE ITEMS LIST (~38% / 5 COLS)                */}
            {/* ============================================================= */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Package size={14} className="text-[#1A2766]" />
                  <span>Invoice Items</span>
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-full">
                    {lines.length}
                  </span>
                </h3>
                <span className="text-[11px] text-slate-400">Click item to inspect & allocate</span>
              </div>

              <div className="space-y-2.5">
                {lines.map((lineData: any, idx: number) => {
                  const itemAlloc = lineData.allocation;
                  const itemBadge = getStatusBadge(itemAlloc);
                  const isSelected = lineData.line.id === selectedLineId;
                  const itemUom = lineData.line.uom || lineData.resolvedSku?.unit || '';

                  return (
                    <div
                      key={lineData.line.id}
                      onClick={() => handleSelectLine(lineData.line.id)}
                      className={`cursor-pointer rounded-xl border p-3.5 transition-all text-left relative ${
                        isSelected
                          ? 'border-[#1A2766] bg-white shadow-md ring-2 ring-[#1A2766]/10'
                          : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 ${
                              isSelected ? 'bg-[#1A2766] text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h4
                              className={`text-xs font-bold leading-snug line-clamp-2 ${
                                isSelected ? 'text-slate-900' : 'text-slate-800'
                              }`}
                            >
                              {lineData.line.itemName}
                            </h4>

                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[11px] text-slate-500">
                              <span className="font-semibold text-slate-800">
                                {lineData.line.quantity} {itemUom}
                              </span>

                              <span>•</span>

                              {lineData.expectedWarehouse ? (
                                <span className="text-slate-600 font-medium truncate max-w-[130px]">
                                  {lineData.expectedWarehouse.name}
                                </span>
                              ) : lineData.zohoLocationId ? (
                                <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-amber-200">
                                  WH Unmapped
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">No WH</span>
                              )}

                              <span>•</span>

                              {lineData.resolvedSku ? (
                                <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-emerald-200 inline-flex items-center gap-1">
                                  <span>MAPPED ✓</span>
                                  {lineData.resolvedSku.id && lineData.resolvedSku.id !== lineData.resolvedSku.name && (
                                    <span className="font-mono text-[9px] text-emerald-800 font-bold">
                                      ({lineData.resolvedSku.id})
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-rose-200">
                                  Mapping Req.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 flex flex-col items-end gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${itemBadge.classes}`}
                          >
                            {itemBadge.label}
                          </span>
                          <ChevronRight
                            size={14}
                            className={`transition-transform ${
                              isSelected ? 'text-[#1A2766] translate-x-0.5' : 'text-slate-300'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ============================================================= */}
            {/* RIGHT PANEL: DEDICATED ALLOCATION WORKSPACE (~62% / 7 COLS)   */}
            {/* ============================================================= */}
            <div className="lg:col-span-7 lg:sticky lg:top-20 space-y-4 min-w-0">
              {!selectedLineData ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                  <Package size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-600">Select an item from the left panel</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click any invoice line on the left to configure warehouse allocations or manual SKUs.
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  {/* Selected Item Header */}
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="space-y-2 min-w-0 flex-1">
                        {/* Status Badges Row */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-bold text-[#1A2766] uppercase tracking-wider bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-100">
                            Selected Item
                          </span>

                          {selectedLineData.resolvedSku ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded border bg-emerald-50 text-emerald-700 border-emerald-200">
                              <CheckCircle2 size={11} className="text-emerald-600" />
                              <span>MAPPED ✓</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded border bg-rose-50 text-rose-700 border-rose-200">
                              <AlertCircle size={11} className="text-rose-600" />
                              <span>SKU MAPPING REQUIRED</span>
                            </span>
                          )}

                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded border uppercase tracking-wider ${
                              statusBadge?.classes || ''
                            }`}
                          >
                            {statusBadge?.label}
                          </span>
                        </div>

                        {/* Product Name (shown exactly ONCE) */}
                        <div>
                          <h2
                            className="text-base font-bold text-slate-900 leading-snug break-words"
                            title={selectedLineData.line.itemName}
                          >
                            {selectedLineData.line.itemName}
                          </h2>
                          {/* If the resolved local product name is different from invoice line item name, display local name discreetly */}
                          {selectedLineData.resolvedSku &&
                            selectedLineData.resolvedSku.name &&
                            selectedLineData.resolvedSku.name.trim().toLowerCase() !==
                              selectedLineData.line.itemName.trim().toLowerCase() && (
                              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                <span className="text-slate-400">Local ERP Product:</span>
                                <span className="font-medium text-slate-700">{selectedLineData.resolvedSku.name}</span>
                              </div>
                            )}
                        </div>

                        {/* Metadata Row: Invoice Qty · Expected WH · Local SKU Code */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500 pt-0.5">
                          <span>
                            Invoice Qty:{' '}
                            <strong className="text-slate-800 font-semibold">
                              {selectedLineData.line.quantity}{' '}
                              {selectedLineData.line.uom || selectedLineData.resolvedSku?.unit || ''}
                            </strong>
                          </span>
                          <span>•</span>
                          <span>
                            Expected WH:{' '}
                            <strong className="text-slate-800 font-semibold">
                              {selectedLineData.expectedWarehouse?.name ||
                                selectedLineData.zohoLocationName ||
                                'Unassigned'}
                            </strong>
                          </span>
                          {selectedLineData.resolvedSku && (
                            <>
                              <span>•</span>
                              <span className="inline-flex items-center gap-1">
                                <span>Local SKU:</span>
                                <strong className="text-indigo-900 font-mono font-bold bg-indigo-50/80 px-1.5 py-0.5 rounded border border-indigo-200/80">
                                  {selectedLineData.resolvedSku.id}
                                </strong>
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Primary Actions (Submit / Deduct Approved) */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap pt-1 sm:pt-0">
                        {!isDeducted && classification === 'APPROVAL_REQUIRED' && (status === 'DRAFT' || status === 'REWORK_REQUIRED' || status === 'REJECTED') && (
                          <button
                            type="button"
                            onClick={handleSubmitApproval}
                            disabled={actionLoading || !canEditStockAllocation}
                            className="px-3.5 py-1.5 bg-[#1A2766] text-white text-xs font-bold rounded-lg hover:bg-[#121c48] disabled:opacity-50 transition-colors shadow-2xs flex items-center gap-1.5"
                          >
                            {actionLoading && <Loader2 size={13} className="animate-spin" />}
                            <span>{status === 'REWORK_REQUIRED' ? 'Resubmit for Approval' : 'Submit Approval'}</span>
                          </button>
                        )}

                        {!isDeducted && status === 'SUBMITTED_FOR_APPROVAL' && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                              <Clock size={13} className="text-orange-500 animate-pulse" />
                              <span>Awaiting Stock Approval</span>
                            </span>
                            <Link
                              href="/staff/dashboard/operations/stock-approval"
                              className="text-xs font-bold text-[#1A2766] hover:underline flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                              <span>Review in Operations</span>
                              <ExternalLink size={12} />
                            </Link>
                          </div>
                        )}

                        {!isDeducted && status === 'APPROVED' && (
                          <button
                            type="button"
                            onClick={() => handleDeduct('deduct-approved')}
                            disabled={actionLoading || !canDeductStock}
                            className="px-3.5 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-2xs flex items-center gap-1.5"
                          >
                            {actionLoading && <Loader2 size={13} className="animate-spin" />}
                            <span>Deduct Approved</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Deviations strip if present */}
                    {alloc?.deviationReasons && alloc.deviationReasons.length > 0 && (
                      <div className="mt-3.5 p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-800">
                        <AlertCircle size={14} className="shrink-0 text-amber-600" />
                        <span>
                          <strong>Deviations:</strong>{' '}
                          {alloc.deviationReasons
                            .map((d: string) => (d === 'ITEM_EXPLODED' ? 'MANUAL_ITEMS_ADDED' : d))
                            .join(', ')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body Content of Right Panel */}
                  <div className="p-5 space-y-4">
                    {/* Read-only view when DEDUCTED */}
                    {isDeducted && (
                      <div className="p-5 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                            <CheckCircle2 size={16} className="text-emerald-600" />
                            <span>
                              {classification === 'AUTO_APPROVED'
                                ? 'Auto-Approved: Stock Deducted & Locked'
                                : 'Stock Deduction Completed & Locked'}
                            </span>
                          </div>
                          {alloc?.deductedAt && (
                            <span className="text-[11px] text-emerald-700 font-medium">
                              Deducted on {new Date(alloc.deductedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-600 space-y-1">
                          {alloc?.allocationData?.map((item: any, i: number) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-emerald-100 text-xs shadow-2xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="font-semibold text-slate-800">{item.skuName || item.skuId}</span>
                              </div>
                              <div className="text-slate-600">
                                Warehouse: <strong className="text-slate-900 font-semibold">{item.warehouseName}</strong> • Deducted:{' '}
                                <strong className="font-bold text-emerald-700">
                                  {item.qty} {item.uom}
                                </strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pending approval notice when SUBMITTED_FOR_APPROVAL */}
                    {!isDeducted && status === 'SUBMITTED_FOR_APPROVAL' && (
                      <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-800 space-y-2">
                        <div className="flex items-center gap-2 font-bold">
                          <Info size={16} className="text-orange-600 shrink-0" />
                          <span>Submitted for Approval</span>
                        </div>
                        <p className="text-[11px] text-orange-700 leading-relaxed">
                          This line has deviation(s) and has been submitted to an authorized supervisor for review.
                          Editing is locked while pending decision.
                        </p>
                      </div>
                    )}

                    {/* Rework Required banner if status is REWORK_REQUIRED or REJECTED */}
                    {!isDeducted && (status === 'REWORK_REQUIRED' || status === 'REJECTED') && (
                      <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-rose-800">
                          <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                          <span>Rework Required: Request was returned by Reviewer</span>
                        </div>
                        {alloc?.rejectionRemarks && (
                          <div className="bg-white/80 p-2.5 rounded-lg border border-rose-200 text-rose-800">
                            <strong>Reviewer Note:</strong> {alloc.rejectionRemarks}
                          </div>
                        )}
                        <p className="text-[11px] text-rose-700 leading-relaxed">
                          Please review the feedback, adjust your warehouse allocations or items below, and resubmit for approval.
                        </p>
                      </div>
                    )}

                    {/* Allocation Mode Selector (when editable) */}
                    {!isDeducted && status !== 'SUBMITTED_FOR_APPROVAL' && (
                      <div className="space-y-4">
                        {/* Selector Tabs: Allocate vs Add Items Manually */}
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <button
                            type="button"
                            onClick={() => setActivePanelMode(activePanelMode === 'ALLOCATE' ? 'NONE' : 'ALLOCATE')}
                            disabled={isMappingRequired || !canEditStockAllocation}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg border transition-all ${
                              activePanelMode === 'ALLOCATE'
                                ? 'bg-[#1A2766] text-white border-[#1A2766] shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                            title={
                              isMappingRequired
                                ? 'Direct allocation unavailable without SKU mapping. Use Add Items Manually.'
                                : 'Configure warehouse stock allocation'
                            }
                          >
                            <Boxes size={14} />
                            <span>Warehouse Allocation</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setActivePanelMode(activePanelMode === 'MANUAL' ? 'NONE' : 'MANUAL')}
                            disabled={!canEditStockAllocation}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg border transition-all ${
                              activePanelMode === 'MANUAL'
                                ? 'bg-[#1A2766] text-white border-[#1A2766] shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            } disabled:opacity-40`}
                            title="Add local ERP SKUs manually for this invoice line"
                          >
                            <ListPlus size={14} />
                            <span>Add Items Manually</span>
                          </button>
                        </div>

                        {/* If no panel is explicitly opened, render the default recommended view */}
                        {activePanelMode === 'NONE' && (
                          <div className="space-y-4">
                            {/* Traceable summary of current draft if any */}
                            {manualItems.length > 0 ? (
                              <div className="p-4 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                                    <ListPlus size={14} className="text-indigo-600" />
                                    <span>Manually Associated ERP Items ({manualItems.length})</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setActivePanelMode('MANUAL')}
                                    className="text-[11px] text-indigo-700 hover:underline font-semibold"
                                  >
                                    Edit Manual Items
                                  </button>
                                </div>
                                <div className="space-y-1.5">
                                  {manualItems.map((item: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="flex flex-wrap items-center justify-between gap-2 p-2 bg-white rounded-lg border border-indigo-100 text-xs"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                        <span className="font-bold text-slate-900">{item.skuName}</span>
                                        {item.skuId && (
                                          <span className="text-[10px] text-slate-400 font-mono">
                                            ({item.skuId})
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-slate-600 flex items-center gap-3">
                                        <span>
                                          WH: <strong>{item.warehouseName || 'Default'}</strong>
                                        </span>
                                        <span>
                                          Qty:{' '}
                                          <strong className="font-semibold text-slate-900">
                                            {item.qty} {item.uom}
                                          </strong>
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : directAllocations.length > 0 ? (
                              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                    <Boxes size={14} className="text-slate-600" />
                                    <span>Current Warehouse Allocations</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setActivePanelMode('ALLOCATE')}
                                    className="text-[11px] text-indigo-700 hover:underline font-semibold"
                                  >
                                    Edit Allocation
                                  </button>
                                </div>
                                <div className="space-y-1.5">
                                  {directAllocations.map((item: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs"
                                    >
                                      <span className="font-semibold text-slate-800">{item.warehouseName}</span>
                                      <span className="text-slate-900 font-bold">
                                        {item.qty} {item.uom}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : isMappingRequired ? (
                              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2.5">
                                <AlertTriangle size={24} className="text-amber-500 mx-auto" />
                                <h4 className="font-bold text-xs text-slate-800">Local SKU Mapping Unavailable</h4>
                                <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                                  This line item is not mapped to a local SKU. Click below to add local ERP inventory items manually and specify deduction warehouses.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setActivePanelMode('MANUAL')}
                                  disabled={!canEditStockAllocation}
                                  className="mt-1 px-4 py-2 bg-[#1A2766] hover:bg-[#121c48] text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs"
                                >
                                  <ListPlus size={14} />
                                  <span>Add Items Manually</span>
                                </button>
                              </div>
                            ) : (
                              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                                <div>
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                      <Boxes size={15} className="text-[#1A2766]" />
                                      <span>Stock Allocation</span>
                                    </h4>
                                    <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                      Not Allocated
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-1">
                                    This item is mapped to local SKU{' '}
                                    <strong className="font-mono text-slate-800">{selectedLineData.resolvedSku?.id}</strong>. Configure warehouse quantities to allocate stock.
                                  </p>
                                </div>

                                {/* Stock metrics grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                                    <div className="text-[10px] text-slate-500 uppercase tracking-wide">Expected WH</div>
                                    <div className="font-bold text-slate-900 truncate mt-0.5" title={selectedLineData.expectedWarehouse?.name || 'Unassigned'}>
                                      {selectedLineData.expectedWarehouse?.name || 'Unassigned'}
                                    </div>
                                  </div>
                                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                                    <div className="text-[10px] text-slate-500 uppercase tracking-wide">Required</div>
                                    <div className="font-bold text-slate-900 mt-0.5">
                                      {selectedLineData.line.quantity} {selectedLineData.line.uom || selectedLineData.resolvedSku?.unit || ''}
                                    </div>
                                  </div>
                                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                                    <div className="text-[10px] text-slate-500 uppercase tracking-wide">Available In WH</div>
                                    <div className="font-bold text-emerald-700 mt-0.5">
                                      {(() => {
                                        const whId = selectedLineData.expectedWarehouse?.id;
                                        const stockRec = selectedLineData.warehouseStocks?.find((s: any) => s.warehouseId === whId);
                                        return stockRec !== undefined ? `${stockRec.availableQty} ${stockRec.uom || ''}` : '—';
                                      })()}
                                    </div>
                                  </div>
                                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                                    <div className="text-[10px] text-slate-500 uppercase tracking-wide">Allocated</div>
                                    <div className="font-bold text-slate-600 mt-0.5">
                                      0 {selectedLineData.line.uom || selectedLineData.resolvedSku?.unit || ''}
                                    </div>
                                  </div>
                                </div>

                                <div className="pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setActivePanelMode('ALLOCATE')}
                                    disabled={!canEditStockAllocation}
                                    className="w-full sm:w-auto px-4 py-2 bg-[#1A2766] hover:bg-[#121c48] text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 shadow-xs"
                                  >
                                    <Boxes size={14} />
                                    <span>Allocate Warehouse Stock</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Direct Warehouse Allocation Panel */}
                        {activePanelMode === 'ALLOCATE' && (
                          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                            <WarehouseAllocationPanel
                              lineData={selectedLineData}
                              invoiceId={invoiceId}
                              onSuccess={() => {
                                setActivePanelMode('NONE');
                                fetchData();
                              }}
                              onCancel={() => setActivePanelMode('NONE')}
                            />
                          </div>
                        )}

                        {/* Manual Item Selection Panel */}
                        {activePanelMode === 'MANUAL' && (
                          <div>
                            <ManualItemSelectionPanel
                              lineData={selectedLineData}
                              invoiceId={invoiceId}
                              onSuccess={() => {
                                setActivePanelMode('NONE');
                                fetchData();
                              }}
                              onCancel={() => setActivePanelMode('NONE')}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
