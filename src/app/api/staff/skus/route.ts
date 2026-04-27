import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

/** GET /api/staff/skus — returns all active SKUs with minimal fields for POS local cache */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const skus = await prisma.sku.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      unit: true,
      moq: true,
      stepQty: true,
      price: true,
      imageUrl: true,
      categoryId: true,
      brand: { select: { name: true } },
      inventory: { select: { qty: true, isOos: true } },
    },
    orderBy: { name: 'asc' },
  });

  const products = skus.map((sku) => {
    const totalQty = sku.inventory.reduce((s, inv) => s + inv.qty, 0);
    const anyOos = sku.inventory.some((inv) => inv.isOos);
    return {
      id: sku.id,
      name: sku.name,
      brand: sku.brand?.name ?? null,
      unit: sku.unit,
      moq: sku.moq,
      stepQty: sku.stepQty,
      price: sku.price,
      imageUrl: sku.imageUrl,
      categoryId: sku.categoryId,
      isOos: sku.inventory.length > 0 ? anyOos || totalQty <= 0 : false,
    };
  });

  return NextResponse.json(products);
}
