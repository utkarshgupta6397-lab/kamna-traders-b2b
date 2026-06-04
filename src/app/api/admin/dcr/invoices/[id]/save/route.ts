import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { selections, manualItems, skipDcr } = await req.json();

    if (!skipDcr && (!selections || !Array.isArray(manualItems))) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const invoice = await prisma.dcrInvoice.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Begin a transaction
    await prisma.$transaction(async (tx) => {
      if (skipDcr) {
        // Just mark as no DCR required
        await tx.dcrInvoice.update({
          where: { id },
          data: { 
            dcrStatus: 'NO_DCR_REQUIRED',
            reviewedAt: new Date(),
            archived: true,
            processedAt: new Date(),
            processingReason: 'MANUAL_SKIP'
          },
        });

        await tx.dcrAuditLog.create({
          data: {
            entityType: 'INVOICE',
            entityId: id,
            action: 'DCR_SKIPPED',
            userId: session.userId,
            metadata: { skipReason: 'User marked as No DCR Required' }
          },
        });
      } else {
        // Process DCR allocation
        // Update selected status for ZOHO items
        for (const item of invoice.items) {
          if (item.source === 'ZOHO') {
            const isSelected = !!selections[item.id];
            await tx.dcrInvoiceItem.update({
              where: { id: item.id },
              data: { selectedForDCR: isSelected },
            });
          }
        }

        // Add manual items
        for (const mItem of manualItems) {
          await tx.dcrInvoiceItem.create({
            data: {
              dcrInvoiceId: id,
              itemName: mItem.itemName,
              sku: mItem.sku || null,
              quantity: mItem.quantity,
              remarks: mItem.remarks,
              source: 'MANUAL',
              selectedForDCR: true,
            },
          });
        }

        await tx.dcrInvoice.update({
          where: { id },
          data: { 
            dcrStatus: 'PENDING_SERIALS',
            reviewedAt: new Date(),
            archived: true,
            processedAt: new Date(),
            processingReason: 'DCR_IDENTIFIED'
          },
        });

        // Log the action
        await tx.dcrAuditLog.create({
          data: {
            entityType: 'INVOICE',
            entityId: id,
            action: 'DCR_ALLOCATION_SAVED',
            userId: session.userId,
            metadata: {
              selections,
              manualItemsCount: manualItems.length
            }
          },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DCR Invoice Save POST] Error:', error);
    return NextResponse.json({ error: 'Failed to save DCR allocation' }, { status: 500 });
  }
}
