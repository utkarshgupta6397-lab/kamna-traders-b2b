import { getSession } from '@/lib/auth';
import CustomerStatementView from '@/components/zoho/CustomerStatementView';
import LiveBankTransactionsView from '@/components/bank/LiveBankTransactionsView';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AccountsPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const session = await getSession();

  if (!session) {
    redirect('/staff?callbackUrl=%2Fstaff%2Fdashboard%2Faccounts');
  }

  const isAdmin = session.role === 'ADMIN';
  const canViewStatement = isAdmin || !!session.accounts_customer_statement;
  const canViewTransactions = isAdmin || !!session.accounts_transactions;
  const canViewSummary = isAdmin || !!session.accounts_summary_view;
  const canManageDcr = isAdmin || !!session.dcr_management;

  if (!canViewStatement && !canViewTransactions && !canViewSummary && !canManageDcr) {
    redirect('/staff/dashboard?error=unauthorized_accounts');
  }

  const searchParams = await props.searchParams;
  let activeTab: 'statement' | 'transactions' | 'summary' = 'statement';
  
  if (searchParams.tab === 'transactions' && canViewTransactions) {
    activeTab = 'transactions';
  } else if (!canViewStatement && canViewTransactions) {
    activeTab = 'transactions';
  }

  return (
    <>
      {activeTab === 'statement' && canViewStatement && (
        <Suspense fallback={<div className="p-12 text-center text-gray-500">Loading statement...</div>}>
          <CustomerStatementView />
        </Suspense>
      )}
      {activeTab === 'transactions' && canViewTransactions && (
        <LiveBankTransactionsView />
      )}
    </>
  );
}
