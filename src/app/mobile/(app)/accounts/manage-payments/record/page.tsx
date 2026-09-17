import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { hasMobilePermission } from '@/lib/mobile-auth';
import { getAllowedPaymentDateRangeIST } from '@/lib/manage-payments';
import RecordPaymentClient from './RecordPaymentClient';

export const metadata = {
  title: 'Record Payment | Kamna B2B ERP',
};

export default async function RecordPaymentPage() {
  const session = await getSession();
  if (!session) {
    redirect('/mobile/login');
  }

  const canCreate =
    hasMobilePermission(session, 'manage_payments_create') ||
    session.role === 'ADMIN';

  if (!canCreate) {
    redirect('/mobile/accounts/manage-payments?error=unauthorized');
  }

  const { minDate, maxDate } = getAllowedPaymentDateRangeIST();

  return (
    <RecordPaymentClient
      minDateStr={minDate}
      maxDateStr={maxDate}
      userName={session.name || 'User'}
    />
  );
}
