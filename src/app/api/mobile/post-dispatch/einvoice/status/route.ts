import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hasPostDispatchAccess } from '@/lib/post-dispatch-auth';
import { runEInvoiceStatusCheck, isConsumerCustomer } from '@/lib/post-dispatch-sync';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPostDispatchAccess(session)) {
    return NextResponse.json(
      { error: 'Forbidden. Post-Dispatch access required.' },
      { status: 403 }
    );
  }

  try {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);

    const candidates = await prisma.postDispatchInvoice.findMany({
      where: {
        zohoCreatedTime: { gte: thirtyDaysAgo },
        eInvoiceGenerated: false,
        erpStatus: 'Active',
        zohoStatus: { notIn: ['void', 'draft'] },
      },
      select: {
        id: true,
        customerId: true,
        zohoDetailsJson: true,
      },
    });

    const eligibleInvoices = candidates.filter((cand) => {
      let isConsumer = false;
      const detailsJson = cand.zohoDetailsJson as any;
      if (detailsJson?.gst_treatment) {
        isConsumer = isConsumerCustomer({ gstTreatment: detailsJson.gst_treatment });
      }
      return !isConsumer;
    });

    return NextResponse.json({
      eligibleCount: eligibleInvoices.length,
      maxBatchSize: 100,
    });
  } catch (error: any) {
    console.error('[EInvoice Status Query API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to inspect E-Invoice eligibility' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPostDispatchAccess(session)) {
    return NextResponse.json(
      { error: 'Forbidden. Post-Dispatch access required.' },
      { status: 403 }
    );
  }

  try {
    const result = await runEInvoiceStatusCheck({
      trigger: 'MANUAL',
      userId: session.userId || session.id,
      userName: session.name || 'Staff',
      maxCalls: 100,
    });

    if (!result.success && result.skippedReason) {
      return NextResponse.json(
        { success: false, message: result.skippedReason, inProgress: true },
        { status: 409 }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.errorMessage || 'E-Invoice check failed.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result,
      message: `${result.processedCount} checked. ${result.remainingCount} remaining.`,
    });
  } catch (error: any) {
    console.error('[EInvoice Status Check API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to run E-Invoice status check' },
      { status: 500 }
    );
  }
}
