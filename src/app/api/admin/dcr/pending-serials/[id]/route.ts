import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET: Fetch individual invoice detail with items and allocated serials
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const invoice = await prisma.dcrInvoice.findUnique({
      where: { id },
      include: {
        items: {
          where: { selectedForDCR: true },
          include: {
            serialAllocations: {
              orderBy: { allocatedAt: 'desc' }
            }
          }
        }
      }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({ invoice });
  } catch (error: any) {
    console.error('[DCR Allocate Details GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch invoice details' }, { status: 500 });
  }
}

// POST: Save/allocate batch of serials for a specific DCR item
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: invoiceId } = await params;
    const { itemId, serials: rawSerials } = await req.json();

    if (!itemId || !Array.isArray(rawSerials)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Process serials: trim, filter out empty, convert to uppercase
    const serials = rawSerials
      .map((s: string) => s.trim().toUpperCase())
      .filter((s: string) => s.length > 0);

    if (serials.length === 0) {
      return NextResponse.json({ error: 'No valid serial numbers provided' }, { status: 400 });
    }

    // 1. Validation: No duplicates in current batch
    const uniqueBatch = new Set(serials);
    if (uniqueBatch.size !== serials.length) {
      return NextResponse.json({ error: 'Duplicate serial numbers found in the current batch' }, { status: 400 });
    }

    // Load invoice and items to validate quantities and states
    const invoice = await prisma.dcrInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: {
          include: {
            serialAllocations: true
          }
        }
      }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const targetItem = invoice.items.find(item => item.id === itemId);
    if (!targetItem || !targetItem.selectedForDCR) {
      return NextResponse.json({ error: 'DCR Item not found or not approved for DCR' }, { status: 404 });
    }

    const requiredQty = targetItem.quantity;
    const currentlyAllocated = targetItem.serialAllocations.length;
    const remainingQty = requiredQty - currentlyAllocated;

    // 2. Validation: Cannot allocate more than required quantity
    if (serials.length > remainingQty) {
      return NextResponse.json({
        error: `Cannot allocate ${serials.length} serials. Only ${remainingQty} remaining for this item.`
      }, { status: 400 });
    }

    // 3. Validation: No unavailable serials in database
    const existingSerials = await prisma.dcrSerial.findMany({
      where: {
        serialNumber: { in: serials }
      }
    });

    const unavailableSerials = existingSerials.filter(s => s.status !== 'AVAILABLE');
    if (unavailableSerials.length > 0) {
      const dupList = unavailableSerials.map(s => s.serialNumber).join(', ');
      return NextResponse.json({
        error: `The following serial numbers are not available for allocation: ${dupList}`
      }, { status: 400 });
    }

    // Perform database transaction
    await prisma.$transaction(async (tx) => {
      // Process DcrSerial and History
      for (const serial of serials) {
        const existing = existingSerials.find(s => s.serialNumber === serial);
        let dcrSerialId;

        if (!existing) {
          const newSerial = await tx.dcrSerial.create({
            data: {
              serialNumber: serial,
              skuId: itemId,
              source: 'MANUAL_DISCOVERY',
              status: 'ALLOCATED',
            }
          });
          dcrSerialId = newSerial.id;

          await tx.dcrSerialHistory.create({
            data: {
              serialId: dcrSerialId,
              eventType: 'INVENTORY_ADD',
              eventDescription: 'Added to inventory via Manual Discovery during DCR Allocation',
              userId: session.userId,
            }
          });
        } else {
          dcrSerialId = existing.id;
          await tx.dcrSerial.update({
            where: { id: dcrSerialId },
            data: { status: 'ALLOCATED', skuId: itemId }
          });
        }

        await tx.dcrSerialHistory.create({
          data: {
            serialId: dcrSerialId,
            eventType: 'ALLOCATED',
            eventDescription: `Allocated to Invoice ${invoice.invoiceNumber}`,
            userId: session.userId,
          }
        });
      }

      // Create allocations
      await tx.dcrSerialAllocation.createMany({
        data: serials.map(serial => ({
          invoiceId,
          skuId: itemId,
          serialNumber: serial,
          allocatedBy: session.name || session.userId || 'Unknown',
        }))
      });

      // Fetch updated counts across all approved DCR items on the invoice
      const updatedInvoice = await tx.dcrInvoice.findUnique({
        where: { id: invoiceId },
        include: {
          items: {
            where: { selectedForDCR: true },
            include: {
              serialAllocations: true
            }
          }
        }
      });

      if (updatedInvoice) {
        let totalRequired = 0;
        let totalAllocated = 0;

        updatedInvoice.items.forEach(item => {
          totalRequired += item.quantity;
          totalAllocated += item.serialAllocations.length;
        });

        // Determine next status
        const nextStatus = totalAllocated === totalRequired 
          ? 'READY_FOR_DCR' 
          : (totalAllocated > 0 ? 'PARTIALLY_ALLOCATED' : 'PENDING_SERIALS');

        await tx.dcrInvoice.update({
          where: { id: invoiceId },
          data: { dcrStatus: nextStatus }
        });
      }

      // Log audit
      await tx.dcrAuditLog.create({
        data: {
          entityType: 'INVOICE',
          entityId: invoiceId,
          action: 'DCR_SERIALS_ALLOCATED',
          userId: session.userId,
          metadata: {
            itemId,
            sku: targetItem.sku,
            itemName: targetItem.itemName,
            count: serials.length,
            serials
          }
        }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DCR Serials POST] Error:', error);
    return NextResponse.json({ error: 'Failed to allocate serial numbers' }, { status: 500 });
  }
}

// DELETE: Revoke/delete a specific serial number allocation
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: invoiceId } = await params;
    const { serialId } = await req.json();

    if (!serialId) {
      return NextResponse.json({ error: 'Missing serialId' }, { status: 400 });
    }

    const allocation = await prisma.dcrSerialAllocation.findFirst({
      where: {
        id: serialId,
        invoiceId
      },
      include: {
        invoiceItem: true
      }
    });

    if (!allocation) {
      return NextResponse.json({ error: 'Allocation not found for this invoice' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Release the DcrSerial
      const dcrSerial = await tx.dcrSerial.findUnique({
        where: { serialNumber: allocation.serialNumber }
      });

      if (dcrSerial) {
        await tx.dcrSerial.update({
          where: { id: dcrSerial.id },
          data: { status: 'AVAILABLE' }
        });

        // Get invoice to record the number in history
        const inv = await tx.dcrInvoice.findUnique({ where: { id: invoiceId }});

        await tx.dcrSerialHistory.create({
          data: {
            serialId: dcrSerial.id,
            eventType: 'DEALLOCATED',
            eventDescription: `De-allocated from Invoice ${inv?.invoiceNumber || invoiceId}`,
            userId: session.userId,
          }
        });
      }

      // Delete the allocation
      await tx.dcrSerialAllocation.delete({
        where: { id: serialId }
      });

      // Recalculate status
      const updatedInvoice = await tx.dcrInvoice.findUnique({
        where: { id: invoiceId },
        include: {
          items: {
            where: { selectedForDCR: true },
            include: {
              serialAllocations: true
            }
          }
        }
      });

      if (updatedInvoice) {
        let totalRequired = 0;
        let totalAllocated = 0;

        updatedInvoice.items.forEach(item => {
          totalRequired += item.quantity;
          totalAllocated += item.serialAllocations.length;
        });

        // Determine next status
        const nextStatus = totalAllocated === totalRequired 
          ? 'READY_FOR_DCR' 
          : (totalAllocated > 0 ? 'PARTIALLY_ALLOCATED' : 'PENDING_SERIALS');

        await tx.dcrInvoice.update({
          where: { id: invoiceId },
          data: { dcrStatus: nextStatus }
        });
      }

      // Log audit
      await tx.dcrAuditLog.create({
        data: {
          entityType: 'INVOICE',
          entityId: invoiceId,
          action: 'DCR_SERIAL_DELETED',
          userId: session.userId,
          metadata: {
            serialId,
            serialNumber: allocation.serialNumber,
            itemName: allocation.invoiceItem.itemName,
            sku: allocation.invoiceItem.sku
          }
        }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DCR Serial DELETE] Error:', error);
    return NextResponse.json({ error: 'Failed to delete serial number' }, { status: 500 });
  }
}
