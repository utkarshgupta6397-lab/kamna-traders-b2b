import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && !session.canManageUnlimitedSkus)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { skuIds, isUnlimited } = await request.json();

    if (!Array.isArray(skuIds) || typeof isUnlimited !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    if (skuIds.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // Do NOT delete WarehouseInventory. Just update the Sku.
    const result = await prisma.sku.updateMany({
      where: { id: { in: skuIds } },
      data: {
        isUnlimited,
        updatedById: session.userId,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error: any) {
    console.error('Failed to toggle unlimited SKUs:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
