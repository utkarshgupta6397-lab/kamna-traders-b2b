import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasMobilePermission } from '@/lib/mobile-auth';
import { getISTDayRange, getTodayDateStringIST } from '@/lib/manage-payments';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canViewOwn =
      hasMobilePermission(session, 'manage_payments_view_own') ||
      hasMobilePermission(session, 'manage_payments_view_all') ||
      session.role === 'ADMIN';

    if (!canViewOwn) {
      return NextResponse.json(
        { error: 'You do not have permission to view Manage Payments.' },
        { status: 403 }
      );
    }

    const canViewAll =
      hasMobilePermission(session, 'manage_payments_view_all') ||
      session.role === 'ADMIN';

    const todayStr = getTodayDateStringIST();
    const { start, end } = getISTDayRange(todayStr);

    // Scope condition:
    // If canViewAll: company-wide.
    // Otherwise: only created by logged-in user.
    const userScope = canViewAll ? {} : { createdById: session.userId };

    // 1. Total Collections Today (APPROVED payments only for today's paymentDate)
    const approvedToday = await prisma.paymentRequest.aggregate({
      where: {
        status: 'APPROVED',
        paymentDate: {
          gte: start,
          lte: end,
        },
        ...userScope,
      },
      _sum: {
        amount: true,
      },
      _count: {
        _all: true,
      },
    });

    // 2. Pending Requests Summary (accessible within user scope)
    const pendingSummary = await prisma.paymentRequest.aggregate({
      where: {
        status: 'PENDING_APPROVAL',
        ...userScope,
      },
      _sum: {
        amount: true,
      },
      _count: {
        _all: true,
      },
    });

    return NextResponse.json({
      success: true,
      todayDate: todayStr,
      totalToday: Number(approvedToday._sum.amount || 0),
      approvedCountToday: approvedToday._count._all || 0,
      pendingCount: pendingSummary._count._all || 0,
      pendingAmount: Number(pendingSummary._sum.amount || 0),
      canViewAll,
    });
  } catch (error: any) {
    console.error('[Manage Payments Summary API Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch summary' },
      { status: 500 }
    );
  }
}
