import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AccountsTabs from './AccountsTabs';

export default async function AccountsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect('/staff/dashboard?error=unauthorized_accounts');
  }

  const isAdmin = session.role === 'ADMIN';
  const canViewStatement = isAdmin || !!session.accounts_customer_statement;
  const canViewTransactions = isAdmin || !!session.accounts_transactions;
  const canViewSummary = isAdmin || !!session.accounts_summary_view;
  const canManageDcr = isAdmin || !!session.dcr_management;

  if (!canViewStatement && !canViewTransactions && !canViewSummary && !canManageDcr) {
    redirect('/staff/dashboard?error=unauthorized_accounts');
  }

  return (
    <AccountsTabs
      canViewStatement={canViewStatement}
      canViewTransactions={canViewTransactions}
      canViewSummary={canViewSummary}
      canManageDcr={canManageDcr}
    >
      {children}
    </AccountsTabs>
  );
}
