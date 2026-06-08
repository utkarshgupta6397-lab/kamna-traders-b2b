import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ReviewClient from './ReviewClient';

export const dynamic = 'force-dynamic';

export default async function AccountsDcrReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
    redirect('/staff/dashboard/accounts?error=unauthorized_dcr');
  }

  const { id } = await params;
  
  const isAdmin = session.role === 'ADMIN';
  const canViewStatement = isAdmin || !!session.accounts_customer_statement;
  const canViewTransactions = isAdmin || !!session.accounts_transactions;
  const canViewSummary = isAdmin || !!session.accounts_summary_view;
  const canManageDcr = isAdmin || !!session.dcr_management;

  return (
    <ReviewClient invoiceId={id} />
  );
}
