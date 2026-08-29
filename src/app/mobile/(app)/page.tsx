import { getSession } from '@/lib/auth';
import Link from 'next/link';

export default async function MobileHome() {
  const session = await getSession();
  const userName = session?.name?.split(' ')[0] || 'User';

  return (
    <div className="flex-1 flex flex-col font-sans bg-[#F8F9FB]">
      <header className="sticky top-0 z-50 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 min-h-[56px] py-2">
          <span className="font-bold tracking-wide text-sm">KAMNA ERP</span>
        </div>
      </header>

      <main className="flex-1 px-6 py-6 max-w-[430px] mx-auto w-full">
        {/* Welcome Section */}
        <div className="mb-9">
          <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">Hello, {userName}</h1>
          <p className="text-slate-500 text-[15px] mt-1.5">What would you like to do today?</p>
        </div>

        {/* Modules Section */}
        <div className="mb-4 text-[12px] font-black text-slate-400 tracking-widest uppercase">
          Modules
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/mobile/operations"
            className="flex flex-col justify-between aspect-square bg-white p-5 rounded-[22px] shadow-sm border border-slate-200 active:scale-[0.96] active:bg-slate-50 transition-all"
          >
            <div className="w-[60px] h-[60px] rounded-[18px] bg-blue-50 flex items-center justify-center mb-auto border border-blue-100/50">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" fill="#dbeafe" stroke="#2563eb" />
                <path d="M3.27 6.96 12 12.01l8.73-5.05" stroke="#0d9488" />
                <path d="M12 22.08V12" stroke="#0d9488" />
              </svg>
            </div>
            <span className="font-bold text-slate-800 text-[19px] tracking-tight leading-none mt-4 text-left">
              Operations
            </span>
          </Link>

          <Link
            href="/mobile/accounts"
            className="flex flex-col justify-between aspect-square bg-white p-5 rounded-[22px] shadow-sm border border-slate-200 active:scale-[0.96] active:bg-slate-50 transition-all"
          >
            <div className="w-[60px] h-[60px] rounded-[18px] bg-green-50 flex items-center justify-center mb-auto border border-green-100/50">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1" fill="#dcfce7" stroke="#16a34a" />
                <path d="M16 11h4v4h-4a2 2 0 0 1-2-2v0a2 2 0 0 1 2-2z" fill="#bae6fd" stroke="#0284c7" />
                <circle cx="17.5" cy="13" r="1.5" fill="#0284c7" stroke="#0284c7" />
              </svg>
            </div>
            <span className="font-bold text-slate-800 text-[19px] tracking-tight leading-none mt-4 text-left">
              Accounts
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}
