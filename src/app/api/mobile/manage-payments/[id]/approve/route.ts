import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasMobilePermission } from '@/lib/mobile-auth';

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canApprove =
      hasMobilePermission(session, 'manage_payments_approve') ||
      session.role === 'ADMIN';

    if (!canApprove) {
      return NextResponse.json(
        { error: 'You do not have permission to approve payments.' },
        { status: 403 }
      );
    }

    const { id } = await props.params;
    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required.' }, { status: 400 });
    }

    // Check payment existence
    const payment = await prisma.paymentRequest.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, gstNumber: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment request not found.' }, { status: 404 });
    }

    if (payment.status !== 'PENDING_APPROVAL') {
      return NextResponse.json(
        { error: `Payment request is already ${payment.status.toLowerCase().replace('_', ' ')}.` },
        { status: 409 }
      );
    }

    // Atomic update conditioned on status=PENDING_APPROVAL for concurrency safety
    const now = new Date();
    const updateResult = await prisma.paymentRequest.updateMany({
      where: {
        id,
        status: 'PENDING_APPROVAL',
      },
      data: {
        status: 'APPROVED',
        approvedById: session.userId,
        approvedAt: now,
      },
    });

    if (updateResult.count === 0) {
      return NextResponse.json(
        { error: 'Payment request status has already been updated by another user.' },
        { status: 409 }
      );
    }

    const updatedPayment = await prisma.paymentRequest.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, gstNumber: true } },
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Payment request approved successfully.',
      payment: updatedPayment,
    });
  } catch (error: any) {
    console.error('[Approve Payment Error]', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to approve payment request.' },
      { status: 500 }
    );
  }
}
