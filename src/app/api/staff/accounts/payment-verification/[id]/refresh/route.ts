import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { refreshSingleCustomerPayment } from '@/lib/services/customer-payment-verification.service';

export const dynamic = 'force-dynamic';

/**
 * Single-payment refresh endpoint.
 * Fetches latest state from Zoho Books for the specified payment,
 * reconciles local DB, and runs existing verification rules.
 *
 * Authorized for users with ADMIN role, accounts_payment_verify_action, or accounts_payment_verify_view.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (
    !session ||
    (session.role !== 'ADMIN' &&
      !session.accounts_payment_verify_action &&
      !session.accounts_payment_verify_view)
  ) {
    return NextResponse.json(
      { error: 'Forbidden: You do not have permission to refresh customer payments.' },
      { status: 403 }
    );
  }

  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required.' }, { status: 400 });
    }

    const result = await refreshSingleCustomerPayment({
      paymentId: id,
      userId: session.userId,
    });

    if (!result.success) {
      if (result.error === 'PAYMENT_NOT_FOUND') {
        return NextResponse.json(result, { status: 404 });
      }
      if (result.error === 'CONCURRENT_REFRESH') {
        return NextResponse.json(result, { status: 409 });
      }
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('[RefreshPaymentRoute] Error:', error);
    return NextResponse.json(
      {
        success: false,
        outcome: 'REFRESH_FAILED',
        isActionable: true,
        message: 'Internal server error while refreshing payment from Zoho Books.',
        error: error.message || 'Internal error',
        zohoApiCalls: 0,
      },
      { status: 500 }
    );
  }
}
