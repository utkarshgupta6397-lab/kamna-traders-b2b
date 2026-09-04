'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SolarFilterState {
  warehouses: string[];
  brands: string[];
  dcrStatus: string[]; // 'DCR' | 'Non-DCR'
  series: string[];
  wattages: string[];
}

interface FilterOptions {
  warehouses: { id: string; name: string }[];
  brands: { id: string; name: string }[];
  series: { id: string; name: string }[];
  wattages: { id: string; name: string }[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  options: FilterOptions;
  appliedFilters: SolarFilterState;
  onApply: (filters: SolarFilterState) => void;
  getMatchCount: (draft: SolarFilterState) => number;
}

type FilterDimension = 'warehouses' | 'brands' | 'dcrStatus' | 'series' | 'wattages';

const DCR_OPTIONS = [
  { id: 'DCR', name: 'DCR' },
  { id: 'Non-DCR', name: 'Non-DCR' },
];

// ─── Drill-down list screen ───────────────────────────────────────────────────

function DrillDownScreen({
  title,
  options,
  selected,
  onToggle,
  onBack,
}: {
  title: string;
  options: { id: string; name: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-lg active:bg-slate-100 transition-colors text-slate-600">
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
        <span className="font-bold text-[15px] text-slate-800 flex-1">{title}</span>
        {selected.length > 0 && (
          <button onClick={() => selected.forEach(s => onToggle(s))} className="text-[12px] font-bold text-[#1A2766]">
            Clear
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {options.map(opt => {
          const isSelected = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => onToggle(opt.id)}
              className="w-full flex items-center justify-between px-4 py-3.5 border-b border-slate-50 active:bg-slate-50 transition-colors text-left"
            >
              <span className={`text-[14px] font-medium ${isSelected ? 'text-[#1A2766]' : 'text-slate-700'}`}>{opt.name}</span>
              {isSelected && <Check size={16} className="text-[#1A2766] shrink-0" strokeWidth={2.5} />}
            </button>
          );
        })}
        {options.length === 0 && (
          <div className="flex items-center justify-center py-12 text-slate-400 text-[13px]">No options available</div>
        )}
      </div>
    </div>
  );
}

// ─── Main filter sheet ────────────────────────────────────────────────────────

export function MobileSolarPanelFilterSheet({ isOpen, onClose, options, appliedFilters, onApply, getMatchCount }: Props) {
  const [draft, setDraft] = useState<SolarFilterState>(appliedFilters);
  const [activeDimension, setActiveDimension] = useState<FilterDimension | null>(null);

  // Sync draft when sheet opens
  useEffect(() => {
    if (isOpen) {
      setDraft(appliedFilters);
      setActiveDimension(null);
    }
  }, [isOpen, appliedFilters]);

  const toggleValue = useCallback((dim: FilterDimension, value: string) => {
    setDraft(prev => {
      const arr = prev[dim] as string[];
      return {
        ...prev,
        [dim]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
      };
    });
  }, []);

  const clearAll = useCallback(() => {
    setDraft({ warehouses: [], brands: [], dcrStatus: [], series: [], wattages: [] });
  }, []);

  const matchCount = getMatchCount(draft);
  const totalSelected =
    draft.warehouses.length + draft.brands.length + draft.dcrStatus.length +
    draft.series.length + draft.wattages.length;

  const dimensionLabel = (dim: FilterDimension): string => {
    const count = (draft[dim] as string[]).length;
    const titles: Record<FilterDimension, string> = {
      warehouses: 'Warehouses',
      brands: 'Brands',
      dcrStatus: 'DCR Status',
      series: 'Series',
      wattages: 'Wattage',
    };
    return count > 0 ? `${titles[dim]} (${count})` : titles[dim];
  };

  const getDrillOptions = (dim: FilterDimension) => {
    if (dim === 'dcrStatus') return DCR_OPTIONS;
    if (dim === 'warehouses') return options.warehouses;
    if (dim === 'brands') return options.brands;
    if (dim === 'series') return options.series;
    return options.wattages;
  };

  const dimensionList: FilterDimension[] = ['warehouses', 'brands', 'dcrStatus', 'series', 'wattages'];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-[150] transition-opacity"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-[160] bg-white rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: '88vh', paddingBottom: 'env(safe-area-inset-bottom)' }}>

        {activeDimension ? (
          // ── Drill-down screen ──────────────────────────────────────────────
          <div className="flex flex-col flex-1 min-h-0" style={{ maxHeight: '88vh' }}>
            <DrillDownScreen
              title={dimensionLabel(activeDimension)}
              options={getDrillOptions(activeDimension)}
              selected={draft[activeDimension] as string[]}
              onToggle={value => toggleValue(activeDimension, value)}
              onBack={() => setActiveDimension(null)}
            />
            {/* Apply footer in drill-down */}
            <div className="shrink-0 px-4 py-3 border-t border-slate-100">
              <button
                onClick={() => setActiveDimension(null)}
                className="w-full bg-[#1A2766] text-white rounded-2xl py-3.5 text-[15px] font-bold active:opacity-80 transition-opacity"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          // ── Root screen ────────────────────────────────────────────────────
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100 shrink-0">
              <span className="font-bold text-[17px] text-slate-900">Filters</span>
              <div className="flex items-center gap-3">
                {totalSelected > 0 && (
                  <button onClick={clearAll} className="text-[13px] font-bold text-rose-500">
                    Clear all
                  </button>
                )}
                <button onClick={onClose} className="p-1.5 rounded-full active:bg-slate-100 transition-colors">
                  <X size={20} className="text-slate-500" />
                </button>
              </div>
            </div>

            {/* Dimension list */}
            <div className="flex-1 overflow-y-auto">
              {dimensionList.map(dim => {
                const count = (draft[dim] as string[]).length;
                return (
                  <button
                    key={dim}
                    onClick={() => setActiveDimension(dim)}
                    className="w-full flex items-center justify-between px-4 py-4 border-b border-slate-50 active:bg-slate-50 transition-colors text-left"
                  >
                    <span className="text-[15px] font-semibold text-slate-800">{dimensionLabel(dim)}</span>
                    <div className="flex items-center gap-2">
                      {count > 0 && (
                        <span className="text-[12px] font-bold text-white bg-[#1A2766] rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 leading-none">
                          {count}
                        </span>
                      )}
                      <ChevronRight size={18} className="text-slate-400" />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Apply footer */}
            <div className="shrink-0 px-4 py-4 border-t border-slate-100">
              <button
                onClick={() => onApply(draft)}
                className="w-full bg-[#1A2766] text-white rounded-2xl py-3.5 text-[15px] font-bold active:opacity-80 transition-opacity"
              >
                {matchCount > 0 ? `Show ${matchCount} result${matchCount === 1 ? '' : 's'}` : 'No results — Clear filters'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
