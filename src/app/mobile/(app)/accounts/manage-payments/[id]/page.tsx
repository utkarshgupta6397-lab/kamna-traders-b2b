import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasMobilePermission } from '@/lib/mobile-auth';
import PaymentDetailClient from './PaymentDetailClient';

export const metadata = {
  title: 'Payment Details | Kamna B2B ERP',
};

export default async function PaymentDetailPage(
  props: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    redirect('/mobile/login');
  }

  const params = await props.params;
  const { id } = params;

  if (!id) {
    notFound();
  }

  const payment = await prisma.paymentRequest.findUnique({
    where: { id },
    include: {
      customer: {
        select: { id: true, name: true, gstNumber: true, status: true },
      },
      createdBy: {
        select: { id: true, name: true, role: true },
      },
      approvedBy: {
        select: { id: true, name: true },
      },
      rejectedBy: {
        select: { id: true, name: true },
      },
    },
  });

  if (!payment) {
    notFound();
  }

  const canViewAll =
    hasMobilePermission(session, 'manage_payments_view_all') ||
    session.role === 'ADMIN';

  const canApprove =
    hasMobilePermission(session, 'manage_payments_approve') ||
    session.role === 'ADMIN';

  const canReject =
    hasMobilePermission(session, 'manage_payments_reject') ||
    session.role === 'ADMIN';

  const isCreator = payment.createdById === session.userId;

  if (!isCreator && !canViewAll) {
    redirect('/mobile/accounts/manage-payments?error=unauthorized');
  }

  // Serialize Decimal amount and Dates for client component
  const serializedPayment = {
    ...payment,
    amount: Number(payment.amount),
    paymentDate: payment.paymentDate.toISOString(),
    createdAt: payment.createdAt.toISOString(),
    submittedAt: payment.submittedAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
    approvedAt: payment.approvedAt ? payment.approvedAt.toISOString() : null,
    rejectedAt: payment.rejectedAt ? payment.rejectedAt.toISOString() : null,
  };

  return (
    <PaymentDetailClient
      payment={serializedPayment}
      canApprove={canApprove}
      canReject={canReject}
    />
  );
}
