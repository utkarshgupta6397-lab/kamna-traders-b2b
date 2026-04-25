'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, Search, Menu, X } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useState, useEffect } from 'react';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const items = useCartStore((state) => state.items);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const totalItems = items.reduce((acc, item) => acc + item.qty, 0);

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex flex-col">
      {/* Header */}
      <header className="bg-[#1A2766] text-white sticky top-0 z-50 shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <Image
                src="/logo.svg"
                alt="Kamna Traders"
                width={130}
                height={56}
                className="object-contain brightness-0 invert"
                priority
              />
            </Link>

            {/* Desktop Search */}
            <div className="hidden md:flex flex-1 max-w-xl mx-8">
              <div className="relative w-full">
                <input 
                  type="text" 
                  placeholder="Search products by SKU or name..." 
                  className="w-full bg-white/10 border border-white/20 rounded-full py-2 pl-4 pr-10 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-[#AE1B1E] focus:bg-white focus:text-gray-900 focus:placeholder-gray-500 transition-all"
                />
                <Search className="absolute right-3 top-2.5 text-white/60" size={20} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-4">
              <Link href="/cart" className="relative p-2 hover:bg-white/10 rounded-full transition-colors">
                <ShoppingCart size={24} />
                {mounted && totalItems > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-[#AE1B1E] rounded-full">
                    {totalItems}
                  </span>
                )}
              </Link>
              <button 
                className="md:hidden p-2 hover:bg-white/10 rounded-full transition-colors"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Search - expanded if menu open or just always visible below header on small screens */}
        {isMobileMenuOpen && (
          <div className="md:hidden p-4 bg-[#003347] border-t border-white/10">
            <div className="relative w-full">
              <input 
                type="text" 
                placeholder="Search products..." 
                className="w-full bg-white/10 border border-white/20 rounded-lg py-2 pl-4 pr-10 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-[#AE1B1E] focus:bg-white focus:text-gray-900"
              />
              <Search className="absolute right-3 top-2.5 text-white/60" size={20} />
            </div>
            <nav className="mt-4 space-y-2">
              <Link href="/" className="block py-2 hover:text-[#AE1B1E] transition-colors">Home</Link>
              <Link href="/categories" className="block py-2 hover:text-[#AE1B1E] transition-colors">Categories</Link>
              <Link href="/staff" className="block py-2 hover:text-[#AE1B1E] transition-colors">Staff Login</Link>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center text-gray-500 text-sm">
            <p>&copy; {new Date().getFullYear()} Kamna Traders. All rights reserved.</p>
            <div className="flex space-x-4 mt-4 md:mt-0">
              <Link href="/staff" className="hover:text-[#1A2766] transition-colors">Staff Portal</Link>
              <Link href="/admin" className="hover:text-[#1A2766] transition-colors">Admin</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
