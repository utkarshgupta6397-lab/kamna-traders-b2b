import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  verifyPaymentInZohoAndLocal,
} from '@/lib/services/customer-payment-verification.service';
import { CustomerPaymentVerificationMethod } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * Executes Manual Verification for a customer payment.
 * Requires accounts_payment_verify_action permission.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (
    !session ||
    (session.role !== 'ADMIN' && !session.accounts_payment_verify_action)
  ) {
    return NextResponse.json(
      { error: 'Forbidden: You do not have permission to verify customer payments.' },
      { status: 403 }
    );
  }

  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    // Check allowZohoWrites header or query parameter
    const allowZohoWritesHeader = request.headers.get('x-allow-zoho-writes') === 'true';
    const allowZohoWritesQuery = new URL(request.url).searchParams.get('allowZohoWrites') === 'true';
    const allowZohoWrites = allowZohoWritesHeader || allowZohoWritesQuery;

    // Production safety: reject attempts to use allowZohoWrites outside development
    if (allowZohoWrites && process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: 'Zoho verification write override is strictly disallowed outside local development.' },
        { status: 403 }
      );
    }

    const result = await verifyPaymentInZohoAndLocal({
      zohoPaymentId: id,
      method: CustomerPaymentVerificationMethod.MANUAL,
      userId: session.userId,
      allowZohoWrites,
    });

    if (!result.success) {
      if (result.skipped) {
        return NextResponse.json(
          {
            error: result.error || 'Zoho writes are disabled in Local Only mode.',
            skipped: true,
            code: result.code || 'SKIPPED_DUE_TO_LOCAL_WRITE_DISABLED',
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: result.error || 'Verification failed in Zoho Books.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Customer payment verified successfully.',
    });
  } catch (error: any) {
    console.error('[VerifyPaymentRoute] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error during payment verification' },
      { status: 500 }
    );
  }
}
