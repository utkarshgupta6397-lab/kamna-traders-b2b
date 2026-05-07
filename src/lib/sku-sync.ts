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

export async function runSkuSync() {
  const zohoUrl = getZohoSyncUrl();
  if (!zohoUrl) {
    throw new Error('Zoho sync environment variables missing');
  }

  // Create Log entry
  const syncLog = await prisma.skuSyncLog.create({
    data: { startedAt: new Date() }
  });

  try {
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
      return { created: 0, updated: 0, failed: 0, totalReceived: 0 };
    }

    // Process all normalization and sync logic in a transaction
    const result = await prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      let failed = 0;
      const errorLogs: any[] = [];

      for (const raw of rawSkus) {
        let currentSkuData: any = null;
        try {
          if (!raw.zoho_book_item_id) {
            try {
              errorLogs.push(safeJson({
                sku: raw.sku_id || 'N/A',
                product: raw.name || 'Unknown',
                reason: 'Zoho Internal ID missing (zoho_book_item_id)',
                api_response: raw,
                payload: null,
                timestamp: new Date().toISOString()
              }));
            } catch (logErr) {
              console.error('Failed to capture structured error log:', logErr);
            }
            failed++;
            continue;
          }
          
          const zohoIdStr = raw.zoho_book_item_id.toString();
          const zohoIdBigInt = BigInt(zohoIdStr);

          // Step 1 — Find/Create Brand
          let brand = null;
          if (raw.brand) {
            brand = await tx.brand.findFirst({
              where: { name: raw.brand }
            });
            if (!brand) {
              brand = await tx.brand.create({
                data: { name: raw.brand }
              });
            }
          }

          // Step 2 — Find/Create Category
          let category = null;
          if (raw.category) {
            category = await tx.category.findFirst({
              where: { name: raw.category }
            });
            if (!category) {
              category = await tx.category.create({
                data: { name: raw.category }
              });
            }
          }

          const price = typeof raw.price === 'number' ? raw.price : parseFloat(raw.price) || 0;
          const caseSize = typeof raw.case_size === 'number' ? raw.case_size : parseInt(raw.case_size, 10) || 1;
          const status = raw.status || 'Inactive';

          // Prepare Base Data
          const baseData = {
            name: raw.name || '',
            price,
            unit: raw.uom || '',
            caseSize: caseSize > 0 ? caseSize : 1,
            isActive: status === 'Active',
            zohoBooksId2: raw.zoho_books_id ? raw.zoho_books_id.toString() : null,
            lastSyncedAt: new Date(),
            brand: brand ? { connect: { id: brand.id } } : undefined,
            category: category ? { connect: { id: category.id } } : undefined,
          };

          // Find Existing SKU by zohoBookItemId FIRST (Identity Priority 1)
          const existingSku = await tx.sku.findFirst({
            where: { zohoBookItemId: zohoIdBigInt }
          });

          if (existingSku) {
            // Update Existing SKU
            currentSkuData = {
              id: raw.sku_id?.trim() || existingSku.id,
              ...baseData
            };
            await tx.sku.update({
              where: { id: existingSku.id },
              data: currentSkuData
            });
            updated++;
          } else {
            // Create New SKU
            currentSkuData = {
              id: raw.sku_id?.trim() || `SKU-${zohoIdStr}`,
              zohoBookItemId: zohoIdBigInt,
              ...baseData
            };
            await tx.sku.create({
              data: currentSkuData
            });
            created++;
          }
        } catch (e: any) {
          console.error(`Failed to sync SKU ${raw.sku_id || raw.zoho_book_item_id}`, e);
          
          let reason = e.message || 'Unknown processing error';
          if (reason.includes('Unique constraint failed on the fields: (`id`)')) {
            reason = 'Duplicate SKU ID conflict in local database';
          } else if (reason.includes('Foreign key constraint failed')) {
            reason = 'Category or Brand resolution failed';
          } else if (reason.includes('Unknown argument `brandId`')) {
            reason = 'Invalid SKU relation mapping';
          }

          try {
            errorLogs.push(safeJson({
              sku: raw.sku_id || 'N/A',
              product: raw.name || 'Unknown',
              reason: reason,
              api_response: raw,
              payload: currentSkuData,
              timestamp: new Date().toISOString()
            }));
          } catch (logErr) {
            console.error('Failed to capture structured error log:', logErr);
          }
          failed++;
        }
      }

      return { created, updated, failed, errorLogs };
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
        logs: result.errorLogs.length > 0 ? { errors: result.errorLogs } : undefined,
      }
    });

    return { ...result, totalReceived: rawSkus.length };

  } catch (error: any) {
    console.error('Sync Engine Error:', error);
    
    try {
      await prisma.skuSyncLog.update({
        where: { id: syncLog.id },
        data: {
          completedAt: new Date(),
          logs: { error: error.message || 'Unknown error' }
        }
      });
    } catch (logErr) {
      console.error('Failed to log error:', logErr);
    }
    throw error;
  }
}
