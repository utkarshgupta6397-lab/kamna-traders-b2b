'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  PackageX,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/lib/utils';
import InvoiceItemCardRibbon from '@/components/dispatch/post-dispatch/InvoiceItemCardRibbon';
import DirectDeductionWorkspace, { LineDraftState } from '@/components/dispatch/post-dispatch/DirectDeductionWorkspace';
import InventoryDeductionSkeleton from '@/components/dispatch/post-dispatch/InventoryDeductionSkeleton';

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

  // Selected line ID for dedicated workspace
  const [selectedLineId, setSelectedLineId] = useState<string | null>(lineQueryParam);

  // In-memory draft states per line so switching cards preserves unsaved user changes
  const [draftStates, setDraftStates] = useState<Record<string, LineDraftState>>({});

  // Concurrency guard to prevent duplicate simultaneous fetches in React
  const isFetchingRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dispatch/post-dispatch/${invoiceId}/stock-deduction`);
      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || 'Failed to fetch stock deduction data');
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error loading stock deduction');
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetchingRef.current = false;
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
      if (!selectedLineId || !data.lines.some((l: any) => l.line.id === selectedLineId)) {
        const firstLineId = data.lines[0].line.id;
        setSelectedLineId(firstLineId);
      }
    }
  }, [data, lineQueryParam, selectedLineId]);

  const handleSelectLine = (lineId: string) => {
    setSelectedLineId(lineId);
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
      toast.success('Invoice synchronized from Zoho Books');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to refresh from Zoho');
    } finally {
      setRefreshingZoho(false);
    }
  };

  const handleUpdateDraftState = useCallback(
    (lineId: string, updater: (prev: LineDraftState) => LineDraftState) => {
      setDraftStates(prev => {
        const current = prev[lineId] || {
          mode: 'AUTOMATIC',
          autoAllocations: [],
          manualAllocations: [],
          isConfigured: false,
        };
        return {
          ...prev,
          [lineId]: updater(current),
        };
      });
    },
    []
  );

  const handleClearDraft = useCallback((lineId: string) => {
    setDraftStates(prev => {
      const updated = { ...prev };
      delete updated[lineId];
      return updated;
    });
  }, []);

  const lines = useMemo(() => data?.lines || [], [data]);
  const selectedLineData = useMemo(
    () => lines.find((l: any) => l.line.id === selectedLineId) || null,
    [lines, selectedLineId]
  );

  // Enriched card lines with draft states
  const cardLines = useMemo(() => {
    return lines.map((l: any) => {
      const lineId = l.line.id;
      const draft = draftStates[lineId];
      let draftMeta = undefined;

      if (draft) {
        const isExploded = draft.mode === 'MANUAL';
        const rows = isExploded ? draft.manualAllocations : draft.autoAllocations;
        const totalUnits = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
        draftMeta = {
          isConfigured: draft.isConfigured,
          isExploded,
          totalUnits,
        };
      }

      return {
        ...l,
        draftState: draftMeta,
      };
    });
  }, [lines, draftStates]);

  if (loading && !data) {
    return <InventoryDeductionSkeleton invoiceId={invoiceId} invoiceNumber={data?.invoiceNumber} />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50/60 flex flex-col items-center justify-center p-6 text-center">
        <div className="p-8 max-w-md w-full bg-white rounded-2xl border border-red-200 shadow-sm text-center">
          <AlertCircle size={40} className="text-red-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">Failed to Load Invoice Data</h2>
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

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* 1. COMPACT SINGLE-LINE POS HEADER STRIP */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/staff/dashboard/dispatch/post-dispatch/${invoiceId}/review`}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shrink-0"
              title="Return to Review"
            >
              <ArrowLeft size={16} />
            </Link>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
              <span className="font-bold text-slate-900 font-mono text-sm tracking-tight">
                {data?.invoiceNumber || invoiceId}
              </span>
              <span className="text-slate-300">·</span>
              <span className="font-bold text-slate-800 truncate max-w-[200px] sm:max-w-[320px]">
                {data?.customerName || 'Customer'}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-600 font-medium">
                {data?.expectedWarehouse?.name || data?.zohoLocationName || 'Unassigned WH'}
              </span>
              <span className="text-slate-300">·</span>
              <span className="font-extrabold text-[#1A2766]">
                {formatCurrency(data?.total || 0)}
              </span>

              {/* Status Badges */}
              <div className="flex items-center gap-1.5 ml-1 flex-wrap">
                {data?.zohoStatus && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                    {data.zohoStatus}
                  </span>
                )}
                {data?.inventoryWorkflowStatus && (
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                      data.inventoryWorkflowStatus === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : data.inventoryWorkflowStatus === 'IN_PROGRESS'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {data.inventoryWorkflowStatus === 'COMPLETED'
                      ? '✓ DEDUCTED'
                      : data.inventoryWorkflowStatus}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleFetchFromZoho}
              disabled={refreshingZoho}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50 shadow-2xs"
              title="Force sync latest invoice lines from Zoho Books"
            >
              <RefreshCw size={13} className={refreshingZoho ? 'animate-spin text-[#1A2766]' : ''} />
              <span>{refreshingZoho ? 'Syncing…' : 'Sync Zoho'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRefreshing(true);
                fetchData();
              }}
              disabled={refreshing}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50 shadow-2xs"
              title="Refresh stock allocation"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin text-[#1A2766]' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN POS WORKSPACE */}
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        {/* Genuine Empty State (only if invoice genuinely has 0 items in Zoho Books) */}
        {lines.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs max-w-2xl mx-auto mt-6">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <PackageX size={28} />
            </div>
            <h3 className="font-bold text-slate-900 text-base">No Invoice Items</h3>
            <p className="text-xs text-slate-500 mt-1 mb-2 max-w-md mx-auto leading-relaxed">
              This invoice does not contain any billable line items in Zoho Books.
            </p>
          </div>
        ) : (
          <>
            {/* TOP SECTION: POS-STYLE INVOICE ITEM CARDS RIBBON */}
            <div>
              <div className="flex items-center justify-between mb-1.5 px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Invoice Items ({lines.length})
                </span>
                <span className="text-[11px] text-slate-400">
                  Select item to allocate
                </span>
              </div>
              <InvoiceItemCardRibbon
                lines={cardLines}
                selectedLineId={selectedLineId}
                onSelectLine={handleSelectLine}
              />
            </div>

            {/* SELECTED ITEM DEDICATED WORKSPACE */}
            {selectedLineData ? (
              <DirectDeductionWorkspace
                key={selectedLineData.line.id}
                invoiceId={invoiceId}
                lineData={selectedLineData}
                allWarehouses={data?.warehouses || []}
                canEditStockAllocation={canEditStockAllocation}
                canDeductStock={canDeductStock}
                canApproveStockDeduction={canApproveStockDeduction}
                draftState={draftStates[selectedLineData.line.id]}
                onUpdateDraftState={handleUpdateDraftState}
                onClearDraft={handleClearDraft}
                onSuccess={async () => {
                  handleClearDraft(selectedLineData.line.id);
                  await fetchData();
                }}
              />
            ) : (
              <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
                Select an invoice item from the cards above to configure deduction.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
