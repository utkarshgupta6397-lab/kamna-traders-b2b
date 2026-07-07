'use client';
import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Filter, X, Check, Download, ChevronDown } from 'lucide-react';
import type { FilterState, FilterOptions, FilterOption } from '@/lib/report-salesman';
import { countActiveFilters, getDefaultFilterState } from '@/lib/report-salesman';

interface CallingAgentFilterPanelProps {
  filterState: FilterState;
  filterOptions: FilterOptions;
  onFilterChange: (state: FilterState) => void;
  onExportCSV: () => void;
  loading: boolean;
}

// ------------------------------------
// Internal MultiSelect Component
// ------------------------------------
const MultiSelect = memo(function MultiSelect({
  label,
  options,
  selectedValues,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggle = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter(v => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white text-left"
      >
        <span className="truncate text-gray-700">
          {selectedValues.length === 0
            ? label
            : `${label} (${selectedValues.length})`}
        </span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 w-[240px] bg-white border border-gray-200 rounded-md shadow-lg py-1 overflow-hidden">
          <div className="max-h-[160px] overflow-y-auto overflow-x-hidden">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400 italic">No options available</div>
            ) : (
              options.map(opt => {
                const isSelected = selectedValues.includes(opt.value);
                return (
                  <div key={opt.value} onClick={() => toggle(opt.value)} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer group truncate">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 group-hover:border-blue-400'}`}>
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>
                    <span className="text-sm text-gray-700 truncate" title={opt.label}>{opt.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
});

// ------------------------------------
// Main Panel
// ------------------------------------
function CallingAgentFilterPanelComponent({
  filterState,
  filterOptions,
  onFilterChange,
  onExportCSV,
  loading,
}: CallingAgentFilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [staged, setStaged] = useState<FilterState>(filterState);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Sync staged when panel opens
  useEffect(() => {
    if (isOpen) setStaged(filterState);
  }, [isOpen, filterState]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const activeCount = countActiveFilters(filterState);

  const handleApply = () => {
    onFilterChange(staged);
    setIsOpen(false);
  };

  const handleReset = () => {
    setStaged(getDefaultFilterState());
  };

  // Helper to remove a single active dimension directly from filterState
  const removeFilterDimension = (key: keyof FilterState) => {
    onFilterChange({
      ...filterState,
      [key]: key === 'paymentStatus' ? 'all' : [],
    });
  };

  const updateStaged = (key: keyof FilterState, value: any) => {
    setStaged(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
      {/* ─── Top Bar ─── */}
      <div className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            ref={buttonRef}
            onClick={() => setIsOpen(!isOpen)}
            disabled={loading}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
              isOpen || activeCount > 0
                ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            } disabled:opacity-50`}
          >
            <Filter size={16} />
            Filters
            {activeCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 ml-1 text-[10px] font-bold bg-blue-600 text-white rounded-full">
                {activeCount}
              </span>
            )}
            <ChevronDown size={14} className={`ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Active Chips (below bar in normal flow, but inline here) */}
          <div className="hidden md:flex items-center gap-2 flex-wrap max-h-8 overflow-hidden">
            {filterState.financialYears.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                FY ({filterState.financialYears.length})
                <button onClick={() => removeFilterDimension('financialYears')} className="hover:text-blue-900"><X size={12} /></button>
              </span>
            )}
            {filterState.quarters.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                Quarter ({filterState.quarters.length})
                <button onClick={() => removeFilterDimension('quarters')} className="hover:text-blue-900"><X size={12} /></button>
              </span>
            )}
            {filterState.months.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                Month ({filterState.months.length})
                <button onClick={() => removeFilterDimension('months')} className="hover:text-blue-900"><X size={12} /></button>
              </span>
            )}
            {filterState.salesmanIds.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                Salesman ({filterState.salesmanIds.length})
                <button onClick={() => removeFilterDimension('salesmanIds')} className="hover:text-green-900"><X size={12} /></button>
              </span>
            )}
            {filterState.callingExecIds.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                Calling Exec ({filterState.callingExecIds.length})
                <button onClick={() => removeFilterDimension('callingExecIds')} className="hover:text-green-900"><X size={12} /></button>
              </span>
            )}
            {filterState.subVendorIds.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                Sub Vendor ({filterState.subVendorIds.length})
                <button onClick={() => removeFilterDimension('subVendorIds')} className="hover:text-green-900"><X size={12} /></button>
              </span>
            )}
            {filterState.leadSources.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                Lead ({filterState.leadSources.length})
                <button onClick={() => removeFilterDimension('leadSources')} className="hover:text-purple-900"><X size={12} /></button>
              </span>
            )}
            {filterState.systemTypes.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                System ({filterState.systemTypes.length})
                <button onClick={() => removeFilterDimension('systemTypes')} className="hover:text-amber-900"><X size={12} /></button>
              </span>
            )}
            {filterState.orderStatuses.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-pink-100 text-pink-800">
                Status ({filterState.orderStatuses.length})
                <button onClick={() => removeFilterDimension('orderStatuses')} className="hover:text-pink-900"><X size={12} /></button>
              </span>
            )}
            {filterState.paymentStatus !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[#1976D2] text-white">
                Payment: {filterState.paymentStatus}
                <button onClick={() => removeFilterDimension('paymentStatus')} className="hover:text-blue-100"><X size={12} /></button>
              </span>
            )}
          </div>
        </div>

        <div>
          <button
            onClick={onExportCSV}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-white text-gray-700 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* ─── Dropdown Panel ─── */}
      {isOpen && (
        <div ref={panelRef} className="absolute left-0 top-full w-full bg-white border-b border-gray-200 shadow-lg px-6 py-5 z-40 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-5">
            {/* Row 1: Time */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Time Period</h3>
              <div className="space-y-3">
                <MultiSelect label="Financial Year" options={filterOptions.financialYears} selectedValues={staged.financialYears} onChange={v => updateStaged('financialYears', v)} />
                <MultiSelect label="Quarter" options={filterOptions.quarters} selectedValues={staged.quarters} onChange={v => updateStaged('quarters', v)} />
                <MultiSelect label="Month" options={filterOptions.months} selectedValues={staged.months} onChange={v => updateStaged('months', v)} />
              </div>
            </div>

            {/* Row 2: People */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Personnel</h3>
              <div className="space-y-3">
                <MultiSelect label="Salesman" options={filterOptions.salesmen} selectedValues={staged.salesmanIds} onChange={v => updateStaged('salesmanIds', v)} />
                <MultiSelect label="Calling Executive" options={filterOptions.callingExecs} selectedValues={staged.callingExecIds} onChange={v => updateStaged('callingExecIds', v)} />
                <MultiSelect label="Sub Vendor" options={filterOptions.subVendors} selectedValues={staged.subVendorIds} onChange={v => updateStaged('subVendorIds', v)} />
              </div>
            </div>

            {/* Row 3: Categories */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Categories</h3>
              <div className="space-y-3">
                <MultiSelect label="Lead Source" options={filterOptions.leadSources} selectedValues={staged.leadSources} onChange={v => updateStaged('leadSources', v)} />
                <MultiSelect label="System Type" options={filterOptions.systemTypes} selectedValues={staged.systemTypes} onChange={v => updateStaged('systemTypes', v)} />
                <MultiSelect label="Order Status" options={filterOptions.statuses} selectedValues={staged.orderStatuses} onChange={v => updateStaged('orderStatuses', v)} />
              </div>
            </div>

            {/* Row 4: Payment */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Payment Status</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'pending', label: '100% Pending' },
                  { id: 'partial', label: 'Partially Paid' },
                  { id: 'paid', label: 'Fully Paid' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => updateStaged('paymentStatus', opt.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      staged.paymentStatus === opt.id
                        ? 'bg-[#1976D2] text-white border-[#1976D2]'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-end gap-3">
            <button onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Cancel
            </button>
            <button onClick={handleReset} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Reset
            </button>
            <button onClick={handleApply} className="px-5 py-2 text-sm font-medium bg-[#1976D2] text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2">
              <Check size={16} /> Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(CallingAgentFilterPanelComponent);
