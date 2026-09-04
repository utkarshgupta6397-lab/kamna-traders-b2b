'use client';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function StatementHeader({ backTo }: { backTo?: string }) {
  const router = useRouter();

  return (
    <header className="flex-none sticky top-0 z-50 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)]">
      <div className="flex items-center px-1 min-h-[56px] py-1">
        {backTo ? (
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-1 px-3 py-2 active:opacity-60 transition-opacity text-left"
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="font-bold text-[15px] truncate">Customer Statement</span>
          </button>
        ) : (
          <Link href="/mobile/accounts" className="flex items-center gap-1 px-3 py-2 active:opacity-60 transition-opacity">
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="font-bold text-[15px] truncate">Customer Statement</span>
          </Link>
        )}
      </div>
    </header>
  );
}
