import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasMobilePermission } from '@/lib/mobile-auth';

const VALID_REJECTION_REASONS = [
  'Incorrect amount',
  'Incorrect customer',
  'Wrong payment date',
  'Duplicate payment',
  'Missing payment proof',
  'Other',
];

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canReject =
      hasMobilePermission(session, 'manage_payments_reject') ||
      session.role === 'ADMIN';

    if (!canReject) {
      return NextResponse.json(
        { error: 'You do not have permission to decline payments.' },
        { status: 403 }
      );
    }

    const { id } = await props.params;
    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required.' }, { status: 400 });
    }

    const body = await request.json();
    const { reason, comment } = body;

    if (!reason || typeof reason !== 'string' || !VALID_REJECTION_REASONS.includes(reason.trim())) {
      return NextResponse.json(
        { error: 'A valid decline reason is required.' },
        { status: 400 }
      );
    }

    const trimmedReason = reason.trim();
    let finalRejectionReason = trimmedReason;

    if (trimmedReason === 'Other') {
      if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
        return NextResponse.json(
          { error: 'Please provide a comment when selecting "Other" as decline reason.' },
          { status: 400 }
        );
      }
      finalRejectionReason = `Other: ${comment.trim()}`;
    } else if (comment && typeof comment === 'string' && comment.trim().length > 0) {
      finalRejectionReason = `${trimmedReason} - ${comment.trim()}`;
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
        status: 'REJECTED',
        rejectedById: session.userId,
        rejectedAt: now,
        rejectionReason: finalRejectionReason,
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
        rejectedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Payment request declined successfully.',
      payment: updatedPayment,
    });
  } catch (error: any) {
    console.error('[Decline Payment Error]', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to decline payment request.' },
      { status: 500 }
    );
  }
}
