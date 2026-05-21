import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AccountsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    redirect('/staff/dashboard?error=unauthorized_accounts');
  }

  return <>{children}</>;
}
