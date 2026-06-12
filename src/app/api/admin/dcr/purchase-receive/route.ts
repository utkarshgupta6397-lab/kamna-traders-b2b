import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && !session.dcr_purchase_receive && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(250, parseInt(searchParams.get('limit') || '50'));
    const skip = (page - 1) * limit;

    const allPurchased = await prisma.dcrSerial.findMany({
      where: { purchaseReceived: true },
      select: {
        id: true,
        serialNumber: true,
        vendorName: true,
        billNumber: true,
        skuId: true,
        vendorDcrStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    const skus = await prisma.sku.findMany({
      select: { id: true, name: true }
    });
    const skuMap = new Map(skus.map(s => [s.id, s.name]));

    // Compute KPIs
    const totalPurchased = allPurchased.length;
    const dcrReceived = allPurchased.filter(s => s.vendorDcrStatus === 'RECEIVED').length;
    const dcrPending = totalPurchased - dcrReceived;
    const completionPercent = totalPurchased > 0 ? Math.round((dcrReceived / totalPurchased) * 100) : 0;

    // Grouping
    const groups = new Map<string, any>();

    for (const serial of allPurchased) {
      const dateStr = serial.createdAt.toISOString().split('T')[0];
      const vendorStr = serial.vendorName || 'Unknown Vendor';
      const billStr = serial.billNumber || 'No Bill';
      const skuId = serial.skuId || 'UNKNOWN';

      const key = `${dateStr}_${vendorStr}_${billStr}_${skuId}`;

      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          date: dateStr,
          vendorName: vendorStr,
          billNumber: billStr,
          skuId,
          skuName: skuMap.get(skuId) || 'Unknown SKU',
          purchasedQty: 0,
          dcrReceived: 0,
          dcrPending: 0,
          serials: []
        });
      }

      const g = groups.get(key);
      g.purchasedQty += 1;
      if (serial.vendorDcrStatus === 'RECEIVED') {
        g.dcrReceived += 1;
      } else {
        g.dcrPending += 1;
      }
      
      g.serials.push({
        serialNumber: serial.serialNumber,
        vendorDcrStatus: serial.vendorDcrStatus
      });
    }

    let rows = Array.from(groups.values());
    
    // Calculate completion % per row
    rows = rows.map(r => ({
      ...r,
      completion: r.purchasedQty > 0 ? Math.round((r.dcrReceived / r.purchasedQty) * 100) : 0
    }));

    // Pagination
    const totalRows = rows.length;
    const paginatedRows = rows.slice(skip, skip + limit);

    return NextResponse.json({
      kpis: {
        totalPurchased,
        dcrReceived,
        dcrPending,
        completionPercent
      },
      rows: paginatedRows,
      total: totalRows,
      page,
      limit
    });
  } catch (error: any) {
    console.error('[Purchase Receive GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}

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
        where: { serialNumber: { in: cleanedSerials }, isDeleted: false }
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
        where: { serialNumber: { in: cleanedSerials }, isDeleted: false }
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

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && !session.dcr_purchase_receive && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serialNumbers, vendorName, billNumber, dateReceived } = await req.json();

    if (!serialNumbers || !Array.isArray(serialNumbers) || serialNumbers.length === 0) {
      return NextResponse.json({ error: 'Serial numbers are required' }, { status: 400 });
    }

    if (!vendorName || !dateReceived) {
      return NextResponse.json({ error: 'Vendor name and date received are required' }, { status: 400 });
    }

    const newDate = new Date(dateReceived);
    if (isNaN(newDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const serials = await tx.dcrSerial.findMany({
        where: { serialNumber: { in: serialNumbers } }
      });

      if (serials.length === 0) throw new Error('No valid serials found');

      for (const serial of serials) {
        // Keep the same time of day if possible, or default to noon UTC
        const d = new Date(dateReceived);
        d.setUTCHours(serial.createdAt.getUTCHours(), serial.createdAt.getUTCMinutes(), 0, 0);

        await tx.dcrSerial.update({
          where: { id: serial.id },
          data: {
            vendorName,
            billNumber: billNumber || null,
            createdAt: d
          }
        });

        await tx.dcrSerialHistory.create({
          data: {
            serialId: serial.id,
            eventType: 'PURCHASE_RECEIVE_EDITED',
            eventDescription: `Purchase details updated: Vendor: ${vendorName}, Bill: ${billNumber || 'N/A'}, Date: ${dateReceived}`,
            userId: session.userId,
          }
        });
      }
    });

    return NextResponse.json({ success: true, updated: serialNumbers.length });
  } catch (error: any) {
    console.error('[Purchase Receive PATCH] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update records' }, { status: 500 });
  }
}
