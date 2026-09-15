'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCw, PackageX, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import InvoiceItemRow from './InvoiceItemRow';
import DeductionSummaryPanel from './DeductionSummaryPanel';

interface Props {
  invoiceId: string;
  canEditStockAllocation?: boolean;
  canDeductStock: boolean;
  canApproveStockDeduction: boolean;
  currentUserId: string;
  onRefresh?: () => void;
}

export default function InventoryDeductionWorkspace({
  invoiceId,
  canEditStockAllocation = false,
  canDeductStock,
  canApproveStockDeduction,
  currentUserId,
  onRefresh
}: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingZoho, setRefreshingZoho] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dispatch/post-dispatch/${invoiceId}/stock-deduction`);
      if (!res.ok) throw new Error('Failed to fetch stock deduction data');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to refresh from Zoho');
    } finally {
      setRefreshingZoho(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [invoiceId]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <Loader2 className="animate-spin text-[#1A2766] mb-3" size={30} />
        <p className="text-xs font-medium">Loading inventory allocation workspace...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center bg-red-50/50 rounded-xl border border-red-200">
        <p className="text-sm font-semibold text-red-700">{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const lines = data?.lines || [];

  return (
    <div className="w-full space-y-6">
      {/* 1. Summary Bar */}
      <DeductionSummaryPanel data={data} />

      {/* 2. Allocation Workspace */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs flex items-center gap-2">
            <span>Invoice Items & Allocations</span>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full lowercase">
              {lines.length} {lines.length === 1 ? 'item' : 'items'}
            </span>
          </h4>
          <button
            type="button"
            onClick={fetchData}
            className="text-slate-500 hover:text-slate-900 flex items-center gap-1.5 text-xs font-medium transition-colors"
          >
            <RefreshCw size={13} />
            <span>Refresh Allocations</span>
          </button>
        </div>

        {/* Informative Empty State */}
        {lines.length === 0 ? (
          <div className="p-8 text-center bg-slate-50/70 rounded-2xl border border-slate-200/80">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <PackageX size={24} />
            </div>
            <h5 className="font-bold text-slate-800 text-sm">Invoice items are not available yet</h5>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
              Line items have not been fetched for this invoice yet. Click below to load the complete line items and item metadata directly from Zoho Books.
            </p>
            <button
              type="button"
              onClick={handleFetchFromZoho}
              disabled={refreshingZoho}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#1A2766] hover:bg-[#121c48] text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-60"
            >
              <ExternalLink size={14} className={refreshingZoho ? 'animate-spin' : ''} />
              <span>{refreshingZoho ? 'Fetching Line Items…' : 'Fetch Items from Zoho Books'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {lines.map((lineData: any, idx: number) => (
              <InvoiceItemRow
                key={lineData.line.id}
                lineData={lineData}
                invoiceId={invoiceId}
                canEditStockAllocation={canEditStockAllocation}
                canDeductStock={canDeductStock}
                canApproveStockDeduction={canApproveStockDeduction}
                currentUserId={currentUserId}
                onUpdate={fetchData}
                index={idx + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

