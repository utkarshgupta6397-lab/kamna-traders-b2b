'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LogOut } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();
  if (!pathname) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-around h-[60px] max-w-[430px] mx-auto">
        <Link 
          href="/mobile"
          className={`flex flex-col items-center justify-center w-full h-full gap-1 ${
            pathname === '/mobile' ? 'text-[#1A2766]' : 'text-slate-400'
          }`}
        >
          <Home size={22} className={pathname === '/mobile' ? 'fill-[#1A2766] text-[#1A2766]' : ''} />
          <span className="text-[10px] font-semibold">Home</span>
        </Link>

        <form action="/api/auth/logout" method="POST" className="w-full h-full">
          <input type="hidden" name="callbackUrl" value="/mobile/login" />
          <button type="submit" className="flex flex-col items-center justify-center w-full h-full gap-1 text-slate-400 active:text-red-600 transition-colors">
            <LogOut size={22} />
            <span className="text-[10px] font-semibold">Logout</span>
          </button>
        </form>
      </div>
    </nav>
  );
}
