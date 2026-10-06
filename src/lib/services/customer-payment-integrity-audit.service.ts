import { prisma } from '@/lib/db';
import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';
import {
  CustomerPaymentVerificationStatus,
  ZohoApiEndpointType,
  Prisma,
} from '@prisma/client';
import {
  CustomerPaymentAuditEventCallback,
  AuditFinalSummary,
} from '@/lib/types/customer-payment-audit-events';
import {
  logZohoApiCall,
  canPerformZohoVerificationWrite,
  normalizeZohoTimestamp,
  getIstTodayDateStr,
  DEFAULT_SYNC_START_DATE,
  ZOHO_IS_VERIFIED_CF_ID,
} from '@/lib/services/customer-payment-verification.service';
import {
  recordOperationStart,
  recordOperationComplete,
  PaymentOperationTrigger,
} from '@/lib/services/customer-payment-operation-tracker.service';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

export interface PaymentIntegrityAuditOptions {
  startDate?: string; // defaults to '2026-03-01'
  endDate?: string;   // defaults to today in IST
  trigger?: PaymentOperationTrigger; // 'MANUAL' | 'AUTOMATIC', defaults to 'MANUAL'
  allowZohoWrites?: boolean;
  auditRunId?: string;
  forceFullAudit?: boolean; // if true, ignores checkpoint and checks all records
  onEvent?: CustomerPaymentAuditEventCallback;
}

export interface PaymentIntegrityAuditResult {
  success: boolean;
  auditedCount: number;
  invalidatedCount: number;
  baselinesCreated: number;
  summary: AuditFinalSummary;
  errors: string[];
}

/**
 * Formats a Date object as YYYY-MM-DD
 */
function formatDateToYmd(d: Date | string): string {
  if (typeof d === 'string') {
    return d.split('T')[0];
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Compares two monetary amounts safely using Decimal string/numerical equality.
 */
function areAmountsEqual(
  amtA: Prisma.Decimal | number | string | null | undefined,
  amtB: Prisma.Decimal | number | string | null | undefined
): boolean {
  if (amtA === null || amtA === undefined || amtB === null || amtB === undefined) return false;
  try {
    const decA = new Prisma.Decimal(amtA.toString());
    const decB = new Prisma.Decimal(amtB.toString());
    return decA.equals(decB);
  } catch {
    return false;
  }
}

/**
 * Normalizes string by trimming whitespace and converting to lowercase for comparison.
 */
function normalizeString(val: string | null | undefined): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().toLowerCase();
}

export interface PaymentIntegrityEvaluation {
  overallIntegrityStatus: 'PASS' | 'FAIL';
  customerNameMatch: boolean;
  amountReceivedMatch: boolean;
  bankChargesMatch: boolean;
  paymentDateMatch: boolean;
  paymentModeMatch: boolean;
  depositToMatch: boolean;
  mismatchedFields: string[];
  reasons: string[];
  checkedAt: string;
}

/**
 * Authoritative 6-field integrity comparison function.
 * Evaluates snapshot values against authoritative Zoho payment values across:
 * 1. Customer Name
 * 2. Amount Received
 * 3. Bank Charges
 * 4. Payment Date
 * 5. Payment Mode
 * 6. Deposit To
 */
export function evaluatePaymentIntegrity(params: {
  snapshot: {
    customerName?: string | null;
    customerId?: string | null;
    amount?: Prisma.Decimal | number | string | null;
    bankCharges?: Prisma.Decimal | number | string | null;
    paymentDate?: Date | string | null;
    paymentMode?: string | null;
    accountId?: string | null;
    accountName?: string | null;
  };
  current: {
    customerName?: string | null;
    customerId?: string | null;
    amount?: number | string | Prisma.Decimal | null;
    bankCharges?: number | string | Prisma.Decimal | null;
    paymentDate?: Date | string | null;
    paymentMode?: string | null;
    accountId?: string | null;
    accountName?: string | null;
  };
}): PaymentIntegrityEvaluation {
  const { snapshot, current } = params;
  const reasons: string[] = [];
  const mismatchedFields: string[] = [];

  // 1. Customer Name: Compare stable ID if both exist; otherwise normalized customer name
  let customerNameMatch = false;
  if (snapshot.customerId && current.customerId) {
    customerNameMatch = String(snapshot.customerId).trim() === String(current.customerId).trim();
  } else {
    customerNameMatch = normalizeString(snapshot.customerName) === normalizeString(current.customerName);
  }
  if (!customerNameMatch) {
    mismatchedFields.push('Customer Name');
    reasons.push(
      `Customer Name changed from "${snapshot.customerName || 'N/A'}" to "${current.customerName || 'N/A'}"`
    );
  }

  // 2. Amount Received: Compare numeric monetary value
  const amountReceivedMatch = areAmountsEqual(snapshot.amount, current.amount);
  if (!amountReceivedMatch) {
    mismatchedFields.push('Amount Received');
    reasons.push(`Amount changed from ₹${snapshot.amount} to ₹${current.amount}`);
  }

  // 3. Bank Charges: Compare numeric bank-charge amount (defaulting null to 0)
  const snapCharges = snapshot.bankCharges != null ? snapshot.bankCharges : 0;
  const currCharges = current.bankCharges != null ? current.bankCharges : 0;
  const bankChargesMatch = areAmountsEqual(snapCharges, currCharges);
  if (!bankChargesMatch) {
    mismatchedFields.push('Bank Charges');
    reasons.push(`Bank Charges changed from ₹${snapCharges} to ₹${currCharges}`);
  }

  // 4. Payment Date: Normalized YYYY-MM-DD comparison
  const snapDateStr = snapshot.paymentDate ? formatDateToYmd(snapshot.paymentDate) : '';
  const currDateStr = current.paymentDate ? formatDateToYmd(current.paymentDate) : '';
  const paymentDateMatch = Boolean(snapDateStr && currDateStr && snapDateStr === currDateStr);
  if (!paymentDateMatch) {
    mismatchedFields.push('Payment Date');
    reasons.push(`Date changed from ${snapDateStr} to ${currDateStr}`);
  }

  // 5. Payment Mode: Normalized string comparison
  const paymentModeMatch = normalizeString(snapshot.paymentMode) === normalizeString(current.paymentMode);
  if (!paymentModeMatch) {
    mismatchedFields.push('Payment Mode');
    reasons.push(
      `Payment Mode changed from "${snapshot.paymentMode || 'N/A'}" to "${current.paymentMode || 'N/A'}"`
    );
  }

  // 6. Deposit To: Compare stable account ID if both exist; otherwise normalized account name
  let depositToMatch = false;
  if (snapshot.accountId && current.accountId) {
    depositToMatch = String(snapshot.accountId).trim() === String(current.accountId).trim();
  } else {
    depositToMatch = normalizeString(snapshot.accountName) === normalizeString(current.accountName);
  }
  if (!depositToMatch) {
    mismatchedFields.push('Deposit To');
    reasons.push(
      `Deposit Account changed from "${snapshot.accountName || 'N/A'}" to "${current.accountName || 'N/A'}"`
    );
  }

  const overallIntegrityStatus = mismatchedFields.length === 0 ? 'PASS' : 'FAIL';

  return {
    overallIntegrityStatus,
    customerNameMatch,
    amountReceivedMatch,
    bankChargesMatch,
    paymentDateMatch,
    paymentModeMatch,
    depositToMatch,
    mismatchedFields,
    reasons,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Runs an integrity audit on verified customer payments:
 * - Queries Zoho Books Customer Payments ordered by last_modified_time descending (`sort_column=last_modified_time&sort_order=D`).
 * - Employs durable checkpointing with a safety overlap window.
 * - For payments verified locally, checks if amount or date has changed compared to the verified snapshot.
 * - If modified:
 *     - Marks local payment REVERIFICATION_REQUIRED.
 *     - Sets requiresManualVerification = true.
 *     - Sets isVerified = false.
 *     - If Zoho Books currently has cf_is_verified = true, sends exactly ONE PUT to set cf_is_verified = false.
 *     - Emits audit log & audit events.
 * - For existing verified payments without snapshots (e.g. initial run), establishes baseline without invalidating.
 * - Real-time progress is emitted via `onEvent`.
 */
export async function auditVerifiedPaymentIntegrity(
  options: PaymentIntegrityAuditOptions = {}
): Promise<PaymentIntegrityAuditResult> {
  const auditStartTime = new Date();
  const auditRunId = options.auditRunId || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const trigger = options.trigger || 'MANUAL';
  const dateStartStr = options.startDate || DEFAULT_SYNC_START_DATE;
  const dateEndStr = options.endDate || getIstTodayDateStr();
  const errors: string[] = [];

  // Track operation start
  await recordOperationStart({
    operationKey: 'audit_verified_payments',
    runId: auditRunId,
    trigger,
  });

  const dispatchEvent = (event: any) => {
    if (options.onEvent && auditRunId) {
      try {
        options.onEvent({
          auditRunId,
          timestamp: new Date().toISOString(),
          ...event,
        });
      } catch (err) {
        console.error('[auditVerifiedPaymentIntegrity] onEvent dispatch error:', err);
      }
    }
  };

  // 1. Fetch durable checkpoint
  let checkpoint = await prisma.paymentIntegrityAuditCheckpoint.findUnique({
    where: { service: 'customer_payment_integrity_audit' },
  });

  const checkpointModifiedTime = options.forceFullAudit ? null : checkpoint?.lastAuditedModifiedTime || null;

  dispatchEvent({
    type: 'AUDIT_STARTED',
    startedAt: auditStartTime.toISOString(),
    startDate: dateStartStr,
    endDate: dateEndStr,
    checkpointTimestamp: checkpointModifiedTime,
    pageSize: 200,
  });

  const token = await getZohoTokens();
  const orgId = getZohoOrgId();

  if (!token || !orgId) {
    const errMsg = 'Zoho Books credentials or organization ID not configured.';
    dispatchEvent({
      type: 'AUDIT_FAILED',
      stage: 'AUTH_INITIALIZATION',
      error: errMsg,
    });
    return {
      success: false,
      auditedCount: 0,
      invalidatedCount: 0,
      baselinesCreated: 0,
      summary: {
        paymentsEvaluated: 0,
        verifiedAudited: 0,
        intactCount: 0,
        invalidatedCount: 0,
        baselinesCreated: 0,
        unverifiedSkipped: 0,
        listApiCalls: 0,
        updateApiCalls: 0,
        totalApiCalls: 0,
        checkpointTimestamp: checkpointModifiedTime,
        newCheckpointTimestamp: checkpointModifiedTime,
        totalDurationMs: 0,
      },
      errors: [errMsg],
    };
  }

  let page = 1;
  let hasMorePage = true;
  let listApiCalls = 0;
  let updateApiCalls = 0;
  let paymentsEvaluated = 0;
  let verifiedAudited = 0;
  let intactCount = 0;
  let invalidatedCount = 0;
  let baselinesCreated = 0;
  let unverifiedSkipped = 0;

  let latestZohoModifiedTimeSeen: string | null = null;
  let shouldStopPagination = false;

  const emitProgress = (operation: string) => {
    dispatchEvent({
      type: 'AUDIT_PROGRESS',
      paymentsEvaluated,
      verifiedAudited,
      intactCount,
      invalidatedCount,
      baselinesCreated,
      unverifiedSkipped,
      listApiCalls,
      updateApiCalls,
      currentOperation: operation,
    });
  };

  emitProgress('Fetching customer payments sorted by last_modified_time descending...');

  try {
    while (hasMorePage && !shouldStopPagination) {
      listApiCalls++;
      const listReqStart = Date.now();
      let listStatus = 0;
      let listJson: any = null;

      const url = `${API_BASE_URL}/books/v3/customerpayments?organization_id=${orgId}&date_start=${dateStartStr}&date_end=${dateEndStr}&page=${page}&per_page=200&sort_column=last_modified_time&sort_order=D`;

      try {
        const res = await fetch(url, {
          headers: { Authorization: `Zoho-oauthtoken ${token}` },
        });
        listStatus = res.status;
        listJson = await res.json();
      } catch (fetchErr: any) {
        await logZohoApiCall({
          endpointType: ZohoApiEndpointType.PAYMENT_LIST,
          method: 'GET',
          success: false,
          httpStatus: listStatus || 500,
        });
        throw new Error(`Zoho API network error on page ${page}: ${fetchErr.message}`);
      }

      const listReqDuration = Date.now() - listReqStart;
      const isListSuccess = listStatus === 200 && listJson?.code === 0;

      await logZohoApiCall({
        endpointType: ZohoApiEndpointType.PAYMENT_LIST,
        method: 'GET',
        success: isListSuccess,
        httpStatus: listStatus,
      });

      if (!isListSuccess) {
        throw new Error(`Zoho API error: ${listJson?.message || `HTTP ${listStatus}`}`);
      }

      const customerPayments: any[] = Array.isArray(listJson.customerpayments)
        ? listJson.customerpayments
        : [];
      const pageInfo = listJson.page_context || {};
      hasMorePage = Boolean(pageInfo.has_more_page);

      dispatchEvent({
        type: 'AUDIT_PAGE_FETCHED',
        page,
        recordsReturned: customerPayments.length,
        hasMorePage,
        httpStatus: listStatus,
        zohoCode: listJson.code ?? 0,
        durationMs: listReqDuration,
      });

      // Track newest last_modified_time from the very first payment returned
      if (page === 1 && customerPayments.length > 0) {
        latestZohoModifiedTimeSeen = normalizeZohoTimestamp(customerPayments[0].last_modified_time);
      }

      for (const p of customerPayments) {
        paymentsEvaluated++;
        const zohoPaymentId = String(p.payment_id);
        const paymentNumber = p.payment_number || zohoPaymentId;
        const currentZohoModified = normalizeZohoTimestamp(p.last_modified_time);

        // Checkpoint boundary check:
        // If checkpoint exists and current record's last_modified_time is strictly older than checkpoint
        // (with safe 15-minute overlap window), stop processing further older records.
        if (checkpointModifiedTime && currentZohoModified) {
          const checkpointTimeMs = new Date(checkpointModifiedTime).getTime() - (15 * 60 * 1000);
          const currentRecordTimeMs = new Date(currentZohoModified).getTime();
          if (currentRecordTimeMs < checkpointTimeMs) {
            console.log(`[IntegrityAudit] Checkpoint boundary reached at ${paymentNumber} (${currentZohoModified} < ${new Date(checkpointTimeMs).toISOString()}). Stopping older scan.`);
            shouldStopPagination = true;
            break;
          }
        }

        // Look up local database record
        const local = await prisma.customerPayment.findUnique({
          where: { zohoPaymentId },
        });

        if (!local) {
          // Payment not in local DB, nothing to invalidate
          unverifiedSkipped++;
          continue;
        }

        // If local payment is not verified, it doesn't need integrity check
        if (
          !local.isVerified &&
          local.verificationStatus !== CustomerPaymentVerificationStatus.VERIFIED
        ) {
          unverifiedSkipped++;
          continue;
        }

        verifiedAudited++;

        // Baseline handling: If local record is verified but has no verified snapshot fields yet
        if (!local.verifiedAmount || !local.verifiedDate) {
          // Establish 6-field baseline using current verified values
          const baseCustomerName = local.verifiedCustomerName || local.customerName || p.customer_name || null;
          const baseCustomerId = local.verifiedCustomerId || local.customerId || String(p.customer_id || '') || null;
          const baseAmount = local.verifiedAmount || local.amount;
          const baseBankCharges = local.verifiedBankCharges ?? local.bankCharges ?? (p.bank_charges != null ? Number(p.bank_charges) : 0);
          const baseDate = local.verifiedDate || local.paymentDate;
          const basePaymentMode = local.verifiedPaymentMode || local.paymentMode || p.payment_mode || null;
          const baseAccountId = local.verifiedAccountId || local.accountId || String(p.account_id || '') || null;
          const baseAccountName = local.verifiedAccountName || local.accountName || p.account_name || null;

          await prisma.customerPayment.update({
            where: { zohoPaymentId },
            data: {
              verifiedCustomerName: baseCustomerName,
              verifiedCustomerId: baseCustomerId,
              verifiedAmount: baseAmount,
              verifiedBankCharges: baseBankCharges,
              verifiedDate: baseDate,
              verifiedPaymentMode: basePaymentMode,
              verifiedAccountId: baseAccountId,
              verifiedAccountName: baseAccountName,
              lastVerifiedZohoModifiedTime: currentZohoModified || local.lastZohoModifiedTime,
            },
          });
          baselinesCreated++;
          dispatchEvent({
            type: 'AUDIT_PAYMENT_EVALUATED',
            paymentId: zohoPaymentId,
            paymentNumber,
            action: 'BASELINE_CREATED',
            details: `Established 6-field baseline snapshot (Customer: ${baseCustomerName}, Amount: ${baseAmount}, Charges: ${baseBankCharges}, Date: ${formatDateToYmd(baseDate)}, Mode: ${basePaymentMode}, Account: ${baseAccountName})`,
            fieldMatchResults: {
              customerName: true,
              amount: true,
              bankCharges: true,
              paymentDate: true,
              paymentMode: true,
              depositTo: true,
            },
          });
          continue;
        }

        // 6-Field Integrity Evaluation: Compare Zoho current values against local snapshot
        const evaluation = evaluatePaymentIntegrity({
          snapshot: {
            customerName: local.verifiedCustomerName || local.customerName,
            customerId: local.verifiedCustomerId || local.customerId,
            amount: local.verifiedAmount,
            bankCharges: local.verifiedBankCharges ?? local.bankCharges ?? 0,
            paymentDate: local.verifiedDate,
            paymentMode: local.verifiedPaymentMode || local.paymentMode,
            accountId: local.verifiedAccountId || local.accountId,
            accountName: local.verifiedAccountName || local.accountName,
          },
          current: {
            customerName: p.customer_name,
            customerId: p.customer_id ? String(p.customer_id) : null,
            amount: p.amount,
            bankCharges: p.bank_charges ?? 0,
            paymentDate: p.date,
            paymentMode: p.payment_mode,
            accountId: p.account_id ? String(p.account_id) : null,
            accountName: p.account_name,
          },
        });

        const fieldMatchResults = {
          customerName: evaluation.customerNameMatch,
          amount: evaluation.amountReceivedMatch,
          bankCharges: evaluation.bankChargesMatch,
          paymentDate: evaluation.paymentDateMatch,
          paymentMode: evaluation.paymentModeMatch,
          depositTo: evaluation.depositToMatch,
        };

        if (evaluation.overallIntegrityStatus === 'PASS') {
          intactCount++;
          dispatchEvent({
            type: 'AUDIT_PAYMENT_EVALUATED',
            paymentId: zohoPaymentId,
            paymentNumber,
            action: 'VERIFIED_INTACT',
            details: `All 6 fields intact (Customer, Amount, Bank Charges, Date, Mode, Account)`,
            fieldMatchResults,
          });
        } else {
          // DISCREPANCY DETECTED: INVALIDATE VERIFICATION
          invalidatedCount++;
          const invalidationReason = evaluation.reasons.join('; ');
          const nowTs = new Date();

          console.warn(`[IntegrityAudit] INVALIDATING ${paymentNumber} (${zohoPaymentId}): ${invalidationReason}`);

          // Invalidate local state immediately
          await prisma.customerPayment.update({
            where: { zohoPaymentId },
            data: {
              isVerified: false,
              verificationStatus: CustomerPaymentVerificationStatus.REVERIFICATION_REQUIRED,
              requiresManualVerification: true,
              verificationInvalidatedAt: nowTs,
              verificationInvalidationReason: invalidationReason,
              customerName: p.customer_name || local.customerName,
              customerId: p.customer_id ? String(p.customer_id) : local.customerId,
              amount: new Prisma.Decimal(p.amount ?? local.amount),
              bankCharges: new Prisma.Decimal(p.bank_charges ?? 0),
              paymentDate: new Date(p.date || local.paymentDate),
              paymentMode: p.payment_mode || local.paymentMode,
              accountId: p.account_id ? String(p.account_id) : local.accountId,
              accountName: p.account_name || local.accountName,
              lastZohoModifiedTime: currentZohoModified || local.lastZohoModifiedTime,
            },
          });

          // Write audit log
          try {
            await prisma.auditLog.create({
              data: {
                userId: 'SYSTEM',
                action: 'CUSTOMER_PAYMENT_VERIFICATION_INVALIDATED',
                details: `Verification invalidated for ${paymentNumber} (${zohoPaymentId}): ${invalidationReason}. Manual re-verification required.`,
              },
            });
          } catch (logErr) {
            console.error('[IntegrityAudit] Failed to create auditLog:', logErr);
          }

          // Check if Zoho Books currently marks cf_is_verified = true
          // If true and writes are permitted, send exactly ONE PUT to clear cf_is_verified in Zoho
          const rawCf = p.cf_is_verified;
          const isZohoReportedVerified = rawCf === true || rawCf === 'true';
          let zohoPutSuccess = false;

          if (isZohoReportedVerified) {
            const writesAllowed = canPerformZohoVerificationWrite(options.allowZohoWrites);
            if (writesAllowed) {
              updateApiCalls++;
              const putUrl = `${API_BASE_URL}/books/v3/customerpayment/${zohoPaymentId}/customfields?organization_id=${orgId}`;
              try {
                const putRes = await fetch(putUrl, {
                  method: 'PUT',
                  headers: {
                    Authorization: `Zoho-oauthtoken ${token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    custom_fields: [
                      {
                        customfield_id: ZOHO_IS_VERIFIED_CF_ID,
                        value: 'false',
                      },
                    ],
                  }),
                });

                const putData = await putRes.json().catch(() => ({}));
                zohoPutSuccess = putRes.ok && putData.code === 0;

                await logZohoApiCall({
                  endpointType: ZohoApiEndpointType.PAYMENT_UPDATE,
                  method: 'PUT',
                  success: zohoPutSuccess,
                  httpStatus: putRes.status,
                });

                if (!zohoPutSuccess) {
                  errors.push(`Failed to reset cf_is_verified in Zoho for ${paymentNumber}: ${putData.message || putRes.statusText}`);
                }
              } catch (putErr: any) {
                await logZohoApiCall({
                  endpointType: ZohoApiEndpointType.PAYMENT_UPDATE,
                  method: 'PUT',
                  success: false,
                  httpStatus: 500,
                });
                errors.push(`Error calling Zoho PUT for ${paymentNumber}: ${putErr.message}`);
              }
            } else {
              console.log(`[IntegrityAudit] Zoho write skipped for ${paymentNumber} (allowZohoWrites disabled or outside dev)`);
            }
          }

          dispatchEvent({
            type: 'AUDIT_PAYMENT_INVALIDATED',
            paymentId: zohoPaymentId,
            paymentNumber,
            reason: invalidationReason,
            mismatchedFields: evaluation.mismatchedFields,
            fieldMatchResults,
            expectedAmount: local.verifiedAmount?.toString(),
            actualAmount: p.amount,
            expectedDate: formatDateToYmd(local.verifiedDate || local.paymentDate),
            actualDate: p.date,
            zohoPutSuccess,
          });
        }
      }

      emitProgress(`Evaluated ${paymentsEvaluated} payments (page ${page})...`);
      page++;
    }

    // Update durable checkpoint if we saw a new latest timestamp
    if (latestZohoModifiedTimeSeen) {
      await prisma.paymentIntegrityAuditCheckpoint.upsert({
        where: { service: 'customer_payment_integrity_audit' },
        update: {
          lastAuditedModifiedTime: latestZohoModifiedTimeSeen,
          lastAuditedAt: auditStartTime,
        },
        create: {
          service: 'customer_payment_integrity_audit',
          lastAuditedModifiedTime: latestZohoModifiedTimeSeen,
          lastAuditedAt: auditStartTime,
        },
      });
    }

    const auditEndTime = new Date();
    const totalDurationMs = auditEndTime.getTime() - auditStartTime.getTime();

    const finalSummary: AuditFinalSummary = {
      paymentsEvaluated,
      verifiedAudited,
      intactCount,
      invalidatedCount,
      baselinesCreated,
      unverifiedSkipped,
      listApiCalls,
      updateApiCalls,
      totalApiCalls: listApiCalls + updateApiCalls,
      checkpointTimestamp: checkpointModifiedTime,
      newCheckpointTimestamp: latestZohoModifiedTimeSeen || checkpointModifiedTime,
      totalDurationMs,
    };

    dispatchEvent({
      type: 'AUDIT_COMPLETED',
      startedAt: auditStartTime.toISOString(),
      completedAt: auditEndTime.toISOString(),
      durationMs: totalDurationMs,
      finalSummary,
    });

    await recordOperationComplete({
      operationKey: 'audit_verified_payments',
      runId: auditRunId,
      trigger,
      success: errors.length === 0,
      recordsProcessed: paymentsEvaluated,
      error: errors.length > 0 ? errors.join('; ') : null,
    });

    return {
      success: errors.length === 0,
      auditedCount: verifiedAudited,
      invalidatedCount,
      baselinesCreated,
      summary: finalSummary,
      errors,
    };
  } catch (err: any) {
    console.error('[IntegrityAudit] Audit run failed:', err);
    dispatchEvent({
      type: 'AUDIT_FAILED',
      stage: 'AUDIT_EXECUTION',
      error: err.message || 'Audit execution failed',
    });

    await recordOperationComplete({
      operationKey: 'audit_verified_payments',
      runId: auditRunId,
      trigger,
      success: false,
      recordsProcessed: paymentsEvaluated,
      error: err.message || 'Audit execution failed',
    });

    return {
      success: false,
      auditedCount: verifiedAudited,
      invalidatedCount,
      baselinesCreated,
      summary: {
        paymentsEvaluated,
        verifiedAudited,
        intactCount,
        invalidatedCount,
        baselinesCreated,
        unverifiedSkipped,
        listApiCalls,
        updateApiCalls,
        totalApiCalls: listApiCalls + updateApiCalls,
        checkpointTimestamp: checkpointModifiedTime,
        newCheckpointTimestamp: latestZohoModifiedTimeSeen || checkpointModifiedTime,
        totalDurationMs: Date.now() - auditStartTime.getTime(),
      },
      errors: [err.message || 'Unknown error during integrity audit'],
    };
  }
}

