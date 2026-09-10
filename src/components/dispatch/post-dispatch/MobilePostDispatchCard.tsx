'use client';

import React from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Camera,
  Building2,
  FileCheck,
} from 'lucide-react';
import { PostDispatchInvoiceSummary } from './InvoiceCard';

export interface MobilePostDispatchCardProps {
  invoice: PostDispatchInvoiceSummary;
  activeQueue: 'receiving' | 'check';
  onAction: (invoice: PostDispatchInvoiceSummary) => void;
}

function formatINR(val: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) {
    return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
  }
  return `${mins}m`;
}

export default function MobilePostDispatchCard({
  invoice,
  activeQueue,
  onAction,
}: MobilePostDispatchCardProps) {
  const isVoid = invoice.erpSubStatus === 'Void' || invoice.zohoStatus?.toLowerCase() === 'void';

  const receivingStatus = invoice.workflowSummary?.receivingStatus || 'PENDING';
  const checkedStatus = invoice.workflowSummary?.checkedStatus || 'PENDING';

  const receivingDone = receivingStatus === 'COMPLETED';
  const receivingRework = receivingStatus === 'REWORK_REQUIRED';
  const receivingAwaiting = receivingStatus === 'AWAITING_VERIFICATION';

  const checkedDone = checkedStatus === 'COMPLETED';
  const checkedRework = checkedStatus === 'REWORK_REQUIRED';
  const checkedAwaiting = checkedStatus === 'AWAITING_VERIFICATION';

  // Zoho status badge colors
  const zohoLower = (invoice.zohoStatus || '').toLowerCase();
  let zohoBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
  if (isVoid) {
    zohoBadgeClass = 'bg-red-50 text-red-700 border-red-200';
  } else if (zohoLower === 'paid') {
    zohoBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  } else if (zohoLower === 'partially paid' || zohoLower === 'partially_paid') {
    zohoBadgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (zohoLower === 'sent') {
    zohoBadgeClass = 'bg-blue-50 text-blue-800 border-blue-200';
  }

  return (
    <div
      onClick={() => onAction(invoice)}
      className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col gap-3 active:scale-[0.99] transition-transform cursor-pointer"
    >
      {/* Top row: Invoice #, Zoho Status, Timer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-[#1A2766] text-[15px] tracking-tight truncate">
            {invoice.invoiceNumber}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${zohoBadgeClass}`}
          >
            {invoice.zohoStatus || 'Active'}
          </span>
        </div>

        {/* Timer */}
        <div className="flex items-center gap-1 text-slate-600 text-xs font-semibold shrink-0 bg-slate-100/90 px-2 py-1 rounded-lg">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{formatDuration(invoice.timer?.elapsedSeconds || 0)}</span>
          {invoice.timer?.isStopped && (
            <span className="text-[10px] text-slate-400 font-normal">(stop)</span>
          )}
        </div>
      </div>

      {/* Customer Name, Warehouse, and Amount */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-[14px] font-semibold text-slate-900 truncate leading-snug">
            {invoice.customerName}
          </h4>
          <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
            <Building2 size={12} className="text-slate-400 shrink-0" />
            <span className="truncate">{invoice.warehouseName || 'Not Assigned'}</span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-[16px] font-black text-[#1A2766] leading-none">
            {formatINR(invoice.total)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-medium">Invoice Total</div>
        </div>
      </div>

      {/* Workflow Status Strip */}
      <div className="grid grid-cols-3 gap-1.5 py-2 px-2.5 bg-slate-50/80 rounded-xl border border-slate-100 text-[11px]">
        {/* Receiving */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-bold uppercase text-slate-400">Receiving</span>
          <div className="flex items-center gap-1">
            {receivingDone ? (
              <span className="font-semibold text-emerald-700 flex items-center gap-0.5">
                <CheckCircle2 size={11} className="text-emerald-600" /> Verified
              </span>
            ) : receivingRework ? (
              <span className="font-semibold text-amber-700 flex items-center gap-0.5">
                <AlertCircle size={11} className="text-amber-600" /> Rework
              </span>
            ) : receivingAwaiting ? (
              <span className="font-semibold text-blue-700 flex items-center gap-0.5">
                <Clock size={11} className="text-blue-600" /> In Review
              </span>
            ) : (
              <span className="font-semibold text-rose-600 flex items-center gap-1">
                <AlertCircle size={11} className="text-rose-500 shrink-0" /> Pending
              </span>
            )}
          </div>
        </div>

        {/* Checked */}
        <div className="flex flex-col gap-0.5 border-l border-slate-200/60 pl-2">
          <span className="text-[9px] font-bold uppercase text-slate-400">Checked</span>
          <div className="flex items-center gap-1">
            {checkedDone ? (
              <span className="font-semibold text-emerald-700 flex items-center gap-0.5">
                <CheckCircle2 size={11} className="text-emerald-600" /> Verified
              </span>
            ) : checkedRework ? (
              <span className="font-semibold text-amber-700 flex items-center gap-0.5">
                <AlertCircle size={11} className="text-amber-600" /> Rework
              </span>
            ) : checkedAwaiting ? (
              <span className="font-semibold text-blue-700 flex items-center gap-0.5">
                <Clock size={11} className="text-blue-600" /> In Review
              </span>
            ) : (
              <span className="font-semibold text-rose-600 flex items-center gap-1">
                <AlertCircle size={11} className="text-rose-500 shrink-0" /> Pending
              </span>
            )}
          </div>
        </div>

        {/* E-Invoice */}
        <div className="flex flex-col gap-0.5 border-l border-slate-200/60 pl-2">
          <span className="text-[9px] font-bold uppercase text-slate-400">E-Invoice</span>
          <div>
            {invoice.isConsumer ? (
              <span className="font-medium text-slate-400">Consumer</span>
            ) : invoice.eInvoice?.generated ? (
              <span className="font-semibold text-teal-700 flex items-center gap-0.5">
                <CheckCircle2 size={11} className="text-teal-600" /> Done
              </span>
            ) : (
              <span className="font-semibold text-rose-600 flex items-center gap-1">
                <AlertCircle size={11} className="text-rose-500 shrink-0" /> Pending
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Queue-Specific Contextual Action Button (Single Primary Button) */}
      <div className="pt-1 border-t border-slate-100">
        {activeQueue === 'receiving' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAction(invoice);
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-[#1A2766] hover:bg-[#131d4d] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all"
          >
            <Camera size={15} />
            <span>{receivingRework ? 'Re-upload Receiving Proof' : 'Upload Receiving Proof'}</span>
          </button>
        )}

        {activeQueue === 'check' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAction(invoice);
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-[#1A2766] hover:bg-[#131d4d] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all"
          >
            <FileCheck size={15} />
            <span>{checkedRework ? 'Re-upload Check Evidence' : 'Upload Check Evidence'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
