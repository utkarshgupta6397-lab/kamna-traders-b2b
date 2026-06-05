import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && !session.dcr_purchase_dcr_receive && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serials: rawSerials, skuId } = await req.json();

    if (!skuId || !Array.isArray(rawSerials)) {
      return NextResponse.json({ error: 'Invalid payload: skuId and serials array are required' }, { status: 400 });
    }

    // Process serials: trim, filter empty, uppercase, drop wattage patterns like (620 Wp)
    const cleanedSerials = rawSerials
      .map((s: string) => s.replace(/\(\s*\d+\s*W[pP]?\s*\)/g, '').trim().toUpperCase())
      .map((s: string) => s.replace(/[^A-Z0-9-]/g, '').trim())
      .filter((s: string) => s.length > 0);

    if (cleanedSerials.length === 0) {
      return NextResponse.json({ error: 'No valid serial numbers provided after cleaning.' }, { status: 400 });
    }

    // 1. Duplicate in current upload
    const uniqueBatch = new Set(cleanedSerials);
    if (uniqueBatch.size !== cleanedSerials.length) {
      return NextResponse.json({ error: 'Duplicate serial numbers found in the current batch.' }, { status: 400 });
    }

    const serials = Array.from(uniqueBatch);

    // Fetch existing serials from DB
    const existingSerials = await prisma.dcrSerial.findMany({
      where: {
        serialNumber: { in: serials }
      }
    });

    const warnings: string[] = [];
    const errors: string[] = [];

    // SKU Integrity Validation
    for (const serial of serials) {
      const existing = existingSerials.find(s => s.serialNumber === serial);
      if (existing) {
        if (existing.vendorDcrStatus === 'RECEIVED') {
          warnings.push(`Serial ${serial} already has Vendor DCR marked as RECEIVED. It will be skipped.`);
        }
        if (existing.skuLocked && existing.skuId !== skuId) {
          errors.push(`Serial number ${serial} already belongs to another SKU. SKU reassignment is not permitted.`);
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }

    // Perform DB Transaction
    await prisma.$transaction(async (tx) => {
      for (const serial of serials) {
        const existing = existingSerials.find(s => s.serialNumber === serial);
        if (existing && existing.vendorDcrStatus === 'RECEIVED') {
          continue; // Skip already received
        }

        let dcrSerialId;

        if (!existing) {
          // Create new (certificate received before panels physically received, completely allowed)
          const newSerial = await tx.dcrSerial.create({
            data: {
              serialNumber: serial,
              skuId: skuId,
              serialSource: 'VENDOR_DCR_IMPORT', // Note: could be PURCHASE_RECEIVE if that happened first, but since it doesn't exist, we use VENDOR_DCR_IMPORT
              status: 'AVAILABLE',
              vendorDcrStatus: 'RECEIVED',
              vendorDcrReceivedAt: new Date(),
              vendorDcrReceivedBy: session.name || session.userId,
              skuLocked: true
            }
          });
          dcrSerialId = newSerial.id;

          await tx.dcrSerialHistory.create({
            data: {
              serialId: dcrSerialId,
              eventType: 'VENDOR_DCR_RECEIVED',
              eventDescription: 'Vendor DCR received (Auto-created via Import)',
              userId: session.userId,
            }
          });
        } else {
          // Update existing
          dcrSerialId = existing.id;
          await tx.dcrSerial.update({
            where: { id: dcrSerialId },
            data: {
              vendorDcrStatus: 'RECEIVED',
              vendorDcrReceivedAt: new Date(),
              vendorDcrReceivedBy: session.name || session.userId,
              skuId: skuId,
              skuLocked: true
            }
          });

          await tx.dcrSerialHistory.create({
            data: {
              serialId: dcrSerialId,
              eventType: 'VENDOR_DCR_RECEIVED',
              eventDescription: 'Vendor DCR Certificate Imported',
              userId: session.userId,
            }
          });
        }
      }

      // Check if we need to update parent invoice statuses (Customer DCR Status Engine)
      const allocations = await tx.dcrSerialAllocation.findMany({
        where: {
          serialNumber: { in: serials }
        }
      });

      const invoiceIds = Array.from(new Set(allocations.map(a => a.invoiceId)));
      
      for (const invId of invoiceIds) {
        const inv = await tx.dcrInvoice.findUnique({
          where: { id: invId },
          include: {
            items: {
              where: { selectedForDCR: true },
              include: { serialAllocations: true }
            }
          }
        });

        if (inv) {
          let allSerialsAllocated = true;
          let anyVendorDcrPending = false;
          let totalRequired = 0;
          let totalAllocated = 0;

          const invSerialNumbers = inv.items.flatMap(item => item.serialAllocations.map(a => a.serialNumber));
          const invSerials = await tx.dcrSerial.findMany({
            where: { serialNumber: { in: invSerialNumbers } }
          });

          inv.items.forEach(item => {
            totalRequired += item.quantity;
            totalAllocated += item.serialAllocations.length;
            if (item.serialAllocations.length < item.quantity) {
              allSerialsAllocated = false;
            }
          });

          invSerials.forEach(s => {
            if (s.vendorDcrStatus === 'NOT_RECEIVED') {
              anyVendorDcrPending = true;
            }
          });

          let nextStatus = inv.dcrStatus;

          if (totalAllocated === 0) {
            nextStatus = 'PENDING_SERIALS';
          } else if (totalAllocated < totalRequired) {
            nextStatus = 'PARTIALLY_ALLOCATED';
          } else if (allSerialsAllocated) {
            if (anyVendorDcrPending) {
              nextStatus = 'VENDOR_DCR_PENDING';
            } else {
              // Transition to HOLD or READY_TO_ISSUE based on payment status. 
              nextStatus = 'READY_TO_ISSUE';
            }
          }

          if (nextStatus !== inv.dcrStatus) {
            await tx.dcrInvoice.update({
              where: { id: inv.id },
              data: { dcrStatus: nextStatus }
            });

            await tx.dcrAuditLog.create({
              data: {
                entityType: 'INVOICE',
                entityId: inv.id,
                action: 'DCR_STATUS_UPDATED',
                userId: session.userId,
                metadata: { oldStatus: inv.dcrStatus, newStatus: nextStatus, reason: 'Vendor DCR Received' }
              }
            });
          }
        }
      }
    });

    return NextResponse.json({ success: true, warnings });
  } catch (error: any) {
    console.error('[Purchase DCR Receive POST] Error:', error);
    return NextResponse.json({ error: 'Failed to process DCR certificates' }, { status: 500 });
  }
}
