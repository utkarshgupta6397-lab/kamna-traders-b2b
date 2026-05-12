import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, ArrowLeft } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

export default async function StaffSettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect('/staff');
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex flex-col">
      <Toaster position="top-right" />
      <header className="bg-[#1A2766] shadow-lg">
        <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/staff/dashboard" className="text-white/60 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div className="flex items-center gap-2">
              <Image src="/logo.svg" alt="Kamna Traders" width={100} height={40} className="object-contain brightness-0 invert h-8 w-auto" />
              <span className="text-white/40 text-xs border-l border-white/20 pl-2 font-medium tracking-wide uppercase">Settings</span>
            </div>
          </div>

          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="flex items-center gap-1.5 text-red-300 hover:text-white transition-colors text-sm font-medium">
              <LogOut size={16} /><span className="hidden md:inline">Logout</span>
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 py-8 px-4">
        {children}
      </main>
    </div>
  );
}
