'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  name?: string;
}

export function Select({
  value,
  defaultValue,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  name
}: SelectProps) {
  const [internalValue, setInternalValue] = useState<string | undefined>(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Use a global event to close other selects. We dispatch a custom event when opening.
  const handleOpen = () => {
    if (disabled) return;
    const event = new CustomEvent('kamna-select-open');
    window.dispatchEvent(event);
    setIsOpen(true);
  };

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleOpen = () => {
    if (isOpen) {
      handleClose();
    } else {
      handleOpen();
    }
  };

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (
        isOpen && 
        triggerRef.current && 
        !triggerRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    };

    const handleOtherSelectOpen = () => {
      if (isOpen) {
        handleClose();
      }
    };

    const handleScrollOrResize = () => {
      if (isOpen) {
        // Optional: you can either reposition or just close on scroll. Closing is safer to avoid detached dropdowns.
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleGlobalClick);
      window.addEventListener('kamna-select-open', handleOtherSelectOpen);
      window.addEventListener('scroll', handleScrollOrResize, true); // true for capturing phase
      window.addEventListener('resize', handleScrollOrResize);
      
      // Calculate position
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const dropdownHeight = 250; // Max height we will set

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
    }

    return () => {
      document.removeEventListener('mousedown', handleGlobalClick);
      window.removeEventListener('kamna-select-open', handleOtherSelectOpen);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, handleClose]);

  const currentValue = value !== undefined ? value : internalValue;
  const selectedOption = options.find(o => String(o.value) === String(currentValue));

  return (
    <>
      {/* Hidden input for native form submission if needed */}
      {name && <input type="hidden" name={name} value={currentValue ?? ''} />}

      <div
        ref={triggerRef}
        onClick={toggleOpen}
        className={`flex items-center justify-between border rounded px-2 py-1.5 text-xs bg-white cursor-pointer select-none
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:border-gray-400 focus-within:ring-2 focus-within:ring-[#1A2766] focus-within:border-transparent'}
          ${isOpen ? 'border-[#1A2766] ring-2 ring-[#1A2766]' : 'border-gray-300'}
          ${className}
        `}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleOpen();
          } else if (e.key === 'Escape') {
            handleClose();
          }
        }}
      >
        <span className={selectedOption ? 'text-gray-900 truncate' : 'text-gray-500 truncate'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="bg-white border border-gray-200 rounded shadow-lg overflow-y-auto py-1 text-sm font-sans"
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-500 italic">No options available</div>
          ) : (
            options.map((option) => {
              const isSelected = String(option.value) === String(currentValue);
              return (
                <div
                  key={option.value}
                  className={`
                    px-3 py-1.5 text-xs cursor-pointer flex items-center justify-between
                    ${option.disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-blue-50'}
                    ${isSelected ? 'bg-blue-50/50 text-[#1A2766] font-medium' : 'text-gray-700'}
                  `}
                  onClick={() => {
                    if (option.disabled) return;
                    setInternalValue(option.value);
                    onChange?.(option.value);
                    handleClose();
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <Check size={14} className="text-[#1A2766] ml-2 flex-shrink-0" />}
                </div>
              );
            })
          )}
        </div>,
        document.body
      )}
    </>
  );
}
