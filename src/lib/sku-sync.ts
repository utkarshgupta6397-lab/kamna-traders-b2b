import { prisma } from '@/lib/db';
import { getZohoSyncUrl } from '@/lib/zoho';

/**
 * Normalizes strings for comparison.
 */
const normalizeStr = (s: string) => {
  if (!s) return '';
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
};

/**
 * Recursively converts any BigInt values to strings (Failsafe).
 */
export function safeJson(value: any) {
  if (value === undefined || value === null) return value;
  return JSON.parse(
    JSON.stringify(value, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v
    )
  );
}

/**
 * Calculates granular diff between old and new SKU data.
 */
function calculateSkuDiff(oldData: any, newData: any) {
  const fields = [
    'name', 'price', 'unit', 'caseSize', 'isActive', 
    'zohoBooksId2', 'brandId', 'categoryId', 'gstPercent', 'hsnCode', 'description'
  ];
  
  const diff: Record<string, { old: any, new: any }> = {};
  let hasChanges = false;

  fields.forEach(field => {
    let oldVal = oldData[field];
    let newVal = newData[field];

    let normalizedOld = oldVal === null || oldVal === undefined ? '' : oldVal.toString().trim();
    let normalizedNew = newVal === null || newVal === undefined ? '' : newVal.toString().trim();

    if (normalizedOld !== normalizedNew) {
      diff[field] = { old: oldVal, new: newVal };
      hasChanges = true;
    }
  });

  return { hasChanges, diff };
}

/**
 * Hard verification of persisted state after DB write.
 * OPTIMIZATION: Only used for new creations or high-risk updates.
 */
async function verifyPersistence(skuId: string, expectedData: any) {
  const actual = await prisma.sku.findUnique({ where: { id: skuId } });
  if (!actual) return { success: false, reason: 'Record not found in DB after commit' };

  const mismatches: string[] = [];
  Object.keys(expectedData).forEach(field => {
    let actualVal = (actual as any)[field];
    let expectedVal = expectedData[field];
    
    let normActual = actualVal === null || actualVal === undefined ? '' : actualVal.toString().trim();
    let normExpected = expectedVal === null || expectedVal === undefined ? '' : expectedVal.toString().trim();

    if (normActual !== normExpected) {
      mismatches.push(`${field}: expected "${expectedVal}", found "${actualVal}"`);
    }
  });

  return { success: mismatches.length === 0, mismatches, persistedState: safeJson(actual) };
}

export async function runSkuSync(options: { limit?: number; trigger?: 'USER' | 'CRON' } = {}) {
  const totalStart = performance.now();
  const { limit = 0, trigger = 'CRON' } = options;
  const zohoUrl = getZohoSyncUrl();

  if (!zohoUrl) throw new Error('Zoho sync environment variables missing');

  // 1. CONCURRENCY LOCK
  const lock = await prisma.syncLock.upsert({
    where: { name: 'SKU_SYNC' },
    update: {},
    create: { name: 'SKU_SYNC', isLocked: false }
  });

  if (lock.isLocked && lock.lockedAt && (Date.now() - lock.lockedAt.getTime() < 10 * 60 * 1000)) {
    throw new Error('Synchronization already in progress.');
  }

  await prisma.syncLock.update({
    where: { name: 'SKU_SYNC' },
    data: { isLocked: true, lockedAt: new Date(), lockedBy: trigger }
  });

  try {
    // 2. PRELOAD LOOKUPS (The "One-Trip" Optimization)
    const preloadStart = performance.now();
    const [brands, categories, identities, skus] = await Promise.all([
      prisma.brand.findMany(),
      prisma.category.findMany(),
      prisma.skuIdentityRegistry.findMany(),
      prisma.sku.findMany({ 
        select: { 
          id: true, name: true, price: true, unit: true, caseSize: true, 
          isActive: true, zohoBooksId2: true, brandId: true, categoryId: true,
          gstPercent: true, hsnCode: true, description: true
        } 
      })
    ]);

    const brandMap = new Map(brands.map(b => [b.name, b.id]));
    const categoryMap = new Map(categories.map(c => [c.name, c.id]));
    const identityMap = new Map(identities.map(i => [i.zohoBookItemId, i]));
    const skuMap = new Map(skus.map(s => [s.id, s]));

    console.log(`[Perf] SKU Sync Preload: ${(performance.now() - preloadStart).toFixed(2)}ms (Brands: ${brands.length}, Categories: ${categories.length}, Identities: ${identities.length})`);

    const syncLog = await prisma.skuSyncLog.create({
      data: { 
        startedAt: new Date(), 
        trigger, 
        syncLimit: limit, 
        metadata: safeJson({ preSyncAudit: { skuCount: skus.length, registryCount: identities.length } }) 
      }
    });

    // 3. FETCH ZOHO DATA
    const fetchStart = performance.now();
    const response = await fetch(zohoUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`Zoho API error: ${response.status}`);
    const data = await response.json();
    const rawSkus = data?.result?.data;
    console.log(`[Perf] Zoho Fetch: ${(performance.now() - fetchStart).toFixed(2)}ms`);

    if (!Array.isArray(rawSkus) || rawSkus.length === 0) {
      await prisma.skuSyncLog.update({ where: { id: syncLog.id }, data: { completedAt: new Date(), totalReceived: 0 } });
      return { created: 0, updated: 0, failed: 0, totalReceived: 0, skipped: 0, processed: 0 };
    }

    const executionTrace: any[] = [];
    let created = 0, updated = 0, failed = 0, skipped = 0, processed = 0;

    // 4. MAIN SYNC LOOP (Optimized Chatter)
    const loopStart = performance.now();
    for (let i = 0; i < rawSkus.length; i++) {
      const raw = rawSkus[i];
      const skuId = raw.sku_id?.trim() || 'N/A';
      const productName = raw.name || 'Unknown';
      
      if (limit > 0 && processed >= limit) {
        skipped++; continue;
      }

      processed++;
      const itemStartTime = performance.now();
      let traceStatus: any = 'FETCHED', traceAction = 'NONE';

      try {
        const zohoIdStr = String(raw.zoho_book_item_id);
        if (!zohoIdStr || zohoIdStr === 'undefined') throw new Error('Zoho Internal ID missing');

        // A. Resolve Brand/Category (From Memory)
        let brandId = raw.brand ? brandMap.get(raw.brand) : null;
        if (raw.brand && !brandId) {
          // Fallback for missing brand: Single trip
          const newBrand = await prisma.brand.upsert({ where: { name: raw.brand }, update: {}, create: { name: raw.brand } });
          brandId = newBrand.id;
          brandMap.set(raw.brand, brandId);
        }

        let categoryId = raw.category ? categoryMap.get(raw.category) : null;
        if (raw.category && !categoryId) {
          const newCat = await prisma.category.upsert({ where: { name: raw.category }, update: {}, create: { name: raw.category } });
          categoryId = newCat.id;
          categoryMap.set(raw.category, categoryId);
        }

        const baseData = {
          name: raw.name || '',
          price: typeof raw.price === 'number' ? raw.price : parseFloat(raw.price) || 0,
          unit: raw.uom || '',
          caseSize: (typeof raw.case_size === 'number' ? raw.case_size : parseInt(raw.case_size, 10) || 1) || 1,
          isActive: raw.status === 'Active',
          zohoBooksId2: raw.zoho_books_id ? String(raw.zoho_books_id) : null,
          brandId, categoryId,
          gstPercent: typeof raw.gst_percent === 'number' ? raw.gst_percent : parseFloat(raw.gst_percent) || 0,
          hsnCode: raw.hsn_code || null,
          description: raw.description || null
        };

        // B. Identity Resolution (From Memory)
        const identity = identityMap.get(zohoIdStr);

        if (identity) {
          if (identity.skuId !== skuId && skuId !== 'N/A') {
            throw new Error(`CONFLICT: Zoho ${zohoIdStr} mapped to ${identity.skuId}, but payload claims ${skuId}`);
          }

          const existingSku = skuMap.get(identity.skuId);

          if (existingSku) {
            const { hasChanges } = calculateSkuDiff(existingSku, baseData);
            if (!hasChanges) {
              traceStatus = 'SKIPPED'; traceAction = 'RECONCILED'; skipped++;
            } else {
              await prisma.sku.update({ where: { id: existingSku.id }, data: { ...baseData, lastSyncedAt: new Date() } });
              traceStatus = 'UPDATED'; traceAction = 'SYNCED'; updated++;
            }
          } else {
            await prisma.sku.create({ data: { id: identity.skuId, zohoBookItemId: zohoIdStr, ...baseData, lastSyncedAt: new Date() } });
            traceStatus = 'CREATED'; traceAction = 'RESTORED'; created++;
          }

          // Periodic update of identity (once per sync)
          await prisma.skuIdentityRegistry.update({ where: { id: identity.id }, data: { lastSeenAt: new Date(), syncGeneration: { increment: 1 } } });

        } else {
          // New Identity: Atomic transaction
          const finalId = skuId === 'N/A' ? `SKU-${zohoIdStr}` : skuId;
          await prisma.$transaction([
            prisma.skuIdentityRegistry.create({ data: { skuId: finalId, zohoBookItemId: zohoIdStr } }),
            prisma.sku.create({ data: { id: finalId, zohoBookItemId: zohoIdStr, ...baseData, lastSyncedAt: new Date() } })
          ]);
          traceStatus = 'CREATED'; traceAction = 'NEW_IDENTITY'; created++;
        }
      } catch (e: any) {
        traceStatus = 'FAILED'; failed++;
        executionTrace.push({ sku: skuId, status: 'FAILED', error: e.message });
      }
    }
    console.log(`[Perf] SKU Loop Execution: ${(performance.now() - loopStart).toFixed(2)}ms for ${processed} items`);

    await prisma.skuSyncLog.update({
      where: { id: syncLog.id },
      data: {
        completedAt: new Date(),
        totalReceived: rawSkus.length,
        processedCount: processed, createdCount: created, updatedCount: updated, skippedCount: skipped, failedCount: failed,
        metadata: safeJson({ duration: performance.now() - totalStart })
      }
    });

    return { created, updated, failed, skipped, processed, totalReceived: rawSkus.length };

  } finally {
    await prisma.syncLock.update({ where: { name: 'SKU_SYNC' }, data: { isLocked: false, lockedAt: null, lockedBy: null } }).catch(() => null);
  }
}
