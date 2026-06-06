import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [reviewPending, pendingInvoicesWithItems, vendorDcrPending, holdQueue, readyToIssue] = await Promise.all([
      // reviewPending: archived = false, status is NEW or UNDER_REVIEW
      prisma.dcrInvoice.count({
        where: { archived: false, dcrStatus: { in: ['NEW', 'UNDER_REVIEW'] } }
      }),
      // pendingInvoicesWithItems: status is PENDING_SERIALS or PARTIALLY_ALLOCATED
      prisma.dcrInvoice.findMany({
        where: { dcrStatus: { in: ['PENDING_SERIALS', 'PARTIALLY_ALLOCATED'] } },
        include: {
          items: {
            where: { selectedForDCR: true },
            include: {
              serialAllocations: true
            }
          }
        }
      }),
      // vendorDcrPending: status is VENDOR_DCR_PENDING
      prisma.dcrInvoice.count({
        where: { dcrStatus: 'VENDOR_DCR_PENDING' }
      }),
      // holdQueue: invoices awaiting management approval
      prisma.dcrInvoice.count({
        where: { dcrStatus: 'HOLD' }
      }),
      // readyToIssue: approved by management, awaiting physical issuance
      prisma.dcrInvoice.count({
        where: { dcrStatus: 'READY_TO_ISSUE' }
      })
    ]);

    let pendingSerials = 0;
    pendingInvoicesWithItems.forEach(inv => {
      inv.items.forEach(item => {
        const required = item.quantity;
        const allocated = item.serialAllocations.length;
        pendingSerials += Math.max(0, required - allocated);
      });
    });

    return NextResponse.json({
      reviewPending,
      pendingSerials,
      vendorDcrPending,
      holdQueue,
      readyToIssue,
    });
  } catch (error: any) {
    console.error('[DCR Stats GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch DCR statistics' }, { status: 500 });
  }
}

