import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const todayStr = new Date().toDateString();
    let stats = (globalThis as any).__ZOHO_USAGE_STATS__;
    
    if (!stats || stats.date !== todayStr) {
      stats = { date: todayStr, total: 0, customer: 0, invoice: 0, payment: 0, statement: 0, other: 0 };
    }

    return NextResponse.json({
      success: true,
      today: {
        total: stats.total,
        customer: stats.customer,
        invoice: stats.invoice,
        payment: stats.payment,
        statement: stats.statement,
        other: stats.other
      }
    });
  } catch (error: any) {
    console.error('[Zoho API Meter] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 });
  }
}
