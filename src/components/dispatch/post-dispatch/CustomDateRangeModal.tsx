'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, X, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export interface CustomDateRangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFrom?: string;
  initialTo?: string;
  onApply: (from: string, to: string) => void;
}

export default function CustomDateRangeModal({
  isOpen,
  onClose,
  initialFrom = '',
  initialTo = '',
  onApply,
}: CustomDateRangeModalProps) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [fromVal, setFromVal] = useState(initialFrom || todayStr);
  const [toVal, setToVal] = useState(initialTo || todayStr);
  const [error, setError] = useState<string | null>(null);

  // Sync state with props when modal opens
  useEffect(() => {
    if (isOpen) {
      setFromVal(initialFrom || todayStr);
      setToVal(initialTo || todayStr);
      setError(null);
    }
  }, [isOpen, initialFrom, initialTo, todayStr]);

  if (!isOpen) return null;

  const handleApply = () => {
    if (!fromVal) {
      setError('Please select a start date (From).');
      return;
    }
    const effectiveTo = toVal || fromVal;
    if (effectiveTo < fromVal) {
      setError('End date (To) cannot be earlier than start date (From).');
      return;
    }
    setError(null);
    onApply(fromVal, effectiveTo);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#1A2766]/10 text-[#1A2766] rounded-xl">
              <Calendar size={18} strokeWidth={2.2} />
            </div>
            <div>
              <h3 className="font-bold text-[#1A2766] text-sm">Select Custom Range</h3>
              <p className="text-[11px] text-slate-500 font-medium">Filter invoices by dispatch date</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content / Inputs */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                From Date
              </label>
              <input
                type="date"
                value={fromVal}
                max={todayStr}
                onChange={(e) => {
                  setFromVal(e.target.value);
                  setError(null);
                }}
                className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                To Date
              </label>
              <input
                type="date"
                value={toVal}
                min={fromVal}
                max={todayStr}
                onChange={(e) => {
                  setToVal(e.target.value);
                  setError(null);
                }}
                className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/70 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!fromVal}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#1A2766] hover:bg-[#1A2766]/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
          >
            Apply Range
          </button>
        </div>
      </div>
    </div>
  );
}
