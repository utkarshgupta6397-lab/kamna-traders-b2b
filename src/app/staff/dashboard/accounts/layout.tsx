import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AccountsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session || (!session.accounts_customer_statement && !session.accounts_transactions && !session.accounts_summary_view && session.role !== 'ADMIN')) {
    redirect('/staff/dashboard?error=unauthorized_accounts');
  }

  return <>{children}</>;
}
