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
    const { searchParams } = new URL(req.url);
    const sortBy = searchParams.get('sortBy') || 'date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const validSortBy = ['date', 'total'].includes(sortBy) ? sortBy : 'date';
    const validSortOrder = (['asc', 'desc'].includes(sortOrder) ? sortOrder : 'desc') as 'asc' | 'desc';

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

    // Find next invoice ID based on current queue sorting before we update the current invoice
    const activeInvoices = await prisma.dcrInvoice.findMany({
      where: {
        invoiceStatus: { not: 'void' },
        archived: false,
        dcrStatus: { in: ['NEW', 'UNDER_REVIEW'] }
      },
      orderBy: validSortBy === 'total'
        ? { invoiceTotal: validSortOrder }
        : { invoiceDate: validSortOrder },
      select: { id: true }
    });

    const currentIndex = activeInvoices.findIndex(inv => inv.id === id);
    const nextInvoiceId = currentIndex !== -1 && currentIndex < activeInvoices.length - 1
      ? activeInvoices[currentIndex + 1].id
      : null;

    // Begin a transaction
    await prisma.$transaction(async (tx) => {
      // Fetch count of existing serial allocations for this invoice
      const allocatedSerialsCount = await tx.dcrSerialAllocation.count({
        where: { invoiceId: id }
      });

      if (skipDcr) {
        // Rule 1 & 3: Cannot skip/archive if serial allocations exist
        if (allocatedSerialsCount > 0) {
          throw new Error("This invoice already has allocated serial numbers. Remove or unallocate all serials before marking the invoice as 'No DCR Required' or modifying serial-managed items.");
        }

        // Just mark as no DCR required
        await tx.dcrInvoice.update({
          where: { id },
          data: { 
            dcrStatus: 'PROCESSED_NO_DCR',
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
        // Rule 2: Before removing a serial-managed line item, check whether serial numbers are already allocated.
        
        // Check ZOHO items being deselected
        for (const item of invoice.items) {
          if (item.source === 'ZOHO') {
            const isSelected = !!selections[item.id];
            // If it was selected before, but now deselected:
            if (item.selectedForDCR && !isSelected) {
              const hasAllocations = await tx.dcrSerialAllocation.count({
                where: { skuId: item.id }
              });
              if (hasAllocations > 0) {
                throw new Error("This invoice already has allocated serial numbers. Remove or unallocate all serials before marking the invoice as 'No DCR Required' or modifying serial-managed items.");
              }
            }

            await tx.dcrInvoiceItem.update({
              where: { id: item.id },
              data: { selectedForDCR: isSelected },
            });
          }
        }

        // Check MANUAL items being removed
        const existingManualItems = invoice.items.filter(item => item.source === 'MANUAL');
        for (const item of existingManualItems) {
          const isKept = manualItems.some((mItem: any) => mItem.id === item.id);
          if (!isKept) {
            const hasAllocations = await tx.dcrSerialAllocation.count({
              where: { skuId: item.id }
            });
            if (hasAllocations > 0) {
              throw new Error("This invoice already has allocated serial numbers. Remove or unallocate all serials before marking the invoice as 'No DCR Required' or modifying serial-managed items.");
            }

            // Safe to delete manual item since it has no allocations
            await tx.dcrInvoiceItem.delete({
              where: { id: item.id }
            });
          }
        }

        // Add new manual items
        for (const mItem of manualItems) {
          if (mItem.id.startsWith('manual_')) {
            await tx.dcrInvoiceItem.create({
              data: {
                dcrInvoiceId: id,
                itemName: mItem.itemName,
                sku: mItem.sku || mItem.itemId || null,
                itemId: mItem.itemId || null,
                quantity: mItem.quantity,
                remarks: mItem.remarks,
                source: 'MANUAL',
                selectedForDCR: true,
              },
            });
          }
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

    return NextResponse.json({ success: true, nextInvoiceId });
  } catch (error: any) {
    console.error('[DCR Invoice Save POST] Error:', error);
    if (error.message && error.message.includes('allocated serial numbers')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Failed to save DCR allocation' }, { status: 500 });
  }
}
