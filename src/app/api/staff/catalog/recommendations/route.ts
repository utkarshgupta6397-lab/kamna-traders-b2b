import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const categoryId = searchParams.get('categoryId');
    const subCategoryId = searchParams.get('subCategoryId');

    if (!categoryId) {
      return NextResponse.json({ error: 'Missing categoryId parameter' }, { status: 400 });
    }

    // Determine the target classification ID to filter by
    // Since the database Product only stores one categoryId (which can be either a parent or a sub-category),
    // we use the subCategoryId if provided; otherwise, we use the categoryId.
    const targetClassificationId = subCategoryId || categoryId;

    // Fetch active variants belonging to active products in this classification
    const activeVariants = await prisma.productVariant.findMany({
      where: {
        isActive: true,
        product: {
          isActive: true,
          categoryId: targetClassificationId,
        },
      },
      select: {
        product: {
          select: {
            hsnCodeId: true,
            taxRateId: true,
            unitId: true,
          }
        }
      }
    });

    // Helper to calculate frequencies
    const getTopFrequencies = (items: (string | null)[]) => {
      const counts: Record<string, number> = {};
      let maxCount = 0;
      
      for (const item of items) {
        if (!item) continue;
        counts[item] = (counts[item] || 0) + 1;
        if (counts[item] > maxCount) {
          maxCount = counts[item];
        }
      }

      if (maxCount === 0) return [];

      // Find all items that have the maxCount (handles ties)
      const topItems = Object.keys(counts).filter(key => counts[key] === maxCount);
      return topItems;
    };

    const hsnCodesList = activeVariants.map(v => v.product?.hsnCodeId);
    const taxRatesList = activeVariants.map(v => v.product?.taxRateId);
    const unitsList = activeVariants.map(v => v.product?.unitId);

    const recommendedHsnCodes = getTopFrequencies(hsnCodesList);
    const recommendedTaxRates = getTopFrequencies(taxRatesList);
    const recommendedUnits = getTopFrequencies(unitsList);

    return NextResponse.json({
      hsnCodes: recommendedHsnCodes,
      taxRates: recommendedTaxRates,
      units: recommendedUnits,
      activeSkuCount: activeVariants.length
    });

  } catch (error: any) {
    console.error('Failed to aggregate recommendations:', error);
    return NextResponse.json({ error: 'Failed to aggregate recommendations' }, { status: 500 });
  }
}
