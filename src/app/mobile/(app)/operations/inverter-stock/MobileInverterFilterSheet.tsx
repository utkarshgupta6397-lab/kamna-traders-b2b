import React, { useState, useEffect, useMemo } from 'react';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';

export type FilterSection = 'Warehouses' | 'Brands' | 'Inverter Types' | 'Phases' | 'Capacities';

export interface FilterState {
  warehouses: string[];
  brands: string[];
  types: string[];
  phases: string[];
  capacities: string[];
}

interface FilterOption {
  id: string;
  name: string;
}

interface FilterOptions {
  warehouses: FilterOption[];
  brands: FilterOption[];
  types: FilterOption[];
  phases: FilterOption[];
  capacities: FilterOption[];
}

interface MobileInverterFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  options: FilterOptions;
  appliedFilters: FilterState;
  onApply: (filters: FilterState) => void;
  getMatchCount: (draftFilters: FilterState) => number;
}

const FilterCheckList = ({
  options,
  selected,
  onToggle,
}: {
  options: FilterOption[];
  selected: string[];
  onToggle: (id: string) => void;
}) => (
  <div className="flex flex-col">
    {options.map((opt) => (
      <button
        key={opt.id}
        onClick={() => onToggle(opt.id)}
        className="flex items-center gap-3 px-2 py-3 border-b border-slate-100 last:border-0 active:bg-slate-50 transition-colors text-left"
      >
        <div
          className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
            selected.includes(opt.id)
              ? 'bg-[#1A2766] border-[#1A2766]'
              : 'bg-white border-slate-300'
          }`}
        >
          {selected.includes(opt.id) && <Check size={14} className="text-white" strokeWidth={3} />}
        </div>
        <span className="text-[15px] text-slate-700 font-medium leading-snug">{opt.name}</span>
      </button>
    ))}
  </div>
);

export function MobileInverterFilterSheet({
  isOpen,
  onClose,
  options,
  appliedFilters,
  onApply,
  getMatchCount,
}: MobileInverterFilterSheetProps) {
  const [sheetVisible, setSheetVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeView, setActiveView] = useState<FilterSection | null>(null);
  const [draft, setDraft] = useState<FilterState>(appliedFilters);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line
      setDraft(appliedFilters);
      // eslint-disable-next-line
      setActiveView(null);
      setMounted(true);
      requestAnimationFrame(() => setSheetVisible(true));
    } else {
      setSheetVisible(false);
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [isOpen, appliedFilters]);

  const matchCount = useMemo(() => getMatchCount(draft), [draft, getMatchCount]);

  if (!mounted) return null;

  const handleToggle = (section: keyof FilterState, id: string) => {
    setDraft((prev) => ({
      ...prev,
      [section]: prev[section].includes(id)
        ? prev[section].filter((v) => v !== id)
        : [...prev[section], id],
    }));
  };

  const handleClearAll = () => {
    setDraft({
      warehouses: [],
      brands: [],
      types: [],
      phases: [],
      capacities: [],
    });
  };

  const renderSelectionSummary = (selected: string[], opts: FilterOption[]) => {
    if (selected.length === 0) return 'All';
    if (selected.length === 1) {
      const found = opts.find((o) => o.id === selected[0]);
      return found ? found.name : '1 selected';
    }
    return `${selected.length} selected`;
  };

  const rows: { id: FilterSection; key: keyof FilterState; label: string; opts: FilterOption[] }[] = [
    { id: 'Warehouses', key: 'warehouses', label: 'Warehouses', opts: options.warehouses },
    { id: 'Brands', key: 'brands', label: 'Brands', opts: options.brands },
    { id: 'Inverter Types', key: 'types', label: 'Inverter Types', opts: options.types },
    { id: 'Phases', key: 'phases', label: 'Phases', opts: options.phases },
    { id: 'Capacities', key: 'capacities', label: 'Capacities', opts: options.capacities },
  ];

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col justify-end transition-colors duration-300 ${
        sheetVisible ? 'bg-black/40' : 'bg-transparent pointer-events-none'
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-white w-full rounded-t-[20px] shadow-2xl flex flex-col transition-transform duration-300 pb-[env(safe-area-inset-bottom)] ${
          sheetVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ height: '88dvh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0 bg-white rounded-t-[20px]">
          <div className="w-10 h-1.5 bg-slate-200 rounded-full" />
        </div>

        {activeView === null ? (
          // --- MAIN VIEW ---
          <>
            <div className="px-5 pt-2 pb-4 flex items-center justify-between shrink-0 bg-white">
              <h3 className="font-bold text-slate-900 text-[20px]">Filters</h3>
              <button
                onClick={onClose}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-2">
              <div className="flex flex-col gap-2">
                {rows.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => setActiveView(row.id)}
                    className="flex items-center justify-between py-4 border-b border-slate-100 active:bg-slate-50 transition-colors text-left"
                  >
                    <span className="text-[16px] font-medium text-slate-800">{row.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] text-slate-400 truncate max-w-[140px]">
                        {renderSelectionSummary(draft[row.key], row.opts)}
                      </span>
                      <ChevronRight size={18} className="text-slate-300" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          // --- DRILL-DOWN VIEW ---
          <>
            <div className="px-3 pt-2 pb-4 flex items-center shrink-0 bg-white border-b border-slate-100">
              <button
                onClick={() => setActiveView(null)}
                className="p-2 active:bg-slate-100 rounded-full text-slate-600 transition-colors mr-2"
              >
                <ChevronLeft size={24} />
              </button>
              <h3 className="font-bold text-slate-900 text-[18px] flex-1">{activeView}</h3>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-2">
              {(() => {
                const row = rows.find((r) => r.id === activeView);
                if (!row || row.opts.length === 0) {
                  return <p className="text-[14px] text-slate-400 text-center py-6">No options available</p>;
                }
                return (
                  <FilterCheckList
                    options={row.opts}
                    selected={draft[row.key]}
                    onToggle={(id) => handleToggle(row.key, id)}
                  />
                );
              })()}
            </div>
          </>
        )}

        {/* --- FIXED BOTTOM ACTIONS --- */}
        <div className="bg-white border-t border-slate-100 px-5 py-4 shrink-0 flex items-center gap-4">
          <button
            onClick={handleClearAll}
            className="text-[15px] font-bold text-slate-600 active:opacity-60 transition-opacity whitespace-nowrap"
          >
            Clear All
          </button>
          <button
            onClick={() => onApply(draft)}
            className="flex-1 bg-[#1A2766] text-white font-bold text-[15px] rounded-xl py-3.5 active:opacity-80 transition-opacity"
          >
            Show {matchCount} {matchCount === 1 ? 'result' : 'results'}
          </button>
        </div>
      </div>
    </div>
  );
}
