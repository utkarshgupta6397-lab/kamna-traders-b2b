import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

// PATCH /api/admin/dcr/hold-queue/release
// Body: { invoiceId, serialNumbers?: string[], releaseAll?: boolean }
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_hold_release && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized: dcr_hold_release required' }, { status: 403 });
    }

    const { invoiceId, serialNumbers, releaseAll } = await req.json();

    if (!invoiceId) {
      return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 });
    }
    if (!releaseAll && (!Array.isArray(serialNumbers) || serialNumbers.length === 0)) {
      return NextResponse.json({ error: 'serialNumbers or releaseAll is required' }, { status: 400 });
    }

    // Fetch the invoice
    const invoice = await prisma.dcrInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: {
          where: { selectedForDCR: true },
          include: {
            serialAllocations: {
              include: { serial: true }
            }
          }
        }
      }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Strict invoice status check removed to allow release of eligible serials regardless of invoice status

    // Fetch outstanding balance from cache for audit trail
    let outstandingAmountAtRelease: number | null = null;
    try {
      const cache = await prisma.invoiceSummaryCache.findUnique({ where: { id: 'singleton' } });
      if (cache?.rows) {
        const rows = cache.rows as any[];
        const customerRow = rows.find((r: any) => r.customerId === invoice.customerId);
        outstandingAmountAtRelease = customerRow?.amountPending ?? null;
      }
    } catch (_) {}

    // Gather all allocations for this invoice
    const allAllocations = invoice.items.flatMap(item => item.serialAllocations);

    // Determine which serial numbers to release
    let targetSerialNumbers: string[];
    if (releaseAll) {
      // Release all eligible (vendorDcrStatus = RECEIVED, not already released)
      targetSerialNumbers = allAllocations
        .filter(a => a.serial?.vendorDcrStatus === 'RECEIVED' && a.serial?.status !== 'READY_TO_ISSUE' && a.serial?.status !== 'ISSUED')
        .map(a => a.serialNumber);
    } else {
      targetSerialNumbers = serialNumbers;
    }

    if (targetSerialNumbers.length === 0) {
      return NextResponse.json({ error: 'No eligible serials found to release' }, { status: 400 });
    }

    // Validate each requested serial
    const errors: string[] = [];
    for (const sn of targetSerialNumbers) {
      const alloc = allAllocations.find(a => a.serialNumber === sn);
      if (!alloc) {
        errors.push(`Serial ${sn} not found in this invoice`);
        continue;
      }
      if (!alloc.serial) {
        errors.push(`Serial ${sn} record not found in DcrSerial`);
        continue;
      }
      if (alloc.serial.vendorDcrStatus !== 'RECEIVED') {
        errors.push(`Serial ${sn} cannot be released: vendor DCR not yet received`);
      }
      if (alloc.serial.status === 'ISSUED') {
        errors.push(`Serial ${sn} is already issued`);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const releasedBy = session.name || session.userId || 'Unknown';
    const releasedAt = new Date();

    await prisma.$transaction(async (tx) => {
      // Update each DcrSerial status to READY_TO_ISSUE and write history
      for (const sn of targetSerialNumbers) {
        const dcrSerial = await tx.dcrSerial.findUnique({ where: { serialNumber: sn } });
        if (!dcrSerial) continue;

        await tx.dcrSerial.update({
          where: { id: dcrSerial.id },
          data: { status: 'READY_TO_ISSUE' }
        });

        // DcrSerialHistory — serial-level trail
        await tx.dcrSerialHistory.create({
          data: {
            serialId: dcrSerial.id,
            eventType: 'HOLD_RELEASED',
            eventDescription: JSON.stringify({
              releasedBy,
              releasedAt: releasedAt.toISOString(),
              invoiceNumber: invoice.invoiceNumber,
              customerName: invoice.customerName,
              oldStatus: 'HOLD',
              newStatus: 'READY_TO_ISSUE',
              outstandingAmountAtRelease,
            }),
            userId: session.userId,
          }
        });

        // DcrAuditLog — entity-level trail
        await tx.dcrAuditLog.create({
          data: {
            entityType: 'SERIAL',
            entityId: dcrSerial.id,
            action: 'SERIAL_HOLD_RELEASED',
            userId: session.userId,
            metadata: {
              serialNumber: sn,
              invoiceId,
              invoiceNumber: invoice.invoiceNumber,
              customerName: invoice.customerName,
              releasedBy,
              releasedAt: releasedAt.toISOString(),
              oldStatus: 'HOLD',
              newStatus: 'READY_TO_ISSUE',
              outstandingAmountAtRelease,
            }
          }
        });
      }

      // Recalculate DcrInvoice.dcrStatus
      // Fetch fresh state post-update
      const updatedInvoice = await tx.dcrInvoice.findUnique({
        where: { id: invoiceId },
        include: {
          items: {
            where: { selectedForDCR: true },
            include: { serialAllocations: true }
          }
        }
      });

      if (updatedInvoice) {
        const allSerialNumbers = updatedInvoice.items.flatMap(item => item.serialAllocations.map(a => a.serialNumber));
        const allSerials = await tx.dcrSerial.findMany({
          where: { serialNumber: { in: allSerialNumbers } },
          select: { serialNumber: true, status: true, vendorDcrStatus: true }
        });

        const anyStillOnHold = allSerials.some(s => s.status !== 'READY_TO_ISSUE' && s.status !== 'ISSUED');
        let nextInvoiceStatus = invoice.dcrStatus;
        
        // If it was in HOLD and now everything is released, move to READY_TO_ISSUE
        if (invoice.dcrStatus === 'HOLD' && !anyStillOnHold) {
          nextInvoiceStatus = 'READY_TO_ISSUE';
        }

        if (nextInvoiceStatus !== invoice.dcrStatus) {
          await tx.dcrInvoice.update({
            where: { id: invoiceId },
            data: { dcrStatus: nextInvoiceStatus }
          });
        }

        // Invoice-level audit log
        await tx.dcrAuditLog.create({
          data: {
            entityType: 'INVOICE',
            entityId: invoiceId,
            action: 'INVOICE_HOLD_RELEASED',
            userId: session.userId,
            metadata: {
              invoiceNumber: invoice.invoiceNumber,
              customerName: invoice.customerName,
              releasedBy,
              releasedAt: releasedAt.toISOString(),
              serialsReleased: targetSerialNumbers.length,
              newInvoiceStatus: nextInvoiceStatus,
              outstandingAmountAtRelease,
            }
          }
        });
      }
    });

    return NextResponse.json({ success: true, released: targetSerialNumbers.length });
  } catch (error: any) {
    console.error('[DCR Hold Queue Release PATCH] Error:', error);
    return NextResponse.json({ error: 'Failed to release serials' }, { status: 500 });
  }
}
