import { prisma } from './db';
import { PrismaClient, Prisma } from '@prisma/client';
import { getZohoTokens, getZohoOrgId } from './zoho-auth';
import { recordPostDispatchHistory } from './post-dispatch-history';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

export interface SyncResult {
  success: boolean;
  invoicesDiscovered: number;
  invoicesImported: number;
  invoicesUpdated: number;
  invoicesSkipped: number;
  apiCallsTotal: number;
  apiCallsInvoiceList: number;
  apiCallsInvoiceDetail: number;
  apiCallsEInvoice: number;
  hasMoreWarning?: boolean;
  errorMessage?: string;
  skippedReason?: string;
}

export interface EInvoiceCheckResult {
  success: boolean;
  eligibleCount: number;
  processedCount: number;
  remainingCount: number;
  failedCount: number;
  apiCallsUsed: number;
  errorMessage?: string;
  skippedReason?: string;
}

/**
 * Calculates start and end of TODAY in Indian Standard Time (IST, UTC+5:30).
 */
export function getIstTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);

  const istYear = istNow.getUTCFullYear();
  const istMonth = istNow.getUTCMonth();
  const istDate = istNow.getUTCDate();

  const startUtcMs = Date.UTC(istYear, istMonth, istDate, 0, 0, 0, 0) - istOffsetMs;
  const endUtcMs = Date.UTC(istYear, istMonth, istDate, 23, 59, 59, 999) - istOffsetMs;

  return {
    start: new Date(startUtcMs),
    end: new Date(endUtcMs),
  };
}

/**
 * Checks if current time is within 09:00 AM IST to 08:00 PM IST working window.
 */
export function isWithinIstWorkingHours(date: Date = new Date()): boolean {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(date.getTime() + istOffsetMs);
  const hours = istNow.getUTCHours();
  const minutes = istNow.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;

  // 09:00 AM IST is 9 * 60 = 540 min.
  // 08:00 PM IST is 20 * 60 = 1200 min.
  return totalMinutes >= 540 && totalMinutes <= 1200;
}

/**
 * Checks if current time is within 07:00 PM IST daily check window (19:00 - 19:14 IST).
 */
export function isIst7PmWindow(date: Date = new Date()): boolean {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(date.getTime() + istOffsetMs);
  const hours = istNow.getUTCHours();
  const minutes = istNow.getUTCMinutes();
  return hours === 19 && minutes >= 0 && minutes < 15;
}

/**
 * Calculates the next scheduled 15-minute sync time within IST working hours.
 */
export function getNextScheduledSyncTime(): Date {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  let istCandidate = new Date(now.getTime() + istOffsetMs);

  // Round up to next 15-minute interval
  const remainder = 15 - (istCandidate.getUTCMinutes() % 15);
  istCandidate = new Date(istCandidate.getTime() + remainder * 60 * 1000);
  istCandidate.setUTCSeconds(0, 0);

  const hours = istCandidate.getUTCHours();
  const minutes = istCandidate.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;

  if (totalMinutes < 540) {
    // Before 9:00 AM -> schedule for 09:00 AM today
    istCandidate.setUTCHours(9, 0, 0, 0);
  } else if (totalMinutes > 1200) {
    // After 8:00 PM -> schedule for 09:00 AM tomorrow
    istCandidate.setUTCDate(istCandidate.getUTCDate() + 1);
    istCandidate.setUTCHours(9, 0, 0, 0);
  }

  // Convert IST back to UTC
  return new Date(istCandidate.getTime() - istOffsetMs);
}

/**
 * Calculates the next scheduled 7:00 PM IST daily E-Invoice check time.
 */
export function getNextScheduledEInvoiceTime(): Date {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);

  const candidate = new Date(istNow);
  candidate.setUTCHours(19, 0, 0, 0);

  if (istNow.getTime() >= candidate.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }

  return new Date(candidate.getTime() - istOffsetMs);
}

/**
 * Logs a Zoho API call to the centralized ZohoApiLog table.
 * Standard modules:
 * - 'post_dispatch_list'
 * - 'post_dispatch_detail'
 * - 'post_dispatch_einvoice'
 * - 'post_dispatch_other'
 */
export async function logZohoApiCall(params: {
  endpoint: string;
  module: 'post_dispatch_list' | 'post_dispatch_detail' | 'post_dispatch_einvoice' | 'post_dispatch_other' | string;
  userId?: string | null;
}) {
  try {
    await prisma.zohoApiLog.create({
      data: {
        endpoint: params.endpoint,
        module: params.module,
        userId: params.userId || null,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error('[ZohoApiLog] Failed to log API call:', error);
  }
}

/**
 * Retrieves today's Zoho API usage stats based on IST day boundaries.
 * Accurately reports:
 * - Total Calls
 * - Invoice List Sync
 * - Invoice Detail Fetch
 * - E-Invoice
 * - Other
 */
export async function getTodayPostDispatchApiUsage() {
  const { start, end } = getIstTodayRange();

  const [
    totalCalls,
    listCalls,
    detailCalls,
    legacyInvoiceCalls,
    einvoiceCalls,
    lastSyncLog,
    lastEInvoiceHistory,
  ] = await Promise.all([
    prisma.zohoApiLog.count({
      where: {
        module: { startsWith: 'post_dispatch' },
        timestamp: { gte: start, lte: end },
      },
    }),
    prisma.zohoApiLog.count({
      where: {
        module: 'post_dispatch_list',
        timestamp: { gte: start, lte: end },
      },
    }),
    prisma.zohoApiLog.count({
      where: {
        module: 'post_dispatch_detail',
        timestamp: { gte: start, lte: end },
      },
    }),
    prisma.zohoApiLog.count({
      where: {
        module: 'post_dispatch_invoices', // legacy categorization
        timestamp: { gte: start, lte: end },
      },
    }),
    prisma.zohoApiLog.count({
      where: {
        module: 'post_dispatch_einvoice',
        timestamp: { gte: start, lte: end },
      },
    }),
    prisma.postDispatchSyncLog.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
    }),
    prisma.postDispatchHistory.findFirst({
      where: { eventType: 'EINVOICE_CHECK_COMPLETED' },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const effectiveListCalls = listCalls + legacyInvoiceCalls;
  const effectiveDetailCalls = detailCalls;
  const otherCalls = Math.max(0, totalCalls - effectiveListCalls - effectiveDetailCalls - einvoiceCalls);

  return {
    todayTotal: totalCalls,
    todayInvoiceList: effectiveListCalls,
    todayInvoiceDetail: effectiveDetailCalls,
    todayInvoices: effectiveListCalls + effectiveDetailCalls, // backwards compatibility
    todayEInvoice: einvoiceCalls,
    todayOther: otherCalls,
    lastSuccessfulSync: lastSyncLog?.completedAt || null,
    nextScheduledSync: getNextScheduledSyncTime(),
    lastEInvoiceCheck: lastEInvoiceHistory?.createdAt || null,
    nextScheduledEInvoiceCheck: getNextScheduledEInvoiceTime(),
  };
}

/**
 * Acquires a non-overlapping lock using the SyncLock table.
 */
async function acquireSyncLock(lockName: string, maxLockMinutes: number = 5): Promise<boolean> {
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
        },
      });
      return true;
    }

    return false;
  } catch (err) {
    console.error('[PostDispatchSync] Error acquiring sync lock:', err);
    return false;
  }
}

/**
 * Releases the sync lock.
 */
async function releaseSyncLock(lockName: string) {
  try {
    await prisma.syncLock.update({
      where: { name: lockName },
      data: {
        isLocked: false,
      },
    });
  } catch (err) {
    console.error('[PostDispatchSync] Error releasing sync lock:', err);
  }
}

export interface ZohoLineItem {
  line_item_id?: string;
  item_id?: string;
  name?: string;
  item_name?: string;
  description?: string;
  quantity?: number;
  rate?: number;
  item_total?: number;
  amount?: number;
  hsn_or_sac?: string;
  tax_percentage?: number;
}

export interface ZohoInvoiceListItem {
  invoice_id: string;
  invoice_number?: string;
  customer_id?: string;
  customer_name?: string;
  status?: string;
  date?: string;
  total?: number;
  currency_code?: string;
  created_time?: string;
  last_modified_time?: string;
  salesorder_id?: string;
  salesorder_number?: string;
  gst_treatment?: string;
  e_invoice_details?: {
    status?: string;
    irn?: string;
    ack_no?: string;
    ack_number?: string;
    ack_date?: string;
  };
  einvoice_details?: {
    status?: string;
    irn?: string;
    ack_no?: string;
    ack_number?: string;
    ack_date?: string;
  };
  irn?: string;
  ack_no?: string;
  ack_date?: string;
  [key: string]: unknown;
}

/**
 * Checks whether a customer / invoice is of "consumer" type (B2C) and thus ineligible for E-Invoicing.
 * Authoritative Zoho treatment identifier:
 * - gst_treatment === 'consumer'
 */
export function isConsumerCustomer(params: {
  gstTreatment?: string | null;
  gstNumber?: string | null;
}): boolean {
  const treatment = (params.gstTreatment || '').toLowerCase().trim();
  if (treatment === 'consumer' || treatment.includes('consumer')) {
    return true;
  }
  return false;
}

/**
 * LIGHTWEIGHT INVOICE SYNC (15-Minute Scheduled Execution)
 *
 * Principles:
 * 1. Exactly ONE list request (per_page = 200).
 * 2. 30-Day lookback maximum safety boundary.
 * 3. NO per-invoice detail calls during sync.
 * 4. Safe cursor: Tracks last_modified_time.
 * 5. Exact Zoho status preserved; Draft imported as non-actionable; Void archived.
 */
export async function runPostDispatchSync(options: {
  trigger?: 'CRON' | 'MANUAL';
  userId?: string | null;
  forceFullSync?: boolean;
}): Promise<SyncResult> {
  const trigger = options.trigger || 'MANUAL';
  const LOCK_KEY = 'post_dispatch_invoice_sync';

  // 1. Lock check
  const lockAcquired = await acquireSyncLock(LOCK_KEY);
  if (!lockAcquired) {
    return {
      success: false,
      invoicesDiscovered: 0,
      invoicesImported: 0,
      invoicesUpdated: 0,
      invoicesSkipped: 0,
      apiCallsTotal: 0,
      apiCallsInvoiceList: 0,
      apiCallsInvoiceDetail: 0,
      apiCallsEInvoice: 0,
      skippedReason: 'A synchronization job is already running.',
    };
  }

  const syncLog = await prisma.postDispatchSyncLog.create({
    data: {
      trigger,
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });

  let apiCallsTotal = 0;
  let apiCallsInvoiceList = 0;
  const apiCallsInvoiceDetail = 0;
  const apiCallsEInvoice = 0;
  let invoicesDiscovered = 0;
  let invoicesImported = 0;
  let invoicesUpdated = 0;
  let invoicesSkipped = 0;
  let hasMoreWarning = false;

  try {
    const orgId = getZohoOrgId();
    if (!orgId) throw new Error('Missing ZOHO_ORGANIZATION_ID or ZOHO_BOOKS_ORG_ID');

    const accessToken = await getZohoTokens();
    if (!accessToken) throw new Error('Failed to obtain Zoho access token. Please re-authenticate.');

    // 2. 30-day lookback calculation in Zoho Books timestamp format (YYYY-MM-DDTHH:mm:ss+0530)
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const formatZohoTimestamp = (d: Date) => {
      const istOffsetMs = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(d.getTime() + istOffsetMs);
      const pad = (n: number) => String(n).padStart(2, '0');
      const y = istDate.getUTCFullYear();
      const m = pad(istDate.getUTCMonth() + 1);
      const day = pad(istDate.getUTCDate());
      const hh = pad(istDate.getUTCHours());
      const mm = pad(istDate.getUTCMinutes());
      const ss = pad(istDate.getUTCSeconds());
      return `${y}-${m}-${day}T${hh}:${mm}:${ss}+0530`;
    };

    const thirtyDaysAgoFormatted = formatZohoTimestamp(new Date(Date.now() - THIRTY_DAYS_MS));

    let lastModifiedCursor: string | null = null;
    if (!options.forceFullSync) {
      const cursorConfig = await prisma.integrationConfig.findUnique({
        where: { key: 'post_dispatch_sync_cursor' },
      });
      if (cursorConfig?.value) {
        if (new Date(cursorConfig.value).getTime() < Date.now() - THIRTY_DAYS_MS) {
          lastModifiedCursor = thirtyDaysAgoFormatted;
        } else {
          lastModifiedCursor = cursorConfig.value;
        }
      } else {
        lastModifiedCursor = thirtyDaysAgoFormatted;
      }
    } else {
      lastModifiedCursor = thirtyDaysAgoFormatted;
    }

    // 3. ONE lightweight Zoho invoice-list request (Fixed per_page = 200)
    let url = `${API_BASE_URL}/books/v3/invoices?organization_id=${orgId}&page=1&per_page=200&sort_column=last_modified_time&sort_order=A`;
    if (lastModifiedCursor) {
      url += `&last_modified_time=${encodeURIComponent(lastModifiedCursor)}`;
    }

    apiCallsTotal++;
    apiCallsInvoiceList++;
    await logZohoApiCall({
      endpoint: '/books/v3/invoices',
      module: 'post_dispatch_list',
      userId: options.userId,
    });

    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `Zoho API returned status ${res.status}`);
    }

    const data = await res.json();
    const discoveredInvoices: ZohoInvoiceListItem[] = data.invoices || [];
    invoicesDiscovered = discoveredInvoices.length;

    const pageContext = data.page_context;
    if (pageContext && pageContext.has_more_page) {
      hasMoreWarning = true;
      console.warn(
        `[PostDispatchSync] 200-record ceiling reached. More changes exist in Zoho. Safe cursor ensures subsequent runs continue without skip.`
      );
    }

    // 4. Upsert discovered invoices into local database WITHOUT per-invoice detail calls
    let maxModifiedTimeInBatch: string | null = null;

    for (const zohoInv of discoveredInvoices) {
      const zohoInvoiceId = String(zohoInv.invoice_id);
      const zohoStatus = String(zohoInv.status || '').toLowerCase();
      const isVoid = zohoStatus === 'void';

      if (zohoInv.last_modified_time) {
        if (!maxModifiedTimeInBatch || zohoInv.last_modified_time > maxModifiedTimeInBatch) {
          maxModifiedTimeInBatch = zohoInv.last_modified_time;
        }
      }

      const existing = await prisma.postDispatchInvoice.findUnique({
        where: { zohoInvoiceId },
      });

      // Extract E-Invoice data available directly on list response
      const einvoiceObj = zohoInv.e_invoice_details || zohoInv.einvoice_details || null;
      const eInvoiceGenerated = Boolean(
        zohoInv.irn || (einvoiceObj && (einvoiceObj.status === 'GENERATED' || einvoiceObj.irn))
      );
      const eInvoiceIrn = zohoInv.irn || einvoiceObj?.irn || null;
      const eInvoiceAckNo = zohoInv.ack_no || einvoiceObj?.ack_no || einvoiceObj?.ack_number || null;
      const eInvoiceAckDate = zohoInv.ack_date || einvoiceObj?.ack_date || null;
      const eInvoiceStatus = einvoiceObj?.status || (eInvoiceGenerated ? 'GENERATED' : 'NOT_GENERATED');

      if (!existing) {
        // --- NEW INVOICE IMPORT ---
        const zohoCreatedTime = zohoInv.created_time ? new Date(zohoInv.created_time) : new Date();
        const erpStatus = isVoid ? 'Archived' : 'Active';
        const erpSubStatus = isVoid ? 'Void' : null;
        const timerStoppedAt = isVoid ? new Date() : null;

        try {
          await prisma.$transaction(async (tx) => {
            const newInvoice = await tx.postDispatchInvoice.create({
              data: {
                zohoInvoiceId,
                invoiceNumber: zohoInv.invoice_number || 'UNKNOWN',
                customerId: zohoInv.customer_id ? String(zohoInv.customer_id) : null,
                customerName: zohoInv.customer_name || 'Unknown Customer',
                zohoStatus: zohoInv.status || 'draft',
                erpStatus,
                erpSubStatus,
                zohoCreatedTime,
                timerStoppedAt,
                total: Number(zohoInv.total || 0),
                currencyCode: zohoInv.currency_code || 'INR',
                salesOrderId: zohoInv.salesorder_id ? String(zohoInv.salesorder_id) : null,
                salesOrderNumber: zohoInv.salesorder_number || null,
                eInvoiceGenerated,
                eInvoiceIrn,
                eInvoiceAckNo,
                eInvoiceAckDate,
                eInvoiceStatus,
                lastZohoSync: new Date(),
                zohoDetailsJson: zohoInv as unknown as Prisma.InputJsonObject,
              },
            });

            // Create the 3 Post Dispatch workflows:
            await tx.postDispatchWorkflow.createMany({
              data: [
                { invoiceId: newInvoice.id, workflowType: 'RECEIVING', status: 'PENDING' },
                { invoiceId: newInvoice.id, workflowType: 'CHECKED', status: 'PENDING' },
                { invoiceId: newInvoice.id, workflowType: 'INVENTORY_DEDUCTION', status: 'PENDING' },
              ],
            });

            // Log history
            await recordPostDispatchHistory(tx, {
              invoiceId: newInvoice.id,
              eventType: 'INVOICE_IMPORTED',
              userName: 'System Sync',
              metadata: {
                zohoStatus: newInvoice.zohoStatus,
                invoiceNumber: newInvoice.invoiceNumber,
                total: newInvoice.total,
              },
            });

            if (isVoid) {
              await recordPostDispatchHistory(tx, {
                invoiceId: newInvoice.id,
                eventType: 'INVOICE_VOID',
                userName: 'System Sync',
                metadata: { reason: 'Imported with Zoho status Void' },
              });
            }
          });

          invoicesImported++;
        } catch (createErr: any) {
          if (createErr.code === 'P2002') {
            invoicesSkipped++;
          } else {
            throw createErr;
          }
        }
      } else {
        // --- EXISTING INVOICE UPDATE ---
        const wasVoid = existing.erpSubStatus === 'Void' || existing.zohoStatus.toLowerCase() === 'void';
        const hasStatusChanged = existing.zohoStatus.toLowerCase() !== zohoStatus;
        const hasTotalChanged = Number(existing.total) !== Number(zohoInv.total || 0);

        let newErpStatus = existing.erpStatus;
        let newErpSubStatus = existing.erpSubStatus;
        let newTimerStoppedAt = existing.timerStoppedAt;

        if (isVoid && !wasVoid) {
          newErpStatus = 'Archived';
          newErpSubStatus = 'Void';
          newTimerStoppedAt = new Date();
        }

        const updatedEInvoiceFields: Record<string, unknown> = {};
        if (!existing.eInvoiceGenerated && eInvoiceGenerated) {
          updatedEInvoiceFields.eInvoiceGenerated = true;
          updatedEInvoiceFields.eInvoiceIrn = eInvoiceIrn;
          updatedEInvoiceFields.eInvoiceAckNo = eInvoiceAckNo;
          updatedEInvoiceFields.eInvoiceAckDate = eInvoiceAckDate;
          updatedEInvoiceFields.eInvoiceStatus = eInvoiceStatus;
        }

        if (hasStatusChanged || hasTotalChanged || (isVoid && !wasVoid) || Object.keys(updatedEInvoiceFields).length > 0) {
          await prisma.$transaction(async (tx) => {
            await tx.postDispatchInvoice.update({
              where: { id: existing.id },
              data: {
                zohoStatus: zohoInv.status || existing.zohoStatus,
                total: Number(zohoInv.total || existing.total),
                erpStatus: newErpStatus,
                erpSubStatus: newErpSubStatus,
                timerStoppedAt: newTimerStoppedAt,
                lastZohoSync: new Date(),
                ...updatedEInvoiceFields,
              },
            });

            if (hasStatusChanged) {
              await recordPostDispatchHistory(tx, {
                invoiceId: existing.id,
                eventType: 'INVOICE_STATUS_UPDATED',
                userName: 'System Sync',
                metadata: { from: existing.zohoStatus, to: zohoInv.status },
              });
            }

            if (isVoid && !wasVoid) {
              await recordPostDispatchHistory(tx, {
                invoiceId: existing.id,
                eventType: 'INVOICE_VOID',
                userName: 'System Sync',
                metadata: { reason: 'Zoho invoice marked Void' },
              });
            }

            if (updatedEInvoiceFields.eInvoiceGenerated) {
              await recordPostDispatchHistory(tx, {
                invoiceId: existing.id,
                eventType: 'EINVOICE_STATUS_UPDATED',
                userName: 'System Sync',
                metadata: updatedEInvoiceFields as Prisma.InputJsonObject,
              });
            }
          });

          invoicesUpdated++;
        } else {
          invoicesSkipped++;
        }
      }
    }

    // 5. Update Cursor Safely
    if (maxModifiedTimeInBatch) {
      await prisma.integrationConfig.upsert({
        where: { key: 'post_dispatch_sync_cursor' },
        update: { value: maxModifiedTimeInBatch },
        create: { key: 'post_dispatch_sync_cursor', value: maxModifiedTimeInBatch },
      });
    }

    // 6. Complete Sync Log
    await prisma.postDispatchSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        invoicesDiscovered,
        invoicesImported,
        invoicesUpdated,
        invoicesSkipped,
        apiCallsTotal,
        apiCallsInvoice: apiCallsInvoiceList,
        apiCallsEInvoice: 0,
      },
    });

    return {
      success: true,
      invoicesDiscovered,
      invoicesImported,
      invoicesUpdated,
      invoicesSkipped,
      apiCallsTotal,
      apiCallsInvoiceList,
      apiCallsInvoiceDetail,
      apiCallsEInvoice,
      hasMoreWarning,
    };
  } catch (error: any) {
    console.error('[PostDispatchSync] Sync failed:', error);
    await prisma.postDispatchSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: error.message || 'Unknown error occurred',
        apiCallsTotal,
        apiCallsInvoice: apiCallsInvoiceList,
        apiCallsEInvoice: 0,
      },
    });

    return {
      success: false,
      invoicesDiscovered,
      invoicesImported,
      invoicesUpdated,
      invoicesSkipped,
      apiCallsTotal,
      apiCallsInvoiceList,
      apiCallsInvoiceDetail,
      apiCallsEInvoice,
      errorMessage: error.message || 'Unknown sync error',
    };
  } finally {
    await releaseSyncLock(LOCK_KEY);
  }
}

/**
 * ON-DEMAND INVOICE DETAIL FETCH (Lazy-Loaded upon "Review Inventory")
 *
 * Rules:
 * 1. If forceRefresh is FALSE and invoice line items already exist in local DB:
 *    -> Return cached DB data immediately with 0 API calls.
 * 2. If cached data does not exist, OR forceRefresh is TRUE:
 *    -> Call GET /books/v3/invoices/{zoho_invoice_id} exactly ONCE.
 *    -> Log API call as 'post_dispatch_detail'.
 *    -> Cache line items & full payload in local DB.
 *    -> Return fresh detail.
 */
export async function getOrFetchInvoiceDetail(params: {
  invoiceId: string;
  forceRefresh?: boolean;
  userId?: string | null;
  userName?: string | null;
}): Promise<{
  success: boolean;
  source: 'CACHE' | 'ZOHO_API';
  lines: any[];
  invoice: any;
  error?: string;
}> {
  const invoice = await prisma.postDispatchInvoice.findUnique({
    where: { id: params.invoiceId },
    include: {
      lines: true,
      workflows: {
        include: {
          submissions: {
            include: { files: true },
            orderBy: { submissionNumber: 'desc' },
          },
        },
      },
      history: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!invoice) {
    return { success: false, source: 'CACHE', lines: [], invoice: null, error: 'Invoice not found' };
  }

  // Check if detail is already cached locally and no force refresh requested
  const hasCachedLines = invoice.lines.length > 0;
  if (hasCachedLines && !params.forceRefresh) {
    return {
      success: true,
      source: 'CACHE',
      lines: invoice.lines,
      invoice,
    };
  }

  // Fetch full detail from Zoho Books
  try {
    const orgId = getZohoOrgId();
    if (!orgId) throw new Error('Missing Zoho organization ID');

    const accessToken = await getZohoTokens();
    if (!accessToken) throw new Error('Missing Zoho access token');

    await logZohoApiCall({
      endpoint: `/books/v3/invoices/${invoice.zohoInvoiceId}`,
      module: 'post_dispatch_detail',
      userId: params.userId,
    });

    const res = await fetch(
      `${API_BASE_URL}/books/v3/invoices/${invoice.zohoInvoiceId}?organization_id=${orgId}`,
      {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      }
    );

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `Zoho API returned status ${res.status}`);
    }

    const json = await res.json();
    const zohoDetail = json.invoice;
    if (!zohoDetail) throw new Error('Invalid response structure from Zoho');

    const rawLines = (zohoDetail.line_items || []) as ZohoLineItem[];

    // Replace / cache lines in database
    await prisma.$transaction(async (tx) => {
      await tx.postDispatchInvoiceLine.deleteMany({
        where: { invoiceId: invoice.id },
      });

      if (rawLines.length > 0) {
        await tx.postDispatchInvoiceLine.createMany({
          data: rawLines.map((li) => ({
            invoiceId: invoice.id,
            zohoLineItemId: li.line_item_id ? String(li.line_item_id) : null,
            itemId: li.item_id ? String(li.item_id) : null,
            itemName: li.name || li.item_name || 'Item',
            description: li.description || null,
            quantity: Number(li.quantity || 0),
            rate: Number(li.rate || 0),
            amount: Number(li.item_total || li.amount || 0),
            hsnCode: li.hsn_or_sac ? String(li.hsn_or_sac) : null,
            taxPercent: Number(li.tax_percentage || 0),
          })),
        });
      }

      await tx.postDispatchInvoice.update({
        where: { id: invoice.id },
        data: {
          zohoDetailsJson: zohoDetail as unknown as Prisma.InputJsonObject,
          lastZohoSync: new Date(),
        },
      });

      if (params.forceRefresh) {
        await recordPostDispatchHistory(tx, {
          invoiceId: invoice.id,
          eventType: 'INVOICE_DETAIL_FORCE_REFRESHED',
          userId: params.userId || undefined,
          userName: params.userName || 'Staff',
          metadata: { lineItemsCount: rawLines.length },
        });
      }
    });

    const updatedInvoice = await prisma.postDispatchInvoice.findUnique({
      where: { id: invoice.id },
      include: {
        lines: true,
        workflows: {
          include: {
            submissions: {
              include: { files: true },
              orderBy: { submissionNumber: 'desc' },
            },
          },
        },
        history: { orderBy: { createdAt: 'desc' } },
      },
    });

    return {
      success: true,
      source: 'ZOHO_API',
      lines: updatedInvoice?.lines || [],
      invoice: updatedInvoice,
    };
  } catch (err: any) {
    console.error(`[PostDispatchSync] Failed to fetch invoice detail for ${invoice.zohoInvoiceId}:`, err);
    return {
      success: false,
      source: 'ZOHO_API',
      lines: invoice.lines,
      invoice,
      error: err.message || 'Failed to fetch detail from Zoho Books',
    };
  }
}

/**
 * TARGETED E-INVOICE STATUS CHECK (Manual & 7 PM Scheduled Reconciliation)
 *
 * Strict Rules:
 * 1. Restrict to last 30 days.
 * 2. EXCLUDE consumer-type customers (B2C ineligible for E-Invoice).
 * 3. Include only unresolved invoices (eInvoiceGenerated === false, zohoStatus != 'void', erpStatus === 'Active').
 * 4. HARD LIMIT: Capped at MAXIMUM 100 Zoho API calls per run.
 * 5. Rate-limited execution with error tolerance.
 */
export async function runEInvoiceStatusCheck(options: {
  trigger?: 'MANUAL' | 'CRON_7PM';
  userId?: string | null;
  userName?: string | null;
  maxCalls?: number;
}): Promise<EInvoiceCheckResult> {
  const maxCalls = Math.min(options.maxCalls || 100, 100); // HARD CAP: 100
  const LOCK_KEY = 'post_dispatch_einvoice_check';

  const lockAcquired = await acquireSyncLock(LOCK_KEY);
  if (!lockAcquired) {
    return {
      success: false,
      eligibleCount: 0,
      processedCount: 0,
      remainingCount: 0,
      failedCount: 0,
      apiCallsUsed: 0,
      skippedReason: 'An E-Invoice check job is already running.',
    };
  }

  try {
    const orgId = getZohoOrgId();
    if (!orgId) throw new Error('Missing Zoho organization ID');

    const accessToken = await getZohoTokens();
    if (!accessToken) throw new Error('Missing Zoho access token');

    // 1. Find candidate invoices within last 30 days
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);

    const candidates = await prisma.postDispatchInvoice.findMany({
      where: {
        zohoCreatedTime: { gte: thirtyDaysAgo },
        eInvoiceGenerated: false,
        erpStatus: 'Active',
        zohoStatus: { notIn: ['void', 'draft'] },
      },
      orderBy: { zohoCreatedTime: 'desc' },
    });

    // 2. Filter out consumer-type customers
    const eligibleInvoices: typeof candidates = [];
    for (const cand of candidates) {
      let isConsumer = false;
      const detailsJson = cand.zohoDetailsJson as any;
      if (detailsJson?.gst_treatment) {
        isConsumer = isConsumerCustomer({ gstTreatment: detailsJson.gst_treatment });
      }

      if (!isConsumer) {
        eligibleInvoices.push(cand);
      }
    }

    const eligibleCount = eligibleInvoices.length;
    const toProcess = eligibleInvoices.slice(0, maxCalls);
    const remainingCount = Math.max(0, eligibleCount - toProcess.length);

    let processedCount = 0;
    let failedCount = 0;
    let apiCallsUsed = 0;

    for (const inv of toProcess) {
      try {
        apiCallsUsed++;
        await logZohoApiCall({
          endpoint: `/books/v3/invoices/${inv.zohoInvoiceId}`,
          module: 'post_dispatch_einvoice',
          userId: options.userId,
        });

        const res = await fetch(
          `${API_BASE_URL}/books/v3/invoices/${inv.zohoInvoiceId}?organization_id=${orgId}`,
          {
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
          }
        );

        if (!res.ok) {
          failedCount++;
          continue;
        }

        const data = await res.json();
        const zohoInv = data.invoice;
        if (!zohoInv) {
          failedCount++;
          continue;
        }

        const einvoiceObj = zohoInv.e_invoice_details || zohoInv.einvoice_details || null;
        const eInvoiceGenerated = Boolean(
          zohoInv.irn || (einvoiceObj && (einvoiceObj.status === 'GENERATED' || einvoiceObj.irn))
        );

        if (eInvoiceGenerated) {
          const eInvoiceIrn = zohoInv.irn || einvoiceObj?.irn || null;
          const eInvoiceAckNo = zohoInv.ack_no || einvoiceObj?.ack_no || einvoiceObj?.ack_number || null;
          const eInvoiceAckDate = zohoInv.ack_date || einvoiceObj?.ack_date || null;
          const eInvoiceStatus = einvoiceObj?.status || 'GENERATED';

          await prisma.postDispatchInvoice.update({
            where: { id: inv.id },
            data: {
              eInvoiceGenerated: true,
              eInvoiceIrn,
              eInvoiceAckNo,
              eInvoiceAckDate,
              eInvoiceStatus,
              lastZohoSync: new Date(),
            },
          });

          await recordPostDispatchHistory(prisma, {
            invoiceId: inv.id,
            eventType: 'EINVOICE_STATUS_UPDATED',
            userId: options.userId || undefined,
            userName: options.userName || (options.trigger === 'CRON_7PM' ? 'Daily 7PM Check' : 'Staff Check'),
            metadata: {
              irn: eInvoiceIrn,
              ackNo: eInvoiceAckNo,
              ackDate: eInvoiceAckDate,
            },
          });
        }

        processedCount++;
      } catch (invoiceErr) {
        console.warn(`[EInvoiceCheck] Failed checking invoice ${inv.zohoInvoiceId}:`, invoiceErr);
        failedCount++;
      }
    }

    // Record check history
    if (toProcess.length > 0) {
      await recordPostDispatchHistory(prisma, {
        invoiceId: toProcess[0].id,
        eventType: 'EINVOICE_CHECK_COMPLETED',
        userId: options.userId || undefined,
        userName: options.userName || (options.trigger === 'CRON_7PM' ? 'Daily 7PM Check' : 'Manual E-Invoice Check'),
        metadata: {
          trigger: options.trigger || 'MANUAL',
          eligibleCount,
          processedCount,
          remainingCount,
          failedCount,
          apiCallsUsed,
        },
      });
    }

    return {
      success: true,
      eligibleCount,
      processedCount,
      remainingCount,
      failedCount,
      apiCallsUsed,
    };
  } catch (err: any) {
    console.error('[PostDispatchSync] E-Invoice status check failed:', err);
    return {
      success: false,
      eligibleCount: 0,
      processedCount: 0,
      remainingCount: 0,
      failedCount: 0,
      apiCallsUsed: 0,
      errorMessage: err.message || 'Failed to check E-Invoice status',
    };
  } finally {
    await releaseSyncLock(LOCK_KEY);
  }
}

/**
 * Verifies if all 3 workflows are completed and archives the invoice if so.
 */
export async function checkAndArchiveInvoice(
  invoiceId: string,
  tx?: Prisma.TransactionClient | PrismaClient
) {
  const db = (tx || prisma) as PrismaClient;
  const workflows = await db.postDispatchWorkflow.findMany({
    where: { invoiceId },
  });

  const allCompleted =
    workflows.length === 3 &&
    workflows.every((wf) => wf.status === 'COMPLETED');

  if (allCompleted) {
    await db.postDispatchInvoice.update({
      where: { id: invoiceId },
      data: {
        erpStatus: 'Archived',
        erpSubStatus: 'Completed',
        timerStoppedAt: new Date(),
      },
    });

    await recordPostDispatchHistory(db, {
      invoiceId,
      eventType: 'INVOICE_ARCHIVED',
      userName: 'System Workflow',
      metadata: {
        reason: 'All workflows (Receiving, Checked, Inventory) completed',
      },
    });
  }
}
