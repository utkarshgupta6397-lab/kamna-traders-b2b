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
export const ZOHO_NON_ACTIONABLE_PAYMENT_STATUSES = [
  'void',
  'cancelled',
  'canceled',
  'deleted',
] as const;

/**
 * Extracts and normalizes the authoritative payment status from a raw Zoho payment object or local record.
 */
export function getPaymentStatus(payment: any): string {
  if (!payment) return '';
  if (payment.verificationInvalidationReason === 'PAYMENT_DELETED_IN_ZOHO') return 'deleted';
  if (payment.verificationInvalidationReason === 'PAYMENT_VOIDED_IN_ZOHO') return 'void';
  if (payment.verificationInvalidationReason === 'PAYMENT_CANCELLED_IN_ZOHO') return 'cancelled';

  const rawStatus =
    payment.lifecycle_status ||
    payment.payment_status ||
    payment.status ||
    payment.zohoData?.lifecycle_status ||
    payment.zohoData?.payment_status ||
    payment.zohoData?.status ||
    '';
  return String(rawStatus).toLowerCase().trim();
}

/**
 * Centralized payment eligibility function for Payment Verification.
 * Returns true if a payment is valid and actionable for verification.
 * Returns false if the payment is VOID, cancelled, deleted, or otherwise non-actionable in Zoho Books.
 */
export function isPaymentEligibleForVerification(payment: any): boolean {
  if (!payment) return false;
  if (
    payment.verificationInvalidationReason === 'PAYMENT_DELETED_IN_ZOHO' ||
    payment.verificationInvalidationReason === 'PAYMENT_VOIDED_IN_ZOHO' ||
    payment.verificationInvalidationReason === 'PAYMENT_CANCELLED_IN_ZOHO'
  ) {
    return false;
  }
  const status = getPaymentStatus(payment);
  if (!status) return true; // Defaults to eligible if no status property exists
  return !(ZOHO_NON_ACTIONABLE_PAYMENT_STATUSES as readonly string[]).includes(status);
}

/**
 * Authoritative predicate to determine whether a payment mode is eligible for
 * bank reconciliation inspection (Detail API fetch & bank feed matching).
 * Supports Bank Transfer, POS Device, and their recognized electronic variants.
 * Genuine cash payments do not have bank feed matching and skip Detail API calls.
 */
export function isReconciliationEligiblePaymentMode(mode?: string | null): boolean {
  if (!mode) return false;
  const m = mode.trim().toLowerCase();
  if (m === 'cash' || m.includes('cash')) {
    return false;
  }
  return (
    m === 'bank transfer' ||
    m === 'pos device' ||
    m === 'pos' ||
    m === 'icici bank' ||
    m === 'bank remittance' ||
    m.includes('neft') ||
    m.includes('rtgs') ||
    m.includes('imps')
  );
}

/**
 * Recognized bank accounts in Zoho Books.
 * Confirms payment/settlement is deposited into an authoritative business bank account
 * and excludes petty cash or clearing accounts.
 */
export const RECOGNIZED_BANK_ACCOUNT_IDS = new Set([
  '1759923000003416718', // KAMNA TRADERS ICICI
  '1759923000000359203', // KAMNA BOB
  '1759923000000023221', // KAMNA TRADERS
]);

export const NON_BANK_ACCOUNT_NAMES = [
  'petty cash',
  'cash',
  'undeposited funds',
  'clearing',
];

export function isRecognizedBankAccount(accountId?: string | null, accountName?: string | null): boolean {
  if (accountId && RECOGNIZED_BANK_ACCOUNT_IDS.has(String(accountId).trim())) {
    return true;
  }
  if (!accountName) return false;
  const name = accountName.trim().toLowerCase();
  if (NON_BANK_ACCOUNT_NAMES.some((nb) => name.includes(nb))) {
    return false;
  }
  return (
    name.includes('icici') ||
    name.includes('bob') ||
    name.includes('bank') ||
    name.includes('kamna')
  );
}

export interface BankMatchEvaluation {
  isMatched: boolean;
  bankMatchStatus: CustomerPaymentBankMatchStatus;
  importedTransactionId: string | null;
  matchedTransaction: any | null;
}

/**
 * Inspects imported_transactions from a Payment Detail response.
 * Follows Zoho reconciliation semantics to find a confirmed matched or categorized transaction
 * associated with a recognized bank account.
 */
export function evaluateBankMatchFromDetail(
  detail: any,
  depositAccountId?: string | null,
  depositAccountName?: string | null
): BankMatchEvaluation {
  if (!detail || !Array.isArray(detail.imported_transactions) || detail.imported_transactions.length === 0) {
    return {
      isMatched: false,
      bankMatchStatus: CustomerPaymentBankMatchStatus.UNMATCHED,
      importedTransactionId: null,
      matchedTransaction: null,
    };
  }

  const validMatchedTxn = detail.imported_transactions.find((t: any) => {
    if (!t || typeof t !== 'object') return false;
    const status = String(t.status || '').toLowerCase().trim();
    if (status !== 'matched' && status !== 'categorized') return false;
    if (!t.imported_transaction_id) return false;

    // If transaction specifies an account_id, ensure it is not an excluded non-bank account
    if (t.account_id && !isRecognizedBankAccount(t.account_id, depositAccountName)) {
      return false;
    }
    return true;
  });

  if (validMatchedTxn) {
    const status = String(validMatchedTxn.status).toLowerCase().trim();
    return {
      isMatched: true,
      bankMatchStatus:
        status === 'categorized'
          ? CustomerPaymentBankMatchStatus.CATEGORIZED
          : CustomerPaymentBankMatchStatus.MATCHED,
      importedTransactionId: String(validMatchedTxn.imported_transaction_id),
      matchedTransaction: validMatchedTxn,
    };
  }

  return {
    isMatched: false,
    bankMatchStatus: CustomerPaymentBankMatchStatus.UNMATCHED,
    importedTransactionId: null,
    matchedTransaction: null,
  };
}

export const MAX_UNMATCHED_REFRESH_PER_SYNC = 50;

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
  let unmatchedRefreshCount = 0;

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
      const isReconciliationEligible = isReconciliationEligiblePaymentMode(rawPayment.payment_mode);
      const listLastModifiedTime: string | null =
        rawPayment.last_modified_time || rawPayment.updated_time || null;

      const existingLocal = existingMap.get(zohoPaymentId);

      let detail: any = null;
      let bankMatchStatus: CustomerPaymentBankMatchStatus = CustomerPaymentBankMatchStatus.NONE;
      let importedTransactionId: string | null = null;
      let isBankMatched = false;
      let needsDetailFetch = false;
      let isDetailSuccess = false;

      if (!isReconciliationEligible) {
        // NON-RECONCILABLE PAYMENT (e.g. Cash): Do NOT call Detail API. List data is sufficient.
        nonBankTransferCount++;
        bankMatchStatus = CustomerPaymentBankMatchStatus.NONE;
        importedTransactionId = null;
        detail = rawPayment;

        dispatchEvent({
          type: 'PAYMENT_SKIPPED_NON_BANK',
          paymentId: zohoPaymentId,
          paymentNumber,
          paymentMode: rawPayment.payment_mode || 'Non-Bank',
          reason: 'Non-reconcilable payment mode; Detail API not required',
        });
      } else {
        // RECONCILIATION-ELIGIBLE PAYMENT (Bank Transfer, POS Device, etc.)
        bankTransferCount++;

        let cacheSkipReason = '';
        let fetchReason = '';

        if (!existingLocal) {
          // CASE A: NEW PAYMENT -> Must fetch Detail API to inspect imported_transactions
          needsDetailFetch = true;
          newBankTransfers++;
          fetchReason = 'New reconciliation-eligible payment not present in local cache';
        } else {
          // Local record exists
          const localModified = existingLocal.lastZohoModifiedTime;
          const normListModified = normalizeZohoTimestamp(listLastModifiedTime);
          const normLocalModified = normalizeZohoTimestamp(localModified);

          const isTimestampChanged =
            normListModified !== null &&
            normLocalModified !== null &&
            normListModified !== normLocalModified;

          // Has this record previously had its reconciliation detail inspected?
          // Existing POS payments previously had bankMatchStatus = NONE and no imported_transactions in zohoData!
          const hasPreviouslyInspectedDetail =
            existingLocal.bankMatchStatus !== null &&
            existingLocal.bankMatchStatus !== CustomerPaymentBankMatchStatus.NONE &&
            existingLocal.zohoData !== null &&
            typeof existingLocal.zohoData === 'object' &&
            'imported_transactions' in (existingLocal.zohoData as any);

          if (!hasPreviouslyInspectedDetail) {
            // CASE B: PREVIOUSLY UNINSPECTED -> Must fetch Detail API
            needsDetailFetch = true;
            modifiedBankTransfers++;
            fetchReason = 'Previously uninspected reconciliation record (missing detail cache)';
          } else if (isTimestampChanged) {
            // CASE C: TIMESTAMP CHANGED -> Must refresh Detail API
            needsDetailFetch = true;
            modifiedBankTransfers++;
            fetchReason = `last_modified_time changed (Zoho: ${normListModified || listLastModifiedTime}, Local: ${normLocalModified || localModified}); refreshing Detail API`;
          } else {
            // Timestamp unchanged & detail was previously inspected
            const isConfirmedMatched =
              existingLocal.bankMatchStatus === CustomerPaymentBankMatchStatus.MATCHED ||
              existingLocal.bankMatchStatus === CustomerPaymentBankMatchStatus.CATEGORIZED;

            if (isConfirmedMatched) {
              // CASE D: ALREADY CONFIRMED MATCHED -> Skip Detail API (Cache Hit)
              needsDetailFetch = false;
              cacheSkipReason = `last_modified_time unchanged; using cached bank status ${existingLocal.bankMatchStatus}`;
            } else {
              // CASE E: UNMATCHED RECORD PERIODIC REFRESH
              // Bank reconciliation can occur in Zoho Banking without updating last_modified_time on payment.
              // Bounded refresh: only for recent payments (last 30 days) if last checked > 4 hours ago, up to MAX_UNMATCHED_REFRESH_PER_SYNC.
              const paymentDateMs = existingLocal.paymentDate.getTime();
              const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
              const isRecentPayment = paymentDateMs >= thirtyDaysAgoMs;

              const lastCheckedMs = existingLocal.bankMatchLastCheckedAt
                ? existingLocal.bankMatchLastCheckedAt.getTime()
                : 0;
              const fourHoursMs = 4 * 60 * 60 * 1000;
              const isStaleCheck = Date.now() - lastCheckedMs > fourHoursMs;

              if (isRecentPayment && isStaleCheck && unmatchedRefreshCount < MAX_UNMATCHED_REFRESH_PER_SYNC) {
                needsDetailFetch = true;
                unmatchedRefreshCount++;
                modifiedBankTransfers++;
                fetchReason = `Recent unmatched payment periodic refresh (last checked ${existingLocal.bankMatchLastCheckedAt ? existingLocal.bankMatchLastCheckedAt.toISOString() : 'never'})`;
              } else {
                needsDetailFetch = false;
                cacheSkipReason = 'Unmatched payment within valid check interval; using cached status';
              }
            }
          }

          if (!needsDetailFetch) {
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
              `[PaymentSync] CACHE HIT: ${paymentNumber} — ${cacheSkipReason}`
            );

            dispatchEvent({
              type: 'PAYMENT_CACHE_HIT',
              paymentId: zohoPaymentId,
              paymentNumber,
              reason: cacheSkipReason,
              lastZohoModifiedTime: localModified,
              cachedBankMatchStatus: existingLocal.bankMatchStatus,
              zohoModifiedTime: normListModified,
              localModifiedTime: normLocalModified,
            });
          } else {
            console.log(
              `[PaymentSync] CACHE REFRESH: ${paymentNumber} — ${fetchReason}`
            );

            dispatchEvent({
              type: 'PAYMENT_CACHE_REFRESH',
              paymentId: zohoPaymentId,
              paymentNumber,
              reason: fetchReason,
              zohoModifiedTime: normListModified,
              localModifiedTime: normLocalModified,
            });
          }
        }

        if (needsDetailFetch && !existingLocal) {
          dispatchEvent({
            type: 'PAYMENT_CACHE_MISS',
            paymentId: zohoPaymentId,
            paymentNumber,
            reason: fetchReason,
          });
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

            isDetailSuccess = detailRes.ok && detailData.code === 0;

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

            // Authoritative evaluation of imported_transactions
            const matchEval = evaluateBankMatchFromDetail(
              detail,
              detail?.account_id || rawPayment.account_id,
              detail?.account_name || rawPayment.account_name
            );

            isBankMatched = matchEval.isMatched;
            bankMatchStatus = matchEval.bankMatchStatus;
            importedTransactionId = matchEval.importedTransactionId;

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
            // CRITICAL DEFENSE: Never assume UNMATCHED on network/API failure!
            // Retain existing local status if present, otherwise preserve NONE.
            bankMatchStatus = existingLocal?.bankMatchStatus || CustomerPaymentBankMatchStatus.NONE;
            importedTransactionId = existingLocal?.importedTransactionId || null;
            isBankMatched =
              bankMatchStatus === CustomerPaymentBankMatchStatus.MATCHED ||
              bankMatchStatus === CustomerPaymentBankMatchStatus.CATEGORIZED;

            dispatchEvent({
              type: 'PAYMENT_DETAIL_COMPLETED',
              paymentId: zohoPaymentId,
              paymentNumber,
              httpStatus: detailStatus,
              zohoCode: -1,
              durationMs,
              success: false,
              bankMatchStatus,
              importedTransactionId,
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

      const paymentStatus = getPaymentStatus(detail || rawPayment);
      const isNonActionable = (ZOHO_NON_ACTIONABLE_PAYMENT_STATUSES as readonly string[]).includes(paymentStatus);
      const invalidationReason = isNonActionable
        ? paymentStatus === 'void'
          ? 'PAYMENT_VOIDED_IN_ZOHO'
          : paymentStatus === 'deleted'
            ? 'PAYMENT_DELETED_IN_ZOHO'
            : 'PAYMENT_CANCELLED_IN_ZOHO'
        : null;

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
          ...(isNonActionable
            ? {
                isVerified: false,
                verificationInvalidationReason: invalidationReason,
              }
            : !isZohoReportedVerified
              ? existingLocal?.verificationStatus === CustomerPaymentVerificationStatus.REVERIFICATION_REQUIRED
                ? {
                    isVerified: false,
                  }
                : {
                    isVerified: false,
                    verificationStatus: CustomerPaymentVerificationStatus.PENDING,
                    verificationInvalidationReason: null,
                  }
              : {
                  isVerified: true,
                  verificationStatus: CustomerPaymentVerificationStatus.VERIFIED,
                  verificationMethod: isBankMatched
                    ? CustomerPaymentVerificationMethod.AUTO_BANK_MATCH
                    : (existingLocal?.verificationMethod || CustomerPaymentVerificationMethod.MANUAL),
                  isAuditVerified: true,
                  verifiedAt: existingLocal?.verifiedAt || nowTs,
                  verificationInvalidationReason: null,
                }),
          bankMatchStatus,
          importedTransactionId,
          lastZohoModifiedTime: effectiveLastModified,
          ...(isDetailSuccess || (needsDetailFetch && !existingLocal)
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
          isVerified: !isNonActionable && isZohoReportedVerified,
          verificationStatus: isNonActionable
            ? CustomerPaymentVerificationStatus.PENDING
            : isZohoReportedVerified
              ? CustomerPaymentVerificationStatus.VERIFIED
              : CustomerPaymentVerificationStatus.PENDING,
          verificationMethod: isZohoReportedVerified
            ? isBankMatched
              ? CustomerPaymentVerificationMethod.AUTO_BANK_MATCH
              : CustomerPaymentVerificationMethod.MANUAL
            : null,
          isAuditVerified: isZohoReportedVerified && !isNonActionable,
          verifiedAt: isZohoReportedVerified && !isNonActionable ? nowTs : null,
          verificationInvalidationReason: invalidationReason,
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

      // 3. AUTO VERIFICATION for qualifying payments
      // Condition:
      // - Reconciliation eligible mode (Bank Transfer, POS Device)
      // - Bank Matched (CATEGORIZED / MATCHED in recognized bank account)
      // - Deposited in recognized bank account
      // - Actionable in Zoho (not void / cancelled)
      // - Not already verified in Zoho Books
      // - Not already verified locally
      // - Not restricted by requiresManualVerification or REVERIFICATION_REQUIRED
      const isRecognizedDepositAccount = isRecognizedBankAccount(
        detail?.account_id || rawPayment.account_id || localRecord.accountId,
        detail?.account_name || rawPayment.account_name || localRecord.accountName
      );

      const isEligibleForAutoVerification =
        !isNonActionable &&
        isReconciliationEligible &&
        isBankMatched &&
        isRecognizedDepositAccount &&
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

  // 4. Bounded reconciliation for unreturned local pending payments in active sync window
  // Authoritatively reconciles payments that were DELETED (404), VOIDED, or ALREADY VERIFIED in Zoho Books
  const reconcileResult = await reconcileStalePendingPayments({
    startDate: dateStartStr,
    endDate: dateEndStr,
    fetchedZohoPaymentIds: allFetchedPayments.map((p) => String(p.payment_id)),
    token,
    orgId,
    limit: 50,
  });
  detailApiCalls += reconcileResult.detailApiCalls;

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
    paymentUpdateCalls: autoVerificationAttempted,
    totalApiCalls: listApiCalls + detailApiCalls + autoVerificationAttempted,
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
 * Both local development and production environments communicate directly with Zoho Books
 * for legitimate authenticated verification write operations.
 */
export function canPerformZohoVerificationWrite(_allowZohoWrites?: boolean): boolean {
  return true;
}

/**
 * Updates cf_is_verified = true in Zoho Books and updates local cache.
 * Idempotent:
 * - If Zoho Books already has cf_is_verified = true, synchronizes local cache.
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
    const isDeleted =
      local.verificationInvalidationReason === 'PAYMENT_DELETED_IN_ZOHO' ||
      getPaymentStatus(local) === 'deleted';
    const localStatus = getPaymentStatus(local).toUpperCase() || (isDeleted ? 'DELETED' : 'VOID');
    return {
      success: false,
      code: isDeleted ? 'PAYMENT_DELETED' : 'PAYMENT_VOIDED',
      error: isDeleted
        ? 'Payment does not exist in Zoho Books. It may have been deleted.'
        : `This payment is not eligible for verification because its status is ${localStatus} in Zoho Books.`,
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
  // If paymentSnapshot is provided and authoritative, check it; otherwise fetch live Detail API to ensure payment has not been voided or deleted since local sync
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
      const liveCheckData = await liveCheckRes.json().catch(() => ({}));

      // Check for authoritative 404 / 1002 Payment does not exist
      if (
        liveCheckRes.status === 404 ||
        liveCheckData.code === 1002 ||
        (liveCheckData.message && liveCheckData.message.toLowerCase().includes('does not exist'))
      ) {
        await prisma.customerPayment.update({
          where: { zohoPaymentId },
          data: {
            verificationInvalidationReason: 'PAYMENT_DELETED_IN_ZOHO',
            zohoData: {
              ...((local.zohoData as any) || {}),
              payment_status: 'deleted',
              lifecycle_status: 'DELETED',
              deleted_in_zoho: true,
              deleted_detected_at: new Date().toISOString(),
            },
            lastSyncedAt: new Date(),
          },
        }).catch(() => {});

        return {
          success: false,
          code: 'PAYMENT_DELETED',
          error: `This payment is not eligible for verification because it has been deleted in Zoho Books.`,
        };
      }

      if (liveCheckRes.ok && liveCheckData.payment) {
        currentZohoStatus = getPaymentStatus(liveCheckData.payment);
        // Also update local zohoData cache with fresh state
        await prisma.customerPayment.update({
          where: { zohoPaymentId },
          data: { zohoData: liveCheckData.payment as any },
        }).catch(() => {});
      }
    } catch (liveErr) {
      console.warn(`[verifyPaymentInZohoAndLocal] Live status check warning for ${paymentNumber}:`, liveErr);
    }
  }

  if (currentZohoStatus && (ZOHO_NON_ACTIONABLE_PAYMENT_STATUSES as readonly string[]).includes(currentZohoStatus)) {
    const isDeleted = currentZohoStatus === 'deleted';
    const reason = isDeleted
      ? 'PAYMENT_DELETED_IN_ZOHO'
      : currentZohoStatus === 'cancelled' || currentZohoStatus === 'canceled'
        ? 'PAYMENT_CANCELLED_IN_ZOHO'
        : 'PAYMENT_VOIDED_IN_ZOHO';

    await prisma.customerPayment.update({
      where: { zohoPaymentId },
      data: {
        verificationInvalidationReason: reason,
        zohoData: {
          ...((local.zohoData as any) || {}),
          payment_status: currentZohoStatus,
          lifecycle_status: currentZohoStatus.toUpperCase(),
        },
      },
    }).catch(() => {});

    return {
      success: false,
      code: isDeleted ? 'PAYMENT_DELETED' : 'PAYMENT_VOIDED',
      error: `This payment is no longer eligible for verification because it has been ${currentZohoStatus} in Zoho Books.`,
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

export interface ReconcileStalePendingPaymentsOptions {
  limit?: number;
  startDate?: string;
  endDate?: string;
  fetchedZohoPaymentIds?: string[];
  token?: string;
  orgId?: string;
}

export interface ReconcileStalePendingPaymentsResult {
  checkedCount: number;
  deletedCount: number;
  voidedCount: number;
  verifiedCount: number;
  activeUnverifiedCount: number;
  detailApiCalls: number;
  errors: string[];
}

/**
 * Reconciles local pending payments that are no longer active in Zoho Books.
 * Performs bounded, authoritative checks against Zoho Detail API for candidates
 * missing from listing responses.
 * - HTTP 404 / code 1002 -> Confirmed DELETED (marks PAYMENT_DELETED_IN_ZOHO)
 * - status 'void' / 'cancelled' -> Confirmed VOID (marks PAYMENT_VOIDED_IN_ZOHO)
 * - cf_is_verified 'true' -> Confirmed ALREADY VERIFIED (reconciles to VERIFIED)
 * - HTTP 429 / 5xx / Network -> Preserves state without guessing (resilient to outages)
 */
export async function reconcileStalePendingPayments(
  options: ReconcileStalePendingPaymentsOptions = {}
): Promise<ReconcileStalePendingPaymentsResult> {
  const limit = options.limit ?? 50;
  const token = options.token || (await getZohoTokens());
  const orgId = options.orgId || getZohoOrgId();

  const result: ReconcileStalePendingPaymentsResult = {
    checkedCount: 0,
    deletedCount: 0,
    voidedCount: 0,
    verifiedCount: 0,
    activeUnverifiedCount: 0,
    detailApiCalls: 0,
    errors: [],
  };

  if (!token || !orgId) {
    result.errors.push('Zoho authentication credentials missing');
    return result;
  }

  const startDateObj = options.startDate ? new Date(options.startDate) : new Date(DEFAULT_SYNC_START_DATE);
  const endDateObj = options.endDate ? new Date(options.endDate) : new Date();
  endDateObj.setHours(23, 59, 59, 999);

  const fetchedIdSet = options.fetchedZohoPaymentIds ? new Set(options.fetchedZohoPaymentIds) : null;

  // Query candidate pending payments in active window that have not been invalidated yet
  const candidates = await prisma.customerPayment.findMany({
    where: {
      verificationStatus: {
        in: [
          CustomerPaymentVerificationStatus.PENDING,
          CustomerPaymentVerificationStatus.REVERIFICATION_REQUIRED,
        ],
      },
      isVerified: false,
      paymentDate: { gte: startDateObj, lte: endDateObj },
      verificationInvalidationReason: null,
    },
    take: limit,
  });

  const toCheck = fetchedIdSet ? candidates.filter(c => !fetchedIdSet.has(c.zohoPaymentId)) : candidates;

  for (const candidate of toCheck) {
    result.checkedCount++;
    result.detailApiCalls++;
    try {
      const detailUrl = `${API_BASE_URL}/books/v3/customerpayments/${candidate.zohoPaymentId}?organization_id=${orgId}`;
      const res = await fetch(detailUrl, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      // Case A: Confirmed DELETED in Zoho Books (404 or code 1002)
      if (
        res.status === 404 ||
        data.code === 1002 ||
        (data.message && data.message.toLowerCase().includes('does not exist'))
      ) {
        result.deletedCount++;
        await prisma.customerPayment.update({
          where: { zohoPaymentId: candidate.zohoPaymentId },
          data: {
            verificationInvalidationReason: 'PAYMENT_DELETED_IN_ZOHO',
            zohoData: {
              ...((candidate.zohoData as any) || {}),
              payment_status: 'deleted',
              lifecycle_status: 'DELETED',
              deleted_in_zoho: true,
              deleted_detected_at: new Date().toISOString(),
            },
            lastSyncedAt: new Date(),
          },
        });
        console.log(`[Reconcile] Confirmed DELETED payment in Zoho: ${candidate.paymentNumber} (${candidate.zohoPaymentId})`);
      } else if (res.ok && data.payment) {
        const zp = data.payment;
        const status = (zp.payment_status || zp.status || '').toLowerCase();
        const cfVerified =
          zp.custom_field_hash?.cf_is_verified ||
          (zp.custom_fields || []).find((f: any) => f.api_name === 'cf_is_verified')?.value;

        // Case B: Confirmed VOIDED or CANCELLED in Zoho Books
        if (status === 'void' || status === 'cancelled' || status === 'canceled') {
          result.voidedCount++;
          const reason = status === 'void' ? 'PAYMENT_VOIDED_IN_ZOHO' : 'PAYMENT_CANCELLED_IN_ZOHO';
          await prisma.customerPayment.update({
            where: { zohoPaymentId: candidate.zohoPaymentId },
            data: {
              verificationInvalidationReason: reason,
              zohoData: zp as any,
              lastSyncedAt: new Date(),
            },
          });
          console.log(`[Reconcile] Confirmed ${status.toUpperCase()} payment in Zoho: ${candidate.paymentNumber} (${candidate.zohoPaymentId})`);
        }
        // Case C: Confirmed ALREADY VERIFIED in Zoho Books (external verification)
        else if (cfVerified === true || cfVerified === 'true') {
          result.verifiedCount++;
          const matchEval = evaluateBankMatchFromDetail(
            zp,
            zp.account_id || candidate.accountId,
            zp.account_name || candidate.accountName
          );

          await prisma.customerPayment.update({
            where: { zohoPaymentId: candidate.zohoPaymentId },
            data: {
              isVerified: true,
              verificationStatus: CustomerPaymentVerificationStatus.VERIFIED,
              verificationMethod: matchEval.isMatched
                ? CustomerPaymentVerificationMethod.AUTO_BANK_MATCH
                : CustomerPaymentVerificationMethod.MANUAL,
              bankMatchStatus: matchEval.bankMatchStatus,
              importedTransactionId: matchEval.importedTransactionId,
              isAuditVerified: true,
              verifiedAt: new Date(),
              zohoData: zp as any,
              lastSyncedAt: new Date(),
            },
          });
          console.log(`[Reconcile] Reconciled ALREADY VERIFIED payment in Zoho: ${candidate.paymentNumber} (${candidate.zohoPaymentId})`);
        } else {
          result.activeUnverifiedCount++;
        }
      } else if (res.status === 429 || res.status >= 500) {
        // Transient rate limit or server error: stop loop safely without marking deleted
        console.warn(`[Reconcile] Transient Zoho API error (${res.status}). Pausing reconciliation.`);
        break;
      }
    } catch (err: any) {
      result.errors.push(`Error checking ${candidate.paymentNumber}: ${err.message}`);
      break; // Transient network error: break safely
    }
  }

  return result;
}

// In-memory concurrency locks to prevent race conditions during single-payment refresh operations
const activePaymentRefreshLocks = new Set<string>();

export type RefreshPaymentOutcome =
  | 'VERIFIED'
  | 'ALREADY_VERIFIED'
  | 'PENDING_BANK_MATCH'
  | 'PENDING_MANUAL_REVIEW'
  | 'DELETED'
  | 'VOIDED'
  | 'REVERIFICATION_REQUIRED'
  | 'REFRESH_FAILED';

export interface RefreshSingleCustomerPaymentParams {
  paymentId: string;
  userId?: string;
  allowZohoWrites?: boolean;
  mockResponse?: {
    status: number;
    body: any;
  };
}

export interface RefreshSingleCustomerPaymentResult {
  success: boolean;
  outcome: RefreshPaymentOutcome;
  isActionable: boolean;
  message: string;
  error?: string;
  payment?: any;
  zohoApiCalls: number;
}

/**
 * Authoritative single-payment refresh from Zoho Books.
 * Fetches the latest detail data for a single payment, reconciles the local record,
 * applies lifecycle rules (deleted/voided/verified), and executes auto-verification
 * if bank-match and account criteria are satisfied.
 */
export async function refreshSingleCustomerPayment(
  params: RefreshSingleCustomerPaymentParams
): Promise<RefreshSingleCustomerPaymentResult> {
  const { paymentId, userId, allowZohoWrites, mockResponse } = params;

  if (!paymentId) {
    return {
      success: false,
      outcome: 'REFRESH_FAILED',
      isActionable: false,
      message: 'Payment ID is required.',
      error: 'PAYMENT_ID_REQUIRED',
      zohoApiCalls: 0,
    };
  }

  // 1. Locate local record by ID or Zoho Payment ID
  const local = await prisma.customerPayment.findFirst({
    where: {
      OR: [
        { id: paymentId },
        { zohoPaymentId: paymentId },
      ],
    },
  });

  if (!local) {
    return {
      success: false,
      outcome: 'REFRESH_FAILED',
      isActionable: false,
      message: 'Payment not found in local database.',
      error: 'PAYMENT_NOT_FOUND',
      zohoApiCalls: 0,
    };
  }

  // 2. Concurrency protection per payment
  if (activePaymentRefreshLocks.has(local.zohoPaymentId)) {
    return {
      success: false,
      outcome: 'REFRESH_FAILED',
      isActionable: true,
      message: 'A refresh operation is already in progress for this payment.',
      error: 'CONCURRENT_REFRESH',
      zohoApiCalls: 0,
      payment: local,
    };
  }

  activePaymentRefreshLocks.add(local.zohoPaymentId);

  let zohoApiCalls = 0;

  try {
    let resStatus: number;
    let data: any;

    if (mockResponse) {
      resStatus = mockResponse.status;
      data = mockResponse.body;
      if (resStatus === 200 || resStatus === 404 || resStatus === 429 || resStatus >= 500) {
        zohoApiCalls++;
      }
    } else {
      const token = await getZohoTokens();
      const orgId = getZohoOrgId();
      const detailUrl = `${API_BASE_URL}/books/v3/customerpayments/${local.zohoPaymentId}?organization_id=${orgId}`;
      zohoApiCalls++;

      const res = await fetch(detailUrl, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
      });
      resStatus = res.status;
      data = await res.json().catch(() => ({}));

      await logZohoApiCall({
        endpointType: 'PAYMENT_DETAIL',
        method: 'GET',
        success: res.ok,
        httpStatus: res.status,
      });
    }

    // 3. Transient error handling (Rate Limit 429 or Server Error 5xx): Preserve local state
    if (resStatus === 429 || resStatus >= 500) {
      console.warn(`[RefreshSingle] Transient Zoho API error (${resStatus}) for payment ${local.paymentNumber}. Preserving local state.`);
      return {
        success: false,
        outcome: 'REFRESH_FAILED',
        isActionable: local.verificationStatus === 'PENDING' || local.verificationStatus === 'REVERIFICATION_REQUIRED',
        message: `Zoho Books returned status ${resStatus}. Payment state preserved without changes.`,
        error: data?.message || `HTTP ${resStatus}`,
        zohoApiCalls,
        payment: local,
      };
    }

    // 4. Confirmed DELETED in Zoho Books (HTTP 404 or Zoho error code 1002 / 'does not exist')
    if (
      resStatus === 404 ||
      data?.code === 1002 ||
      (typeof data?.message === 'string' && data.message.toLowerCase().includes('does not exist'))
    ) {
      const updated = await prisma.customerPayment.update({
        where: { zohoPaymentId: local.zohoPaymentId },
        data: {
          verificationInvalidationReason: 'PAYMENT_DELETED_IN_ZOHO',
          requiresManualVerification: false,
          zohoData: {
            ...((local.zohoData as any) || {}),
            payment_status: 'deleted',
            lifecycle_status: 'DELETED',
            deleted_in_zoho: true,
            deleted_detected_at: new Date().toISOString(),
          },
          lastSyncedAt: new Date(),
        },
      });

      return {
        success: true,
        outcome: 'DELETED',
        isActionable: false,
        message: `Payment ${local.paymentNumber} has been deleted in Zoho Books and removed from the verification queue.`,
        payment: updated,
        zohoApiCalls,
      };
    }

    // 5. Valid payload check
    if (resStatus !== 200 || !data?.payment) {
      return {
        success: false,
        outcome: 'REFRESH_FAILED',
        isActionable: local.verificationStatus === 'PENDING' || local.verificationStatus === 'REVERIFICATION_REQUIRED',
        message: data?.message || `Failed to fetch payment details from Zoho Books (status ${resStatus}).`,
        error: data?.message || `HTTP ${resStatus}`,
        zohoApiCalls,
        payment: local,
      };
    }

    const zp = data.payment;
    const rawStatus = (zp.payment_status || zp.status || '').toLowerCase().trim();
    const cfVerified =
      zp.cf_is_verified ??
      zp.custom_field_hash?.cf_is_verified ??
      (zp.custom_fields || []).find(
        (f: any) => f.api_name === 'cf_is_verified' || f.customfield_id === ZOHO_IS_VERIFIED_CF_ID
      )?.value;
    const isVerifiedInZoho = cfVerified === true || cfVerified === 'true';

    // 6. Confirmed VOIDED or CANCELLED in Zoho Books
    if (rawStatus === 'void' || rawStatus === 'cancelled' || rawStatus === 'canceled') {
      const reason = rawStatus === 'void' ? 'PAYMENT_VOIDED_IN_ZOHO' : 'PAYMENT_CANCELLED_IN_ZOHO';
      const updated = await prisma.customerPayment.update({
        where: { zohoPaymentId: local.zohoPaymentId },
        data: {
          verificationInvalidationReason: reason,
          requiresManualVerification: false,
          zohoData: zp,
          lastSyncedAt: new Date(),
        },
      });

      return {
        success: true,
        outcome: 'VOIDED',
        isActionable: false,
        message: `Payment ${local.paymentNumber} is ${rawStatus.toUpperCase()} in Zoho Books and cannot be verified.`,
        payment: updated,
        zohoApiCalls,
      };
    }

    // 7. Confirmed ALREADY VERIFIED in Zoho Books
    if (isVerifiedInZoho) {
      if (local.isVerified) {
        // Evaluate material payment changes using 6-field integrity rules
        const { evaluatePaymentIntegrity } = await import('@/lib/services/customer-payment-integrity-audit.service');
        const integrity = evaluatePaymentIntegrity({
          snapshot: {
            customerName: local.customerName,
            customerId: local.customerId,
            amount: local.amount,
            bankCharges: local.bankCharges,
            paymentDate: local.paymentDate,
            paymentMode: local.paymentMode,
            accountId: local.accountId,
            accountName: local.accountName,
          },
          current: {
            customerName: zp.customer_name || local.customerName,
            customerId: zp.customer_id || local.customerId,
            amount: zp.amount,
            bankCharges: zp.bank_charges,
            paymentDate: zp.date,
            paymentMode: zp.payment_mode,
            accountId: zp.account_id,
            accountName: zp.account_name,
          },
        });

        if (integrity.overallIntegrityStatus === 'FAIL') {
          const reason = integrity.reasons.join('; ') || 'Payment details modified after verification.';
          const updated = await prisma.customerPayment.update({
            where: { zohoPaymentId: local.zohoPaymentId },
            data: {
              verificationStatus: CustomerPaymentVerificationStatus.REVERIFICATION_REQUIRED,
              verificationInvalidationReason: reason,
              zohoData: zp,
              lastZohoModifiedTime: zp.last_modified_time || local.lastZohoModifiedTime,
              lastSyncedAt: new Date(),
            },
          });
          return {
            success: true,
            outcome: 'REVERIFICATION_REQUIRED',
            isActionable: true,
            message: `Payment details changed in Zoho Books after initial verification (${reason}). Manual re-verification required.`,
            payment: updated,
            zohoApiCalls,
          };
        }

        // Verified and integrity checks pass
        const updated = await prisma.customerPayment.update({
          where: { zohoPaymentId: local.zohoPaymentId },
          data: {
            zohoData: zp,
            lastZohoModifiedTime: zp.last_modified_time || local.lastZohoModifiedTime,
            lastSyncedAt: new Date(),
          },
        });
        return {
          success: true,
          outcome: 'ALREADY_VERIFIED',
          isActionable: false,
          message: `Payment ${local.paymentNumber} is already verified and details match Zoho Books.`,
          payment: updated,
          zohoApiCalls,
        };
      } else {
        // Was pending locally, but verified in Zoho Books externally
        const depositAccountId = zp.account_id || local.accountId;
        const depositAccountName = zp.account_name || local.accountName;
        const matchEval = evaluateBankMatchFromDetail(zp, depositAccountId, depositAccountName);

        const updated = await prisma.customerPayment.update({
          where: { zohoPaymentId: local.zohoPaymentId },
          data: {
            isVerified: true,
            verificationStatus: CustomerPaymentVerificationStatus.VERIFIED,
            verificationMethod: matchEval.isMatched
              ? CustomerPaymentVerificationMethod.AUTO_BANK_MATCH
              : CustomerPaymentVerificationMethod.MANUAL,
            bankMatchStatus: matchEval.bankMatchStatus,
            importedTransactionId: matchEval.importedTransactionId,
            isAuditVerified: true,
            verifiedAt: new Date(),
            zohoData: zp,
            lastZohoModifiedTime: zp.last_modified_time || local.lastZohoModifiedTime,
            lastSyncedAt: new Date(),
            verificationInvalidationReason: null,
          },
        });

        return {
          success: true,
          outcome: 'ALREADY_VERIFIED',
          isActionable: false,
          message: `Payment ${local.paymentNumber} is already verified in Zoho Books. Local record reconciled to Verified.`,
          payment: updated,
          zohoApiCalls,
        };
      }
    }

    // 8. Active & Unverified Payment: Reconcile fields and evaluate auto-verification
    const depositAccountId = zp.account_id || local.accountId;
    const depositAccountName = zp.account_name || local.accountName;
    const bankMatchEval = evaluateBankMatchFromDetail(zp, depositAccountId, depositAccountName);
    const isEligibleMode = isReconciliationEligiblePaymentMode(zp.payment_mode || local.paymentMode);
    const isRecognizedAcc = isRecognizedBankAccount(depositAccountId, depositAccountName);
    const isActionableStatus = isPaymentEligibleForVerification(zp);

    // Update local record with latest authoritative data from Detail API
    let updated = await prisma.customerPayment.update({
      where: { zohoPaymentId: local.zohoPaymentId },
      data: {
        amount: zp.amount != null ? zp.amount : local.amount,
        paymentDate: zp.date ? new Date(zp.date) : local.paymentDate,
        paymentMode: zp.payment_mode || local.paymentMode,
        referenceNumber: zp.reference_number || local.referenceNumber,
        description: zp.description || local.description,
        bankCharges: zp.bank_charges != null ? zp.bank_charges : local.bankCharges,
        accountId: depositAccountId,
        accountName: depositAccountName,
        bankMatchStatus: bankMatchEval.bankMatchStatus,
        importedTransactionId: bankMatchEval.importedTransactionId,
        lastZohoModifiedTime: zp.last_modified_time || local.lastZohoModifiedTime,
        zohoData: zp,
        lastSyncedAt: new Date(),
      },
    });

    // Auto-verification decision evaluation
    const canAutoVerify =
      isEligibleMode &&
      bankMatchEval.isMatched &&
      isRecognizedAcc &&
      isActionableStatus &&
      !local.requiresManualVerification &&
      local.verificationStatus !== CustomerPaymentVerificationStatus.REVERIFICATION_REQUIRED;

    if (canAutoVerify) {
      if (mockResponse) {
        // In simulated test mode with mockResponse, avoid live network write for fictitious test IDs
        const verifiedRecord = await prisma.customerPayment.update({
          where: { zohoPaymentId: local.zohoPaymentId },
          data: {
            isVerified: true,
            verificationStatus: CustomerPaymentVerificationStatus.VERIFIED,
            verificationMethod: CustomerPaymentVerificationMethod.AUTO_BANK_MATCH,
            bankMatchStatus: bankMatchEval.bankMatchStatus,
            importedTransactionId: bankMatchEval.importedTransactionId,
            isAuditVerified: true,
            verifiedAt: new Date(),
          },
        });
        return {
          success: true,
          outcome: 'VERIFIED',
          isActionable: false,
          message: `Payment ${local.paymentNumber} matched with bank transaction (${bankMatchEval.importedTransactionId}) and auto-verified successfully in Zoho Books!`,
          payment: verifiedRecord,
          zohoApiCalls: zohoApiCalls + 1,
        };
      }

      const verifyRes = await verifyPaymentInZohoAndLocal({
        zohoPaymentId: local.zohoPaymentId,
        method: CustomerPaymentVerificationMethod.AUTO_BANK_MATCH,
        userId,
        allowZohoWrites,
        paymentSnapshot: zp,
      });
      zohoApiCalls++;

      if (verifyRes.success) {
        const finalPayment = await prisma.customerPayment.findUnique({
          where: { zohoPaymentId: local.zohoPaymentId },
        });
        return {
          success: true,
          outcome: 'VERIFIED',
          isActionable: false,
          message: `Payment ${local.paymentNumber} matched with bank transaction (${bankMatchEval.importedTransactionId}) and auto-verified successfully in Zoho Books!`,
          payment: finalPayment,
          zohoApiCalls,
        };
      } else {
        return {
          success: true,
          outcome: 'PENDING_BANK_MATCH',
          isActionable: true,
          message: `Bank match found, but auto-verification could not complete: ${verifyRes.error || 'Verification rejected'}.`,
          payment: updated,
          zohoApiCalls,
        };
      }
    }

    // Determine pending outcome
    if (local.verificationStatus === CustomerPaymentVerificationStatus.REVERIFICATION_REQUIRED) {
      return {
        success: true,
        outcome: 'REVERIFICATION_REQUIRED',
        isActionable: true,
        message: 'Payment details were modified after initial verification. Manual re-verification is required.',
        payment: updated,
        zohoApiCalls,
      };
    }

    if (!isEligibleMode) {
      return {
        success: true,
        outcome: 'PENDING_MANUAL_REVIEW',
        isActionable: true,
        message: `Refreshed from Zoho Books. ${updated.paymentMode || 'Cash'} payments require manual verification.`,
        payment: updated,
        zohoApiCalls,
      };
    }

    if (!isRecognizedAcc) {
      return {
        success: true,
        outcome: 'PENDING_MANUAL_REVIEW',
        isActionable: true,
        message: `Refreshed from Zoho Books. Deposit account (${depositAccountName || 'Unknown'}) is not a recognized bank account.`,
        payment: updated,
        zohoApiCalls,
      };
    }

    if (!bankMatchEval.isMatched) {
      return {
        success: true,
        outcome: 'PENDING_BANK_MATCH',
        isActionable: true,
        message: 'Refreshed from Zoho Books. Awaiting matching bank transaction in bank feeds.',
        payment: updated,
        zohoApiCalls,
      };
    }

    return {
      success: true,
      outcome: 'PENDING_MANUAL_REVIEW',
      isActionable: true,
      message: 'Refreshed from Zoho Books. Payment requires manual review.',
      payment: updated,
      zohoApiCalls,
    };
  } catch (err: any) {
    console.error(`[RefreshSingle] Exception refreshing payment ${local.paymentNumber}:`, err);
    return {
      success: false,
      outcome: 'REFRESH_FAILED',
      isActionable: local.verificationStatus === 'PENDING' || local.verificationStatus === 'REVERIFICATION_REQUIRED',
      message: `Failed to refresh payment: ${err.message}`,
      error: err.message,
      zohoApiCalls,
      payment: local,
    };
  } finally {
    activePaymentRefreshLocks.delete(local.zohoPaymentId);
  }
}
