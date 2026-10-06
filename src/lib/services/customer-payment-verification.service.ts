import { prisma } from '@/lib/db';
import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';
import {
  CustomerPaymentVerificationStatus,
  CustomerPaymentVerificationMethod,
  CustomerPaymentBankMatchStatus,
  ZohoApiEndpointType,
  Prisma,
} from '@prisma/client';
import {
  CustomerPaymentSyncEventCallback,
  SyncFinalSummary,
} from '@/lib/types/customer-payment-sync-events';
import {
  recordOperationStart,
  recordOperationComplete,
  PaymentOperationTrigger,
} from '@/lib/services/customer-payment-operation-tracker.service';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';
export const ZOHO_IS_VERIFIED_CF_ID = '1759923000005543022';

export const DEFAULT_SYNC_START_DATE = '2026-03-01';

export interface CustomerPaymentSyncOptions {
  startDate?: string; // defaults to '2026-03-01'
  endDate?: string;   // defaults to today in IST
  trigger?: 'CRON' | 'MANUAL';
  allowZohoWrites?: boolean;
  syncRunId?: string;
  onEvent?: CustomerPaymentSyncEventCallback;
}

export interface CustomerPaymentSyncDiagnostics {
  syncStartedAt: string;
  syncCompletedAt: string;
  dateStart: string;
  dateEnd: string;
  listApiCalls: number;
  listPaymentsReceived: number;
  bankTransferCount: number;
  nonBankTransferCount: number;
  detailApiCalls: number;
  detailCallsSkippedFromCache: number;
  newBankTransfers: number;
  modifiedBankTransfers: number;
  unchangedBankTransfers: number;
  autoVerificationEligible: number;
  autoVerificationAttempted: number;
  autoVerificationSucceeded: number;
  autoVerificationFailed: number;
}

export interface CustomerPaymentSyncResult {
  success: boolean;
  discovered: number;
  upserted: number;
  autoVerified: number;
  diagnostics: CustomerPaymentSyncDiagnostics;
  errors: string[];
}

export interface ZohoApiUsageToday {
  total: number;
  paymentListCalls: number;
  paymentDetailCalls: number;
  paymentUpdateCalls: number;
}

/**
 * Returns today's date in IST formatted as YYYY-MM-DD
 */
export function getIstTodayDateStr(): string {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);
  const year = istNow.getUTCFullYear();
  const month = String(istNow.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istNow.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the IST day range (00:00:00.000 to next day 00:00:00.000) for Asia/Kolkata
 */
export function getIstTodayRange(): { startIstUtc: Date; endIstUtc: Date } {
  // Current time in IST: UTC + 5:30 (330 min)
  const now = new Date();
  const utcMs = now.getTime();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(utcMs + istOffsetMs);

  const year = istDate.getUTCFullYear();
  const month = istDate.getUTCMonth();
  const day = istDate.getUTCDate();

  // Midnight IST = (UTC time corresponding to IST 00:00)
  const startIstUtc = new Date(Date.UTC(year, month, day, 0, 0, 0) - istOffsetMs);
  const endIstUtc = new Date(Date.UTC(year, month, day + 1, 0, 0, 0) - istOffsetMs);

  return { startIstUtc, endIstUtc };
}

/**
 * Normalizes a Zoho timestamp string or Date into a canonical ISO string.
 * Handles variations like:
 * - '2026-10-05T13:44:01+0530' (missing colon in offset)
 * - '2026-10-05T13:44:01+05:30' (standard ISO offset)
 * - '2026-10-05T08:14:01.000Z' (UTC format)
 * Returns null if input is null/undefined or invalid date.
 */
export function normalizeZohoTimestamp(val: string | Date | null | undefined): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val.toISOString();
  }
  const str = String(val).trim();
  if (!str) return null;

  // If already standard ISO or date string, try parsing directly
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  // Handle format: 2026-10-05T13:44:01+0530 (insert colon into +0530 -> +05:30)
  const offsetRegex = /([+-]\d{2})(\d{2})$/;
  if (offsetRegex.test(str)) {
    const withColon = str.replace(offsetRegex, '$1:$2');
    const parsedWithColon = new Date(withColon);
    if (!isNaN(parsedWithColon.getTime())) {
      return parsedWithColon.toISOString();
    }
  }

  return null;
}

/**
 * Authoritative non-actionable Zoho Books payment statuses.
 * Payments marked with these statuses must never enter Pending Verification,
 * must not contribute to verification counts, and must never be verified.
 */
export const ZOHO_NON_ACTIONABLE_PAYMENT_STATUSES = ['void', 'cancelled', 'canceled'] as const;

/**
 * Extracts and normalizes the authoritative payment status from a raw Zoho payment object or local record.
 */
export function getPaymentStatus(payment: any): string {
  if (!payment) return '';
  const rawStatus =
    payment.payment_status ||
    payment.status ||
    payment.zohoData?.payment_status ||
    payment.zohoData?.status ||
    '';
  return String(rawStatus).toLowerCase().trim();
}

/**
 * Centralized payment eligibility function for Payment Verification.
 * Returns true if a payment is valid and actionable for verification.
 * Returns false if the payment is VOID, cancelled, or otherwise non-actionable in Zoho Books.
 */
export function isPaymentEligibleForVerification(payment: any): boolean {
  if (!payment) return false;
  const status = getPaymentStatus(payment);
  if (!status) return true; // Defaults to eligible if no status property exists
  return !(ZOHO_NON_ACTIONABLE_PAYMENT_STATUSES as readonly string[]).includes(status);
}

/**
 * Persists an outbound Zoho API call to ZohoApiUsageLog for audit & usage tracking.
 */
export async function logZohoApiCall(params: {
  endpointType: ZohoApiEndpointType;
  method: string;
  success: boolean;
  httpStatus?: number;
}): Promise<void> {
  try {
    await prisma.zohoApiUsageLog.create({
      data: {
        service: 'customer_payment_verification',
        endpointType: params.endpointType,
        method: params.method,
        success: params.success,
        httpStatus: params.httpStatus ?? null,
      },
    });
  } catch (err) {
    console.error('[ZohoApiUsageLog] Failed to record API call:', err);
  }
}

/**
 * Aggregates Zoho API calls made today (IST calendar day boundary: 00:00 IST to 24:00 IST).
 */
export async function getZohoApiUsageToday(): Promise<ZohoApiUsageToday> {
  const { startIstUtc, endIstUtc } = getIstTodayRange();

  try {
    const logs = await prisma.zohoApiUsageLog.groupBy({
      by: ['endpointType'],
      where: {
        service: 'customer_payment_verification',
        createdAt: {
          gte: startIstUtc,
          lt: endIstUtc,
        },
      },
      _count: {
        _all: true,
      },
    });

    let paymentListCalls = 0;
    let paymentDetailCalls = 0;
    let paymentUpdateCalls = 0;

    for (const item of logs) {
      if (item.endpointType === ZohoApiEndpointType.PAYMENT_LIST) {
        paymentListCalls = item._count._all;
      } else if (item.endpointType === ZohoApiEndpointType.PAYMENT_DETAIL) {
        paymentDetailCalls = item._count._all;
      } else if (item.endpointType === ZohoApiEndpointType.PAYMENT_UPDATE) {
        paymentUpdateCalls = item._count._all;
      }
    }

    const total = paymentListCalls + paymentDetailCalls + paymentUpdateCalls;
    return {
      total,
      paymentListCalls,
      paymentDetailCalls,
      paymentUpdateCalls,
    };
  } catch (err) {
    console.error('[getZohoApiUsageToday] Error aggregating API calls:', err);
    return {
      total: 0,
      paymentListCalls: 0,
      paymentDetailCalls: 0,
      paymentUpdateCalls: 0,
    };
  }
}

/**
 * Checks if current time is within Indian Standard Time (IST, UTC+5:30) 08:00 AM to 08:00 PM operating window.
 * Schedule: Every 4 hours from 8 AM through 8 PM IST (08:00, 12:00, 16:00, 20:00 IST).
 */
export function isWithinPaymentSyncHours(date: Date = new Date()): boolean {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(date.getTime() + istOffsetMs);
  const hours = istNow.getUTCHours();
  const minutes = istNow.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;
  // 08:00 IST = 480 min, 20:00 IST = 1200 min
  return totalMinutes >= 480 && totalMinutes <= 1200;
}

/**
 * Formats a date into YYYY-MM-DD
 */
function formatDateToYmd(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Fetches unverified customer payments from Zoho Books (rolling 60-day window by default)
 * and synchronizes them to the local CustomerPayment cache.
 * Evaluates bank match and executes auto-verification for eligible Bank Transfer payments.
 */
export async function syncCustomerPayments(
  options: CustomerPaymentSyncOptions = {}
): Promise<CustomerPaymentSyncResult> {
  const syncStartTime = new Date();
  const syncRunId = options.syncRunId || `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const trigger: PaymentOperationTrigger = options.trigger === 'CRON' ? 'AUTOMATIC' : 'MANUAL';

  // Record operation start in database
  await recordOperationStart({
    operationKey: 'sync_zoho_data',
    runId: syncRunId,
    trigger,
  });

  const dispatchEvent = (event: any) => {
    if (options.onEvent) {
      try {
        options.onEvent({
          syncRunId,
          timestamp: new Date().toISOString(),
          ...event,
        });
      } catch (err) {
        console.error('[syncCustomerPayments] onEvent dispatch error:', err);
      }
    }
  };

  const token = await getZohoTokens();
  if (!token) {
    await recordOperationComplete({
      operationKey: 'sync_zoho_data',
      runId: syncRunId,
      trigger,
      success: false,
      recordsProcessed: 0,
      error: 'Zoho access token is missing or expired. Please re-authenticate Zoho Books.',
    });
    dispatchEvent({
      type: 'SYNC_FAILED',
      stage: 'AUTH',
      error: 'Zoho access token is missing or expired. Please re-authenticate Zoho Books.',
    });
    throw new Error('Zoho access token is missing or expired. Please re-authenticate Zoho Books.');
  }

  const orgId = getZohoOrgId();
  if (!orgId) {
    await recordOperationComplete({
      operationKey: 'sync_zoho_data',
      runId: syncRunId,
      trigger,
      success: false,
      recordsProcessed: 0,
      error: 'Zoho Organization ID is missing in environment variables.',
    });
    dispatchEvent({
      type: 'SYNC_FAILED',
      stage: 'CONFIG',
      error: 'Zoho Organization ID is missing in environment variables.',
    });
    throw new Error('Zoho Organization ID is missing in environment variables.');
  }

  // Active sync window: 2026-03-01 to today in IST (all unverified payments)
  const dateStartStr = options.startDate || DEFAULT_SYNC_START_DATE;
  const dateEndStr = options.endDate || getIstTodayDateStr();

  console.log(`[CustomerPaymentSync] Active verification window: ${dateStartStr} -> ${dateEndStr}`);

  // Emit SYNC_STARTED
  dispatchEvent({
    type: 'SYNC_STARTED',
    startedAt: syncStartTime.toISOString(),
    startDate: dateStartStr,
    endDate: dateEndStr,
    filter: 'cf_is_verified=false',
    pageSize: 200,
  });

  let page = 1;
  let hasMorePage = true;
  let allFetchedPayments: any[] = [];
  const errors: string[] = [];
  let listApiCalls = 0;

  // 1. Fetch unverified list from Zoho Books (per_page max 200, consuming all pages)
  while (hasMorePage) {
    const url = `${API_BASE_URL}/books/v3/customerpayments?organization_id=${orgId}&date_start=${dateStartStr}&date_end=${dateEndStr}&cf_is_verified=false&page=${page}&per_page=200&sort_column=date&sort_order=A`;
    let resStatus = 0;
    const listFetchStart = Date.now();

    dispatchEvent({
      type: 'PAYMENT_LIST_STARTED',
      page,
      requestedPageSize: 200,
    });

    try {
      listApiCalls++;
      const res = await fetch(url, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
      });
      resStatus = res.status;
      const data = await res.json();
      const durationMs = Date.now() - listFetchStart;

      await logZohoApiCall({
        endpointType: ZohoApiEndpointType.PAYMENT_LIST,
        method: 'GET',
        success: res.ok && data.code === 0,
        httpStatus: resStatus,
      });

      const isSuccess = res.ok && data.code === 0;
      const payments = data.customerpayments || [];

      dispatchEvent({
        type: 'PAYMENT_LIST_COMPLETED',
        page,
        recordsReturned: payments.length,
        hasMorePage: Boolean(data.page_context?.has_more_page),
        httpStatus: resStatus,
        zohoCode: data.code ?? 0,
        durationMs,
        success: isSuccess,
        error: isSuccess ? undefined : (data.message || `HTTP ${resStatus}`),
      });

      if (!isSuccess) {
        throw new Error(data.message || `Zoho API Error (${res.status}) on page ${page}`);
      }

      allFetchedPayments = allFetchedPayments.concat(payments);
      hasMorePage = Boolean(data.page_context?.has_more_page);
      page++;
    } catch (fetchErr: any) {
      const durationMs = Date.now() - listFetchStart;
      if (resStatus === 0) {
        await logZohoApiCall({
          endpointType: ZohoApiEndpointType.PAYMENT_LIST,
          method: 'GET',
          success: false,
        });

        dispatchEvent({
          type: 'PAYMENT_LIST_COMPLETED',
          page,
          recordsReturned: 0,
          hasMorePage: false,
          httpStatus: 0,
          zohoCode: -1,
          durationMs,
          success: false,
          error: fetchErr.message,
        });
      }
      errors.push(`Page ${page} fetch error: ${fetchErr.message}`);
      break;
    }
  }

  // Pre-fetch existing local records in batch for efficiency
  const paymentIds = allFetchedPayments.map((p) => String(p.payment_id));
  const existingRecords = await prisma.customerPayment.findMany({
    where: { zohoPaymentId: { in: paymentIds } },
  });
  const existingMap = new Map(existingRecords.map((r) => [r.zohoPaymentId, r]));

  // Diagnostic counters
  let bankTransferCount = 0;
  let nonBankTransferCount = 0;
  let detailApiCalls = 0;
  let detailCallsSkippedFromCache = 0;
  let newBankTransfers = 0;
  let modifiedBankTransfers = 0;
  let unchangedBankTransfers = 0;
  let autoVerificationEligible = 0;
  let autoVerificationAttempted = 0;
  let autoVerificationSucceeded = 0;
  let autoVerificationFailed = 0;
  let upsertedCount = 0;
  let paymentsProcessed = 0;

  const emitProgress = (currentOp: string) => {
    dispatchEvent({
      type: 'SYNC_PROGRESS',
      paymentsDiscovered: allFetchedPayments.length,
      paymentsProcessed,
      paymentsSkipped: nonBankTransferCount,
      detailCalls: detailApiCalls,
      cacheHits: detailCallsSkippedFromCache,
      updateCalls: autoVerificationAttempted,
      verified: autoVerificationSucceeded,
      verificationFailures: autoVerificationFailed,
      currentOperation: currentOp,
    });
  };

  // 2. Process payments one-by-one with local detail caching & invalidation
  for (const rawPayment of allFetchedPayments) {
    try {
      const zohoPaymentId = String(rawPayment.payment_id);
      const paymentNumber = String(rawPayment.payment_number || zohoPaymentId);
      const isBankTransfer = rawPayment.payment_mode === 'Bank Transfer';
      const listLastModifiedTime: string | null =
        rawPayment.last_modified_time || rawPayment.updated_time || null;

      const existingLocal = existingMap.get(zohoPaymentId);

      let detail: any = null;
      let bankMatchStatus: CustomerPaymentBankMatchStatus = CustomerPaymentBankMatchStatus.NONE;
      let importedTransactionId: string | null = null;
      let isBankMatched = false;
      let needsDetailFetch = false;

      if (!isBankTransfer) {
        // NON-BANK PAYMENT: Do NOT call Detail API. List data is sufficient.
        nonBankTransferCount++;
        bankMatchStatus = CustomerPaymentBankMatchStatus.NONE;
        importedTransactionId = null;
        detail = rawPayment;

        dispatchEvent({
          type: 'PAYMENT_SKIPPED_NON_BANK',
          paymentId: zohoPaymentId,
          paymentNumber,
          paymentMode: rawPayment.payment_mode || 'Non-Bank',
          reason: 'Non-bank payment mode; Detail API not required',
        });
      } else {
        // BANK TRANSFER: Check local detail cache and last_modified_time
        bankTransferCount++;

        if (!existingLocal) {
          // CASE A: NEW PAYMENT -> Must fetch Detail API to inspect imported_transactions
          needsDetailFetch = true;
          newBankTransfers++;

          dispatchEvent({
            type: 'PAYMENT_CACHE_MISS',
            paymentId: zohoPaymentId,
            paymentNumber,
            reason: 'New Bank Transfer not present in local cache',
          });
        } else {
          // Local record exists
          const localModified = existingLocal.lastZohoModifiedTime;
          const hasCachedBankMatch = existingLocal.bankMatchStatus !== null;

          const normListModified = normalizeZohoTimestamp(listLastModifiedTime);
          const normLocalModified = normalizeZohoTimestamp(localModified);

          const isTimestampUnchanged =
            normListModified !== null &&
            normLocalModified !== null &&
            normListModified === normLocalModified;

          if (isTimestampUnchanged && hasCachedBankMatch) {
            // CASE B: EXISTING PAYMENT, NOT MODIFIED -> DO NOT call Detail API. Use local cache.
            needsDetailFetch = false;
            unchangedBankTransfers++;
            detailCallsSkippedFromCache++;
            bankMatchStatus =
              existingLocal.bankMatchStatus || CustomerPaymentBankMatchStatus.UNMATCHED;
            importedTransactionId = existingLocal.importedTransactionId;
            isBankMatched =
              bankMatchStatus === CustomerPaymentBankMatchStatus.MATCHED ||
              bankMatchStatus === CustomerPaymentBankMatchStatus.CATEGORIZED;
            detail = existingLocal.zohoData || rawPayment;

            console.log(
              `[PaymentSync] CACHE HIT: ${paymentNumber} — last_modified_time unchanged (${normListModified} === ${normLocalModified}); using cached bank status ${bankMatchStatus}`
            );

            dispatchEvent({
              type: 'PAYMENT_CACHE_HIT',
              paymentId: zohoPaymentId,
              paymentNumber,
              reason: 'last_modified_time unchanged; using cached verification & bank match state',
              lastZohoModifiedTime: localModified,
              cachedBankMatchStatus: existingLocal.bankMatchStatus,
              zohoModifiedTime: normListModified,
              localModifiedTime: normLocalModified,
            });
          } else {
            // CASE C: EXISTING PAYMENT, MODIFIED or NO CACHED TIMESTAMP -> Fetch Detail API
            needsDetailFetch = true;
            modifiedBankTransfers++;

            const refreshReason = !hasCachedBankMatch
              ? 'missing cached bank status; refreshing Detail API'
              : `last_modified_time changed (Zoho: ${normListModified || listLastModifiedTime}, Local: ${normLocalModified || localModified}); refreshing Detail API`;

            console.log(
              `[PaymentSync] CACHE REFRESH: ${paymentNumber} — ${refreshReason}`
            );

            dispatchEvent({
              type: 'PAYMENT_CACHE_REFRESH',
              paymentId: zohoPaymentId,
              paymentNumber,
              reason: refreshReason,
              zohoModifiedTime: normListModified,
              localModifiedTime: normLocalModified,
            });
          }
        }

        if (needsDetailFetch) {
          detailApiCalls++;
          let detailStatus = 0;
          const detailStart = Date.now();

          dispatchEvent({
            type: 'PAYMENT_DETAIL_STARTED',
            paymentId: zohoPaymentId,
            paymentNumber,
          });

          emitProgress(`Fetching details for ${paymentNumber}...`);

          try {
            const detailUrl = `${API_BASE_URL}/books/v3/customerpayments/${zohoPaymentId}?organization_id=${orgId}`;
            const detailRes = await fetch(detailUrl, {
              headers: { Authorization: `Zoho-oauthtoken ${token}` },
            });
            detailStatus = detailRes.status;
            const detailData = await detailRes.json();
            const durationMs = Date.now() - detailStart;

            const isDetailSuccess = detailRes.ok && detailData.code === 0;

            await logZohoApiCall({
              endpointType: ZohoApiEndpointType.PAYMENT_DETAIL,
              method: 'GET',
              success: isDetailSuccess,
              httpStatus: detailStatus,
            });

            if (isDetailSuccess && detailData.payment) {
              detail = detailData.payment;
            } else {
              detail = rawPayment;
            }

            // Inspect imported_transactions from fresh detail
            const importedTxns: any[] = Array.isArray(detail?.imported_transactions)
              ? detail.imported_transactions
              : [];

            if (importedTxns.length > 0) {
              const matchedTxn = importedTxns.find(
                (t: any) => t.status === 'categorized' || t.status === 'matched'
              );
              if (matchedTxn) {
                isBankMatched = true;
                importedTransactionId = String(matchedTxn.imported_transaction_id);
                bankMatchStatus =
                  matchedTxn.status === 'categorized'
                    ? CustomerPaymentBankMatchStatus.CATEGORIZED
                    : CustomerPaymentBankMatchStatus.MATCHED;
              } else {
                bankMatchStatus = CustomerPaymentBankMatchStatus.UNMATCHED;
              }
            } else {
              bankMatchStatus = CustomerPaymentBankMatchStatus.UNMATCHED;
            }

            dispatchEvent({
              type: 'PAYMENT_DETAIL_COMPLETED',
              paymentId: zohoPaymentId,
              paymentNumber,
              httpStatus: detailStatus,
              zohoCode: detailData.code ?? 0,
              durationMs,
              success: isDetailSuccess,
              bankMatchStatus,
              importedTransactionId,
              error: isDetailSuccess ? undefined : (detailData.message || `HTTP ${detailStatus}`),
            });
          } catch (detailErr: any) {
            const durationMs = Date.now() - detailStart;
            if (detailStatus === 0) {
              await logZohoApiCall({
                endpointType: ZohoApiEndpointType.PAYMENT_DETAIL,
                method: 'GET',
                success: false,
              });
            }
            console.warn(`[PaymentSync] Failed to fetch detail for ${zohoPaymentId}:`, detailErr.message);
            detail = rawPayment;

            dispatchEvent({
              type: 'PAYMENT_DETAIL_COMPLETED',
              paymentId: zohoPaymentId,
              paymentNumber,
              httpStatus: detailStatus,
              zohoCode: -1,
              durationMs,
              success: false,
              bankMatchStatus: CustomerPaymentBankMatchStatus.UNMATCHED,
              importedTransactionId: null,
              error: detailErr.message,
            });
          }
        }
      }

      // Invoice numbers summary
      const invoiceNumbers =
        Array.isArray(detail?.invoices) && detail.invoices.length > 0
          ? detail.invoices.map((inv: any) => inv.invoice_number).filter(Boolean).join(', ')
          : (rawPayment.invoice_numbers || '');

      const paymentDate = new Date(detail?.date || rawPayment.date);
      const amount = new Prisma.Decimal(detail?.amount ?? rawPayment.amount ?? 0);
      const bankCharges = new Prisma.Decimal(detail?.bank_charges ?? rawPayment.bank_charges ?? 0);
      const effectiveLastModified =
        listLastModifiedTime ||
        detail?.last_modified_time ||
        detail?.updated_time ||
        existingLocal?.lastZohoModifiedTime ||
        null;

      const rawCf = rawPayment.cf_is_verified;
      const isZohoReportedVerified = rawCf === true || rawCf === 'true';

      // Upsert record locally with cache fields.
      // If Zoho LIST explicitly returns the payment in cf_is_verified=false, ensure local record reflects unverified status
      // unless local database was already verified in the current active session.
      const nowTs = new Date();
      const localRecord = await prisma.customerPayment.upsert({
        where: { zohoPaymentId },
        update: {
          paymentNumber: detail?.payment_number || rawPayment.payment_number || '',
          customerId: String(detail?.customer_id || rawPayment.customer_id || ''),
          customerName: detail?.customer_name || rawPayment.customer_name || '',
          amount,
          bankCharges,
          paymentDate,
          paymentMode: detail?.payment_mode || rawPayment.payment_mode || '',
          referenceNumber: detail?.reference_number || rawPayment.reference_number || '',
          accountId: detail?.account_id || rawPayment.account_id || null,
          accountName: detail?.account_name || rawPayment.account_name || null,
          description: detail?.description || rawPayment.description || null,
          invoiceNumbers: invoiceNumbers || null,
          ...(!isZohoReportedVerified
            ? existingLocal?.verificationStatus === CustomerPaymentVerificationStatus.REVERIFICATION_REQUIRED
              ? {
                  isVerified: false,
                }
              : {
                  isVerified: false,
                  verificationStatus: CustomerPaymentVerificationStatus.PENDING,
                }
            : {}),
          bankMatchStatus,
          importedTransactionId,
          lastZohoModifiedTime: effectiveLastModified,
          ...(needsDetailFetch || !existingLocal
            ? { bankMatchLastCheckedAt: nowTs }
            : {}),
          zohoData: detail as any,
          lastSyncedAt: nowTs,
        },
        create: {
          zohoPaymentId,
          paymentNumber: detail?.payment_number || rawPayment.payment_number || '',
          customerId: String(detail?.customer_id || rawPayment.customer_id || ''),
          customerName: detail?.customer_name || rawPayment.customer_name || '',
          amount,
          bankCharges,
          paymentDate,
          paymentMode: detail?.payment_mode || rawPayment.payment_mode || '',
          referenceNumber: detail?.reference_number || rawPayment.reference_number || '',
          accountId: detail?.account_id || rawPayment.account_id || null,
          accountName: detail?.account_name || rawPayment.account_name || null,
          description: detail?.description || rawPayment.description || null,
          invoiceNumbers: invoiceNumbers || null,
          isVerified: false,
          verificationStatus: CustomerPaymentVerificationStatus.PENDING,
          bankMatchStatus,
          importedTransactionId,
          lastZohoModifiedTime: effectiveLastModified,
          bankMatchLastCheckedAt: nowTs,
          zohoData: detail as any,
          lastSyncedAt: nowTs,
        },
      });
      upsertedCount++;
      paymentsProcessed++;

      // 3. AUTO VERIFICATION for qualifying Bank Transfer payments
      // Condition: Bank Transfer + Bank Matched (CATEGORIZED / MATCHED) + Zoho reports cf_is_verified=false
      // GUARD: Payments marked REVERIFICATION_REQUIRED, requiresManualVerification, or VOID/cancelled MUST NEVER auto-verify!
      const isEligibleForAutoVerification =
        isBankTransfer &&
        isBankMatched &&
        isPaymentEligibleForVerification(detail || rawPayment) &&
        !isZohoReportedVerified &&
        !localRecord.isVerified &&
        !localRecord.requiresManualVerification &&
        localRecord.verificationStatus !== CustomerPaymentVerificationStatus.REVERIFICATION_REQUIRED;

      if (isEligibleForAutoVerification) {
        autoVerificationEligible++;
        autoVerificationAttempted++;

        dispatchEvent({
          type: 'AUTO_VERIFICATION_STARTED',
          paymentId: zohoPaymentId,
          paymentNumber,
          paymentMode: rawPayment.payment_mode || 'Bank Transfer',
          bankMatchStatus,
          reason: `cached status ${bankMatchStatus} and Zoho cf_is_verified=false`,
        });

        emitProgress(`Verifying ${paymentNumber} in Zoho Books...`);

        const autoVerifyResult = await verifyPaymentInZohoAndLocal({
          zohoPaymentId,
          method: CustomerPaymentVerificationMethod.AUTO_BANK_MATCH,
          token,
          orgId,
          paymentSnapshot: detail,
          allowZohoWrites: options.allowZohoWrites,
          syncRunId,
          onEvent: options.onEvent,
        });

        if (autoVerifyResult.success) {
          autoVerificationSucceeded++;
          dispatchEvent({
            type: 'AUTO_VERIFICATION_COMPLETED',
            paymentId: zohoPaymentId,
            paymentNumber,
            bankMatchStatus,
            zohoUpdateSuccess: true,
            localVerificationStatus: 'VERIFIED',
          });
        } else {
          autoVerificationFailed++;
          dispatchEvent({
            type: 'AUTO_VERIFICATION_COMPLETED',
            paymentId: zohoPaymentId,
            paymentNumber,
            bankMatchStatus,
            zohoUpdateSuccess: false,
            localVerificationStatus: 'PENDING',
            reason: autoVerifyResult.error,
          });

          if (!autoVerifyResult.skipped) {
            errors.push(`Auto-verify failed for ${zohoPaymentId}: ${autoVerifyResult.error}`);
          }
        }
      }

      emitProgress(`Checking ${paymentNumber}...`);
    } catch (recordErr: any) {
      paymentsProcessed++;
      errors.push(`Error processing payment ${rawPayment.payment_id}: ${recordErr.message}`);
    }
  }

  const syncEndTime = new Date();
  const totalDurationMs = syncEndTime.getTime() - syncStartTime.getTime();

  const diagnostics: CustomerPaymentSyncDiagnostics = {
    syncStartedAt: syncStartTime.toISOString(),
    syncCompletedAt: syncEndTime.toISOString(),
    dateStart: dateStartStr,
    dateEnd: dateEndStr,
    listApiCalls,
    listPaymentsReceived: allFetchedPayments.length,
    bankTransferCount,
    nonBankTransferCount,
    detailApiCalls,
    detailCallsSkippedFromCache,
    newBankTransfers,
    modifiedBankTransfers,
    unchangedBankTransfers,
    autoVerificationEligible,
    autoVerificationAttempted,
    autoVerificationSucceeded,
    autoVerificationFailed,
  };

  const finalSummary: SyncFinalSummary = {
    paymentsDiscovered: allFetchedPayments.length,
    newPayments: newBankTransfers,
    updatedPayments: modifiedBankTransfers,
    paymentsProcessed,
    cacheHits: detailCallsSkippedFromCache,
    detailCalls: detailApiCalls,
    autoVerificationCandidates: autoVerificationEligible,
    successfullyVerified: autoVerificationSucceeded,
    verificationFailures: autoVerificationFailed,
    skipped: nonBankTransferCount,
    paymentListCalls: listApiCalls,
    paymentDetailCalls: detailApiCalls,
    paymentUpdateCalls: canPerformZohoVerificationWrite(options.allowZohoWrites) ? autoVerificationAttempted : 0,
    totalApiCalls: listApiCalls + detailApiCalls + (canPerformZohoVerificationWrite(options.allowZohoWrites) ? autoVerificationAttempted : 0),
    totalDurationMs,
  };

  dispatchEvent({
    type: 'SYNC_COMPLETED',
    startedAt: syncStartTime.toISOString(),
    completedAt: syncEndTime.toISOString(),
    durationMs: totalDurationMs,
    finalSummary,
  });

  await recordOperationComplete({
    operationKey: 'sync_zoho_data',
    runId: syncRunId,
    trigger,
    success: errors.length === 0,
    recordsProcessed: paymentsProcessed,
    error: errors.length > 0 ? errors.join('; ') : null,
  });

  console.log('[CustomerPaymentSync] Diagnostics:', JSON.stringify(diagnostics, null, 2));

  return {
    success: errors.length === 0,
    discovered: allFetchedPayments.length,
    upserted: upsertedCount,
    autoVerified: autoVerificationSucceeded,
    diagnostics,
    errors,
  };
}

/**
 * Central backend write gate for Zoho Customer Payment verification updates.
 * STRICT SECURITY:
 * 1. NODE_ENV MUST be 'development' (production rejects real verification writes via this dev toggle).
 * 2. allowZohoWrites must be explicitly true.
 */
export function canPerformZohoVerificationWrite(allowZohoWrites: boolean = false): boolean {
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }
  return Boolean(allowZohoWrites);
}

/**
 * Updates cf_is_verified = true in Zoho Books and updates local cache.
 * Idempotent:
 * - If Zoho Books already has cf_is_verified = true, synchronizes local cache.
 * - If allowZohoWrites is false, blocks actual Zoho PUT and keeps local record PENDING (NO fake success).
 * - Real local isVerified = true transition occurs ONLY AFTER successful Zoho PUT response.
 */
export interface PaymentAuditVerifiedFields {
  customerName?: boolean;
  amount?: boolean;
  bankCharges?: boolean;
  paymentDate?: boolean;
  paymentMode?: boolean;
  depositTo?: boolean;
}

export async function verifyPaymentInZohoAndLocal(params: {
  zohoPaymentId: string;
  method: CustomerPaymentVerificationMethod;
  userId?: string;
  token?: string;
  orgId?: string;
  paymentSnapshot?: any;
  allowZohoWrites?: boolean;
  syncRunId?: string;
  onEvent?: CustomerPaymentSyncEventCallback;
  verifiedFields?: PaymentAuditVerifiedFields;
}): Promise<{ success: boolean; error?: string; skipped?: boolean; code?: string }> {
  const { zohoPaymentId, method, userId, allowZohoWrites, syncRunId, onEvent } = params;

  const dispatchEvent = (event: any) => {
    if (onEvent && syncRunId) {
      try {
        onEvent({
          syncRunId,
          timestamp: new Date().toISOString(),
          ...event,
        });
      } catch (err) {
        console.error('[verifyPaymentInZohoAndLocal] onEvent error:', err);
      }
    }
  };

  const local = await prisma.customerPayment.findUnique({
    where: { zohoPaymentId },
  });

  if (!local) {
    return { success: false, error: 'Payment not found in local database.' };
  }

  const paymentNumber = local.paymentNumber || zohoPaymentId;

  // Defensive check 1: Check local cached eligibility
  if (!isPaymentEligibleForVerification(local)) {
    const localStatus = getPaymentStatus(local).toUpperCase() || 'VOID';
    return {
      success: false,
      code: 'PAYMENT_VOIDED',
      error: `This payment is not eligible for verification because its status is ${localStatus} in Zoho Books.`,
    };
  }

  if (local.isVerified && local.verificationStatus === CustomerPaymentVerificationStatus.VERIFIED) {
    // Already verified locally (idempotent success)
    return { success: true };
  }

  const token = params.token || (await getZohoTokens());
  const orgId = params.orgId || getZohoOrgId();

  if (!token || !orgId) {
    return { success: false, error: 'Zoho credentials or organization ID missing.' };
  }

  // Defensive check 2: Validate live status from Zoho Books
  // If paymentSnapshot is provided and authoritative, check it; otherwise fetch live Detail API to ensure payment has not been voided since local sync
  let currentZohoStatus = '';
  if (params.paymentSnapshot) {
    currentZohoStatus = getPaymentStatus(params.paymentSnapshot);
  }

  if (!currentZohoStatus) {
    try {
      const liveCheckUrl = `${API_BASE_URL}/books/v3/customerpayments/${zohoPaymentId}?organization_id=${orgId}`;
      const liveCheckRes = await fetch(liveCheckUrl, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
      });
      if (liveCheckRes.ok) {
        const liveCheckData = await liveCheckRes.json();
        if (liveCheckData.payment) {
          currentZohoStatus = getPaymentStatus(liveCheckData.payment);
          // Also update local zohoData cache with fresh state
          await prisma.customerPayment.update({
            where: { zohoPaymentId },
            data: { zohoData: liveCheckData.payment as any },
          }).catch(() => {});
        }
      }
    } catch (liveErr) {
      console.warn(`[verifyPaymentInZohoAndLocal] Live status check warning for ${paymentNumber}:`, liveErr);
    }
  }

  if (currentZohoStatus && (ZOHO_NON_ACTIONABLE_PAYMENT_STATUSES as readonly string[]).includes(currentZohoStatus)) {
    return {
      success: false,
      code: 'PAYMENT_VOIDED',
      error: `This payment is no longer eligible for verification because it has been voided in Zoho Books.`,
    };
  }

  // ── CENTRAL BACKEND WRITE GATE ──
  // Check if real Zoho verification writes are allowed for this local environment
  const writeAllowed = canPerformZohoVerificationWrite(allowZohoWrites);
  if (!writeAllowed) {
    console.log(
      `[LOCAL_WRITE_GUARD] Zoho verification write BLOCKED for ${zohoPaymentId} (${local.paymentNumber}). Local toggle is OFF or not in development.`
    );

    // Record diagnostic audit event for blocked attempt (NEVER mark PAYMENT_VERIFIED)
    try {
      await prisma.auditLog.create({
        data: {
          userId: userId || 'SYSTEM',
          action: 'PAYMENT_VERIFICATION_WRITE_BLOCKED',
          details: `Verification write for ${local.paymentNumber} (${zohoPaymentId}) blocked: LOCAL_ZOHO_WRITES_DISABLED`,
        },
      });
    } catch (auditErr) {
      console.error('[VerifyPayment] Failed to record diagnostic audit log:', auditErr);
    }

    // Keep local record as isVerified: false, verificationStatus: PENDING
    return {
      success: false,
      skipped: true,
      code: 'SKIPPED_DUE_TO_LOCAL_WRITE_DISABLED',
      error: 'Zoho writes are disabled in Local Only mode.',
    };
  }

  // STEP 1 — Update the custom field via dedicated endpoint:
  // PUT /books/v3/customerpayment/{customer_payment_id}/customfields?organization_id={orgId}
  const endpoint = `/books/v3/customerpayment/${zohoPaymentId}/customfields?organization_id=${orgId}`;
  const customFieldPayload = {
    custom_fields: [
      {
        customfield_id: ZOHO_IS_VERIFIED_CF_ID,
        value: 'true',
      },
    ],
  };

  let updateStatus = 0;
  const now = new Date();
  const updateStart = Date.now();

  dispatchEvent({
    type: 'PAYMENT_UPDATE_STARTED',
    paymentId: zohoPaymentId,
    paymentNumber,
    apiCategory: 'PAYMENT_UPDATE',
    endpoint,
  });

  try {
    const updateRes = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customFieldPayload),
      }
    );

    updateStatus = updateRes.status;
    const updateData = await updateRes.json().catch(() => ({}));
    const durationMs = Date.now() - updateStart;
    const isUpdateSuccess = updateRes.ok && updateData.code === 0;

    // Log the API call as PAYMENT_UPDATE
    await logZohoApiCall({
      endpointType: ZohoApiEndpointType.PAYMENT_UPDATE,
      method: 'PUT',
      success: isUpdateSuccess,
      httpStatus: updateStatus,
    });

    if (!isUpdateSuccess) {
      const errMsg = updateData.message || `Zoho custom-field update failed with HTTP ${updateRes.status}`;
      console.error(`[VerifyPayment] Zoho custom-field update failed for ${zohoPaymentId}:`, errMsg);

      dispatchEvent({
        type: 'PAYMENT_UPDATE_COMPLETED',
        paymentId: zohoPaymentId,
        paymentNumber,
        httpStatus: updateStatus,
        zohoCode: updateData.code ?? -1,
        durationMs,
        success: false,
        localVerificationStatus: 'PENDING',
        error: errMsg,
      });

      // Record failed verification attempt metadata without marking verified
      await prisma.customerPayment.update({
        where: { zohoPaymentId },
        data: {
          verificationAttemptCount: { increment: 1 },
          lastVerificationAttemptAt: now,
          lastVerificationError: errMsg,
        },
      });

      return { success: false, error: errMsg };
    }

    // STEP 2 — Successful Zoho PUT response is sufficient to mark the payment VERIFIED locally.
    // Update local DB to VERIFIED with 6-field verified snapshot for integrity auditing
    const rawZoho = (local.zohoData as any) || params.paymentSnapshot || {};
    const verifiedCustomerName = local.customerName || rawZoho.customer_name || null;
    const verifiedCustomerId = local.customerId || (rawZoho.customer_id ? String(rawZoho.customer_id) : null);
    const verifiedAmount = local.amount;
    const verifiedBankCharges = local.bankCharges ?? (rawZoho.bank_charges != null ? Number(rawZoho.bank_charges) : 0);
    const verifiedDate = local.paymentDate;
    const verifiedPaymentMode = local.paymentMode || rawZoho.payment_mode || null;
    const verifiedAccountId = local.accountId || (rawZoho.account_id ? String(rawZoho.account_id) : null);
    const verifiedAccountName = local.accountName || rawZoho.account_name || null;
    const lastVerifiedZohoModifiedTime =
      local.lastZohoModifiedTime || (params.paymentSnapshot?.last_modified_time ?? null);

    await prisma.customerPayment.update({
      where: { zohoPaymentId },
      data: {
        isVerified: true,
        verificationStatus: CustomerPaymentVerificationStatus.VERIFIED,
        verificationMethod: method,
        verifiedAt: now,
        verifiedById: userId || null,
        verificationAttemptCount: { increment: 1 },
        lastVerificationAttemptAt: now,
        lastVerificationError: null,
        // 6-Field Integrity Audit Snapshot
        verifiedCustomerName,
        verifiedCustomerId,
        verifiedAmount,
        verifiedBankCharges,
        verifiedDate,
        verifiedPaymentMode,
        verifiedAccountId,
        verifiedAccountName,
        lastVerifiedZohoModifiedTime,
        requiresManualVerification: false,
        verificationInvalidatedAt: null,
        verificationInvalidationReason: null,
        // 6-field Audit Verification flags
        isAuditVerified: true,
        verifiedFieldCustomerName: true,
        verifiedFieldAmount: true,
        verifiedFieldBankCharges: true,
        verifiedFieldPaymentDate: true,
        verifiedFieldPaymentMode: true,
        verifiedFieldDepositTo: true,
      },
    });

    dispatchEvent({
      type: 'PAYMENT_UPDATE_COMPLETED',
      paymentId: zohoPaymentId,
      paymentNumber,
      httpStatus: updateStatus,
      zohoCode: updateData.code ?? 0,
      durationMs,
      success: true,
      localVerificationStatus: 'VERIFIED',
    });

    // Record Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          userId: userId || 'SYSTEM',
          action: 'PAYMENT_VERIFIED',
          details: `Payment ${local.paymentNumber} (${zohoPaymentId}) verified via ${method}`,
        },
      });
    } catch (auditErr) {
      console.error('[VerifyPayment] Failed to write AuditLog:', auditErr);
    }

    return { success: true };
  } catch (err: any) {
    const durationMs = Date.now() - updateStart;
    console.error(`[VerifyPayment] Exception during verify for ${zohoPaymentId}:`, err);

    dispatchEvent({
      type: 'PAYMENT_UPDATE_COMPLETED',
      paymentId: zohoPaymentId,
      paymentNumber,
      httpStatus: updateStatus,
      zohoCode: -1,
      durationMs,
      success: false,
      localVerificationStatus: 'PENDING',
      error: err.message || 'Internal connection error during verification',
    });

    await prisma.customerPayment.update({
      where: { zohoPaymentId },
      data: {
        verificationAttemptCount: { increment: 1 },
        lastVerificationAttemptAt: now,
        lastVerificationError: err.message || 'Internal connection error during verification',
      },
    });

    return { success: false, error: err.message || 'Internal connection error during verification' };
  }
}
