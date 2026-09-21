import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Toaster } from 'react-hot-toast';
import GlobalDispatchNotifier from '@/components/GlobalDispatchNotifier';
import StaffTopNav from '@/components/dashboard/StaffTopNav';

export default async function StaffDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  console.log(`[StaffLayout] Auth Check: ${session ? 'Valid Session' : 'No Session'}, Role: ${session?.role || 'None'}`);

  if (!session) {
    console.warn('[StaffLayout] Redirecting to /staff. Reason: No session');
    redirect('/staff?callbackUrl=%2Fstaff%2Fdashboard');
  }

  return (
    <div className="h-screen bg-[#f8f9fb] print:bg-white flex flex-col overflow-hidden">
      <Toaster position="top-right" />
      <GlobalDispatchNotifier />
      <header className="print:hidden sticky top-0 z-50 bg-gradient-to-r from-[#1A2766] via-[#1f3180] to-[#AE1B1E] shadow-lg shrink-0">
        <div className="w-full px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/staff/dashboard" className="flex items-center gap-2 flex-shrink-0" title={session.name || 'Staff'}>
            <Image src="/logo.svg" alt="Kamna Traders" width={100} height={40} className="object-contain brightness-0 invert h-9 w-auto" priority />
            <span className="text-white/80 text-xs font-medium border-l border-white/20 pl-2 max-w-[120px] sm:max-w-[160px] md:max-w-[220px] truncate inline-block" title={session.name || 'Staff'}>
              {session.name || 'Staff'}
            </span>
          </Link>

          {/* Top Navigation */}
          <StaffTopNav session={session} />
        </div>
      </header>

      <main className="flex-1 w-full px-4 sm:px-6 py-2 flex flex-col min-h-0 overflow-y-auto lg:overflow-hidden print:p-0 print:m-0 print:max-w-none">
        {children}
      </main>
    </div>
  );
}
