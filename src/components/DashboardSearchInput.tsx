'use client';

import { useSkuStore } from '@/store/skuStore';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Search } from 'lucide-react';

/** Client-side search input that writes to the Zustand skuStore for instant local filtering. */
export default function DashboardSearchInput() {
  const setSearch = useSkuStore((s) => s.setSearch);
  const [value, setValue] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setValue(v);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setSearch(v.trim());
      }, 200);
    },
    [setSearch]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
        <Search size={18} className="text-[#1A2766]/40" />
      </div>
      <input
        id="global-search"
        name="q"
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="Search SKU or Product Name..."
        className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-white border border-[#E7EAF0] shadow-sm focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] outline-none text-[#1A2766] placeholder-gray-400 transition-all"
      />
    </div>
  );
}
