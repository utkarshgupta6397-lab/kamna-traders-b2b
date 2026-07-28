import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { ProductLookupService } from '@/lib/services/ProductLookupService';

/** GET /api/staff/skus — returns all active SKUs with minimal fields for POS local cache */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const warehouseId = searchParams.get('warehouseId') || undefined;
  
  console.log(`[API] /api/staff/skus hit at ${new Date().toISOString()} | Warehouse: ${warehouseId ?? 'GLOBAL'}`);
  
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Inventory workflows consume this endpoint, so enforce inventory rules
    const products = await ProductLookupService.search('inventory', { warehouseId });

    // Calculate Top Brands
    const brandCounts: Record<string, number> = {};
    const categoryBrandCounts: Record<string, Record<string, number>> = {};

    products.forEach((p: any) => {
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
    const totalCount = products.length;
    const activeCount = products.length;
    const eligibleCount = products.filter((p: any) => p.caseSize > 1 && p.isActive).length;

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
