import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { hasMobilePermission } from '@/lib/mobile-auth';
import ManagePaymentsHomeClient from './ManagePaymentsHomeClient';

export const metadata = {
  title: 'Manage Payments | Kamna B2B ERP',
};

export default async function ManagePaymentsPage() {
  const session = await getSession();
  if (!session) {
    redirect('/mobile/login');
  }

  const canViewOwn =
    hasMobilePermission(session, 'manage_payments_view_own') ||
    hasMobilePermission(session, 'manage_payments_view_all') ||
    session.role === 'ADMIN';

  if (!canViewOwn) {
    redirect('/mobile/accounts?error=unauthorized');
  }

  const canViewAll =
    hasMobilePermission(session, 'manage_payments_view_all') ||
    session.role === 'ADMIN';

  const canCreate =
    hasMobilePermission(session, 'manage_payments_create') ||
    session.role === 'ADMIN';

  return (
    <ManagePaymentsHomeClient
      userId={session.userId}
      userName={session.name || 'User'}
      canViewAll={canViewAll}
      canCreate={canCreate}
    />
  );
}
