import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { CustomerPaymentVerificationStatus } from '@prisma/client';
import {
  getZohoApiUsageToday,
  DEFAULT_SYNC_START_DATE,
  isPaymentEligibleForVerification,
} from '@/lib/services/customer-payment-verification.service';

export const dynamic = 'force-dynamic';

/**
 * Returns pending payments queue, summary KPI statistics, and Zoho API usage for Payment Verification workspace.
 * Active queue operates on all unverified, non-void payments from 2026-03-01 through today.
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

    // 1. Fetch unverified candidates in active window to compute eligible KPI counts
    const unverifiedCandidates = await prisma.customerPayment.findMany({
      where: {
        verificationStatus: {
          in: [
            CustomerPaymentVerificationStatus.PENDING,
            CustomerPaymentVerificationStatus.REVERIFICATION_REQUIRED,
          ],
        },
        isVerified: false,
        paymentDate: { gte: activeWindowStartDate },
      },
      select: {
        verificationStatus: true,
        paymentMode: true,
        zohoData: true,
      },
    });

    const eligibleUnverified = unverifiedCandidates.filter(isPaymentEligibleForVerification);
    const pendingVerificationCount = eligibleUnverified.length;
    const reverificationRequiredCount = eligibleUnverified.filter(
      (p) => p.verificationStatus === CustomerPaymentVerificationStatus.REVERIFICATION_REQUIRED
    ).length;
    const cashPendingCount = eligibleUnverified.filter(
      (p) => ['Cash', 'cash', 'CASH'].includes(p.paymentMode || '')
    ).length;

    // 2. Verified metrics (Total manual + auto, Auto-verified this week) & Zoho API usage
    const [
      autoVerifiedThisWeekCount,
      verifiedThisWeekCount,
      zohoApiUsage,
    ] = await Promise.all([
      prisma.customerPayment.count({
        where: {
          verificationStatus: CustomerPaymentVerificationStatus.VERIFIED,
          verificationMethod: 'AUTO_BANK_MATCH',
          verifiedAt: { gte: startOfWeek },
        },
      }),
      prisma.customerPayment.count({
        where: {
          verificationStatus: CustomerPaymentVerificationStatus.VERIFIED,
          verifiedAt: { gte: startOfWeek },
        },
      }),
      getZohoApiUsageToday(),
    ]);

    // 3. Query pending queue payments (Earliest first: paymentDate ASC, from 2026-03-01 onwards)
    const whereClause: any = {
      verificationStatus: {
        in: [
          CustomerPaymentVerificationStatus.PENDING,
          CustomerPaymentVerificationStatus.REVERIFICATION_REQUIRED,
        ],
      },
      isVerified: false,
      paymentDate: { gte: activeWindowStartDate },
    };

    if (mode && mode !== 'ALL') {
      whereClause.paymentMode = mode;
    }

    const fetchedPayments = await prisma.customerPayment.findMany({
      where: whereClause,
      orderBy: { paymentDate: 'asc' },
      take: 500,
      include: {
        verifiedBy: {
          select: { id: true, name: true },
        },
      },
    });

    // Exclude VOID, cancelled, or inactive payments deterministically
    const eligiblePendingPayments = fetchedPayments.filter(isPaymentEligibleForVerification);

    return NextResponse.json({
      success: true,
      stats: {
        pendingVerification: pendingVerificationCount,
        reverificationRequired: reverificationRequiredCount,
        autoVerifiedThisWeek: autoVerifiedThisWeekCount,
        cashPending: cashPendingCount,
        verifiedThisWeek: verifiedThisWeekCount,
      },
      zohoApiUsage,
      payments: eligiblePendingPayments,
    });
  } catch (error: any) {
    console.error('[PaymentVerificationQueue] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch payment verification queue' },
      { status: 500 }
    );
  }
}

