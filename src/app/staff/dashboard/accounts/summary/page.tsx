import { getSession } from '@/lib/auth';
import AccountsSummaryView from '@/components/zoho/AccountsSummaryView';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AccountsSummaryPage() {
  const session = await getSession();

  if (!session) {
    redirect('/staff?callbackUrl=%2Fstaff%2Fdashboard%2Faccounts%2Fsummary');
  }

  const canViewSummary = session.role === 'ADMIN' || !!session.accounts_summary_view;

  if (!canViewSummary) {
    redirect('/staff/dashboard?error=unauthorized_accounts');
  }

  return <AccountsSummaryView />;
}
