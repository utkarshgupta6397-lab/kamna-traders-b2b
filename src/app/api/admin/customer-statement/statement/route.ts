import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCustomerStatement } from '@/lib/zoho/customer-statement';
import { hasMobileFeatureAccess } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isDesktopAllowed = session.role === 'ADMIN' || Boolean(session.accounts_customer_statement);
  const isMobileAllowed = hasMobileFeatureAccess(session, 'mobile_accounts', 'mobile_accounts_customer_statement');
  if (!isDesktopAllowed && !isMobileAllowed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get('customerId');

  if (!customerId || !/^\d+$/.test(customerId.trim()) || customerId.trim().length < 15) {
    return NextResponse.json(
      { error: 'Invalid or missing customerId. Must be a numeric ID (min 15 digits).' },
      { status: 400 }
    );
  }

  try {
    const minDate = '2026-03-01';
    const result = await getCustomerStatement(customerId.trim(), minDate);
    if (!result.success) {
      return NextResponse.json({ error: result.error, raw: result.raw }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: String(e)
    }, { status: 500 });
  }
}
