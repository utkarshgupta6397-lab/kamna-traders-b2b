import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCustomerById } from '@/lib/zoho/customer-statement';
import { trackZohoApiCall } from '@/lib/zoho-api-meter';

export const maxDuration = 300; // Allow up to 5 minutes to prevent timeout on Vercel

export async function POST(req: Request) {
  console.log('[HOLD_REFRESH] Step A: API entry');
  try {
    const session = await getSession();
    if (!session || (!session.dcr_hold_release && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

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

    const customerIds = Array.from(new Set(holdInvoices.map((inv: any) => inv.customerId)));
    
    console.log('[HOLD_REFRESH] Step B: Outstanding refresh service - Customers found:', customerIds.length);

    if (customerIds.length === 0) {
      return NextResponse.json({ success: true, message: 'No customers in hold queue', updated: 0 });
    }

    let updatedCount = 0;
    const now = new Date();

    // 2. Fetch balances from Zoho and update DB
    // To respect rate limits but not take forever, we can process sequentially or in small batches
    for (const cid of customerIds) {
      console.log(`[HOLD_REFRESH] Step C: Zoho API call for: ${cid}`);
      trackZohoApiCall('Customer Fetch (Hold Queue)');
      const result = await getCustomerById(cid);
      
      if (result.success && result.data) {
        const c = result.data;
        const customerNet = (c.outstandingReceivable || 0) - (c.unusedCreditsReceivable || 0);
        const vendorNet = (c.outstandingPayable || 0) - (c.unusedCreditsPayable || 0);
        const isHybrid = !!c.associatedVendorId;
        const netClosingBalance = isHybrid ? (customerNet - vendorNet) : customerNet;

        console.log(`[HOLD_REFRESH] Step D: Database write for: ${cid} with amount: ${netClosingBalance}`);
        await prisma.dcrInvoice.updateMany({
          where: { customerId: cid },
          data: {
            outstandingAmount: netClosingBalance,
            outstandingUpdatedAt: now,
          }
        });
        
        updatedCount++;
      } else {
        console.error(`[HOLD_REFRESH] Failed to fetch balance for customer ${cid}:`, result.error);
      }
    }

    console.log('[HOLD_REFRESH] Step E: Response generation');
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
