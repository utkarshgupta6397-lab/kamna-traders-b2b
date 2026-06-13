import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCustomerStatement } from '@/lib/zoho/customer-statement';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && !session.accounts_customer_statement)) {
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

  const minDate = '2026-03-01';
  const result = await getCustomerStatement(customerId.trim(), minDate);
  if (!result.success) {
    return NextResponse.json({ error: result.error, raw: result.raw }, { status: 400 });
  }

  return NextResponse.json(result);
}
