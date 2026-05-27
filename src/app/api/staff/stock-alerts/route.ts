import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session || (!session.stock_alerts_manage && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const thresholds = await prisma.stockAlertThreshold.findMany({
      include: {
        warehouse: { select: { name: true } },
        sku: { select: { name: true, unit: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (thresholds.length === 0) {
      return NextResponse.json([]);
    }

    const whIds = Array.from(new Set(thresholds.map(t => t.warehouseId)));
    const skuIds = Array.from(new Set(thresholds.map(t => t.skuId)));

    const inventory = await prisma.warehouseInventory.findMany({
      where: {
        warehouseId: { in: whIds },
        skuId: { in: skuIds }
      },
      select: { warehouseId: true, skuId: true, qty: true }
    });

    const stockMap = new Map<string, number>();
    for (const inv of inventory) {
      stockMap.set(`${inv.warehouseId}_${inv.skuId}`, inv.qty);
    }

    const results = thresholds.map(t => ({
      ...t,
      currentStock: stockMap.get(`${t.warehouseId}_${t.skuId}`) ?? 0
    }));

    return NextResponse.json(results);
  } catch (err) {
    console.error('Failed to fetch stock alert thresholds:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || (!session.stock_alerts_manage && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { warehouseId, skuId, minimumQty, isEnabled } = await request.json();

    if (!warehouseId || !skuId || minimumQty === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const qty = parseInt(minimumQty, 10);
    if (isNaN(qty) || qty < 0) {
      return NextResponse.json({ error: 'Minimum quantity must be a non-negative number' }, { status: 400 });
    }

    const result = await prisma.stockAlertThreshold.upsert({
      where: {
        warehouseId_skuId: { warehouseId, skuId }
      },
      update: {
        minimumQty: qty,
        isEnabled: isEnabled !== undefined ? isEnabled : true,
        updatedById: session.userId
      },
      create: {
        warehouseId,
        skuId,
        minimumQty: qty,
        isEnabled: isEnabled !== undefined ? isEnabled : true,
        createdById: session.userId,
        updatedById: session.userId
      }
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('Failed to save stock alert threshold:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session || (!session.stock_alerts_manage && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { id, minimumQty, isEnabled } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Threshold ID is required' }, { status: 400 });
    }

    const dataToUpdate: any = {};
    if (minimumQty !== undefined) {
      const qty = parseInt(minimumQty, 10);
      if (isNaN(qty) || qty < 0) {
        return NextResponse.json({ error: 'Minimum quantity must be a non-negative number' }, { status: 400 });
      }
      dataToUpdate.minimumQty = qty;
    }
    if (isEnabled !== undefined) {
      dataToUpdate.isEnabled = isEnabled;
    }
    dataToUpdate.updatedById = session.userId;

    const result = await prisma.stockAlertThreshold.update({
      where: { id },
      data: dataToUpdate
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('Failed to update stock alert threshold:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session || (!session.stock_alerts_manage && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Threshold ID is required' }, { status: 400 });
    }

    await prisma.stockAlertThreshold.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to delete stock alert threshold:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
