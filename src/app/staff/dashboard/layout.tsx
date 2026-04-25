import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, Home, ClipboardList, Package } from 'lucide-react';

export default async function StaffDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect('/staff');
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex flex-col">
      <header className="bg-[#1A2766] text-white shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/staff/dashboard" className="flex items-center gap-2">
              <Image src="/logo.svg" alt="Kamna Traders" width={110} height={48} className="object-contain brightness-0 invert" priority />
              <span className="text-white/40 text-xs border-l border-white/20 pl-2">Staff</span>
            </Link>
          </div>
          
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link href="/staff/dashboard" className="flex items-center space-x-2 hover:text-[#AE1B1E] transition-colors">
              <Home size={18} />
              <span className="hidden md:inline">Dashboard</span>
            </Link>
            <Link href="/staff/dashboard/carts" className="flex items-center space-x-2 hover:text-[#AE1B1E] transition-colors">
              <ClipboardList size={18} />
              <span className="hidden md:inline">Carts</span>
            </Link>
            <Link href="/" className="flex items-center space-x-2 hover:text-[#AE1B1E] transition-colors" target="_blank">
              <Package size={18} />
              <span className="hidden md:inline">Public Store</span>
            </Link>
            <form action="/api/auth/logout" method="POST" className="pl-4 border-l border-white/20">
              <button type="submit" className="flex items-center space-x-2 text-red-300 hover:text-white transition-colors">
                <LogOut size={18} />
                <span className="hidden md:inline">Logout</span>
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
