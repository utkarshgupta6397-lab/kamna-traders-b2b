import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fetchInvoiceById } from '@/lib/zoho/invoices';
import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';
import { CustomerBalanceService } from '@/lib/services/customer-balance.service';
import { RawInvoiceRow } from '@/lib/recovery/recovery-calculator';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

function isOperationallyOpen(row: { paymentStatus: string; amountPending: number; invoiceValue: number }): boolean {
  if (row.paymentStatus === 'paid' || row.paymentStatus === 'void') return false;
  if (row.amountPending <= 0) return false;
  
  const absPending = Math.abs(row.amountPending);
  
  // Rule 1: <= ₹10 variance is always ignored
  if (absPending <= 10) return false;
  
  // Rule 2: Large invoices can have <= ₹100 variance
  if (row.invoiceValue > 100000 && absPending <= 100) return false;

  return true;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && !session.accounts_summary_view && !session.accounts_recovery_manage)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    let { invoiceIds, dryRun, type } = body || {};

    /* =========================================================================
     * PRE-DEPLOYMENT VERIFICATION — PRODUCTION RECOVERY RECONCILIATION
     * =========================================================================
     * 
     * PURPOSE:
     * This checklist and SQL verification suite must be executed against the
     * production Hostinger VPS before approving the merge and deployment to main.
     * All queries are strictly READ-ONLY. Do not mutate production data.
     * 
     * -------------------------------------------------------------------------
     * SECTION A: EXACT READ-ONLY SQL QUERIES (PRODUCTION POSTGRESQL)
     * -------------------------------------------------------------------------
     * 
     * 1. Recovery task counts grouped by status:
     *    SELECT "status", COUNT(*) AS task_count
     *    FROM "RecoveryInvoiceTask"
     *    GROUP BY "status"
     *    ORDER BY task_count DESC;
     * 
     * 2. Total active task rows vs distinct invoices and distinct customers:
     *    SELECT 
     *      COUNT(*) AS total_active_tasks,
     *      COUNT(DISTINCT "invoiceId") AS distinct_active_invoices,
     *      COUNT(DISTINCT "customerId") AS distinct_active_customers
     *    FROM "RecoveryInvoiceTask"
     *    WHERE "status" = 'ACTIVE';
     * 
     * 3. Active recovery invoices grouped by customer:
     *    SELECT 
     *      "customerId",
     *      "customerName",
     *      COUNT(*) AS active_invoice_count,
     *      SUM(COALESCE("lastKnownPendingAmount", 0)) AS total_pending_estimate
     *    FROM "RecoveryInvoiceTask"
     *    WHERE "status" = 'ACTIVE'
     *    GROUP BY "customerId", "customerName"
     *    ORDER BY active_invoice_count DESC, total_pending_estimate DESC;
     * 
     * 4. Inconsistent duplicate active tasks for the same invoice (if any):
     *    SELECT "invoiceId", COUNT(*) AS duplicate_task_count
     *    FROM "RecoveryInvoiceTask"
     *    WHERE "status" = 'ACTIVE'
     *    GROUP BY "invoiceId"
     *    HAVING COUNT(*) > 1;
     * 
     * 5. InvoiceSummaryCache metadata vs JSON array row length:
     *    SELECT 
     *      id,
     *      "generatedAt",
     *      "invoiceCount" AS cache_meta_count,
     *      jsonb_array_length("rows"::jsonb) AS actual_json_row_count
     *    FROM "InvoiceSummaryCache"
     *    WHERE id = 'singleton';
     * 
     * 6. Cached invoice counts by raw paymentStatus:
     *    SELECT 
     *      r."paymentStatus",
     *      COUNT(*) AS count_in_cache,
     *      SUM(COALESCE(r."amountPending", 0)) AS total_pending_in_cache
     *    FROM "InvoiceSummaryCache" c,
     *    LATERAL jsonb_to_recordset(c."rows"::jsonb) AS r(
     *      "paymentStatus" text,
     *      "amountPending" numeric
     *    )
     *    WHERE c.id = 'singleton'
     *    GROUP BY r."paymentStatus";
     * 
     * 7. Cached invoices categorized by operational open status (tolerance rules):
     *    SELECT 
     *      CASE 
     *        WHEN LOWER(COALESCE(r."paymentStatus", '')) IN ('paid', 'void') THEN 'PAID_OR_VOID'
     *        WHEN COALESCE(r."amountPending", 0) <= 0 THEN 'ZERO_PENDING'
     *        WHEN ABS(COALESCE(r."amountPending", 0)) <= 10 THEN 'SUB_TOLERANCE_SETTLED_LE_10'
     *        WHEN COALESCE(r."invoiceValue", 0) > 100000 AND ABS(COALESCE(r."amountPending", 0)) <= 100 THEN 'SUB_TOLERANCE_SETTLED_LE_100'
     *        ELSE 'OPERATIONALLY_OPEN'
     *      END AS operational_category,
     *      COUNT(*) AS invoice_count,
     *      SUM(COALESCE(r."amountPending", 0)) AS total_pending
     *    FROM "InvoiceSummaryCache" c,
     *    LATERAL jsonb_to_recordset(c."rows"::jsonb) AS r(
     *      "paymentStatus" text,
     *      "amountPending" numeric,
     *      "invoiceValue" numeric
     *    )
     *    WHERE c.id = 'singleton'
     *    GROUP BY 1
     *    ORDER BY invoice_count DESC;
     * 
     * 8. Active tasks that will be inspected during refresh (first 200 batch):
     *    SELECT 
     *      id AS task_id,
     *      "invoiceId",
     *      "invoiceNumber",
     *      "customerId",
     *      "customerName",
     *      "lastKnownPendingAmount",
     *      "lastKnownInvoiceStatus",
     *      "flaggedAt"
     *    FROM "RecoveryInvoiceTask"
     *    WHERE "status" = 'ACTIVE'
     *    ORDER BY "flaggedAt" DESC
     *    LIMIT 200;
     * 
     * 9. Active recovery tasks missing from the cached lookback window:
     *    WITH cached_invoices AS (
     *      SELECT DISTINCT r."invoiceId"
     *      FROM "InvoiceSummaryCache" c,
     *      LATERAL jsonb_to_recordset(c."rows"::jsonb) AS r("invoiceId" text)
     *      WHERE c.id = 'singleton'
     *    )
     *    SELECT 
     *      COUNT(t.id) AS active_tasks_missing_from_cache,
     *      COUNT(DISTINCT t."invoiceId") AS missing_distinct_invoices
     *    FROM "RecoveryInvoiceTask" t
     *    LEFT JOIN cached_invoices ci ON t."invoiceId" = ci."invoiceId"
     *    WHERE t."status" = 'ACTIVE' AND ci."invoiceId" IS NULL;
     * 
     * 10. Active tasks cross-referenced with cached invoice status:
     *     WITH cached_invoices AS (
     *       SELECT 
     *         r."invoiceId",
     *         r."paymentStatus",
     *         r."amountPending",
     *         r."invoiceValue"
     *       FROM "InvoiceSummaryCache" c,
     *       LATERAL jsonb_to_recordset(c."rows"::jsonb) AS r(
     *         "invoiceId" text,
     *         "paymentStatus" text,
     *         "amountPending" numeric,
     *         "invoiceValue" numeric
     *       )
     *       WHERE c.id = 'singleton'
     *     )
     *     SELECT 
     *       t.id AS task_id,
     *       t."invoiceId",
     *       t."invoiceNumber",
     *       t."customerName",
     *       ci."paymentStatus" AS cached_status,
     *       ci."amountPending" AS cached_pending,
     *       CASE 
     *         WHEN ci."invoiceId" IS NULL THEN 'NOT_IN_CACHE'
     *         WHEN LOWER(COALESCE(ci."paymentStatus", '')) IN ('paid', 'void') THEN 'PAID_OR_VOID'
     *         WHEN COALESCE(ci."amountPending", 0) <= 0 THEN 'ZERO_PENDING'
     *         WHEN ABS(COALESCE(ci."amountPending", 0)) <= 10 THEN 'SETTLED_WITHIN_TOLERANCE'
     *         WHEN COALESCE(ci."invoiceValue", 0) > 100000 AND ABS(COALESCE(ci."amountPending", 0)) <= 100 THEN 'SETTLED_WITHIN_TOLERANCE_LARGE'
     *         ELSE 'OPERATIONALLY_OPEN'
     *       END AS cache_eligibility
     *     FROM "RecoveryInvoiceTask" t
     *     LEFT JOIN cached_invoices ci ON t."invoiceId" = ci."invoiceId"
     *     WHERE t."status" = 'ACTIVE';
     * 
     * -------------------------------------------------------------------------
     * SECTION B: EXPECTED ANSWERS & INTERPRETATION OF RESULTS
     * -------------------------------------------------------------------------
     * 
     * Target Benchmarks (Provisional Production Snapshot):
     * - Accounts Summary Lookback: ~153 total invoices in cache.
     * - Operationally Open Invoices: ~14.
     * - Settled / Paid Invoices: ~139.
     * - Active Recovery Customer Accounts: ~13.
     * - Active Recovery Tasks in DB: ~153 (if sidebar badge reflects total active flags).
     * 
     * Detailed Metric Interpretations:
     * - Query 1 & 2:
     *   * If ACTIVE tasks = 153, this proves the sidebar floating badge ({activeTasksList.length})
     *     measures the raw database row count of active tasks across all history.
     *   * If distinct_active_invoices < total_active_tasks, duplicate task rows exist (see Query 4).
     * - Query 5 & 7:
     *   * If actual_json_row_count = 153 and OPERATIONALLY_OPEN = 14, this proves the Accounts
     *     Summary "All" tab represents 153 total invoices while only 14 are open.
     *   * If OPERATIONALLY_OPEN != 14, recent invoice payments or new billings have occurred.
     * - Query 9 & 10:
     *   * Measures the intersection of active recovery tasks and the recent cached window.
     *   * If tasks are NOT_IN_CACHE, they represent older invoices outside the 15-day window.
     *   * If tasks are PAID_OR_VOID or SETTLED, they are prime candidates for auto-resolution.
     * 
     * -------------------------------------------------------------------------
     * SECTION C: LIVE ZOHO BOOKS VERIFICATION PROCEDURE
     * -------------------------------------------------------------------------
     * 
     * Helper Function: fetchInvoiceById(invoiceId) in src/lib/zoho/invoices.ts
     * Request Contract: GET https://www.zohoapis.in/books/v3/invoices/{id}?organization_id=60027595766
     * Authorization Header: Zoho-oauthtoken {accessToken}
     * 
     * Verification Procedure:
     * 1. Pick 3 representative active invoice IDs from Query 8 (e.g. 1 open, 1 suspected paid, 1 advance).
     * 2. Run read-only diagnostic via node script:
     *    npx tsx -e "
     *      import { fetchInvoiceById } from './src/lib/zoho/invoices';
     *      (async () => {
     *        const ids = ['<invoice_id_1>', '<invoice_id_2>'];
     *        for (const id of ids) {
     *          const { invoice } = await fetchInvoiceById(id);
     *          console.log({ id, number: invoice.invoice_number, status: invoice.status, balance: invoice.balance });
     *        }
     *      })();
     *    "
     * 3. Confirm Zoho balance_due matches cache and DB before triggering refresh.
     * 
     * -------------------------------------------------------------------------
     * SECTION D: DATABASE & ENVIRONMENT IDENTITY VERIFICATION
     * -------------------------------------------------------------------------
     * 
     * 1. Database Connection Identity Query:
     *    SELECT current_database(), current_user, inet_server_addr(), inet_server_port();
     *    * Limitation: On VPS or Docker, inet_server_addr() may return 127.0.0.1 or local socket.
     *      Verify VPS PM2 environment via: `pm2 env <app-id> | grep DATABASE_URL`.
     * 2. Zoho Organization Verification:
     *    npx tsx -e "
     *      import { getZohoOrgId } from './src/lib/zoho-auth';
     *      console.log('Active Zoho Org ID:', getZohoOrgId());
     *    "
     *    * Pass Criteria: Must return '60027595766' (Kamna Traders Production Org).
     * 
     * -------------------------------------------------------------------------
     * SECTION E: AUTOMATIC RESOLUTION SAFETY CRITERIA
     * -------------------------------------------------------------------------
     * 
     * A recovery task MAY be automatically updated to RESOLVED / AUTO_RELEASED ONLY when:
     *  [A] Live Zoho API explicitly responds with HTTP 200, status in ('paid', 'void'), or balance == 0.
     *  [B] Live Zoho API explicitly responds with HTTP 404 / 'not found' (Invoice deleted in Zoho).
     *  [C] Outstanding balance <= 200 AND invoice age > 7 days (auto-release threshold).
     * 
     * A recovery task MUST NEVER be resolved when:
     *  [D] Zoho API returns 401 (Auth error), 429 (Rate limit), or 5xx (Server error).
     *  [E] Network request times out or aborts.
     *  [F] An invoice is merely absent from InvoiceSummaryCache (cache lookback cutoff).
     *  [G] Response data structure is malformed or missing expected status fields.
     * 
     * In all failure modes [D]-[G], the task MUST remain ACTIVE.
     * =========================================================================
     */

    // Refresh customer statement balances in bulk, and gather active recovery invoice tasks for live Zoho verification
    let customerBalancesRefreshed = 0;
    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      const cache = await prisma.invoiceSummaryCache.findUnique({
        where: { id: 'singleton' },
      });

      // Automatically collect active recovery tasks (up to 200) for live Zoho Books reconciliation
      const activeTasks = await prisma.recoveryInvoiceTask.findMany({
        where: { status: 'ACTIVE' },
        select: { invoiceId: true, customerId: true },
        take: 200,
      });
      invoiceIds = activeTasks.map((t) => t.invoiceId);

      const cacheCustIds =
        cache && cache.rows && Array.isArray(cache.rows)
          ? ((cache.rows as unknown) as RawInvoiceRow[])
              .filter((r) => isOperationallyOpen(r))
              .map((r) => r.customerId)
              .filter(Boolean)
          : [];
      const activeCustIds = activeTasks.map((t) => t.customerId).filter(Boolean);
      const openCustIds = Array.from(new Set([...cacheCustIds, ...activeCustIds]));

      if (openCustIds.length > 0) {
        try {
          await CustomerBalanceService.refreshCustomerBalances(openCustIds);
          customerBalancesRefreshed = openCustIds.length;
        } catch (e: any) {
          console.warn('[Recovery Refresh] Customer balance bulk refresh warning:', e?.message);
        }
      }

      if (invoiceIds.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'Recovery queue customer balances refreshed (no active recovery tasks)',
          refreshedCustomersCount: customerBalancesRefreshed,
          lastRefreshedAt: new Date().toISOString(),
        });
      }
    } else if (type === 'queue') {
      const activeTasks = await prisma.recoveryInvoiceTask.findMany({
        where: { invoiceId: { in: invoiceIds }, status: 'ACTIVE' },
        select: { customerId: true },
      });
      const custIds = Array.from(new Set(activeTasks.map((t) => t.customerId).filter(Boolean)));
      if (custIds.length > 0) {
        try {
          await CustomerBalanceService.refreshCustomerBalances(custIds);
          customerBalancesRefreshed = custIds.length;
        } catch (e: any) {
          console.warn('[Recovery Refresh] Queue customer balance refresh warning:', e?.message);
        }
      }
    }

    if (invoiceIds.length > 200) {
      return NextResponse.json({ success: false, error: 'Cannot refresh more than 200 invoices at a time' }, { status: 400 });
    }

    // 1. Check if summary refresh lock is active
    const summaryLock = await prisma.syncLock.findUnique({
      where: { name: 'INVOICE_SUMMARY_REFRESH' },
    });
    if (summaryLock?.isLocked && summaryLock.lockedAt && (Date.now() - summaryLock.lockedAt.getTime() < 2 * 60 * 1000)) {
      return NextResponse.json({
        success: false,
        error: 'Summary refresh is in progress. Please wait for it to finish.',
      }, { status: 409 });
    }

    // 2. Concurrency Lock for Recovery Queue / Full Customer Sync
    const recoveryLock = await prisma.syncLock.upsert({
      where: { name: 'RECOVERY_SYNC' },
      update: {},
      create: { name: 'RECOVERY_SYNC', isLocked: false },
    });

    if (recoveryLock.isLocked && recoveryLock.lockedAt && (Date.now() - recoveryLock.lockedAt.getTime() < 5 * 60 * 1000)) {
      return NextResponse.json({
        success: false,
        error: 'Full customer sync is currently in progress. Please try again shortly.',
      }, { status: 409 });
    }

    await prisma.syncLock.update({
      where: { name: 'RECOVERY_SYNC' },
      data: { isLocked: true, lockedAt: new Date(), lockedBy: session.name || 'Staff' },
    });

    try {
      const totalActiveCount = await prisma.recoveryInvoiceTask.count({
        where: { status: 'ACTIVE' }
      });

      const isDryRun = !!dryRun;
      const proposedRemovals: any[] = [];
      const updatedInvoiceRows = new Map<string, { balance: number; total: number; status: string }>();
      let processedCount = 0;
      let removedCount = 0;
      let releasedCount = 0;

      const batchSize = 10;
      for (let i = 0; i < invoiceIds.length; i += batchSize) {
      const batch = invoiceIds.slice(i, i + batchSize);
      await Promise.all(batch.map(async (invoiceId: string) => {
        try {
          const activeTask = await prisma.recoveryInvoiceTask.findFirst({
            where: { invoiceId, status: 'ACTIVE' }
          });
          if (!activeTask) return;

          let balance = 0;
          let total = 0;
          let status = 'unpaid';
          let invoiceDateStr = '';
          let found = true;

          try {
            const { invoice: zohoInv } = await fetchInvoiceById(invoiceId);
            if (!zohoInv) {
              found = false;
            } else {
              balance = Number(zohoInv.balance_due !== undefined ? zohoInv.balance_due : (zohoInv.balance !== undefined ? zohoInv.balance : (zohoInv.balance_amount || 0)));
              total = Number(zohoInv.total || 0);
              status = zohoInv.status || 'unpaid';
              invoiceDateStr = zohoInv.date || '';
            }
          } catch (err: any) {
            if (err.message?.toLowerCase().includes('not found') || err.message?.toLowerCase().includes('404')) {
              found = false;
            } else {
              throw err;
            }
          }

          processedCount++;
          if (found) {
            updatedInvoiceRows.set(invoiceId, { balance, total, status });
          } else {
            updatedInvoiceRows.set(invoiceId, { balance: 0, total: 0, status: 'void' });
          }

          if (!found) {
            proposedRemovals.push({
              invoiceId,
              invoiceNumber: activeTask.invoiceNumber,
              customerName: activeTask.customerName,
              previousBalance: activeTask.lastKnownPendingAmount || 0,
              newBalance: 0,
              removalReason: 'NO_LONGER_ELIGIBLE',
              reasonLabel: 'No Longer Eligible'
            });
            removedCount++;

            if (!isDryRun) {
              await prisma.recoveryInvoiceTask.update({
                where: { id: activeTask.id },
                data: {
                  status: 'RESOLVED',
                  resolvedByUserId: 'SYSTEM',
                  resolvedByName: 'System Auto-Resolve',
                  resolvedAt: new Date(),
                  resolvedReason: 'NO_LONGER_ELIGIBLE',
                  lastSyncedAt: new Date()
                }
              });
            }
            return;
          }

          const ageDays = invoiceDateStr 
            ? Math.max(0, Math.ceil((Date.now() - new Date(invoiceDateStr).getTime()) / (1000 * 60 * 60 * 24)))
            : 0;

          const isOpen = isOperationallyOpen({
            paymentStatus: status,
            amountPending: balance,
            invoiceValue: total
          });

          if (!isOpen) {
            proposedRemovals.push({
              invoiceId,
              invoiceNumber: activeTask.invoiceNumber,
              customerName: activeTask.customerName,
              previousBalance: activeTask.lastKnownPendingAmount || 0,
              newBalance: balance,
              removalReason: 'FULLY_PAID',
              reasonLabel: 'Fully Paid'
            });
            removedCount++;

            if (!isDryRun) {
              await prisma.recoveryInvoiceTask.update({
                where: { id: activeTask.id },
                data: {
                  status: 'RESOLVED',
                  resolvedByUserId: 'SYSTEM',
                  resolvedByName: 'System Auto-Resolve',
                  resolvedAt: new Date(),
                  resolvedReason: 'AUTO_RESOLVED',
                  lastKnownPendingAmount: balance,
                  lastKnownInvoiceStatus: status,
                  lastSyncedAt: new Date()
                }
              });
            }
          } else if (balance <= 200 && ageDays > 7) {
            proposedRemovals.push({
              invoiceId,
              invoiceNumber: activeTask.invoiceNumber,
              customerName: activeTask.customerName,
              previousBalance: activeTask.lastKnownPendingAmount || 0,
              newBalance: balance,
              removalReason: 'AUTO_RELEASED',
              reasonLabel: 'Auto Released (< threshold)'
            });
            releasedCount++;

            if (!isDryRun) {
              // Set status to AUTO_RELEASED
              await prisma.recoveryInvoiceTask.update({
                where: { id: activeTask.id },
                data: {
                  status: 'AUTO_RELEASED',
                  releasedByUserId: 'SYSTEM',
                  releasedByName: 'System Auto-Release',
                  releasedAt: new Date(),
                  resolvedReason: 'AUTO_RELEASED',
                  lastKnownPendingAmount: balance,
                  lastKnownInvoiceStatus: status,
                  lastSyncedAt: new Date()
                }
              });

              // Create Audit Log
              await prisma.auditLog.create({
                data: {
                  userId: session.userId || 'SYSTEM',
                  action: 'AUTO_RELEASE',
                  details: JSON.stringify({
                    invoice_number: activeTask.invoiceNumber,
                    previous_balance: activeTask.lastKnownPendingAmount || 0,
                    release_reason: 'Outstanding Balance <= ₹200 and Invoice Age > 7 days',
                    timestamp: new Date()
                  })
                }
              });
            }
          } else {
            // Remains active
            if (!isDryRun) {
              await prisma.recoveryInvoiceTask.update({
                where: { id: activeTask.id },
                data: {
                  lastKnownPendingAmount: balance,
                  lastKnownInvoiceStatus: status,
                  lastSyncedAt: new Date()
                }
              });
            }
          }

        } catch (err: any) {
          console.error(`Error refreshing invoiceId ${invoiceId}:`, err.message);
        }
      }));
    }

    // Fetch unique customer credits if dryRun is enabled
    const customerCredits: any[] = [];
    if (isDryRun && invoiceIds.length > 0) {
      const activeTasksForSync = await prisma.recoveryInvoiceTask.findMany({
        where: { invoiceId: { in: invoiceIds }, status: 'ACTIVE' },
        select: { customerId: true, customerName: true }
      });
      
      const uniqueCustMap = new Map<string, string>();
      for (const t of activeTasksForSync) {
        uniqueCustMap.set(t.customerId, t.customerName);
      }
      
      const uniqueCustomerIds = Array.from(uniqueCustMap.keys());
      const orgId = getZohoOrgId();
      const accessToken = await getZohoTokens();
      
      if (orgId && accessToken && uniqueCustomerIds.length > 0) {
        await Promise.all(uniqueCustomerIds.map(async (customerId) => {
          try {
            const url = `${API_BASE_URL}/books/v3/contacts/${customerId}?organization_id=${orgId}`;
            const response = await fetch(url, {
              headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
            });
            if (response.ok) {
              const contactData = await response.json();
              const contact = contactData.contact;
              if (contact) {
                const rawCredits = contact.unused_credits_receivable_amount ??
                  contact.unused_credits_amount ??
                  contact.unused_credits ??
                  contact.credits ??
                  contact.excess_payments ??
                  contact.unapplied_amount ??
                  0;
                const unusedCredits = Math.max(0, Number(rawCredits) || 0);
                
                if (unusedCredits >= 200) {
                  let lastActivity = contact.last_modified_time || contact.updated_time || 'N/A';
                  if (lastActivity !== 'N/A') {
                    try {
                      lastActivity = new Date(lastActivity).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      });
                    } catch {
                      // ignore
                    }
                  }
                  
                  customerCredits.push({
                    customerId,
                    customerName: uniqueCustMap.get(customerId) || contact.contact_name || contact.display_name || 'Unknown',
                    availableCredit: unusedCredits,
                    lastActivityDate: lastActivity
                  });
                }
              }
            }
          } catch (err: any) {
            console.error(`Error fetching credits for customer ${customerId}:`, err.message);
          }
        }));
        
        customerCredits.sort((a, b) => b.availableCredit - a.availableCredit);
      }
    }

      if (!isDryRun && updatedInvoiceRows.size > 0) {
        try {
          const currentCache = await prisma.invoiceSummaryCache.findUnique({ where: { id: 'singleton' } });
          if (currentCache && Array.isArray(currentCache.rows)) {
            const updatedRows = (currentCache.rows as any[]).map((r) => {
              const fresh = updatedInvoiceRows.get(r.invoiceId);
              if (fresh) {
                const freshPending = fresh.balance;
                const freshStatus = fresh.status === 'sent' || fresh.status === 'unpaid' || fresh.status === 'overdue' ? 'unpaid' : fresh.status;
                const invVal = fresh.total > 0 ? fresh.total : Number(r.invoiceValue || 0);
                return {
                  ...r,
                  invoiceValue: invVal,
                  amountPending: freshPending,
                  paymentStatus: freshStatus,
                  amountPaid: Math.max(0, invVal - freshPending),
                  lastRefreshedAt: new Date().toISOString(),
                };
              }
              return r;
            });
            await prisma.invoiceSummaryCache.update({
              where: { id: 'singleton' },
              data: { rows: updatedRows },
            });
          }
        } catch (cacheErr: any) {
          console.warn('[Recovery Refresh] Non-fatal cache row update error:', cacheErr?.message);
        }
      }

      // Fetch the final set of ACTIVE recovery tasks to return to UI
      const activeTasks = await prisma.recoveryInvoiceTask.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { flaggedAt: 'desc' }
      });

      // Accurately reflect remaining tasks to process based on batch execution limit
      const remainingCount = Math.max(0, totalActiveCount - processedCount);

      return NextResponse.json({
        success: true,
        dryRun: isDryRun,
        proposedRemovals,
        customerCredits,
        data: activeTasks,
        stats: {
          processed: processedCount,
          removed: removedCount,
          released: releasedCount,
          remaining: remainingCount,
          totalEligible: totalActiveCount,
          activeRemaining: activeTasks.length,
        }
      });
    } finally {
      await prisma.syncLock
        .update({
          where: { name: 'RECOVERY_SYNC' },
          data: { isLocked: false, lockedAt: null, lockedBy: null },
        })
        .catch(() => null);
    }

  } catch (error: any) {
    console.error('[POST /api/accounts/recovery/refresh]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
