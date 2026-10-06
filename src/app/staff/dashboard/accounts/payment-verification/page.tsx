import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import VerifyPaymentsClient from './VerifyPaymentsClient';

export const metadata = {
  title: 'Verify Payments | Kamna ERP',
  description: 'Review and verify customer payments from Zoho Books',
};

export default async function PaymentVerificationPage() {
  const session = await getSession();

  if (!session) {
    redirect('/staff/dashboard?error=unauthorized_accounts');
  }

  const isAdmin = session.role === 'ADMIN';
  const canView = isAdmin || Boolean(session.accounts_payment_verify_view);
  const canAction = isAdmin || Boolean(session.accounts_payment_verify_action);

  if (!canView) {
    redirect('/staff/dashboard?error=unauthorized_verify_payments');
  }

  return <VerifyPaymentsClient canAction={canAction} />;
}
