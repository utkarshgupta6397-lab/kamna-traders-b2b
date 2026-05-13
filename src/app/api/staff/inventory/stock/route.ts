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

  if (!warehouseId || !skuId) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    const inventory = await prisma.warehouseInventory.findUnique({
      where: { warehouseId_skuId: { warehouseId, skuId } },
      select: { qty: true }
    });

    return NextResponse.json({ qty: inventory?.qty ?? 0 });
  } catch (error) {
    console.error('Stock fetch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
