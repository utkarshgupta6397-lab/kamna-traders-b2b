'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, Loader2, X, AlertCircle, RefreshCw } from 'lucide-react';

import { LookupService, type Option } from '@/lib/services/lookup-service';

interface AsyncLookupFieldProps {
  endpoint: string;
  value: string | undefined;
  onChange: (val: string | undefined, opt?: Option) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  renderOption?: (opt: Option) => React.ReactNode;
  displayValue?: (opt: Option) => string;
  isOptionDisabled?: (opt: Option) => boolean;
  extraQueryParams?: Record<string, string>;
  clearable?: boolean;
}

// Module-level cache is now handled by LookupService

export default function AsyncLookupField({
  endpoint,
  value,
  onChange,
  label,
  placeholder = 'Select...',
  disabled = false,
  required = false,
  renderOption,
  displayValue,
  isOptionDisabled,
  extraQueryParams,
  clearable = false,
}: AsyncLookupFieldProps) {
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  // ─── Default label logic ───────────────────────────────────────────────────
  const defaultDisplayValue = (opt: Option): string => {
    if (opt.code && opt.name) return opt.name;
    if (opt.abbreviation) return opt.abbreviation;
    if (opt.percentage !== undefined) return `${opt.percentage}%`;
    return opt.name || opt.code || opt.id;
  };

  const getDisplay = displayValue || defaultDisplayValue;
  const getRender = renderOption || ((opt: Option) => getDisplay(opt));

  // ─── Fetch options ────────────────────────────────────────────────────────
  const loadOptions = useCallback(async (query: string = '') => {
    setLoading(true);
    setError(false);
    
    try {
      const records = await LookupService.fetchOptions(endpoint, query, extraQueryParams);
      setOptions(records);
    } catch (e) {
      console.error('AsyncLookupField: failed to load options from', endpoint, e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [endpoint, extraQueryParams]);

  // ─── Eager load on mount ──────────────────────────────────────────────────
  useEffect(() => {
    loadOptions('');
  }, [loadOptions]);

  // ─── Dropdown Positioning ─────────────────────────────────────────────────
  useEffect(() => {
    const updatePosition = () => {
      if (open && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const dropdownHeight = 250; 

        const renderAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

        setDropdownStyle({
          position: 'fixed',
          top: renderAbove ? 'auto' : `${rect.bottom + 4}px`,
          bottom: renderAbove ? `${window.innerHeight - rect.top + 4}px` : 'auto',
          left: `${rect.left}px`,
          width: `${rect.width}px`,
          zIndex: 9999,
          maxHeight: `${dropdownHeight}px`
        });
      }
    };

    if (open) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [open]);

  // ─── Handle Search ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !search) return; // empty search is already handled by initial load
    const delay = setTimeout(() => loadOptions(search), 300);
    return () => clearTimeout(delay);
  }, [search, open, loadOptions]);

  // ─── Pre-fetch missing selected value ─────────────────────────────────────
  const [preloadedOption, setPreloadedOption] = useState<Option | null>(null);

  useEffect(() => {
    if (!value) {
      setPreloadedOption(null);
      return;
    }
    if (options.find(o => o.id === value)) {
      setPreloadedOption(null);
      return;
    }
    // Check if we have it in some other cache entry? Too complex, just fetch it if needed.
    let cancelled = false;
    (async () => {
      const fetched = await LookupService.fetchById(endpoint, value);
      if (fetched && !cancelled) {
        setPreloadedOption(fetched);
      }
    })();
    return () => { cancelled = true; };
  }, [value, endpoint, options]); 

  const selectedOption = options.find(o => o.id === value) || preloadedOption;
  const displayLabel = value && selectedOption ? getDisplay(selectedOption) : null;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative">
      <label className="block text-[13.5px] font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      <div
        ref={triggerRef}
        className={`relative w-full flex items-center border rounded-lg transition-all duration-200
          ${open 
            ? 'border-blue-500 ring-[3px] ring-blue-500/10 bg-white shadow-sm' 
            : error 
              ? 'border-red-200 bg-red-50' 
              : 'border-gray-200 bg-white hover:border-gray-300'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer'}
        `}
        onClick={() => !disabled && !error && setOpen(!open)}
      >
        <span className={`flex-1 block px-3 py-2 text-sm ${!displayLabel ? 'text-gray-400' : 'text-gray-900'} truncate`}>
          {error ? (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle size={14} />
              <span className="font-medium">Unable to load {label}</span>
              <button 
                type="button" 
                onClick={(e) => { e.stopPropagation(); loadOptions(''); }}
                className="ml-auto flex items-center gap-1 text-[12px] bg-white px-2 py-0.5 rounded border border-red-200 hover:bg-red-50 transition-colors"
              >
                <RefreshCw size={10} /> Retry
              </button>
            </div>
          ) : loading && !displayLabel && !options.length ? (
            <div className="flex items-center h-5 w-full animate-pulse">
              <div className="h-3.5 bg-gray-200 rounded w-1/3"></div>
            </div>
          ) : (
            displayLabel ?? placeholder
          )}
        </span>

        {!error && (
          <div className="flex items-center pr-2 gap-1">
            {clearable && value && !disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(undefined, undefined); }}
                className="p-0.5 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <ChevronsUpDown className={`h-4 w-4 flex-shrink-0 ${disabled || (loading && !options.length) ? 'text-gray-300' : 'text-gray-400'}`} />
          </div>
        )}
      </div>

      {open && !disabled && !error && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => { setOpen(false); setSearch(''); }} />
          <div 
            ref={dropdownRef}
            style={dropdownStyle}
            className="z-[9999] bg-white shadow-xl rounded-xl border border-gray-100 overflow-hidden flex flex-col"
          >
            {/* Search bar */}
            <div className="p-2 border-b border-gray-100 shrink-0">
              <input
                type="text"
                autoFocus
                className="w-full text-sm py-1.5 px-3 border border-gray-200 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-gray-50"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            </div>

            {/* Options list */}
            <div className="overflow-auto flex-1">
              {loading && search ? (
                <div className="px-4 py-3 text-sm text-gray-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching...
                </div>
              ) : options.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400 text-center">No results found.</div>
              ) : (
                options.map((opt) => {
                  const optDisabled = isOptionDisabled ? isOptionDisabled(opt) : false;
                  const isSelected = value === opt.id;
                  return (
                    <div
                      key={opt.id}
                      className={`select-none relative py-2 pl-3 pr-8 text-sm transition-colors
                        ${optDisabled
                          ? 'opacity-50 bg-gray-50 cursor-not-allowed text-gray-400'
                          : isSelected
                            ? 'bg-blue-50 text-blue-800 cursor-pointer'
                            : 'cursor-pointer hover:bg-gray-50 text-gray-800'
                        }
                      `}
                      onClick={() => {
                        if (optDisabled) return;
                        onChange(opt.id, opt);
                        setPreloadedOption(opt);
                        setOpen(false);
                        setSearch('');
                      }}
                    >
                      <span className="block truncate">{getRender(opt)}</span>
                      {isSelected && (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-blue-600">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
