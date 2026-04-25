'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, Search, Menu, X } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';

function HeaderContent() {
  const [mounted, setMounted] = useState(false);
  const items = useCartStore(s => s.items);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchVal, setSearchVal] = useState(searchParams.get('q') ?? '');

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    setSearchVal(searchParams.get('q') ?? '');
  }, [searchParams]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If pressing '/' and not already in an input/textarea
      if (e.key === '/' && 
          document.activeElement?.tagName !== 'INPUT' && 
          document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const totalItems = items.reduce((acc, i) => acc + i.qty, 0);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    const cat = searchParams.get('category');
    if (searchVal.trim()) params.set('q', searchVal.trim());
    if (cat) params.set('category', cat);
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : '/');
  };

  const clearSearch = () => {
    setSearchVal('');
    const params = new URLSearchParams();
    const cat = searchParams.get('category');
    if (cat) params.set('category', cat);
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : '/');
  };

  return (
    <>
      {/* MOBILE HEADER (< 768px) */}
      <header className="md:hidden sticky top-0 z-50 bg-gradient-to-r from-[#1A2766] via-[#1f3180] to-[#AE1B1E] shadow-sm">
        <div className="h-[52px] px-[12px] flex items-center justify-between">
          <Link href="/" className="flex-shrink-0">
            <Image src="/logo.svg" alt="Kamna Traders" width={80} height={24} className="object-contain brightness-0 invert h-6 w-auto" priority />
          </Link>
          <Link href="/cart" className="flex-shrink-0 relative p-1.5 hover:bg-white/10 rounded-full transition-colors">
            <ShoppingCart size={22} className="text-white" />
            {mounted && totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-white text-[#AE1B1E] text-[10px] font-black w-[18px] h-[18px] rounded-full flex items-center justify-center shadow-sm">
                {totalItems > 9 ? '9+' : totalItems}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* DESKTOP HEADER (>= 768px) */}
      <header className="hidden md:block sticky top-0 z-50 bg-gradient-to-r from-[#1A2766] via-[#1f3180] to-[#AE1B1E] shadow-lg">
        <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/" className="flex-shrink-0">
            <Image src="/logo.svg" alt="Kamna Traders" width={100} height={40} className="object-contain brightness-0 invert h-9 w-auto" priority />
          </Link>
          <div className="flex-1 mx-2">
            <form onSubmit={handleSearch} className="relative max-w-xl">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                ref={searchInputRef}
                type="text" 
                value={searchVal} 
                onChange={e => setSearchVal(e.target.value)} 
                placeholder="Search products, SKUs…" 
                className="w-full pl-9 pr-9 py-2 text-sm rounded-lg bg-white/95 border-0 focus:ring-2 focus:ring-white/50 outline-none text-gray-800 placeholder-gray-400" 
              />
              {searchVal && (
                <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </form>
          </div>
          <Link href="/cart" className="flex-shrink-0 relative p-2 hover:bg-white/10 rounded-lg transition-colors">
            <ShoppingCart size={20} className="text-white" />
            {mounted && totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-white text-[#AE1B1E] text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {totalItems > 9 ? '9+' : totalItems}
              </span>
            )}
          </Link>
        </div>
      </header>
    </>
  );
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#f8f9fb] flex flex-col">
      <Suspense fallback={
        <header className="sticky top-0 z-50 bg-gradient-to-r from-[#1A2766] via-[#1f3180] to-[#AE1B1E] shadow-lg h-14" />
      }>
        <HeaderContent />
      </Suspense>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="bg-white border-t border-gray-200 mt-auto py-4">
        <div className="max-w-screen-2xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-gray-400">
          <p>&copy; {new Date().getFullYear()} Kamna Traders. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/staff" className="hover:text-[#1A2766]">Staff Portal</Link>
            <Link href="/admin" className="hover:text-[#1A2766]">Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
