import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Package, Zap } from 'lucide-react';

export default async function MobileOperationsPage() {
  await getSession(); // just ensures we have it

  return (
    <div className="flex-1 flex flex-col font-sans">
      <header className="sticky top-0 z-50 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)]">
        <div className="flex items-center px-1 min-h-[56px] py-1">
          <Link href="/mobile" className="flex items-center gap-1 px-3 py-2 active:opacity-60 transition-opacity">
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="font-bold text-[15px]">Operations</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-[430px] mx-auto w-full">
        <div className="mb-4 text-[11px] font-bold text-slate-400 tracking-wider uppercase px-1">
          Available Modules
        </div>

        <div className="flex flex-col gap-3">
          <Link href="/mobile/operations/solar-panel-stock" className="flex items-center justify-between bg-white p-4 rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100/50">
                <Package size={22} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="font-bold text-slate-800 text-[15px]">Solar Panel Stock</div>
                <div className="text-[12px] text-slate-500 font-medium">View Current Stock</div>
              </div>
            </div>
            <ChevronRight size={20} className="text-slate-300" />
          </Link>

          <Link href="/mobile/operations/wire-cable-stock" className="flex items-center justify-between bg-white p-4 rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100/50">
                <Package size={22} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="font-bold text-slate-800 text-[15px]">Wire & Cables Stock</div>
                <div className="text-[12px] text-slate-500 font-medium">View Current Stock</div>
              </div>
            </div>
            <ChevronRight size={20} className="text-slate-300" />
          </Link>

          <Link href="/mobile/operations/inverter-stock" className="flex items-center justify-between bg-white p-4 rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100/50">
                <Zap size={22} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="font-bold text-slate-800 text-[15px]">Inverter Stock</div>
                <div className="text-[12px] text-slate-500 font-medium">View Current Stock</div>
              </div>
            </div>
            <ChevronRight size={20} className="text-slate-300" />
          </Link>
        </div>
      </main>
    </div>
  );
}
