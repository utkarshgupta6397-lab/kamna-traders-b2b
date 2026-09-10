'use client';

import React from 'react';
import { Clock, CheckCircle2, Circle, AlertCircle, Ban, ChevronRight } from 'lucide-react';

export interface PostDispatchInvoiceSummary {
  id: string;
  invoiceNumber: string;
  zohoInvoiceId?: string;
  customerId?: string | null;
  customerName: string;
  warehouseName?: string | null;
  total: number;
  currencyCode: string;
  salesOrderNumber?: string | null;
  zohoStatus: string;
  erpStatus: string;
  erpSubStatus?: string | null;
  isActionable: boolean;
  isConsumer?: boolean;
  eInvoice: {
    generated: boolean;
    irn?: string | null;
    ackNo?: string | null;
    ackDate?: string | null;
    status?: string | null;
  };
  timer: {
    startedAt: string;
    stoppedAt?: string | null;
    elapsedSeconds: number;
    isStopped: boolean;
  };
  workflowSummary: {
    total: number;
    completedCount: number;
    receivingStatus: string;
    checkedStatus: string;
    inventoryStatus: string;
  };
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

interface InvoiceCardProps {
  invoice: PostDispatchInvoiceSummary;
  onOpen: (invoice: PostDispatchInvoiceSummary) => void;
}

export default function InvoiceCard({ invoice, onOpen }: InvoiceCardProps) {
  const isVoid = invoice.erpSubStatus === 'Void' || invoice.zohoStatus.toLowerCase() === 'void';
  const isDraft = invoice.zohoStatus.toLowerCase() === 'draft';

  const receivingDone = invoice.workflowSummary.receivingStatus === 'COMPLETED';
  const receivingAwaiting = invoice.workflowSummary.receivingStatus === 'AWAITING_VERIFICATION';
  const receivingRework = invoice.workflowSummary.receivingStatus === 'REWORK_REQUIRED';

  const checkedDone = invoice.workflowSummary.checkedStatus === 'COMPLETED';
  const checkedAwaiting = invoice.workflowSummary.checkedStatus === 'AWAITING_VERIFICATION';
  const checkedRework = invoice.workflowSummary.checkedStatus === 'REWORK_REQUIRED';

  const hasRework = receivingRework || checkedRework;
  const hasAwaiting = receivingAwaiting || checkedAwaiting;

  return (
    <div
      onClick={() => onOpen(invoice)}
      className={`bg-white rounded-2xl p-4 border transition-all active:scale-[0.99] cursor-pointer shadow-sm ${
        isVoid
          ? 'border-red-200 bg-red-50/20 opacity-80'
          : hasRework
          ? 'border-amber-300 bg-amber-50/10'
          : hasAwaiting
          ? 'border-blue-200'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Top row: Invoice #, Zoho status badge, Timer */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#1A2766] text-base tracking-tight">
            {invoice.invoiceNumber}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
              isVoid
                ? 'bg-red-100 text-red-700'
                : isDraft
                ? 'bg-slate-100 text-slate-600'
                : invoice.zohoStatus.toLowerCase() === 'sent'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-blue-100 text-blue-800'
            }`}
          >
            {invoice.zohoStatus}
          </span>
          {isDraft && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500">
              Not Actionable
            </span>
          )}
        </div>

        {/* Timer */}
        <div className="flex items-center gap-1 text-slate-600 text-xs font-semibold shrink-0 bg-slate-100/80 px-2 py-1 rounded-lg">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{formatDuration(invoice.timer.elapsedSeconds)}</span>
          {invoice.timer.isStopped && (
            <span className="text-[10px] text-slate-400 font-normal">(stop)</span>
          )}
        </div>
      </div>

      {/* Customer Name & Amount */}
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-sm font-semibold text-slate-800 truncate pr-2">
          {invoice.customerName}
        </div>
        <div className="text-base font-bold text-[#1A2766] shrink-0">
          {formatINR(invoice.total)}
        </div>
      </div>

      {/* Badges row: E-Invoice & Attention Badges */}
      <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
        {/* E-Invoice */}
        {invoice.eInvoice.generated ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-medium text-[11px] border border-teal-200">
            <CheckCircle2 className="w-3 h-3 text-teal-600" />
            E-Invoice: Generated
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px]">
            <Circle className="w-3 h-3 text-slate-400" />
            E-Invoice: Not Generated
          </span>
        )}

        {/* Attention badge */}
        {hasRework && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[11px]">
            <AlertCircle className="w-3 h-3 text-amber-600" />
            Rework Required
          </span>
        )}

        {hasAwaiting && !hasRework && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-semibold text-[11px]">
            <Clock className="w-3 h-3 text-blue-600" />
            Awaiting Verification
          </span>
        )}

        {isVoid && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 text-red-800 font-bold text-[11px]">
            <Ban className="w-3 h-3 text-red-600" />
            Archived — Void
          </span>
        )}
      </div>

      {/* Workflows summary footer */}
      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          {/* Receiving status */}
          <div className="flex items-center gap-1">
            {receivingDone ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : receivingRework ? (
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            ) : receivingAwaiting ? (
              <div className="w-3.5 h-3.5 rounded-full bg-blue-500" />
            ) : (
              <Circle className="w-3.5 h-3.5 text-slate-300" />
            )}
            <span
              className={
                receivingDone
                  ? 'text-emerald-700 font-medium'
                  : receivingRework
                  ? 'text-amber-700 font-semibold'
                  : 'text-slate-500'
              }
            >
              Receiving
            </span>
          </div>

          {/* Checked status */}
          <div className="flex items-center gap-1">
            {checkedDone ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : checkedRework ? (
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            ) : checkedAwaiting ? (
              <div className="w-3.5 h-3.5 rounded-full bg-blue-500" />
            ) : (
              <Circle className="w-3.5 h-3.5 text-slate-300" />
            )}
            <span
              className={
                checkedDone
                  ? 'text-emerald-700 font-medium'
                  : checkedRework
                  ? 'text-amber-700 font-semibold'
                  : 'text-slate-500'
              }
            >
              Checked
            </span>
          </div>

          {/* Inventory status (placeholder) */}
          <div className="flex items-center gap-1 text-slate-400">
            <Circle className="w-3.5 h-3.5 text-slate-300" />
            <span>Inventory</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-blue-600 font-semibold text-xs">
          <span>Open</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
}
