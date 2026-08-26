import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { Box, ChevronRight } from 'lucide-react';

export default async function MobileHome() {
  const session = await getSession();
  const userName = session?.name?.split(' ')[0] || 'User';

  return (
    <div className="flex-1 flex flex-col font-sans">
      <header className="sticky top-0 z-50 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 min-h-[56px] py-2">
          <span className="font-bold tracking-wide text-sm">KAMNA ERP</span>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-[430px] mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Hello, {userName}</h1>
          <p className="text-slate-500 text-sm mt-1">What would you like to do today?</p>
        </div>

        <div className="mb-2 text-[11px] font-bold text-slate-400 tracking-wider uppercase px-1">
          Modules
        </div>

        <div className="space-y-3">
          <Link href="/mobile/operations" className="flex items-center justify-between bg-white p-4 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#F8F9FB] text-[#1A2766] rounded-xl border border-slate-100">
                <Box size={22} strokeWidth={2.5} />
              </div>
              <span className="font-bold text-slate-800 text-[15px]">Operations</span>
            </div>
            <ChevronRight size={20} className="text-slate-300" />
          </Link>

          <Link href="/mobile/accounts" className="flex items-center justify-between bg-white p-4 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#F8F9FB] text-[#1A2766] rounded-xl border border-slate-100">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <span className="font-bold text-slate-800 text-[15px]">Accounts</span>
            </div>
            <ChevronRight size={20} className="text-slate-300" />
          </Link>
        </div>
      </main>
    </div>
  );
}
