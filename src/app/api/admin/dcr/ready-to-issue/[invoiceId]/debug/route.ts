import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  try {
    const { invoiceId } = await params;

    const invoice = await prisma.dcrInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: {
          include: {
            serialAllocations: {
              include: {
                serial: { select: { id: true, serialNumber: true, status: true, tag: true, vendorDcrStatus: true } }
              }
            }
          }
        }
      }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const allSerials = invoice.items.flatMap(item => item.serialAllocations.map(alloc => alloc.serial));
    const eligibleSerials = allSerials.filter(s => s?.status === 'READY_TO_ISSUE');
    const blockedSerials = allSerials.filter(s => s?.status !== 'READY_TO_ISSUE');

    return NextResponse.json({
      invoice,
      allocatedCount: allSerials.length,
      eligibleCount: eligibleSerials.length,
      blockedCount: blockedSerials.length,
      blockedSerials
    });

  } catch (error: any) {
    console.error('[DEBUG READY TO ISSUE] Error:', error);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
