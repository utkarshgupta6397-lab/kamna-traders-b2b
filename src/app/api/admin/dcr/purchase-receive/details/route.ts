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
    const receiptId = searchParams.get('id');

    if (!receiptId) {
      return NextResponse.json({ error: 'Missing receipt ID' }, { status: 400 });
    }

    // receiptId format: `${dateStr}_${vendorStr}_${billStr}_${skuId}`
    // Since vendorStr or billStr might contain underscores, we split and take from the ends
    const parts = receiptId.split('_');
    if (parts.length < 4) {
      return NextResponse.json({ error: 'Invalid receipt ID format' }, { status: 400 });
    }

    const dateStr = parts[0];
    const skuId = parts[parts.length - 1];
    
    // To extract vendorStr and billStr accurately, we must query the DB 
    // to find serials matching dateStr and skuId, and then filter by the exact key match.
    // However, we can just fetch all serials for the given skuId and dateStr (via createdAt bounds)
    // and then filter down.

    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid date in receipt ID' }, { status: 400 });
    }

    const nextDay = new Date(dateObj);
    nextDay.setDate(nextDay.getDate() + 1);

    // Fetch all serials for that date
    const serials = await prisma.dcrSerial.findMany({
      where: {
        purchaseReceived: true,
        createdAt: {
          gte: dateObj,
          lt: nextDay,
        }
      },
      select: {
        id: true,
        serialNumber: true,
        vendorName: true,
        billNumber: true,
        skuId: true,
        vendorDcrStatus: true,
        createdAt: true
      }
    });

    // Filter serials that match the exact receiptId string
    const matchingSerials = serials.filter(serial => {
      const sDateStr = serial.createdAt.toISOString().split('T')[0];
      const sVendorStr = serial.vendorName || 'Unknown Vendor';
      const sBillStr = serial.billNumber || 'No Bill';
      const key = `${sDateStr}_${sVendorStr}_${sBillStr}_${skuId}`;
      return key === receiptId;
    });

    if (matchingSerials.length === 0) {
      return NextResponse.json({ error: 'No matching records found' }, { status: 404 });
    }

    const exactVendor = matchingSerials[0].vendorName;
    const exactBill = matchingSerials[0].billNumber;

    const vendorName = exactVendor || 'Unknown Vendor';
    const billNumber = exactBill || 'No Bill';

    const receiptSerials = serials.filter(s => 
      s.vendorName === exactVendor && 
      s.billNumber === exactBill
    );

    const skuIds = Array.from(new Set(receiptSerials.map(s => s.skuId).filter(Boolean))) as string[];
    const skus = await prisma.sku.findMany({
      where: { id: { in: skuIds } },
      select: { id: true, name: true }
    });
    const skuMap = new Map(skus.map(s => [s.id, s.name]));

    const linesMap = new Map<string, { skuId: string; skuName: string; eligibleSerials: string[] }>();

    for (const s of receiptSerials) {
      if (s.vendorDcrStatus === 'NOT_RECEIVED') {
        const sSkuId = s.skuId || 'UNKNOWN';
        if (!linesMap.has(sSkuId)) {
          linesMap.set(sSkuId, {
            skuId: sSkuId,
            skuName: skuMap.get(sSkuId) || 'Unknown SKU',
            eligibleSerials: []
          });
        }
        linesMap.get(sSkuId)!.eligibleSerials.push(s.serialNumber);
      }
    }

    return NextResponse.json({
      receiptId,
      vendorName,
      billNumber,
      lines: Array.from(linesMap.values())
    });

  } catch (error: any) {
    console.error('[Purchase Receive Details GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch details' }, { status: 500 });
  }
}
