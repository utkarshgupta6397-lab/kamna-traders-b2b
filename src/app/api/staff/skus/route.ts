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
      caseSize: true,
      categoryId: true,
      isActive: true,
      zohoBooksId2: true,
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
      brandId: sku.brand?.name ?? null, // Using name as ID for simplicity if needed, or I could use brandId if it existed.
      unit: sku.unit,
      moq: sku.moq,
      stepQty: sku.stepQty,
      price: sku.price,
      caseSize: sku.caseSize,
      categoryId: sku.categoryId,
      inventoryQty: totalQty,
      isOos: sku.inventory.length > 0 ? anyOos || totalQty <= 0 : false,
      isActive: sku.isActive,
      zohoBooksId2: sku.zohoBooksId2,
    };
  });

  // Calculate Top Brands
  const brandCounts: Record<string, number> = {};
  const categoryBrandCounts: Record<string, Record<string, number>> = {};

  products.forEach((p) => {
    if (p.brand) {
      brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
      if (p.categoryId) {
        if (!categoryBrandCounts[p.categoryId]) categoryBrandCounts[p.categoryId] = {};
        categoryBrandCounts[p.categoryId][p.brand] = (categoryBrandCounts[p.categoryId][p.brand] || 0) + 1;
      }
    }
  });

  const topBrandsFullCatalog = Object.entries(brandCounts)
    .map(([brandName, count]) => ({ brandName, activeSkuCount: count }))
    .sort((a, b) => b.activeSkuCount - a.activeSkuCount)
    .slice(0, 8);

  const topBrandsByCategory: Record<string, { brandName: string; activeSkuCount: number }[]> = {};
  Object.entries(categoryBrandCounts).forEach(([catId, counts]) => {
    topBrandsByCategory[catId] = Object.entries(counts)
      .map(([brandName, count]) => ({ brandName, activeSkuCount: count }))
      .sort((a, b) => b.activeSkuCount - a.activeSkuCount)
      .slice(0, 8);
  });

  return NextResponse.json({
    skus: products,
    topBrandsByCategory,
    topBrandsFullCatalog,
  });
}
