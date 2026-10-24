import { prisma } from '@/lib/db';
import { fetchInvoicesByRange } from '@/lib/zoho/invoices';
import { ingestZohoInvoicesFromListing } from '@/lib/dcr-ingestion';

export const DCR_SYNC_LOCK_NAME = 'DCR_INVOICE_SYNC';

/**
 * Checks if current time is within Indian Standard Time (IST, UTC+5:30) 09:00 AM to 09:00 PM window.
 * Schedule: Every 30 minutes from 09:00 AM through 09:00 PM IST, inclusive (25 runs per day).
 * 09:00, 09:30, 10:00, 10:30, ... 20:30, 21:00 IST.
 */
export function isWithinDcrSyncHours(date: Date = new Date()): boolean {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(date.getTime() + istOffsetMs);
  const hours = istNow.getUTCHours();
  const minutes = istNow.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;
  // 09:00 IST = 9 * 60 = 540 min
  // 21:00 IST = 21 * 60 = 1260 min
  return totalMinutes >= 540 && totalMinutes <= 1260;
}

/**
 * Formats a Date object to YYYY-MM-DD
 */
export function formatDateToYmd(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Acquires a non-overlapping lock using the existing SyncLock table.
 * Automatically breaks stale locks older than maxLockMinutes.
 */
export async function acquireDcrSyncLock(
  lockName: string = DCR_SYNC_LOCK_NAME,
  maxLockMinutes: number = 10
): Promise<boolean> {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - maxLockMinutes * 60 * 1000);

  try {
    const existing = await prisma.syncLock.findUnique({
      where: { name: lockName },
    });

    if (!existing) {
      await prisma.syncLock.create({
        data: {
          name: lockName,
          isLocked: true,
          lockedAt: now,
          lockedBy: 'DCR_SYNC_SERVICE',
        },
      });
      return true;
    }

    if (!existing.isLocked || (existing.lockedAt && existing.lockedAt < staleThreshold)) {
      await prisma.syncLock.update({
        where: { name: lockName },
        data: {
          isLocked: true,
          lockedAt: now,
          lockedBy: 'DCR_SYNC_SERVICE',
        },
      });
      return true;
    }

    return false;
  } catch (err: any) {
    console.error('[DcrSyncService] Error acquiring sync lock:', err.message);
    return false;
  }
}

/**
 * Releases the sync lock safely.
 */
export async function releaseDcrSyncLock(lockName: string = DCR_SYNC_LOCK_NAME): Promise<void> {
  try {
    await prisma.syncLock.updateMany({
      where: { name: lockName },
      data: {
        isLocked: false,
        lockedAt: null,
        lockedBy: null,
      },
    });
  } catch (err: any) {
    console.error('[DcrSyncService] Error releasing sync lock:', err.message);
  }
}

export interface DcrSyncExecutionOptions {
  startDate?: string;
  endDate?: string;
  trigger?: 'CRON' | 'MANUAL';
  force?: boolean;
  userId?: string;
  maxLimit?: number;
}

export interface DcrSyncExecutionResult {
  status: 'COMPLETED' | 'SKIPPED' | 'LOCKED' | 'FAILED';
  message?: string;
  skipped?: boolean;
  startDate?: string;
  endDate?: string;
  totalFetched?: number;
  created?: number;
  updated?: number;
  skippedVoid?: number;
  failed?: number;
  hasMore?: boolean;
  durationMs?: number;
  error?: string;
}

/**
 * Executes DCR Invoice synchronization using the Zoho Books Listing API.
 * Shares the same batch ingestion pipeline between cron and manual syncs.
 */
export async function executeDcrSync(
  options: DcrSyncExecutionOptions = {}
): Promise<DcrSyncExecutionResult> {
  const startTime = Date.now();
  const trigger = options.trigger || 'MANUAL';
  const userId = options.userId || (trigger === 'CRON' ? 'SYSTEM_CRON' : 'SYSTEM_MANUAL');

  // 1. Working Hours check for CRON trigger
  if (trigger === 'CRON' && !options.force && !isWithinDcrSyncHours()) {
    return {
      status: 'SKIPPED',
      message: 'Outside automatic sync window (09:00 AM - 09:00 PM IST; 25 runs/day).',
      skipped: true,
    };
  }

  // 2. Concurrency lock
  const lockAcquired = await acquireDcrSyncLock();
  if (!lockAcquired) {
    return {
      status: 'LOCKED',
      message: 'Another DCR sync operation is currently active. Skipped to prevent overlap.',
      skipped: true,
    };
  }

  try {
    // 3. Determine Date Range: default to rolling 30 days if not provided
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startDate = options.startDate || formatDateToYmd(thirtyDaysAgo);
    const endDate = options.endDate || formatDateToYmd(today);
    const maxLimit = options.maxLimit ?? 10000;

    console.log(`[DcrSyncService] Starting sync (${trigger}). Date range: ${startDate} to ${endDate}, maxLimit: ${maxLimit}`);

    // 4. Fetch invoices via listing API
    const { invoices, apiCallsUsed, hasMorePagesRemaining } = await fetchInvoicesByRange(
      startDate,
      endDate,
      { maxLimit }
    );

    console.log(`[DcrSyncService] Zoho listing fetched: ${invoices.length} invoices across ${apiCallsUsed} API calls.`);

    // 5. Log Zoho API usage
    if (apiCallsUsed > 0) {
      await prisma.zohoApiLog.createMany({
        data: Array.from({ length: apiCallsUsed }).map(() => ({
          endpoint: 'FETCH_INVOICES',
          module: 'DCR',
          userId,
        })),
      });
    }

    // 6. Ingest listing records directly without individual detail calls
    const { created, updated, skippedVoid, failed } = await ingestZohoInvoicesFromListing(
      invoices,
      userId,
      trigger === 'CRON' ? 'ZOHO_SYNC' : 'MANUAL'
    );

    const durationMs = Date.now() - startTime;

    // 7. Audit log
    await prisma.dcrAuditLog.create({
      data: {
        entityType: 'SYNC_RUN',
        entityId: 'SYSTEM',
        action: trigger === 'CRON' ? 'CRON_SYNC_COMPLETE' : 'SYNC_COMPLETE',
        userId,
        metadata: {
          startDate,
          endDate,
          trigger,
          totalFetched: invoices.length,
          created,
          updated,
          skippedVoid,
          failed,
          hasMorePagesRemaining,
          durationMs,
        },
      },
    });

    console.log(`[DcrSyncService] Sync completed in ${durationMs}ms. Created: ${created}, Updated: ${updated}, SkippedVoid: ${skippedVoid}, Failed: ${failed}`);

    return {
      status: 'COMPLETED',
      startDate,
      endDate,
      totalFetched: invoices.length,
      created,
      updated,
      skippedVoid,
      failed,
      hasMore: hasMorePagesRemaining,
      durationMs,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    console.error('[DcrSyncService] Sync failed:', error);
    return {
      status: 'FAILED',
      error: error.message || 'Sync failed',
      durationMs,
    };
  } finally {
    await releaseDcrSyncLock();
  }
}
