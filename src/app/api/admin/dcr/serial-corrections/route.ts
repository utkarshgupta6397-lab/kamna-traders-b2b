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

    const serial = await prisma.dcrSerial.findUnique({
      where: { serialNumber },
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

    // Fetch sku name
    let skuName = serial.skuId;
    if (serial.skuId) {
      const sku = await prisma.sku.findUnique({ where: { id: serial.skuId }, select: { name: true } });
      skuName = sku?.name || serial.skuId;
    }

    return NextResponse.json({ serial, skuName });
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

    const serial = await prisma.dcrSerial.findUnique({ where: { serialNumber: serialNumber.toUpperCase() } });
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
    } else {
      return NextResponse.json({ error: `Unknown correctionType: ${correctionType}` }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
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
    console.error('[Serial Corrections PATCH] Error:', error);
    return NextResponse.json({ error: 'Failed to apply correction' }, { status: 500 });
  }
}
