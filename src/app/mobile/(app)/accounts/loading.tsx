import React from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { MobileCardSkeleton } from '@/components/mobile/skeleton/MobileSkeleton';

export default function AccountsLoading() {
  return (
    <div className="flex-1 flex flex-col font-sans">
      <header className="sticky top-0 z-50 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)]">
        <div className="flex items-center px-1 min-h-[56px] py-1">
          <Link href="/mobile" className="flex items-center gap-1 px-3 py-2 active:opacity-60 transition-opacity">
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="font-bold text-[15px]">Accounts</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-[430px] mx-auto w-full">
        <div className="mb-4 text-[11px] font-bold text-slate-400 tracking-wider uppercase px-1">
          Available Modules
        </div>

        <div className="flex flex-col gap-3">
          <MobileCardSkeleton lines={2} />
          <MobileCardSkeleton lines={2} />
        </div>

        <div className="mb-4 mt-8 text-[11px] font-bold text-slate-400 tracking-wider uppercase px-1">
          Manage DCR
        </div>

        <div className="flex flex-col gap-3">
          <MobileCardSkeleton lines={2} />
        </div>
      </main>
    </div>
  );
}
