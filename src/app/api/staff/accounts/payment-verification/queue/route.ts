import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { CustomerPaymentVerificationStatus } from '@prisma/client';
import {
  getZohoApiUsageToday,
  DEFAULT_SYNC_START_DATE,
} from '@/lib/services/customer-payment-verification.service';

export const dynamic = 'force-dynamic';

/**
 * Returns pending payments queue, summary KPI statistics, and Zoho API usage for Payment Verification workspace.
 * Active queue operates on all unverified payments from 2026-03-01 through today.
 * Pending payments are strictly ordered earliest first (paymentDate ASC).
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (
    !session ||
    (session.role !== 'ADMIN' && !session.accounts_payment_verify_view)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode'); // Optional filter by paymentMode

    // Active verification scope: all payments from 2026-03-01 through today
    const activeWindowStartDate = new Date(DEFAULT_SYNC_START_DATE);

    // Start of current week (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 is Sunday
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - distanceToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    // 1. Calculate KPI summary metrics and Zoho API usage concurrently
    const [
      pendingVerificationCount,
      autoVerifiedThisWeekCount,
      cashPendingCount,
      verifiedThisWeekCount,
      zohoApiUsage,
    ] = await Promise.all([
      // 1. Pending Verification (from 2026-03-01 through today)
      prisma.customerPayment.count({
        where: {
          verificationStatus: CustomerPaymentVerificationStatus.PENDING,
          isVerified: false,
          paymentDate: { gte: activeWindowStartDate },
        },
      }),
      // 2. Auto Verified This Week
      prisma.customerPayment.count({
        where: {
          verificationStatus: CustomerPaymentVerificationStatus.VERIFIED,
          verificationMethod: 'AUTO_BANK_MATCH',
          verifiedAt: { gte: startOfWeek },
        },
      }),
      // 3. Cash Pending (from 2026-03-01 through today)
      prisma.customerPayment.count({
        where: {
          verificationStatus: CustomerPaymentVerificationStatus.PENDING,
          isVerified: false,
          paymentMode: { in: ['Cash', 'cash', 'CASH'] },
          paymentDate: { gte: activeWindowStartDate },
        },
      }),
      // 4. Verified This Week (Total manual + auto)
      prisma.customerPayment.count({
        where: {
          verificationStatus: CustomerPaymentVerificationStatus.VERIFIED,
          verifiedAt: { gte: startOfWeek },
        },
      }),
      // 5. Zoho API usage today (00:00 IST to 24:00 IST)
      getZohoApiUsageToday(),
    ]);

    // 2. Query pending queue payments (Earliest first: paymentDate ASC, from 2026-03-01 onwards)
    const whereClause: any = {
      verificationStatus: CustomerPaymentVerificationStatus.PENDING,
      isVerified: false,
      paymentDate: { gte: activeWindowStartDate },
    };

    if (mode && mode !== 'ALL') {
      whereClause.paymentMode = mode;
    }

    const pendingPayments = await prisma.customerPayment.findMany({
      where: whereClause,
      orderBy: { paymentDate: 'asc' },
      take: 500,
      include: {
        verifiedBy: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      stats: {
        pendingVerification: pendingVerificationCount,
        autoVerifiedThisWeek: autoVerifiedThisWeekCount,
        cashPending: cashPendingCount,
        verifiedThisWeek: verifiedThisWeekCount,
      },
      zohoApiUsage,
      payments: pendingPayments,
    });
  } catch (error: any) {
    console.error('[PaymentVerificationQueue] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch payment verification queue' },
      { status: 500 }
    );
  }
}

