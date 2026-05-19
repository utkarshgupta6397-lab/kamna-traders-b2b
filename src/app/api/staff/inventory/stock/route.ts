import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const warehouseId = searchParams.get('warehouseId');
  const skuId = searchParams.get('skuId');

  if (!warehouseId) {
    return NextResponse.json({ error: 'Missing warehouseId parameter' }, { status: 400 });
  }

  try {
    if (skuId) {
      const inventory = await prisma.warehouseInventory.findUnique({
        where: { warehouseId_skuId: { warehouseId, skuId } },
        select: { qty: true }
      });

      return NextResponse.json({ qty: inventory?.qty ?? 0 });
    }

    // Fetch all stock mappings for the warehouse
    const inventoryList = await prisma.warehouseInventory.findMany({
      where: { warehouseId },
      select: { skuId: true, qty: true }
    });

    const stockMap: Record<string, number> = {};
    for (const inv of inventoryList) {
      stockMap[inv.skuId] = inv.qty;
    }

    return NextResponse.json(stockMap);
  } catch (error) {
    console.error('Stock fetch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
