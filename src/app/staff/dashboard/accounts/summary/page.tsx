import { getSession } from '@/lib/auth';
import AccountsTabs from '../AccountsTabs';
import AccountsSummaryView from '@/components/zoho/AccountsSummaryView';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AccountsSummaryPage() {
  const session = await getSession();

  if (!session) {
    redirect('/staff?callbackUrl=%2Fstaff%2Fdashboard%2Faccounts%2Fsummary');
  }

  const isAdmin = session.role === 'ADMIN';
  const canViewStatement = isAdmin || !!session.accounts_customer_statement;
  const canViewTransactions = isAdmin || !!session.accounts_transactions;
  const canViewSummary = isAdmin || !!session.accounts_summary_view;

  if (!canViewSummary) {
    redirect('/staff/dashboard?error=unauthorized_accounts');
  }

  return (
    <AccountsTabs 
      canViewStatement={canViewStatement} 
      canViewTransactions={canViewTransactions} 
      canViewSummary={canViewSummary}
      activeTab="summary"
    >
      <AccountsSummaryView />
    </AccountsTabs>
  );
}
