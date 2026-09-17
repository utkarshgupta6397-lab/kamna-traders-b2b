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
  const canProcessInvoices = isAdmin || !!session.accounts_invoice_processor;
  const canViewReports = isAdmin || !!session.accounts_reports_salesman;
  const canManagePayments = isAdmin || !!session.manage_payments_view_own || !!session.manage_payments_view_all;

  if (!canViewStatement && !canViewTransactions && !canViewSummary && !canManageDcr && !canProcessInvoices && !canViewReports && !canManagePayments) {
    redirect('/staff/dashboard?error=unauthorized_accounts');
  }

  return (
    <AccountsTabs
      canViewStatement={canViewStatement}
      canViewTransactions={canViewTransactions}
      canViewSummary={canViewSummary}
      canManagePayments={canManagePayments}
      canManageDcr={canManageDcr}
      canProcessInvoices={canProcessInvoices}
      canViewReports={canViewReports}
    >
      {children}
    </AccountsTabs>
  );
}
