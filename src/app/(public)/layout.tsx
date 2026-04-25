'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, Search, Menu, X } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useState, useEffect } from 'react';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const items = useCartStore(s => s.items);

  useEffect(() => setMounted(true), []);

  const totalItems = items.reduce((acc, i) => acc + i.qty, 0);

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex flex-col">
      {/* ── Compact Premium Header ───────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-[#1A2766] via-[#1f3180] to-[#AE1B1E] shadow-lg">
        <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center gap-4">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0">
            <Image
              src="/logo.svg"
              alt="Kamna Traders"
              width={100}
              height={40}
              className="object-contain brightness-0 invert h-9 w-auto"
              priority
            />
          </Link>

          {/* Search — centered & dominant */}
          <div className="flex-1 mx-2 hidden sm:block">
            <form action="/" method="get" className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                name="q"
                type="text"
                placeholder="Search products, SKUs…"
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-white/95 border-0 focus:ring-2 focus:ring-white/50 outline-none text-gray-800 placeholder-gray-400"
              />
            </form>
          </div>

          {/* Cart */}
          <Link href="/cart" className="flex-shrink-0 relative p-2 hover:bg-white/10 rounded-lg transition-colors">
            <ShoppingCart size={20} className="text-white" />
            {mounted && totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-white text-[#AE1B1E] text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {totalItems > 9 ? '9+' : totalItems}
              </span>
            )}
          </Link>

          {/* Mobile menu toggle */}
          <button
            className="sm:hidden p-2 text-white hover:bg-white/10 rounded-lg"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile search */}
        {mobileMenuOpen && (
          <div className="sm:hidden px-4 pb-3">
            <form action="/" method="get">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  name="q"
                  type="text"
                  placeholder="Search products…"
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-white border-0 outline-none text-gray-800"
                />
              </div>
            </form>
          </div>
        )}
      </header>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main className="flex-1">
        {children}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
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
