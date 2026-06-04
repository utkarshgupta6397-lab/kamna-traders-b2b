import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

/** GET /api/staff/skus — returns all active SKUs with minimal fields for POS local cache */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const warehouseId = searchParams.get('warehouseId');
  
  console.log(`[API] /api/staff/skus hit at ${new Date().toISOString()} | Warehouse: ${warehouseId ?? 'GLOBAL'}`);
  
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
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
        isUnlimited: true,
        zohoBooksId2: true,
        brand: { select: { name: true } },
        category: { select: { name: true } },
        inventory: {
          where: warehouseId ? { warehouseId } : undefined,
          select: { qty: true, isOos: true }
        },
      },
      orderBy: { name: 'asc' },
    });

    const products = skus.map((sku) => {
      // If warehouseId is provided, inventory will contain at most 1 item due to @@unique([warehouseId, skuId])
      const targetInv = warehouseId ? sku.inventory[0] : null;
      
      const inventoryQty = targetInv 
        ? targetInv.qty 
        : sku.inventory.reduce((s, inv) => s + inv.qty, 0);

      const isOos = sku.isUnlimited 
        ? false 
        : targetInv
          ? targetInv.isOos || targetInv.qty <= 0
          : sku.inventory.length > 0 
            ? sku.inventory.some((inv) => inv.isOos) || sku.inventory.reduce((s, inv) => s + inv.qty, 0) <= 0
            : false;

      return {
        id: sku.id,
        name: sku.name,
        brand: sku.brand?.name ?? null,
        brandId: sku.brand?.name ?? null,
        unit: sku.unit,
        moq: sku.moq,
        stepQty: sku.stepQty,
        price: sku.price,
        caseSize: sku.caseSize,
        categoryId: sku.categoryId,
        categoryName: sku.category?.name ?? null,
        inventoryQty,
        isOos,
        isUnlimited: sku.isUnlimited,
        isActive: sku.isActive,
        zohoBooksId2: sku.zohoBooksId2,
      };
    });

    // Calculate Top Brands
    const brandCounts: Record<string, number> = {};
    const categoryBrandCounts: Record<string, Record<string, number>> = {};

    products.forEach((p) => {
      // ── CONTEXTUAL BRAND FILTER ──
      // Only count brands for items that are actually available in this warehouse context
      if (p.brand && !p.isOos && ((p.inventoryQty ?? 0) > 0 || p.isUnlimited)) {
        brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
        if (p.categoryId) {
          if (!categoryBrandCounts[p.categoryId]) categoryBrandCounts[p.categoryId] = {};
          categoryBrandCounts[p.categoryId][p.brand] = (categoryBrandCounts[p.categoryId][p.brand] || 0) + 1;
        }
      }
    });

    const topBrandsFullCatalog = Object.entries(brandCounts)
      .map(([brandName, count]) => ({ brandName, activeSkuCount: count }))
      .sort((a, b) => a.brandName.localeCompare(b.brandName))
      .slice(0, 5);

    const topBrandsByCategory: Record<string, { brandName: string; activeSkuCount: number }[]> = {};
    Object.entries(categoryBrandCounts).forEach(([catId, counts]) => {
      topBrandsByCategory[catId] = Object.entries(counts)
        .map(([brandName, count]) => ({ brandName, activeSkuCount: count }))
        .sort((a, b) => a.brandName.localeCompare(b.brandName))
        .slice(0, 5);
    });

    // Debug telemetry
    const totalCount = await prisma.sku.count();
    const activeCount = await prisma.sku.count({ where: { isActive: true } });
    const eligibleCount = products.filter(p => p.caseSize > 1 && p.isActive).length;

    console.log(`[SKU Debug API] Total: ${totalCount}, Active: ${activeCount}, Eligible: ${eligibleCount}, Returned: ${products.length}`);

    return NextResponse.json({
      debug: {
        total: totalCount,
        active: activeCount,
        eligible: eligibleCount
      },
      skus: products,
      topBrandsByCategory,
      topBrandsFullCatalog,
    });
  } catch (error) {
    console.error('[API] /api/staff/skus Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
