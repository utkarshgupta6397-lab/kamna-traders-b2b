'use client';

import { useSkuStore } from '@/store/skuStore';
import { useState, useRef, useCallback, useEffect } from 'react';

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
    <input
      id="global-search"
      name="q"
      type="text"
      value={value}
      onChange={handleChange}
      placeholder="Search SKU or product name…"
      className="w-full px-4 py-1.5 text-sm rounded-lg bg-white/95 border-0 focus:ring-2 focus:ring-white/50 outline-none text-gray-800 placeholder-gray-400"
    />
  );
}
