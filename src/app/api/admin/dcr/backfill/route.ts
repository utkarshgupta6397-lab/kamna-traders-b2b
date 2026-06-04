import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find all invoices with total < 5000 that are either not NO_DCR_REQUIRED or not archived
    const invoicesToUpdate = await prisma.dcrInvoice.findMany({
      where: {
        invoiceTotal: { lt: 5000 },
        OR: [
          { dcrStatus: { not: 'NO_DCR_REQUIRED' } },
          { archived: false }
        ]
      },
      select: { id: true }
    });

    if (invoicesToUpdate.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const ids = invoicesToUpdate.map(inv => inv.id);

    // Update them all to be archived & NO_DCR_REQUIRED
    const updateResult = await prisma.dcrInvoice.updateMany({
      where: {
        id: { in: ids }
      },
      data: {
        dcrStatus: 'NO_DCR_REQUIRED',
        archived: true,
        processedAt: new Date(),
        processingReason: 'AUTO_LOW_VALUE'
      }
    });

    // Create audit log entries for each
    await prisma.dcrAuditLog.createMany({
      data: ids.map(id => ({
        entityType: 'INVOICE',
        entityId: id,
        action: 'AUTO_LOW_VALUE_BACKFILL',
        userId: session.userId,
        metadata: { reason: 'Backfilled via admin API' }
      }))
    });

    return NextResponse.json({ 
      success: true, 
      count: updateResult.count 
    });
  } catch (error: any) {
    console.error('[DCR Backfill GET] Error:', error);
    return NextResponse.json({ error: 'Failed to run backfill' }, { status: 500 });
  }
}
