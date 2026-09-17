import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ManagePaymentsDesktopView from '@/components/accounts/manage-payments/ManagePaymentsDesktopView';

export const dynamic = 'force-dynamic';

export default async function AccountsManagePaymentsPage() {
  const session = await getSession();

  if (!session) {
    redirect('/staff?callbackUrl=%2Fstaff%2Fdashboard%2Faccounts%2Fmanage-payments');
  }

  const isAdmin = session.role === 'ADMIN';
  const canViewOwn = isAdmin || !!session.manage_payments_view_own;
  const canViewAll = isAdmin || !!session.manage_payments_view_all;
  const canCreate = isAdmin || !!session.manage_payments_create;
  const canApprove = isAdmin || !!session.manage_payments_approve;
  const canReject = isAdmin || !!session.manage_payments_reject;

  if (!canViewOwn && !canViewAll) {
    redirect('/staff/dashboard?error=unauthorized_accounts');
  }

  return (
    <ManagePaymentsDesktopView
      userId={session.userId}
      userName={session.name || 'Staff'}
      canViewOwn={canViewOwn}
      canViewAll={canViewAll}
      canCreate={canCreate}
      canApprove={canApprove}
      canReject={canReject}
    />
  );
}
