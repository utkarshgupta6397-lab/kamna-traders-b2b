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

    let verifiedFields: any = undefined;
    try {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await request.json().catch(() => ({}));
        if (body && typeof body === 'object') {
          verifiedFields = body.verifiedFields;
        }
      }
    } catch {
      // Body reading error handled gracefully
    }

    const result = await verifyPaymentInZohoAndLocal({
      zohoPaymentId: id,
      method: CustomerPaymentVerificationMethod.MANUAL,
      userId: session.userId,
      verifiedFields,
    });

    if (!result.success) {
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
