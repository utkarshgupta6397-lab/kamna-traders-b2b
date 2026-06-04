import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DcrClient from './DcrClient';
import AccountsTabs from '../AccountsTabs';

export const dynamic = 'force-dynamic';

export default async function AccountsDcrPage() {
  const session = await getSession();

  if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
    redirect('/staff/dashboard/accounts?error=unauthorized_dcr');
  }

  const isAdmin = session.role === 'ADMIN';
  const canViewStatement = isAdmin || !!session.accounts_customer_statement;
  const canViewTransactions = isAdmin || !!session.accounts_transactions;
  const canViewSummary = isAdmin || !!session.accounts_summary_view;
  const canManageDcr = isAdmin || !!session.dcr_management;

  return (
    <AccountsTabs 
      canViewStatement={canViewStatement} 
      canViewTransactions={canViewTransactions} 
      canViewSummary={canViewSummary}
      canManageDcr={canManageDcr}
      activeTab="dcr"
    >
      <DcrClient />
    </AccountsTabs>
  );
}
