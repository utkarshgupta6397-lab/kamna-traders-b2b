import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { searchParams } = new URL(request.url);
  const skuId = searchParams.get('skuId');

  try {
    const warehouses = await prisma.warehouse.findMany({
      where: { active: true, isSystemWarehouse: false },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    if (skuId) {
      const inv = await prisma.warehouseInventory.findMany({
        where: { skuId },
        select: { warehouseId: true, qty: true },
      });
      const invMap = new Map(inv.map(i => [i.warehouseId, parseFloat(i.qty.toString())]));
      
      const mapped = warehouses.map(w => ({
        ...w,
        availableQty: invMap.get(w.id) || 0,
      }));
      return NextResponse.json(mapped);
    }

    return NextResponse.json(warehouses);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch warehouses' }, { status: 500 });
  }
}
