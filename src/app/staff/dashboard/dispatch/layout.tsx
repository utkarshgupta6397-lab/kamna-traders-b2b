import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DispatchLayoutShell from './DispatchLayoutShell';

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
    <DispatchLayoutShell>
      {children}
    </DispatchLayoutShell>
  );
}
