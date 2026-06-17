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
  const customerIdsParam = searchParams.get('customerIds');

  if (!customerIdsParam) {
    return NextResponse.json({ error: 'Missing customerIds' }, { status: 400 });
  }

  const customerIds = customerIdsParam.split(',').map(id => id.trim()).filter(id => id);

  if (customerIds.length < 2 || customerIds.length > 5) {
    return NextResponse.json({ error: 'Must provide between 2 and 5 customer IDs' }, { status: 400 });
  }

  const minDate = '2026-03-01';

  try {
    const results = await Promise.all(
      customerIds.map(async (id) => {
        const result = await getCustomerStatement(id, minDate);
        return { customerId: id, result };
      })
    );

    const failed = results.filter(r => !r.result.success);

    if (failed.length > 0) {
      return NextResponse.json(
        { error: 'Failed to fetch one or more statements', details: failed },
        { status: 400 }
      );
    }

    const successful = results.map(r => r.result.data);
    return NextResponse.json({ success: true, data: successful });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
