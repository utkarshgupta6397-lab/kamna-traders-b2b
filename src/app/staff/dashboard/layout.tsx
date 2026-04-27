import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, Home, ClipboardList } from 'lucide-react';
import DashboardSearchInput from '@/components/DashboardSearchInput';

export default async function StaffDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect('/staff');
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb] print:bg-white flex flex-col">
      <header className="print:hidden sticky top-0 z-50 bg-gradient-to-r from-[#1A2766] via-[#1f3180] to-[#AE1B1E] shadow-lg">
        <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/staff/dashboard" className="flex items-center gap-2 flex-shrink-0">
            <Image src="/logo.svg" alt="Kamna Traders" width={100} height={40} className="object-contain brightness-0 invert h-9 w-auto" priority />
            <span className="text-white/40 text-xs border-l border-white/20 pl-2">Staff</span>
          </Link>

          {/* Search — local filtering via Zustand store */}
          <div className="flex-1 max-w-lg">
            <DashboardSearchInput />
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-4 text-sm text-white/80 flex-shrink-0">
            <Link href="/staff/dashboard" className="flex items-center gap-1.5 hover:text-white transition-colors">
              <Home size={16} /><span className="hidden md:inline text-xs">Catalog</span>
            </Link>
            <Link href="/staff/dashboard/carts" className="flex items-center gap-1.5 hover:text-white transition-colors">
              <ClipboardList size={16} /><span className="hidden md:inline text-xs">My Carts</span>
            </Link>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="flex items-center gap-1.5 text-red-300 hover:text-white transition-colors">
                <LogOut size={16} /><span className="hidden md:inline text-xs">Logout</span>
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-3 py-3 print:p-0 print:m-0 print:max-w-none">
        {children}
      </main>
    </div>
  );
}
