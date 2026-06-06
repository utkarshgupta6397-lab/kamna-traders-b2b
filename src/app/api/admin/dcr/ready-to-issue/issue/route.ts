import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

// PATCH /api/admin/dcr/ready-to-issue/issue
// Body: { invoiceId, serialNumbers?: string[], issueAll?: boolean }
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized: dcr_management required' }, { status: 403 });
    }

    const { invoiceId, serialNumbers, issueAll } = await req.json();

    if (!invoiceId) {
      return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 });
    }
    if (!issueAll && (!Array.isArray(serialNumbers) || serialNumbers.length === 0)) {
      return NextResponse.json({ error: 'serialNumbers or issueAll is required' }, { status: 400 });
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

    // Gather all allocations for this invoice
    const allAllocations = invoice.items.flatMap(item => item.serialAllocations);

    // Determine which serial numbers to issue
    let targetSerialNumbers: string[];
    if (issueAll) {
      // Issue all eligible (status = READY_TO_ISSUE)
      targetSerialNumbers = allAllocations
        .filter(a => a.serial?.status === 'READY_TO_ISSUE')
        .map(a => a.serialNumber);
    } else {
      targetSerialNumbers = serialNumbers;
    }

    if (targetSerialNumbers.length === 0) {
      return NextResponse.json({ error: 'No eligible serials found to issue' }, { status: 400 });
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
      if (alloc.serial.status !== 'READY_TO_ISSUE') {
        errors.push(`Serial ${sn} cannot be issued: status is ${alloc.serial.status}, expected READY_TO_ISSUE`);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const issuedBy = session.name || session.userId || 'Unknown';
    const issuedAt = new Date();

    await prisma.$transaction(async (tx) => {
      // Update each DcrSerial status to ISSUED and write history
      for (const sn of targetSerialNumbers) {
        const dcrSerial = await tx.dcrSerial.findUnique({ where: { serialNumber: sn } });
        if (!dcrSerial) continue;

        await tx.dcrSerial.update({
          where: { id: dcrSerial.id },
          data: { status: 'ISSUED' }
        });

        // DcrSerialHistory — serial-level trail
        await tx.dcrSerialHistory.create({
          data: {
            serialId: dcrSerial.id,
            eventType: 'DCR_ISSUED',
            eventDescription: JSON.stringify({
              issuedBy,
              issuedAt: issuedAt.toISOString(),
              invoiceNumber: invoice.invoiceNumber,
              customerName: invoice.customerName,
              oldStatus: 'READY_TO_ISSUE',
              newStatus: 'ISSUED'
            }),
            userId: session.userId,
          }
        });

        // DcrAuditLog — entity-level trail
        await tx.dcrAuditLog.create({
          data: {
            entityType: 'SERIAL',
            entityId: dcrSerial.id,
            action: 'SERIAL_ISSUED',
            userId: session.userId,
            metadata: {
              serialNumber: sn,
              invoiceId,
              invoiceNumber: invoice.invoiceNumber,
              customerName: invoice.customerName,
              issuedBy,
              issuedAt: issuedAt.toISOString(),
              oldStatus: 'READY_TO_ISSUE',
              newStatus: 'ISSUED'
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
          select: { serialNumber: true, status: true }
        });

        const anyNotIssued = allSerials.some(s => s.status !== 'ISSUED');
        let nextInvoiceStatus = invoice.dcrStatus;
        
        // If it was READY_TO_ISSUE (or even partially ready) and now everything is ISSUED, move to ISSUED
        if (!anyNotIssued) {
          nextInvoiceStatus = 'ISSUED';
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
            action: 'INVOICE_ISSUED',
            userId: session.userId,
            metadata: {
              invoiceNumber: invoice.invoiceNumber,
              customerName: invoice.customerName,
              issuedBy,
              issuedAt: issuedAt.toISOString(),
              serialsIssued: targetSerialNumbers.length,
              newInvoiceStatus: nextInvoiceStatus
            }
          }
        });
      }
    });

    return NextResponse.json({ success: true, issued: targetSerialNumbers.length });
  } catch (error: any) {
    console.error('[DCR Issue PATCH] Error:', error);
    return NextResponse.json({ error: 'Failed to issue serials' }, { status: 500 });
  }
}
