import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { CustomerBalanceService } from '@/lib/services/customer-balance.service';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && !session.accounts_customer_statement)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get('customerId');

  if (!customerId) {
    return NextResponse.json({ error: 'Missing customerId' }, { status: 400 });
  }

  try {
    const balances = await CustomerBalanceService.getCustomerBalances([customerId]);
    const balanceData = balances[customerId];

    return NextResponse.json({
      success: true,
      data: balanceData || {
        customerId,
        netOutstandingBalance: 0,
        balanceUpdatedAt: null,
        balanceSyncStatus: null,
        balanceSyncError: null
      }
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
