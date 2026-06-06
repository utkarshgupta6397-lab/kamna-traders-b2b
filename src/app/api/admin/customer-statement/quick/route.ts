import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCustomerStatement } from '@/lib/zoho/customer-statement';
import { getCache, setCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.accounts_customer_statement && !session.dcr_management && session.role !== 'ADMIN')) {
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

    const cid = customerId.trim();

    // Check Cache
    const cachedStatement = getCache('customerStatementCache', cid);
    if (cachedStatement) {
      return NextResponse.json(cachedStatement);
    }

    // We don't need a minDate filter for the quick snapshot, we just need the latest transactions.
    const result = await getCustomerStatement(cid);
    if (!result.success || !result.data) {
      return NextResponse.json({ error: result.error, raw: result.raw }, { status: 400 });
    }

    // Also populate the balance cache for the frontend to use immediately if it asks
    setCache('customerBalanceCache', cid, { outstandingBalance: result.data.closingBalance });

    // Prepare quick snapshot response
    const quickResponse = {
      success: true,
      data: {
        closingBalance: result.data.closingBalance,
        transactions: result.data.transactions.slice(-10) // Last 10 transactions
      }
    };

    setCache('customerStatementCache', cid, quickResponse);

    return NextResponse.json(quickResponse);
  } catch (error: any) {
    console.error('[Quick Statement API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch quick statement' }, { status: 500 });
  }
}
