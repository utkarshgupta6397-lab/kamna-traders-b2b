import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasMobilePermission } from '@/lib/mobile-auth';
import { createZohoCustomerAdvance } from '@/lib/services/zoho-customer-advance.service';

export async function POST(
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
        { error: 'You do not have permission to sync/approve payments.' },
        { status: 403 }
      );
    }

    const { id } = await props.params;
    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required.' }, { status: 400 });
    }

    const payment = await prisma.paymentRequest.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, gstNumber: true } },
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment request not found.' }, { status: 404 });
    }

    if (payment.status === 'APPROVED' && payment.zohoSyncStatus === 'ZOHO_SYNCED') {
      return NextResponse.json({
        success: true,
        message: 'Payment is already approved and synced with Zoho Books.',
        payment,
      });
    }

    if (payment.status === 'REJECTED') {
      return NextResponse.json(
        { error: 'Cannot sync a rejected payment request.' },
        { status: 400 }
      );
    }

    // Atomic lock to prevent duplicate sync executions
    const now = new Date();
    const lockResult = await prisma.paymentRequest.updateMany({
      where: {
        id,
        zohoSyncStatus: { not: 'ZOHO_SYNC_PENDING' }
      },
      data: {
        zohoSyncStatus: 'ZOHO_SYNC_PENDING',
        lastZohoSyncAttemptAt: now
      }
    });

    if (lockResult.count === 0) {
      return NextResponse.json(
        { error: 'Zoho synchronization is already in progress.' },
        { status: 409 }
      );
    }

    // Audit log retry started
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: 'ZOHO_SYNC_RETRIED',
          details: JSON.stringify({
            paymentRequestId: id,
            requestNumber: payment.requestNumber,
            actor: session.name || session.userId
          })
        }
      });
    } catch (_) {}

    // Execute Customer Advance sync
    const zohoResult = await createZohoCustomerAdvance(payment);

    if (!zohoResult.success) {
      await prisma.paymentRequest.update({
        where: { id },
        data: {
          zohoSyncStatus: 'ZOHO_SYNC_FAILED',
          zohoSyncError: zohoResult.error,
          zohoSyncAttempts: { increment: 1 },
          lastZohoSyncAttemptAt: new Date()
        }
      });

      try {
        await prisma.auditLog.create({
          data: {
            userId: session.userId,
            action: 'ZOHO_SYNC_FAILED',
            details: JSON.stringify({
              paymentRequestId: id,
              requestNumber: payment.requestNumber,
              error: zohoResult.error,
              actor: session.name || session.userId
            })
          }
        });
      } catch (_) {}

      return NextResponse.json(
        {
          error: `Zoho Books sync failed: ${zohoResult.error}`,
          zohoSyncError: zohoResult.error,
          zohoSyncStatus: 'ZOHO_SYNC_FAILED'
        },
        { status: 422 }
      );
    }

    // Successful sync: update payment to APPROVED with Zoho metadata
    const updatedPayment = await prisma.paymentRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: payment.approvedById || session.userId,
        approvedAt: payment.approvedAt || now,
        zohoPaymentId: zohoResult.paymentId,
        zohoSyncStatus: 'ZOHO_SYNCED',
        zohoSyncedAt: now,
        zohoSyncError: null
      },
      include: {
        customer: { select: { id: true, name: true, gstNumber: true } },
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      }
    });

    try {
      await prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: 'ZOHO_SYNC_SUCCEEDED',
          details: JSON.stringify({
            paymentRequestId: id,
            requestNumber: payment.requestNumber,
            zohoPaymentId: zohoResult.paymentId,
            isExisting: zohoResult.isExisting || false
          })
        }
      });
    } catch (_) {}

    return NextResponse.json({
      success: true,
      message: 'Payment successfully synced to Zoho Books and approved.',
      payment: updatedPayment,
    });
  } catch (error: any) {
    console.error('[Sync Zoho Error]', error);
    try {
      const { id } = await props.params;
      if (id) {
        await prisma.paymentRequest.updateMany({
          where: { id, zohoSyncStatus: 'ZOHO_SYNC_PENDING' },
          data: { zohoSyncStatus: 'ZOHO_SYNC_FAILED', zohoSyncError: error?.message || 'Unexpected error during sync' }
        });
      }
    } catch (_) {}

    return NextResponse.json(
      { error: error?.message || 'Failed to sync payment with Zoho Books.' },
      { status: 500 }
    );
  }
}
