import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { CustomerBalanceService } from '@/lib/services/customer-balance.service';
export const maxDuration = 300; // Allow up to 5 minutes to prevent timeout on Vercel

export async function POST(req: Request) {
  console.log('[HOLD_REFRESH] Step A: API entry');
  try {
    const session = await getSession();
    if (!session || (!session.dcr_hold_release && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let targetCustomerId: string | null = null;
    try {
      const body = await req.json();
      if (body?.customerId) {
        targetCustomerId = body.customerId;
      }
    } catch {
      // no body or invalid JSON
    }

    let customerIds: string[] = [];

    if (targetCustomerId) {
      customerIds = [targetCustomerId];
      console.log('[HOLD_REFRESH] Customer Outstanding Refresh started for:', targetCustomerId);
    } else {
      console.log('[HOLD_REFRESH] Global Outstanding Refresh started');
      // 1. Get all unique customer IDs currently in the hold queue
      const kpiWhereClause: any = {
        invoiceStatus: { not: 'void' },
        serialAllocations: {
          some: {
            serial: {
              vendorDcrStatus: 'RECEIVED',
              status: { notIn: ['READY_TO_ISSUE', 'ISSUED'] }
            }
          }
        }
      };

      const holdInvoices = await prisma.dcrInvoice.findMany({
        where: kpiWhereClause,
        select: { customerId: true },
      });

      customerIds = Array.from(new Set(holdInvoices.map((inv: any) => inv.customerId)));
    }
    
    console.log('[HOLD_REFRESH] Step B: Outstanding refresh service - Customers found:', customerIds.length);

    if (customerIds.length === 0) {
      return NextResponse.json({ success: true, message: 'No customers in hold queue', updated: 0 });
    }

    // 2. Fetch balances from Zoho and update DB using the shared service
    console.log(`[HOLD_REFRESH] Step C: Zoho API call batch refresh for ${customerIds.length} customers`);
    
    const refreshResult = await CustomerBalanceService.refreshCustomerBalances(customerIds);
    const updatedCount = Object.keys(refreshResult).length;

    console.log('[HOLD_REFRESH] Step D: Response generation');
    return NextResponse.json({
      success: true,
      message: `Updated balances for ${updatedCount} customers.`,
      updated: updatedCount,
    });

  } catch (error: any) {
    console.error(
      '[HOLD_QUEUE_REFRESH_ERROR]',
      error
    );

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
