import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DispatchSidebar from './DispatchSidebar';

export default async function DispatchLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect('/staff/dashboard?error=unauthorized_dispatch');
  }

  const isAdmin = session.role === 'ADMIN';
  const canViewDispatch = isAdmin || !!session.dispatch_view;

  if (!canViewDispatch) {
    redirect('/staff/dashboard?error=unauthorized_dispatch');
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)]">
      <DispatchSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
    </div>
  );
}
