import { prisma } from '@/lib/db';
import { getZohoSyncUrl } from '@/lib/zoho';

const normalizeStr = (s: string) => {
  if (!s) return '';
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
};

/**
 * Recursively converts BigInt values to strings to prevent JSON serialization crashes.
 */
function safeJson(value: any) {
  if (value === undefined || value === null) return value;
  return JSON.parse(
    JSON.stringify(value, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v
    )
  );
}

/**
 * Creates a simple checksum of SKU data to detect changes.
 */
function getSkuChecksum(sku: any) {
  const data = {
    name: sku.name,
    price: sku.price,
    unit: sku.unit,
    caseSize: sku.caseSize,
    isActive: sku.isActive,
    brandId: sku.brandId,
    categoryId: sku.categoryId,
    zohoBooksId2: sku.zohoBooksId2
  };
  return JSON.stringify(data);
}

export async function runSkuSync(options: { limit?: number; trigger?: 'USER' | 'CRON' } = {}) {
  const { limit = 0, trigger = 'CRON' } = options;
  const startTime = Date.now();
  const zohoUrl = getZohoSyncUrl();

  if (!zohoUrl) {
    console.error('Zoho sync failed: No URL found in environment');
    throw new Error('Zoho sync environment variables missing');
  }

  // --- TASK 4: VERIFY SYNC CONCURRENCY SAFETY (SyncLock) ---
  const lock = await prisma.syncLock.upsert({
    where: { name: 'SKU_SYNC' },
    update: {},
    create: { name: 'SKU_SYNC', isLocked: false }
  });

  if (lock.isLocked && lock.lockedAt && (Date.now() - lock.lockedAt.getTime() < 10 * 60 * 1000)) {
    console.warn('[SYNC_LOCK] Sync already in progress. Aborting.');
    throw new Error('Synchronization already in progress. Please wait.');
  }

  // Acquire Lock
  await prisma.syncLock.update({
    where: { name: 'SKU_SYNC' },
    data: { isLocked: true, lockedAt: new Date(), lockedBy: trigger }
  });

  try {
    // --- TASK 3: PRE-SYNC CONSISTENCY AUDIT ---
    const [skuCount, invCount, brandCount, catCount] = await Promise.all([
      prisma.sku.count(),
      prisma.warehouseInventory.count(),
      prisma.brand.count(),
      prisma.category.count()
    ]);

    const existingSkuSamples = await prisma.sku.findMany({
      take: 10,
      select: { id: true, zohoBookItemId: true }
    });

    const preSyncAudit = {
      skuCount,
      invCount,
      brandCount,
      catCount,
      existingSkuSamples: safeJson(existingSkuSamples),
      timestamp: new Date().toISOString()
    };

    console.log('[SYNC_AUDIT] Pre-Sync DB State:', preSyncAudit);

    // Extract Metadata for Debugging (Mask sensitive info)
    const urlObj = new URL(zohoUrl);
    const metadata: any = {
      url: zohoUrl.split('?')[0],
      params: Object.fromEntries(urlObj.searchParams),
      requestedAt: new Date().toISOString(),
      syncLimit: limit,
      trigger,
      preSyncAudit
    };
    
    if (metadata.params.publickey) {
      metadata.params.publickey = metadata.params.publickey.substring(0, 5) + '...';
    }

    const syncLog = await prisma.skuSyncLog.create({
      data: { 
        startedAt: new Date(),
        trigger,
        syncLimit: limit,
        metadata: safeJson(metadata)
      }
    });

    try {
      const fetchStart = Date.now();
      const response = await fetch(zohoUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });

      const responseTime = Date.now() - fetchStart;

      if (!response.ok) {
        throw new Error(`Zoho API error: ${response.status}`);
      }

      const data = await response.json();
      
      // --- TASK 9: LOG FULL RESPONSE ON EMPTY ---
      if (!data?.result?.data || data.result.data.length === 0) {
        console.warn('[SYNC_DEBUG] Zoho returned 0 records. Full Body:', JSON.stringify(data));
        metadata.fullEmptyResponse = data;
      }

      const rawSkus = data?.result?.data;
      
      metadata.responseTimeMs = responseTime;
      metadata.totalItemsInResponse = Array.isArray(rawSkus) ? rawSkus.length : 0;
      metadata.rawResponseSize = JSON.stringify(data).length;
      metadata.hasMorePage = data?.result?.has_more_page || false;
      metadata.sampleItemIds = Array.isArray(rawSkus) ? rawSkus.slice(0, 5).map((s: any) => s.sku_id || s.zoho_book_item_id) : [];

      if (!Array.isArray(rawSkus) || rawSkus.length === 0) {
        await prisma.skuSyncLog.update({
          where: { id: syncLog.id },
          data: { 
            completedAt: new Date(), 
            totalReceived: 0,
            metadata: safeJson(metadata)
          }
        });
        return { created: 0, updated: 0, failed: 0, totalReceived: 0, skipped: 0, processed: 0 };
      }

      const executionTrace: any[] = [];
      let created = 0;
      let updated = 0;
      let failed = 0;
      let skipped = 0;
      let processed = 0;
      
      const batchSize = 10;
      let currentBatch: any[] = [];
      const batches: any[] = [];
      let batchStartTime = Date.now();

      // --- TASK 6: ENFORCE SERIAL SYNC ---
      for (let i = 0; i < rawSkus.length; i++) {
        const raw = rawSkus[i];
        const skuId = raw.sku_id?.trim() || 'N/A';
        const productName = raw.name || 'Unknown';
        
        if (limit > 0 && processed >= limit) {
          executionTrace.push({
            sku: skuId,
            product: productName,
            status: 'SKIPPED',
            action: 'limit_reached',
            reason: `Sync limit of ${limit} reached`,
            duration: 0,
            timestamp: new Date().toISOString()
          });
          skipped++;
          continue;
        }

        processed++;
        const itemStartTime = Date.now();
        let traceStatus = 'FETCHED';
        let traceAction = 'none';
        let traceReason = '';
        let errorDetails = null;

        // --- TASK 1: FORENSIC DECISION LOGGING ---
        const forensic: any = {
          sku: skuId,
          zohoId: raw.zoho_book_item_id?.toString(),
          decision: 'PENDING',
          lookupField: 'zohoBookItemId',
          lookupValue: raw.zoho_book_item_id?.toString()
        };

        try {
          if (!raw.zoho_book_item_id) {
            throw new Error('Zoho Internal ID missing');
          }
          
          const zohoIdStr = raw.zoho_book_item_id.toString();
          const zohoIdBigInt = BigInt(zohoIdStr);

          let brandId = null;
          if (raw.brand) {
            const brand = await prisma.brand.upsert({
              where: { name: raw.brand },
              update: {},
              create: { name: raw.brand }
            });
            brandId = brand.id;
          }

          let categoryId = null;
          if (raw.category) {
            const category = await prisma.category.upsert({
              where: { name: raw.category },
              update: {},
              create: { name: raw.category }
            });
            categoryId = category.id;
          }

          const price = typeof raw.price === 'number' ? raw.price : parseFloat(raw.price) || 0;
          const caseSize = typeof raw.case_size === 'number' ? raw.case_size : parseInt(raw.case_size, 10) || 1;
          const status = raw.status || 'Inactive';

          const baseData = {
            name: raw.name || '',
            price,
            unit: raw.uom || '',
            caseSize: caseSize > 0 ? caseSize : 1,
            isActive: status === 'Active',
            zohoBooksId2: raw.zoho_books_id ? raw.zoho_books_id.toString() : null,
            brandId,
            categoryId,
          };

          // Identity Priority: Check existing by Zoho ID
          const existingSku = await prisma.sku.findFirst({
            where: { zohoBookItemId: zohoIdBigInt }
          });

          if (existingSku) {
            forensic.matchedRecordId = existingSku.id;
            forensic.decision = 'UPDATE';
            forensic.reason = `Found existing SKU with Zoho ID ${zohoIdStr}`;

            const currentChecksum = getSkuChecksum({ ...existingSku, id: existingSku.id });
            const newChecksum = getSkuChecksum({ ...baseData, id: existingSku.id });

            if (currentChecksum === newChecksum) {
              traceStatus = 'SKIPPED';
              traceAction = 'no_change';
              traceReason = 'Data matches local database exactly';
              skipped++;
            } else {
              await prisma.sku.update({
                where: { id: existingSku.id },
                data: { ...baseData, lastSyncedAt: new Date() }
              });
              traceStatus = 'UPDATED';
              traceAction = 'data_refresh';
              updated++;
            }
          } else {
            // --- TASK 4: VERIFY ID CONFLICT ---
            const idConflict = await prisma.sku.findUnique({ where: { id: skuId } });
            if (idConflict) {
              forensic.idConflict = true;
              forensic.conflictRecordId = idConflict.id;
              forensic.conflictZohoId = idConflict.zohoBookItemId?.toString();
              throw new Error(`SKU ID conflict: ${skuId} already exists with different Zoho ID (${forensic.conflictZohoId})`);
            }

            forensic.decision = 'CREATE';
            forensic.reason = 'No existing SKU found with this Zoho ID or SKU code';

            await prisma.sku.create({
              data: {
                id: skuId === 'N/A' ? `SKU-${zohoIdStr}` : skuId,
                zohoBookItemId: zohoIdBigInt,
                ...baseData,
                lastSyncedAt: new Date()
              }
            });
            traceStatus = 'CREATED';
            traceAction = 'new_product';
            created++;
          }
        } catch (e: any) {
          traceStatus = 'FAILED';
          traceAction = 'error';
          traceReason = e.message || 'Unknown processing error';
          errorDetails = safeJson({ message: e.message, stack: e.stack, raw, forensic });
          failed++;
        }

        const duration = Date.now() - itemStartTime;
        executionTrace.push({
          sku: skuId,
          product: productName,
          status: traceStatus,
          action: traceAction,
          reason: traceReason,
          duration,
          timestamp: new Date().toISOString(),
          error: errorDetails,
          forensic 
        });

        currentBatch.push(skuId);
        if (currentBatch.length >= batchSize || i === rawSkus.length - 1) {
          batches.push({
            index: batches.length + 1,
            skus: currentBatch,
            duration: Date.now() - batchStartTime,
            timestamp: new Date().toISOString()
          });
          currentBatch = [];
          batchStartTime = Date.now();
        }
      }

      // --- TASK 8: POST-SYNC RECONCILIATION ---
      const finalSkuCount = await prisma.sku.count();
      const reconciliation = {
        zohoReturned: rawSkus.length,
        processed,
        created,
        updated,
        skipped,
        failed,
        preSyncCount: skuCount,
        postSyncCount: finalSkuCount,
        netChange: finalSkuCount - skuCount,
        isConsistent: (created + updated + skipped + failed) === processed
      };

      metadata.batches = batches;
      metadata.reconciliation = reconciliation;

      if (!reconciliation.isConsistent) {
        console.error('[SYNC_ALERT] Reconciliation mismatch!', reconciliation);
      }

      const finalResult = {
        created,
        updated,
        failed,
        skipped,
        processed,
        totalReceived: rawSkus.length,
        duration: Date.now() - startTime,
        reconciliation
      };

      await prisma.skuSyncLog.update({
        where: { id: syncLog.id },
        data: {
          completedAt: new Date(),
          totalReceived: rawSkus.length,
          processedCount: processed,
          createdCount: created,
          updatedCount: updated,
          skippedCount: skipped,
          failedCount: failed,
          metadata: safeJson(metadata),
          executionTrace: safeJson(executionTrace),
          logs: failed > 0 ? { errors: executionTrace.filter(t => t.status === 'FAILED') } : undefined
        }
      });

      return finalResult;

    } catch (error: any) {
      console.error('Inner Sync Error:', error);
      await prisma.skuSyncLog.update({
        where: { id: syncLog.id },
        data: {
          completedAt: new Date(),
          metadata: safeJson({ ...metadata, fatalError: error.message }),
          logs: { error: error.message || 'Unknown error' }
        }
      }).catch(console.error);
      throw error;
    }

  } catch (error: any) {
    console.error('Outer Sync Engine Error:', error);
    throw error;
  } finally {
    // Release Lock
    await prisma.syncLock.update({
      where: { name: 'SKU_SYNC' },
      data: { isLocked: false, lockedAt: null, lockedBy: null }
    }).catch(console.error);
  }
}
