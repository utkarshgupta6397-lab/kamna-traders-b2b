import { getSession } from '@/lib/auth';
import AccountsTabs from './AccountsTabs';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const session = await getSession();

  if (!session) {
    redirect('/staff?callbackUrl=%2Fstaff%2Fdashboard%2Faccounts');
  }

  const isAdmin = session.role === 'ADMIN';
  const canViewStatement = isAdmin || !!session.accounts_customer_statement;
  const canViewTransactions = isAdmin || !!session.accounts_transactions;

  if (!canViewStatement && !canViewTransactions) {
    redirect('/staff/dashboard?error=unauthorized_accounts');
  }

  return (
    <AccountsTabs 
      canViewStatement={canViewStatement} 
      canViewTransactions={canViewTransactions} 
    />
  );
}
