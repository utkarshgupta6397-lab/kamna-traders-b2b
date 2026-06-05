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
    const { itemId, serials: rawSerials, forceCreate = false } = await req.json();

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

    const skuMismatchSerials = existingSerials.filter(s => s.skuLocked && s.skuId && s.skuId !== itemId);
    if (skuMismatchSerials.length > 0) {
      const mismatchList = skuMismatchSerials.map(s => s.serialNumber).join(', ');
      return NextResponse.json({
        error: `SKU mismatch for serials: ${mismatchList}. Serial number already belongs to another SKU. SKU reassignment is not permitted.`
      }, { status: 400 });
    }

    // 4. Check for unknown serials — require explicit confirmation before auto-creating
    const unknownSerials = serials.filter(s => !existingSerials.find(e => e.serialNumber === s));
    if (unknownSerials.length > 0 && !forceCreate) {
      return NextResponse.json({
        requiresConfirmation: true,
        unknownSerials,
        message: `${unknownSerials.length} serial(s) not found in the system. Confirm to auto-create them with Purchase Source = SALES_AUTO_CREATED.`
      }, { status: 200 });
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
              serialSource: 'SALES_AUTO_CREATED',
              status: 'ALLOCATED',
              purchaseReceived: true,
              vendorName: 'NA',
              vendorDcrStatus: 'NOT_RECEIVED',
              skuLocked: true,
            }
          });
          dcrSerialId = newSerial.id;

          await tx.dcrSerialHistory.create({
            data: {
              serialId: dcrSerialId,
              eventType: 'AUTO_CREATED',
              eventDescription: 'Auto-created during sales allocation. Purchase receipt was not recorded.',
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
        let nextStatus = updatedInvoice.dcrStatus;
        if (totalAllocated === 0) {
          nextStatus = 'PENDING_SERIALS';
        } else if (totalAllocated < totalRequired) {
          nextStatus = 'PARTIALLY_ALLOCATED';
        } else {
          // Check Vendor DCR Status for all allocated serials
          const invSerialNumbers = updatedInvoice.items.flatMap(item => item.serialAllocations.map(a => a.serialNumber));
          const invSerials = await tx.dcrSerial.findMany({
            where: { serialNumber: { in: invSerialNumbers } }
          });
          
          let anyVendorDcrPending = false;
          invSerials.forEach(s => {
            if (s.vendorDcrStatus === 'NOT_RECEIVED') {
              anyVendorDcrPending = true;
            }
          });
          
          if (anyVendorDcrPending) {
            nextStatus = 'VENDOR_DCR_PENDING';
          } else {
            nextStatus = 'READY_TO_ISSUE';
          }
        }

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
        let nextStatus = updatedInvoice.dcrStatus;
        if (totalAllocated === 0) {
          nextStatus = 'PENDING_SERIALS';
        } else if (totalAllocated < totalRequired) {
          nextStatus = 'PARTIALLY_ALLOCATED';
        } else {
          // Check Vendor DCR Status for all allocated serials
          const invSerialNumbers = updatedInvoice.items.flatMap(item => item.serialAllocations.map(a => a.serialNumber));
          const invSerials = await tx.dcrSerial.findMany({
            where: { serialNumber: { in: invSerialNumbers } }
          });
          
          let anyVendorDcrPending = false;
          invSerials.forEach(s => {
            if (s.vendorDcrStatus === 'NOT_RECEIVED') {
              anyVendorDcrPending = true;
            }
          });
          
          if (anyVendorDcrPending) {
            nextStatus = 'VENDOR_DCR_PENDING';
          } else {
            nextStatus = 'READY_TO_ISSUE';
          }
        }

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
