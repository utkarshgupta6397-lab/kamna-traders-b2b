import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_serial_mapping_override && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const serialNumber = searchParams.get('serial')?.trim().toUpperCase();

    if (!serialNumber) {
      return NextResponse.json({ error: 'Serial number required' }, { status: 400 });
    }

    const serial = await prisma.dcrSerial.findFirst({
      where: { serialNumber, isDeleted: false },
      include: {
        allocations: {
          include: {
            invoice: { select: { id: true, invoiceNumber: true, customerName: true } },
            invoiceItem: { select: { id: true, itemName: true, sku: true } }
          }
        },
        history: { orderBy: { createdAt: 'desc' } }
      }
    });

    if (!serial) {
      return NextResponse.json({ error: 'Serial not found' }, { status: 404 });
    }

    // Fetch sku details
    let skuName = 'Unknown Product';
    let skuDetails = null;
    if (serial.skuId) {
      const sku = await prisma.sku.findUnique({ 
        where: { id: serial.skuId }, 
        select: { id: true, name: true, zohoBooksId2: true } 
      });
      if (sku) {
        skuName = sku.name;
        skuDetails = sku;
      }
    }

    return NextResponse.json({ serial, skuName, skuDetails });
  } catch (error: any) {
    console.error('[Serial Corrections GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch serial' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_serial_mapping_override && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized: dcr_serial_mapping_override required' }, { status: 403 });
    }

    const { serialNumber, correctionType, newValues, reason } = await req.json();

    if (!serialNumber || !correctionType || !reason?.trim()) {
      return NextResponse.json({ error: 'serialNumber, correctionType, and reason are required' }, { status: 400 });
    }

    const serial = await prisma.dcrSerial.findFirst({ 
      where: { serialNumber: serialNumber.toUpperCase(), isDeleted: false },
      include: { allocations: true, history: true }
    });
    if (!serial) {
      return NextResponse.json({ error: 'Serial not found' }, { status: 404 });
    }

    const oldValues: Record<string, any> = {};
    const updateData: Record<string, any> = {};

    if (correctionType === 'CHANGE_SKU') {
      if (!newValues.skuId) return NextResponse.json({ error: 'newValues.skuId required' }, { status: 400 });
      // Verify SKU exists
      const sku = await prisma.sku.findUnique({ where: { id: newValues.skuId } });
      if (!sku) return NextResponse.json({ error: 'SKU not found' }, { status: 404 });

      oldValues.skuId = serial.skuId;
      updateData.skuId = newValues.skuId;
      updateData.skuLocked = true;
    } else if (correctionType === 'FIX_PURCHASE') {
      oldValues.purchaseReceived = serial.purchaseReceived;
      oldValues.vendorName = serial.vendorName;
      oldValues.billNumber = serial.billNumber;
      if (newValues.purchaseReceived !== undefined) updateData.purchaseReceived = newValues.purchaseReceived;
      if (newValues.vendorName !== undefined) updateData.vendorName = newValues.vendorName;
      if (newValues.billNumber !== undefined) updateData.billNumber = newValues.billNumber;
    } else if (correctionType === 'FIX_DCR') {
      oldValues.vendorDcrStatus = serial.vendorDcrStatus;
      oldValues.vendorDcrReceivedAt = serial.vendorDcrReceivedAt;
      oldValues.vendorDcrReceivedBy = serial.vendorDcrReceivedBy;
      if (newValues.vendorDcrStatus !== undefined) updateData.vendorDcrStatus = newValues.vendorDcrStatus;
      if (newValues.vendorDcrStatus === 'RECEIVED') {
        updateData.vendorDcrReceivedAt = new Date();
        updateData.vendorDcrReceivedBy = session.name || session.userId;
      } else if (newValues.vendorDcrStatus === 'NOT_RECEIVED') {
        updateData.vendorDcrReceivedAt = null;
        updateData.vendorDcrReceivedBy = null;
      }
    } else if (correctionType === 'CHANGE_SERIAL') {
      if (!newValues.serialNumber) return NextResponse.json({ error: 'newValues.serialNumber required' }, { status: 400 });
      const newSerialTrimmed = newValues.serialNumber.trim().toUpperCase();
      
      const existing = await prisma.dcrSerial.findFirst({ where: { serialNumber: newSerialTrimmed, isDeleted: false } });
      if (existing) {
        return NextResponse.json({ error: 'Serial number already exists' }, { status: 400 });
      }

      oldValues.serialNumber = serial.serialNumber;
      updateData.serialNumber = newSerialTrimmed;
    } else if (correctionType === 'DELETE_SERIAL') {
      if (['ISSUED', 'READY_TO_ISSUE'].includes(serial.status)) {
        return NextResponse.json({ error: `Cannot delete serial: Status is ${serial.status}` }, { status: 400 });
      }
      const hasIssueHistory = serial.history?.some((h: any) => h.eventType.includes('ISSUE'));
      if (hasIssueHistory) {
        return NextResponse.json({ error: `Cannot delete serial: Serial has been issued previously` }, { status: 400 });
      }
      
      updateData.isDeleted = true;
      updateData.serialNumber = `${serial.serialNumber}_DEL_${Date.now()}`;
      updateData.deletedAt = new Date();
      updateData.deletedBy = session.userId;
      updateData.deleteReason = reason;
      oldValues.isDeleted = false;
    } else {
      return NextResponse.json({ error: `Unknown correctionType: ${correctionType}` }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {

      // Clear the way for the new serial number if a deleted serial is squatting on it
      if (correctionType === 'CHANGE_SERIAL' && newValues.serialNumber) {
        const newSerialTrimmed = newValues.serialNumber.trim().toUpperCase();
        const deletedSquatter = await tx.dcrSerial.findUnique({ where: { serialNumber: newSerialTrimmed } });
        if (deletedSquatter && deletedSquatter.isDeleted) {
          await tx.dcrSerial.update({
            where: { id: deletedSquatter.id },
            data: { serialNumber: `${deletedSquatter.serialNumber}_DEL_${Date.now()}` }
          });
        }
      }

      if (correctionType === 'DELETE_SERIAL' && serial.allocations && serial.allocations.length > 0) {
        await tx.dcrSerialAllocation.deleteMany({
          where: { serialNumber: serial.serialNumber }
        });
        
        const invoiceIds = Array.from(new Set(serial.allocations.map((a: any) => a.invoiceId)));
        for (const invId of invoiceIds) {
          const invoice = await tx.dcrInvoice.findUnique({
            where: { id: invId as string },
            include: { items: true }
          });
          if (!invoice) continue;
          
          const totalRequired = invoice.items.filter((i: any) => i.selectedForDCR).reduce((sum: number, i: any) => sum + i.quantity, 0);
          const currentAllocations = await tx.dcrSerialAllocation.count({ where: { invoiceId: invId as string } });
          
          let nextStatus = invoice.dcrStatus;
          if (currentAllocations === 0) {
            nextStatus = 'PENDING_SERIALS';
          } else if (currentAllocations < totalRequired) {
            nextStatus = 'PARTIALLY_ALLOCATED';
          }
          
          if (nextStatus !== invoice.dcrStatus) {
            await tx.dcrInvoice.update({
              where: { id: invId as string },
              data: { dcrStatus: nextStatus }
            });
          }
        }
      }

      await tx.dcrSerial.update({
        where: { id: serial.id },
        data: updateData
      });

      await tx.dcrSerialHistory.create({
        data: {
          serialId: serial.id,
          eventType: `CORRECTION_${correctionType}`,
          eventDescription: JSON.stringify({
            correctionType,
            oldValues,
            newValues: updateData,
            reason,
            changedBy: session.name || session.userId,
            changedOn: new Date().toISOString(),
          }),
          userId: session.userId,
        }
      });

      await tx.dcrAuditLog.create({
        data: {
          entityType: 'SERIAL',
          entityId: serial.id,
          action: `SERIAL_CORRECTION_${correctionType}`,
          userId: session.userId,
          metadata: { serialNumber, oldValues, newValues: updateData, reason }
        }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[CHANGE_SERIAL]', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
