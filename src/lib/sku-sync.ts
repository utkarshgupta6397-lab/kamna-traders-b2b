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
 * Calculates granular diff between old and new SKU data using strict business logic.
 * IDENTITY IS STRINGS ONLY.
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

    // Normalize Old Value
    let normalizedOld = oldVal;
    if (typeof normalizedOld === 'string') normalizedOld = normalizedOld.trim();
    if (normalizedOld === null || normalizedOld === undefined) normalizedOld = '';

    // Normalize New Value
    let normalizedNew = newVal;
    if (typeof normalizedNew === 'string') normalizedNew = normalizedNew.trim();
    if (normalizedNew === null || normalizedNew === undefined) normalizedNew = '';

    // Strict string-based comparison
    if (normalizedOld.toString() !== normalizedNew.toString()) {
      diff[field] = { old: oldVal, new: newVal };
      hasChanges = true;
    }
  });

  return { hasChanges, diff };
}

/**
 * Hard verification of persisted state after DB write.
 * Enforces String-only identity.
 */
async function verifyPersistence(skuId: string, expectedData: any) {
  const actual = await prisma.sku.findUnique({ where: { id: skuId } });
  if (!actual) return { success: false, reason: 'Record not found in DB after commit' };

  const mismatches: string[] = [];
  const trackedFields = Object.keys(expectedData);

  for (const field of trackedFields) {
    let actualVal = (actual as any)[field];
    let expectedVal = expectedData[field];

    // String Normalization
    if (typeof actualVal === 'string') actualVal = actualVal.trim();
    if (actualVal === null || actualVal === undefined) actualVal = '';

    if (typeof expectedVal === 'string') expectedVal = expectedVal.trim();
    if (expectedVal === null || expectedVal === undefined) expectedVal = '';

    if (actualVal.toString() !== expectedVal.toString()) {
      mismatches.push(`${field}: expected "${expectedVal}", found "${actualVal}"`);
    }
  }

  return { success: mismatches.length === 0, mismatches, persistedState: safeJson(actual) };
}

export async function runSkuSync(options: { limit?: number; trigger?: 'USER' | 'CRON' } = {}) {
  const { limit = 0, trigger = 'CRON' } = options;
  const zohoUrl = getZohoSyncUrl();

  if (!zohoUrl) throw new Error('Zoho sync environment variables missing');

  // CONCURRENCY LOCK
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
    const [skuCount, invCount, brandCount, catCount] = await Promise.all([
      prisma.sku.count(),
      prisma.warehouseInventory.count(),
      prisma.brand.count(),
      prisma.category.count()
    ]);

    // PRE-SYNC AUDIT (STRINGS ONLY)
    const preExistingIdentities = new Set<string>();
    
    // Defensive check for stale Prisma Client
    if (!prisma.skuIdentityRegistry) {
      throw new Error('Database schema mismatch: SkuIdentityRegistry missing. Restart dev server.');
    }

    const registryCount = await prisma.skuIdentityRegistry.count();
    if (registryCount > 0) {
      const allRegistry = await prisma.skuIdentityRegistry.findMany({ select: { zohoBookItemId: true } });
      allRegistry.forEach(r => preExistingIdentities.add(String(r.zohoBookItemId)));
    }

    const preSyncAudit = { skuCount, registryCount, timestamp: new Date().toISOString() };
    const metadata: any = { requestedAt: new Date().toISOString(), syncLimit: limit, trigger, preSyncAudit };

    const syncLog = await prisma.skuSyncLog.create({
      data: { startedAt: new Date(), trigger, syncLimit: limit, metadata: safeJson(metadata) }
    });

    try {
      const response = await fetch(zohoUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error(`Zoho API error: ${response.status}`);

      const data = await response.json();
      const rawSkus = data?.result?.data;
      metadata.totalItemsInResponse = Array.isArray(rawSkus) ? rawSkus.length : 0;

      if (!Array.isArray(rawSkus) || rawSkus.length === 0) {
        await prisma.skuSyncLog.update({ where: { id: syncLog.id }, data: { completedAt: new Date(), totalReceived: 0, metadata: safeJson(metadata) } });
        return { created: 0, updated: 0, failed: 0, totalReceived: 0, skipped: 0, processed: 0 };
      }

      const executionTrace: any[] = [];
      let created = 0, updated = 0, failed = 0, skipped = 0, processed = 0;
      const sessionCreatedIdentities = new Set<string>();

      for (let i = 0; i < rawSkus.length; i++) {
        const raw = rawSkus[i];
        const skuId = raw.sku_id?.trim() || 'N/A';
        const productName = raw.name || 'Unknown';
        
        if (limit > 0 && processed >= limit) {
          executionTrace.push({ sku: skuId, product: productName, status: 'SKIPPED', action: 'LIMIT_REACHED', duration: 0, timestamp: new Date().toISOString() });
          skipped++;
          continue;
        }

        processed++;
        const itemStartTime = Date.now();
        let traceStatus: 'FETCHED' | 'SKIPPED' | 'UPDATED' | 'CREATED' | 'FAILED' = 'FETCHED';
        let traceAction = 'NONE', traceReason = '', errorDetails = null;

        const forensic: any = { sku: skuId, zohoId: String(raw.zoho_book_item_id), decision: 'PENDING' };

        try {
          // --- MANDATORY IDENTITY FIDELITY CHECK ---
          if (!raw.zoho_book_item_id) throw new Error('Zoho Internal ID missing');
          
          const rawId = raw.zoho_book_item_id;
          if (typeof rawId === 'number') {
            forensic.warning = 'UNSAFE_NUMERIC_ID_DETECTED';
            // Even if it's a number, we convert to string, but it might already be rounded by JS JSON.parse!
          }
          
          const zohoIdStr = String(rawId);

          // Resolve dependencies
          const brandId = raw.brand ? (await prisma.brand.upsert({ where: { name: raw.brand }, update: {}, create: { name: raw.brand } })).id : null;
          const categoryId = raw.category ? (await prisma.category.upsert({ where: { name: raw.category }, update: {}, create: { name: raw.category } })).id : null;

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

          // --- STRING-ONLY IDENTITY RESOLUTION ---
          const identity = await prisma.skuIdentityRegistry.findUnique({
            where: { zohoBookItemId: zohoIdStr }
          });

          if (identity) {
            if (identity.skuId !== skuId && skuId !== 'N/A') {
              throw new Error(`IDENTITY_CONFLICT: Zoho ID ${zohoIdStr} matches SKU ${identity.skuId}, but payload claims ${skuId}`);
            }

            const existingSku = await prisma.sku.findUnique({ where: { id: identity.skuId } });

            if (existingSku) {
              const diffResult = calculateSkuDiff(existingSku, baseData);
              if (!diffResult.hasChanges) {
                traceStatus = 'SKIPPED'; traceAction = 'RECONCILED'; skipped++;
              } else {
                await prisma.sku.update({ where: { id: existingSku.id }, data: { ...baseData, lastSyncedAt: new Date() } });
                const verification = await verifyPersistence(existingSku.id, baseData);
                if (!verification.success) {
                  traceStatus = 'FAILED'; traceAction = 'FAILED_PERSISTENCE'; failed++;
                } else {
                  traceStatus = 'UPDATED'; traceAction = 'DATA_SYNC'; updated++;
                }
              }
            } else {
              await prisma.sku.create({ data: { id: identity.skuId, zohoBookItemId: zohoIdStr, ...baseData, lastSyncedAt: new Date() } });
              traceStatus = 'CREATED'; traceAction = 'IDENTITY_RESTORED'; created++;
            }

            await prisma.skuIdentityRegistry.update({ where: { id: identity.id }, data: { lastSeenAt: new Date(), syncGeneration: { increment: 1 } } });

          } else {
            const codeReuse = await prisma.skuIdentityRegistry.findUnique({ where: { skuId } });
            if (codeReuse) throw new Error(`SKU CODE REUSE: Code ${skuId} is already mapped to Zoho ID ${codeReuse.zohoBookItemId}`);

            const finalId = skuId === 'N/A' ? `SKU-${zohoIdStr}` : skuId;
            await prisma.$transaction([
              prisma.skuIdentityRegistry.create({ data: { skuId: finalId, zohoBookItemId: zohoIdStr } }),
              prisma.sku.create({ data: { id: finalId, zohoBookItemId: zohoIdStr, ...baseData, lastSyncedAt: new Date() } })
            ]);

            const verification = await verifyPersistence(finalId, baseData);
            if (!verification.success) {
              traceStatus = 'FAILED'; traceAction = 'FAILED_PERSISTENCE'; failed++;
            } else {
              traceStatus = 'CREATED'; traceAction = 'IDENTITY_RESOLVED'; created++;
              sessionCreatedIdentities.add(zohoIdStr);
            }
          }
        } catch (e: any) {
          traceStatus = 'FAILED'; traceAction = 'EXCEPTION'; traceReason = e.message;
          errorDetails = safeJson({ message: e.message, forensic }); failed++;
        }

        executionTrace.push({ sku: skuId, product: productName, status: traceStatus, action: traceAction, reason: traceReason, duration: Date.now() - itemStartTime, timestamp: new Date().toISOString(), error: errorDetails, forensic });
      }

      const finalSkuCount = await prisma.sku.count();
      metadata.reconciliation = { processed, created, updated, skipped, failed, preSyncCount: skuCount, postSyncCount: finalSkuCount, isConsistent: (created + updated + failed) === processed };

      await prisma.skuSyncLog.update({
        where: { id: syncLog.id },
        data: {
          completedAt: new Date(),
          totalReceived: rawSkus.length,
          processedCount: processed, createdCount: created, updatedCount: updated, skippedCount: skipped, failedCount: failed,
          metadata: safeJson(metadata),
          executionTrace: safeJson(executionTrace)
        }
      });

      return { created, updated, failed, skipped, processed, totalReceived: rawSkus.length, reconciliation: metadata.reconciliation };

    } catch (error: any) {
      await prisma.skuSyncLog.update({ where: { id: syncLog.id }, data: { completedAt: new Date(), metadata: safeJson({ ...metadata, fatalError: error.message }) } }).catch(console.error);
      throw error;
    }
  } finally {
    await prisma.syncLock.update({ where: { name: 'SKU_SYNC' }, data: { isLocked: false, lockedAt: null, lockedBy: null } }).catch(console.error);
  }
}
