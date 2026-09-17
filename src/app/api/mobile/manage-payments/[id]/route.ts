import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasMobilePermission } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await props.params;
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required.' }, { status: 400 });
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
      return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    }

    const canViewAll =
      hasMobilePermission(session, 'manage_payments_view_all') ||
      session.role === 'ADMIN';

    const isCreator = payment.createdById === session.userId;

    if (!isCreator && !canViewAll) {
      return NextResponse.json(
        { error: 'You do not have permission to view this payment.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      payment,
    });
  } catch (error: any) {
    console.error('[Manage Payments Detail API Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment details.' },
      { status: 500 }
    );
  }
}
