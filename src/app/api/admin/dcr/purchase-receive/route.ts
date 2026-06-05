import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && !session.dcr_purchase_receive && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { vendorName, dateReceived, billNumber, lines } = await req.json();

    // Support both old single-line format and new multi-line format
    if (!vendorName || !dateReceived) {
      return NextResponse.json({ error: 'Vendor name and date are required' }, { status: 400 });
    }

    // Normalise: if old format (skuId + serials), convert to lines[]
    const lineItems: { skuId: string; serials: string[] }[] = Array.isArray(lines) ? lines : [];

    if (lineItems.length === 0) {
      return NextResponse.json({ error: 'At least one SKU line with serials is required' }, { status: 400 });
    }

    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    // Pre-validate all lines first before writing anything
    for (const line of lineItems) {
      if (!line.skuId) {
        allErrors.push('Each line must have a SKU selected.');
        continue;
      }

      const cleanedSerials = line.serials
        .map((s: string) => s.trim().toUpperCase())
        .filter((s: string) => s.length > 0);

      if (cleanedSerials.length === 0) {
        allErrors.push(`No valid serials for SKU ${line.skuId}.`);
        continue;
      }

      const uniqueBatch = new Set(cleanedSerials);
      if (uniqueBatch.size !== cleanedSerials.length) {
        allErrors.push(`Duplicate serials found within SKU ${line.skuId}.`);
        continue;
      }

      const existingSerials = await prisma.dcrSerial.findMany({
        where: { serialNumber: { in: cleanedSerials } }
      });

      for (const serial of cleanedSerials) {
        const existing = existingSerials.find(s => s.serialNumber === serial);
        if (existing) {
          if (existing.purchaseReceived) {
            allWarnings.push(`Serial ${serial} was already marked as received. It will be skipped.`);
          } else if (existing.skuLocked && existing.skuId && existing.skuId !== line.skuId) {
            allErrors.push(`Serial ${serial} already belongs to another SKU. SKU reassignment is not permitted.`);
          }
        }
      }
    }

    if (allErrors.length > 0) {
      return NextResponse.json({ error: 'Validation failed', details: allErrors }, { status: 400 });
    }

    // Process all lines in a single transaction
    await prisma.$transaction(async (tx) => {
      for (const line of lineItems) {
        const cleanedSerials = line.serials
          .map((s: string) => s.trim().toUpperCase())
          .filter((s: string) => s.length > 0);

        const existingSerials = await tx.dcrSerial.findMany({
          where: { serialNumber: { in: cleanedSerials } }
        });

        for (const serial of cleanedSerials) {
          const existing = existingSerials.find(s => s.serialNumber === serial);
          if (existing && existing.purchaseReceived) continue; // skip already received

          let dcrSerialId;

          if (!existing) {
            const newSerial = await tx.dcrSerial.create({
              data: {
                serialNumber: serial,
                skuId: line.skuId,
                serialSource: 'PURCHASE_RECEIVE',
                status: 'AVAILABLE',
                vendorDcrStatus: 'NOT_RECEIVED',
                purchaseReceived: true,
                vendorName,
                billNumber: billNumber || null,
                skuLocked: true,
              }
            });
            dcrSerialId = newSerial.id;
          } else {
            dcrSerialId = existing.id;
            await tx.dcrSerial.update({
              where: { id: dcrSerialId },
              data: {
                purchaseReceived: true,
                vendorName,
                billNumber: billNumber || null,
                skuId: line.skuId,
                skuLocked: true,
              }
            });
          }

          await tx.dcrSerialHistory.create({
            data: {
              serialId: dcrSerialId,
              eventType: 'PURCHASE_RECEIVED',
              eventDescription: `Purchase Received from ${vendorName} (Bill: ${billNumber || 'N/A'}, Date: ${dateReceived})`,
              userId: session.userId,
            }
          });
        }
      }
    });

    const totalSerials = lineItems.reduce((sum, l) => sum + l.serials.filter(s => s.trim()).length, 0);
    return NextResponse.json({ success: true, warnings: allWarnings, totalSerials });
  } catch (error: any) {
    console.error('[Purchase Receive POST] Error:', error);
    return NextResponse.json({ error: 'Failed to process purchase receipt' }, { status: 500 });
  }
}
