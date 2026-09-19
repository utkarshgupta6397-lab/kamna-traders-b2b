'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Check, AlertCircle, Boxes, ListPlus, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import WarehouseAllocationPanel from './WarehouseAllocationPanel';
import ManualItemSelectionPanel from './ManualItemSelectionPanel';

interface Props {
  lineData: any;
  invoiceId: string;
  canEditStockAllocation?: boolean;
  canDeductStock: boolean;
  canApproveStockDeduction: boolean;
  currentUserId: string;
  onUpdate: () => void;
  index: number;
}

export default function InvoiceItemRow({
  lineData,
  invoiceId,
  canEditStockAllocation = false,
  canDeductStock,
  canApproveStockDeduction,
  currentUserId,
  onUpdate,
  index,
}: Props) {
  const [expandedMode, setExpandedMode] = useState<'NONE' | 'ALLOCATE' | 'MANUAL'>('NONE');
  const [loading, setLoading] = useState(false);

  const alloc = lineData.allocation;
  const status = alloc?.status || 'NOT_ALLOCATED';
  const classification = alloc?.classification || 'NOT_ALLOCATED';

  // Determine colors based on status/classification
  let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
  let badgeText = status.replace(/_/g, ' ');

  if (status === 'DEDUCTED' || classification === 'AUTO_APPROVED') {
    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (['APPROVAL_REQUIRED', 'SUBMITTED_FOR_APPROVAL', 'APPROVED', 'REJECTED', 'REWORK_REQUIRED'].includes(status) || classification === 'APPROVAL_REQUIRED') {
    badgeColor = 'bg-red-50 text-red-700 border-red-200';
  } else if (status === 'PARTIALLY_ALLOCATED' || classification === 'PARTIAL') {
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
  }

  const handleDeductAsIs = async () => {
    if (!alloc) return;
    setLoading(true);
    try {
      const endpoint = alloc.status === 'APPROVED' ? 'deduct-approved' : 'deduct-as-is';
      const res = await fetch(`/api/dispatch/post-dispatch/${invoiceId}/stock-deduction/${lineData.line.id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocationId: alloc.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Deducted successfully');
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitApproval = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dispatch/post-dispatch/${invoiceId}/stock-deduction/${lineData.line.id}/submit`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Submitted for approval');
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (action: 'approve' | 'reject') => {
    if (action === 'reject') {
      const remarks = window.prompt("Rejection Reason:");
      if (!remarks || remarks.trim().length < 5) {
        toast.error('Rejection remarks required (min 5 chars)');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/dispatch/post-dispatch/${invoiceId}/stock-deduction/${lineData.line.id}/reject`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ remarks })
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success('Rejected');
        onUpdate();
      } catch (err: any) {
        toast.error(err.message);
      } finally { setLoading(false); }
    } else {
      setLoading(true);
      try {
        const res = await fetch(`/api/dispatch/post-dispatch/${invoiceId}/stock-deduction/${lineData.line.id}/approve`, { method: 'POST' });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success('Approved');
        onUpdate();
      } catch (err: any) {
        toast.error(err.message);
      } finally { setLoading(false); }
    }
  };

  const isDeducted = status === 'DEDUCTED';
  const uomDisplay = lineData.line.uom || lineData.resolvedSku?.unit || '';
  const isMappingRequired = Boolean(lineData.mappingRequired);
  const manualItems = (alloc?.isExploded && Array.isArray(alloc?.allocationData)) ? alloc.allocationData : [];

  return (
    <div className={`border rounded-xl bg-white shadow-2xs overflow-hidden transition-all ${
      status === 'DEDUCTED' ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-200/80 hover:border-slate-300'
    }`}>
      {/* Header Row */}
      <div className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        
        <div className="flex gap-3 items-start flex-1 min-w-0">
          <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0 mt-0.5">
            {index}
          </div>
          <div className="space-y-1 min-w-0">
            <div className="font-bold text-slate-900 text-sm leading-snug">
              {lineData.line.itemName}
            </div>
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                Qty: <strong className="text-slate-900 font-semibold">{lineData.line.quantity}</strong>
                {uomDisplay && <span className="text-[11px] text-slate-500 font-normal">({uomDisplay})</span>}
              </span>

              {lineData.expectedWarehouse ? (
                <span className="inline-flex items-center gap-1">
                  WH: <strong className="text-slate-800 font-medium">{lineData.expectedWarehouse.name}</strong>
                </span>
              ) : lineData.zohoLocationId ? (
                <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-semibold border border-amber-200">
                  <AlertTriangle size={11} /> Warehouse Unmapped ({lineData.zohoLocationName || lineData.zohoLocationId})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                  No WH specified
                </span>
              )}

              {lineData.resolvedSku ? (
                <span className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50/60 px-2 py-0.5 rounded text-[11px] font-semibold border border-indigo-200/60">
                  SKU: {lineData.resolvedSku.name}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[11px] font-semibold border border-rose-200">
                  <AlertTriangle size={11} /> SKU Mapping Required
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2.5 shrink-0">
          <div className={`px-2.5 py-1 text-[10px] font-bold rounded-md border uppercase tracking-wider ${badgeColor}`}>
            {badgeText}
          </div>
          
          <div className="flex items-center gap-1.5 flex-wrap">
            {!isDeducted && classification === 'AUTO_APPROVED' && (
              <button 
                onClick={handleDeductAsIs}
                disabled={loading || !canDeductStock}
                className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-2xs"
              >
                Deduct As-Is
              </button>
            )}
            
            {!isDeducted && classification === 'APPROVAL_REQUIRED' && status === 'DRAFT' && (
              <button 
                onClick={handleSubmitApproval}
                disabled={loading || !canEditStockAllocation}
                className="px-3 py-1.5 bg-[#1A2766] text-white text-xs font-bold rounded-lg hover:bg-[#121c48] disabled:opacity-50 transition-colors shadow-2xs"
              >
                Submit Approval
              </button>
            )}
            
            {!isDeducted && status === 'SUBMITTED_FOR_APPROVAL' && canApproveStockDeduction && (
              <>
                <button onClick={() => handleDecision('approve')} disabled={loading} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-2xs">Approve</button>
                <button onClick={() => handleDecision('reject')} disabled={loading} className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors shadow-2xs">Reject</button>
              </>
            )}
            
            {!isDeducted && status === 'APPROVED' && (
               <button 
                onClick={handleDeductAsIs}
                disabled={loading || !canDeductStock}
                className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-2xs"
              >
                Deduct Approved
              </button>
            )}

            {!isDeducted && status !== 'SUBMITTED_FOR_APPROVAL' && status !== 'APPROVED' && (
              <>
                <button 
                  onClick={() => setExpandedMode(expandedMode === 'ALLOCATE' ? 'NONE' : 'ALLOCATE')}
                  disabled={loading || !canEditStockAllocation || isMappingRequired}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    expandedMode === 'ALLOCATE'
                      ? 'bg-slate-100 text-slate-900 border-slate-400 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={isMappingRequired ? "Direct allocation unavailable without SKU mapping. Use Add Items Manually." : "Configure warehouse stock allocation"}
                  aria-label="Allocate"
                >
                  <Boxes size={13} className="text-slate-500" />
                  <span>Allocate</span>
                </button>
                <button 
                  onClick={() => setExpandedMode(expandedMode === 'MANUAL' ? 'NONE' : 'MANUAL')}
                  disabled={loading || !canEditStockAllocation}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    expandedMode === 'MANUAL'
                      ? 'bg-indigo-50 text-indigo-900 border-indigo-400 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  } disabled:opacity-50`}
                  title="Add ERP inventory items manually for this invoice line."
                  aria-label="Add Items Manually"
                >
                  <ListPlus size={13} className="text-slate-500" />
                  <span>Add Items Manually</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Traceable Manually Added ERP Items Summary (when resolved via manual items) */}
      {manualItems.length > 0 && (
        <div className="px-4 py-2.5 bg-indigo-50/40 border-t border-indigo-100/80">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-indigo-900 flex items-center gap-1.5">
              <ListPlus size={13} className="text-indigo-600" />
              <span>Manually Associated ERP Items ({manualItems.length})</span>
            </span>
            <span className="text-[11px] text-indigo-600 font-medium">Linked to this invoice line</span>
          </div>
          <div className="space-y-1">
            {manualItems.map((item: any, idx: number) => (
              <div key={idx} className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 bg-white/90 rounded-lg border border-indigo-100 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                  <span className="font-bold text-slate-900 truncate">{item.skuName}</span>
                  {item.skuId && <span className="text-[10px] text-slate-400 font-mono">({item.skuId})</span>}
                </div>
                <div className="flex items-center gap-3 text-slate-600 shrink-0">
                  <span>Warehouse: <strong className="text-slate-800">{item.warehouseName || 'Default'}</strong></span>
                  <span>Qty: <strong className="text-slate-900 font-semibold">{item.qty} {item.uom}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {alloc?.deviationReasons && alloc.deviationReasons.length > 0 && (
        <div className="px-4 py-2 bg-amber-50/50 border-t border-amber-100 flex gap-2 items-center text-xs text-amber-800">
          <AlertCircle size={14} className="shrink-0" />
          <span>Deviations: {alloc.deviationReasons.map((d: string) => d === 'ITEM_EXPLODED' ? 'MANUAL_ITEMS_ADDED' : d).join(', ')}</span>
        </div>
      )}

      {/* Panels */}
      {expandedMode === 'ALLOCATE' && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-4">
          <WarehouseAllocationPanel 
            lineData={lineData} 
            invoiceId={invoiceId} 
            onSuccess={() => { setExpandedMode('NONE'); onUpdate(); }}
            onCancel={() => setExpandedMode('NONE')}
          />
        </div>
      )}
      
      {expandedMode === 'MANUAL' && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-4">
          <ManualItemSelectionPanel 
            lineData={lineData} 
            invoiceId={invoiceId}
            onSuccess={() => { setExpandedMode('NONE'); onUpdate(); }}
            onCancel={() => setExpandedMode('NONE')}
          />
        </div>
      )}
    </div>
  );
}
