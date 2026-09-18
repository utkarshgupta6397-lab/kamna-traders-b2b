'use client';

import React, { useRef } from 'react';
import { Package, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatShortUom } from '@/lib/stock-deduction-service';

export interface CardLineItem {
  line: {
    id: string;
    itemId: string | null;
    itemName: string;
    quantity: number;
    uom: string;
    hsnCode?: string | null;
  };
  image?: string | null;
  resolvedSku?: {
    id: string;
    name: string;
    unit: string | null;
    isDecimal: boolean;
  } | null;
  mappingRequired: boolean;
  expectedWarehouse?: {
    id: string;
    name: string;
    zohoLocationId?: string | null;
  } | null;
  warehouseStocks?: Array<{
    warehouseId: string;
    warehouseName: string;
    availableQty: number;
    uom: string | null;
  }>;
  allocation?: any;
  draftState?: {
    isConfigured?: boolean;
    isExploded?: boolean;
    totalUnits?: number;
    hasError?: boolean;
  };
}

interface Props {
  lines: CardLineItem[];
  selectedLineId: string | null;
  onSelectLine: (lineId: string) => void;
}

export default function InvoiceItemCardRibbon({
  lines,
  selectedLineId,
  onSelectLine,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -260 : 260;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const getItemBadge = (item: CardLineItem) => {
    const status = item.allocation?.status;

    if (status === 'DEDUCTED') {
      return {
        label: 'Deducted',
        classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
      };
    }
    if (status === 'APPROVED') {
      return {
        label: 'Approved',
        classes: 'bg-green-50 text-green-700 border-green-200',
        dot: 'bg-green-500',
      };
    }
    if (status === 'SUBMITTED_FOR_APPROVAL') {
      return {
        label: 'Pending Approval',
        classes: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
      };
    }
    if (status === 'REWORK_REQUIRED') {
      return {
        label: 'Rework Required',
        classes: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-500',
      };
    }
    if (item.draftState?.isConfigured || status === 'DRAFT') {
      return {
        label: item.draftState?.isExploded || item.allocation?.isExploded ? 'Exploded (Draft)' : 'Configured',
        classes: 'bg-purple-50 text-purple-700 border-purple-200',
        dot: 'bg-purple-500',
      };
    }
    if (item.mappingRequired) {
      return {
        label: 'Mapping Required',
        classes: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-500',
      };
    }
    return {
      label: 'Ready',
      classes: 'bg-blue-50 text-blue-700 border-blue-200',
      dot: 'bg-blue-500',
    };
  };

  return (
    <div className="relative group w-full">
      {/* Scroll Controls (visible when items overflow) */}
      {lines.length > 3 && (
        <>
          <button
            type="button"
            onClick={() => scroll('left')}
            className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/95 shadow-md border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Scroll left"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/95 shadow-md border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Scroll right"
          >
            <ChevronRight size={16} />
          </button>
        </>
      )}

      {/* Horizontal Ribbon Container */}
      <div
        ref={scrollRef}
        className="flex items-stretch gap-3 overflow-x-auto pb-2 pt-1 scroll-smooth"
      >
        {lines.map((item, idx) => {
          const isSelected = item.line.id === selectedLineId;
          const badge = getItemBadge(item);
          const uom = formatShortUom(item.line.uom || item.resolvedSku?.unit || 'Units');

          return (
            <div
              key={item.line.id}
              onClick={() => onSelectLine(item.line.id)}
              className={`min-w-[170px] max-w-[200px] sm:min-w-[190px] sm:max-w-[210px] shrink-0 p-2.5 rounded-xl border cursor-pointer select-none transition-all flex flex-col justify-between ${
                isSelected
                  ? 'border-[#1A2766] bg-indigo-50/30 shadow-sm ring-2 ring-[#1A2766]/20'
                  : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-2xs'
              }`}
            >
              <div>
                {/* Product Image / Placeholder */}
                <div className="w-full h-24 bg-slate-100/80 rounded-lg overflow-hidden flex items-center justify-center relative border border-slate-100">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.line.itemName}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                      <Package size={28} className="text-slate-300 stroke-[1.5]" />
                      <span className="text-[10px] font-medium text-slate-400 mt-1">No Image</span>
                    </div>
                  )}

                  {/* Top-Right Item Index */}
                  <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-xs text-white text-[10px] font-bold">
                    #{idx + 1}
                  </span>
                </div>

                {/* Product Name */}
                <div className="mt-2">
                  <h4
                    className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2"
                    title={item.line.itemName}
                  >
                    {item.line.itemName}
                  </h4>
                </div>
              </div>

              {/* Quantity & Status Badge */}
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                <span className="text-xs font-bold text-slate-900 whitespace-nowrap">
                  {item.line.quantity} <span className="text-[11px] font-medium text-slate-500">{uom}</span>
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border truncate flex items-center gap-1 ${badge.classes}`}
                  title={badge.label}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${badge.dot}`} />
                  <span className="truncate">{badge.label}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
