'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useRef, useEffect } from 'react';
import { Filter, X, Check, Loader2 } from 'lucide-react';
import ReportExport from './ReportExport';

interface FilterOption {
  value: string;
  label: string;
}

interface ReportFiltersProps {
  users?: FilterOption[];
  filterType: 'salesman' | 'calling-agent';
  loading?: boolean;
}

export default function ReportFilters({ users = [], filterType, loading = false }: ReportFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Local state for filter panel before applying
  const [localFilters, setLocalFilters] = useState({
    quarter: searchParams.get('quarter') ? searchParams.get('quarter')!.split(',') : [],
    month: searchParams.get('month') ? searchParams.get('month')!.split(',') : [],
    userId: searchParams.get('userId') ? searchParams.get('userId')!.split(',') : [],
    leadSource: searchParams.get('leadSource') ? searchParams.get('leadSource')!.split(',') : [],
    systemType: searchParams.get('systemType') ? searchParams.get('systemType')!.split(',') : [],
  });

  // Sync local filters with URL when opened
  useEffect(() => {
    if (isOpen) {
      setLocalFilters({
        quarter: searchParams.get('quarter') ? searchParams.get('quarter')!.split(',') : [],
        month: searchParams.get('month') ? searchParams.get('month')!.split(',') : [],
        userId: searchParams.get('userId') ? searchParams.get('userId')!.split(',') : [],
        leadSource: searchParams.get('leadSource') ? searchParams.get('leadSource')!.split(',') : [],
        systemType: searchParams.get('systemType') ? searchParams.get('systemType')!.split(',') : [],
      });
    }
  }, [isOpen, searchParams]);

  // Click outside to close without applying
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleFilter = (key: keyof typeof localFilters, value: string) => {
    setLocalFilters(prev => {
      const current = prev[key];
      if (current.includes(value)) {
        return { ...prev, [key]: current.filter(v => v !== value) };
      } else {
        return { ...prev, [key]: [...current, value] };
      }
    });
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    Object.entries(localFilters).forEach(([key, values]) => {
      if (values.length > 0) {
        params.set(key, values.join(','));
      }
    });
    router.push(`?${params.toString()}`, { scroll: false });
    setIsOpen(false);
  };

  const resetFilters = () => {
    setLocalFilters({ quarter: [], month: [], userId: [], leadSource: [], systemType: [] });
    router.push('?', { scroll: false });
    setIsOpen(false);
  };

  const hasActiveFilters = Array.from(searchParams.keys()).filter(k => k !== 'format').length > 0;

  const leadSources = [
    { value: 'WALK_IN', label: 'Walk In' },
    { value: 'WHATSAPP', label: 'WhatsApp' },
    { value: 'REFERRAL', label: 'Referral' },
    { value: 'FRIENDS_AND_FAMILY', label: 'Friends & Family' },
    { value: 'CALLING_ACTIVITY', label: 'Calling Activity' },
    { value: 'SUB_VENDOR', label: 'Sub Vendor' },
    { value: 'OTHER', label: 'Other' },
  ];

  const systemTypes = [
    { value: 'ON_GRID', label: 'On Grid' },
    { value: 'OFF_GRID', label: 'Off Grid' },
    { value: 'HYBRID', label: 'Hybrid' },
  ];

  const quarters = [
    { value: 'Q1-2026', label: 'Q1 2026' },
    { value: 'Q2-2026', label: 'Q2 2026' },
    { value: 'Q3-2026', label: 'Q3 2026' },
    { value: 'Q4-2026', label: 'Q4 2026' },
  ];

  const MultiSelectDropdown = ({ 
    label, 
    options, 
    selectedKey 
  }: { 
    label: string; 
    options: FilterOption[]; 
    selectedKey: keyof typeof localFilters 
  }) => {
    const selected = localFilters[selectedKey];
    return (
      <div className="flex flex-col">
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
          {label}
        </label>
        <div className="border border-gray-200 rounded-md max-h-[160px] overflow-y-auto bg-gray-50/50 p-2 space-y-1 custom-scrollbar">
          {options.map(opt => {
            const isSelected = selected.includes(opt.value);
            return (
              <label key={opt.value} className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer group">
                <div className="relative flex items-center">
                  <input 
                    type="checkbox" 
                    className="opacity-0 absolute w-full h-full cursor-pointer"
                    checked={isSelected}
                    onChange={() => toggleFilter(selectedKey, opt.value)}
                  />
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-[#1976D2] border-[#1976D2]' : 'border-gray-300 group-hover:border-[#1976D2]'}`}>
                    {isSelected && <Check size={12} className="text-white" />}
                  </div>
                </div>
                <span className="text-sm text-gray-700 select-none">{opt.label}</span>
              </label>
            );
          })}
          {options.length === 0 && <div className="text-xs text-gray-400 p-2 text-center">No options available</div>}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm relative">
      <div className="flex items-center gap-3">
        <button
          onClick={() => !loading && setIsOpen(!isOpen)}
          disabled={loading}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
            hasActiveFilters ? 'bg-blue-50 text-[#1976D2] border-blue-200' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />}
          Filters
          {hasActiveFilters && !loading && (
            <span className="w-2 h-2 rounded-full bg-[#1976D2] ml-1" />
          )}
        </button>
        
        {hasActiveFilters && !loading && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={12} /> Clear all
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <ReportExport />
      </div>

      {/* Expanded filters area */}
      {isOpen && (
        <div ref={dropdownRef} className="absolute top-[100%] left-0 right-0 bg-white border-b border-gray-200 shadow-xl animate-in slide-in-from-top-2 duration-200 z-50">
          <div className={`p-6 grid gap-6 ${filterType === 'salesman' ? 'grid-cols-1 md:grid-cols-4' : 'grid-cols-1 md:grid-cols-3'}`}>
            <MultiSelectDropdown label="Quarter" options={quarters} selectedKey="quarter" />
            <MultiSelectDropdown label={filterType === 'salesman' ? 'Salesman' : 'Calling Executive'} options={users} selectedKey="userId" />
            {filterType === 'salesman' && (
              <MultiSelectDropdown label="Lead Source" options={leadSources} selectedKey="leadSource" />
            )}
            <MultiSelectDropdown label="System Type" options={systemTypes} selectedKey="systemType" />
          </div>
          
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={resetFilters}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={applyFilters}
              className="px-4 py-2 text-sm font-medium bg-[#1976D2] text-white rounded-md hover:bg-[#1565C0] shadow-sm transition-colors flex items-center gap-2"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
