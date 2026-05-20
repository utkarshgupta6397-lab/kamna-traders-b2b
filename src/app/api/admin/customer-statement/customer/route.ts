import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCustomerById } from '@/lib/zoho/customer-statement';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get('customerId');

  if (!customerId || !/^\d{19}$/.test(customerId.trim())) {
    return NextResponse.json({ error: 'Invalid or missing customerId. Expected 19 digits.' }, { status: 400 });
  }

  const result = await getCustomerById(customerId.trim());
  if (!result.success) {
     return NextResponse.json({ error: result.error, raw: result.raw }, { status: 400 });
  }

  return NextResponse.json(result);
}
