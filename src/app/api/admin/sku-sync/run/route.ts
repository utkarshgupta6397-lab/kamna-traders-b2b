import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getZohoSyncUrl } from '@/lib/zoho';

const normalizeStr = (s: string) => {
  if (!s) return '';
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
};

export async function POST() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const zohoUrl = getZohoSyncUrl();
  if (!zohoUrl) {
    return NextResponse.json({ error: 'Zoho sync environment variables missing' }, { status: 503 });
  }

  try {
    // Create Log entry
    const syncLog = await prisma.skuSyncLog.create({
      data: { startedAt: new Date() }
    });

    const response = await fetch(zohoUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Zoho API error: ${response.status}`);
    }

    const data = await response.json();
    const rawSkus = data?.result?.data;

    if (!Array.isArray(rawSkus) || rawSkus.length === 0) {
      await prisma.skuSyncLog.update({
        where: { id: syncLog.id },
        data: { completedAt: new Date(), totalReceived: 0 }
      });
      return NextResponse.json({ success: true, summary: { created: 0, updated: 0, failed: 0 } });
    }

    // Process all normalization and sync logic in a transaction
    const result = await prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      let failed = 0;

      const existingBrands = await tx.brand.findMany();
      const existingCategories = await tx.category.findMany();
      const existingSkus = await tx.sku.findMany({ select: { id: true, zohoBookItemId: true } });

      const brandMap = new Map<string, string>();
      existingBrands.forEach(b => brandMap.set(normalizeStr(b.name), b.id));

      const categoryMap = new Map<string, string>();
      existingCategories.forEach(c => categoryMap.set(normalizeStr(c.name), c.id));

      const skuMap = new Map<string, string>();
      existingSkus.forEach(s => {
        if (s.zohoBookItemId) {
          skuMap.set(s.zohoBookItemId.toString(), s.id);
        }
      });

      for (const raw of rawSkus) {
        try {
          if (!raw.zoho_book_item_id) {
            failed++;
            continue;
          }
          
          const zohoIdStr = raw.zoho_book_item_id.toString();
          const zohoIdBigInt = BigInt(zohoIdStr);

          // Resolve Brand
          let brandId = null;
          if (raw.brand) {
            const normBrand = normalizeStr(raw.brand);
            if (brandMap.has(normBrand)) {
              brandId = brandMap.get(normBrand);
            } else {
              const cleanCasing = raw.brand.trim().replace(/\s+/g, ' ');
              const newBrand = await tx.brand.create({ data: { name: cleanCasing } });
              brandId = newBrand.id;
              brandMap.set(normBrand, newBrand.id);
            }
          }

          // Resolve Category
          let categoryId = null;
          if (raw.category) {
            const normCat = normalizeStr(raw.category);
            if (categoryMap.has(normCat)) {
              categoryId = categoryMap.get(normCat);
            } else {
              const cleanCasing = raw.category.trim().replace(/\s+/g, ' ');
              const newCategory = await tx.category.create({ data: { name: cleanCasing } });
              categoryId = newCategory.id;
              categoryMap.set(normCat, newCategory.id);
            }
          }

          const price = typeof raw.price === 'number' ? raw.price : parseFloat(raw.price) || 0;
          const caseSize = typeof raw.case_size === 'number' ? raw.case_size : parseInt(raw.case_size, 10) || 1;
          const status = raw.status || 'Inactive';

          const skuData = {
            name: raw.name || '',
            brandId,
            categoryId,
            price,
            caseSize: caseSize > 0 ? caseSize : 1,
            unit: raw.uom || '',
            isActive: status.toLowerCase() === 'active',
            lastSyncedAt: new Date(),
          };

          if (skuMap.has(zohoIdStr)) {
            const localSkuId = skuMap.get(zohoIdStr)!;
            await tx.sku.update({
              where: { id: localSkuId },
              data: skuData
            });
            updated++;
          } else {
            const localSkuId = raw.sku_id?.trim() || `SKU-${zohoIdStr}`;
            await tx.sku.create({
              data: {
                id: localSkuId,
                zohoBookItemId: zohoIdBigInt,
                ...skuData
              }
            });
            skuMap.set(zohoIdStr, localSkuId);
            created++;
          }
        } catch (e) {
          console.error(`Failed to sync SKU ${raw.sku_id || raw.zoho_book_item_id}`, e);
          failed++;
        }
      }

      return { created, updated, failed };
    }, { maxWait: 20000, timeout: 60000 });

    // Update log
    await prisma.skuSyncLog.update({
      where: { id: syncLog.id },
      data: {
        completedAt: new Date(),
        totalReceived: rawSkus.length,
        createdCount: result.created,
        updatedCount: result.updated,
        failedCount: result.failed,
      }
    });

    return NextResponse.json({
      success: true,
      summary: result
    });

  } catch (error: any) {
    console.error('Sync Engine Error:', error);
    
    try {
      const recentLog = await prisma.skuSyncLog.findFirst({ orderBy: { startedAt: 'desc' } });
      if (recentLog && !recentLog.completedAt) {
        await prisma.skuSyncLog.update({
          where: { id: recentLog.id },
          data: {
            completedAt: new Date(),
            logs: { error: error.message || 'Unknown error' }
          }
        });
      }
    } catch (logErr) {
      console.error('Failed to log error:', logErr);
    }

    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}
