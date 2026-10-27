import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  isOperationallyOpen,
  getInvoiceOverdueDays,
  getAgingBucket,
  AgingBucketKey,
  RawInvoiceRow,
  computeCustomerNetOutstanding,
} from '@/lib/recovery/recovery-calculator';
import { CustomerBalanceService } from '@/lib/services/customer-balance.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    const hasAccess =
      session &&
      (session.role === 'ADMIN' ||
        session.accounts_summary_view ||
        session.accounts_recovery_manage ||
        (session.mobile_accounts && session.mobile_accounts_summary_view));

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Requires Accounts Access' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const salespersonFilter = (searchParams.get('salesperson') || '').trim();
    const agingFilter = (searchParams.get('aging') || '').trim() as AgingBucketKey | '';
    
    // Total Outstanding numeric range filter (min <= max, non-negative, empty != 0)
    const rawMin = searchParams.get('minAmount');
    const rawMax = searchParams.get('maxAmount');
    const minAmount = rawMin !== null && rawMin.trim() !== '' ? Math.max(0, parseFloat(rawMin)) : null;
    const maxAmount = rawMax !== null && rawMax.trim() !== '' ? Math.max(0, parseFloat(rawMax)) : null;
    const dueFrom = searchParams.get('dueFrom') || null;
    const dueTo = searchParams.get('dueTo') || null;

    const sortBy = (searchParams.get('sortBy') || 'outstanding').trim();
    const sortOrder = (searchParams.get('sortOrder') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(5, parseInt(searchParams.get('pageSize') || '25', 10)));

    // 1. Load cached invoice snapshot, persistent recovery records, customer metadata & active recovery tasks in parallel
    const [cache, recoveryRecords, dbCustomers, activeTasks] = await Promise.all([
      prisma.invoiceSummaryCache.findUnique({
        where: { id: 'singleton' },
      }),
      prisma.customerRecoveryRecord.findMany(),
      prisma.customer.findMany({
        select: {
          id: true,
          name: true,
          gstNumber: true,
          netOutstandingBalance: true,
        },
      }),
      prisma.recoveryInvoiceTask.findMany({
        where: { status: 'ACTIVE' },
      }),
    ]);

    const recoveryRecordMap = new Map(recoveryRecords.map((r) => [r.customerId, r]));
    const dbCustomerMap = new Map(dbCustomers.map((c) => [c.id, c]));
    const activeTaskMap = new Map(activeTasks.map((t) => [t.invoiceId, t]));

    // Resilient data source: If cache is empty or has no rows, gracefully synthesize rows from active recovery tasks
    // (exact parity with AccountsSummaryView sidebar fallback behavior)
    const hasCacheRows = Boolean(cache?.rows && Array.isArray(cache.rows) && cache.rows.length > 0);
    const rows: RawInvoiceRow[] = hasCacheRows
      ? ((cache!.rows as unknown) as RawInvoiceRow[])
      : activeTasks.map((t) => ({
          invoiceId: t.invoiceId,
          invoiceNumber: t.invoiceNumber,
          invoiceDate: t.flaggedAt.toISOString().slice(0, 10),
          dueDate: null,
          customerId: t.customerId,
          customerName: t.customerName,
          customerGst: dbCustomerMap.get(t.customerId)?.gstNumber || null,
          salespersonName: null,
          invoiceValue: t.lastKnownPendingAmount || 0,
          amountPaid: 0,
          amountPending: t.lastKnownPendingAmount || 0,
          paymentStatus: t.lastKnownInvoiceStatus || 'unpaid',
        }));

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          customers: [],
          kpis: {
            totalOutstanding: 0,
            totalOverdue: 0,
            totalCustomers: 0,
            totalInvoices: 0,
            agingSummary: {
              '0-30': { amount: 0, count: 0 },
              '31-60': { amount: 0, count: 0 },
              '61-90': { amount: 0, count: 0 },
              '90+': { amount: 0, count: 0 },
            },
            oldestOverdue: null,
            lastRefreshedAt: cache?.generatedAt?.toISOString() || null,
          },
          pagination: {
            currentPage: 1,
            pageSize,
            totalCount: 0,
            totalPages: 0,
          },
          salespersons: [],
        },
      });
    }

    const now = new Date();

    const releaseAllowed = Boolean(
      session &&
        (session.role === 'ADMIN' ||
          (session as any).release_statement_queue ||
          session.accounts_recovery_manage)
    );

    // 3. Filter open invoices using the authoritative isOperationallyOpen rule
    // (excludes void, paid, and sub-tolerance variances)
    const openInvoices = rows.filter((r) => isOperationallyOpen(r));

    // Auto-heal / fetch missing customer balances to ensure 100% statement closing balance parity
    const missingBalanceCustIds = Array.from(
      new Set(
        openInvoices
          .map((r) => r.customerId)
          .filter((id) => Boolean(id) && dbCustomerMap.get(id)?.netOutstandingBalance == null)
      )
    );

    if (missingBalanceCustIds.length > 0) {
      try {
        const refreshed = await CustomerBalanceService.refreshCustomerBalances(missingBalanceCustIds);
        for (const [cid, b] of Object.entries(refreshed)) {
          const existing = dbCustomerMap.get(cid);
          if (existing) {
            existing.netOutstandingBalance = b.netOutstandingBalance;
          } else {
            dbCustomerMap.set(cid, {
              id: cid,
              name: '',
              gstNumber: null,
              netOutstandingBalance: b.netOutstandingBalance,
            });
          }
        }
      } catch (e) {
        console.warn('[Recovery Queue] Background customer balance fetch error:', e);
      }
    }

    // 4. Group open invoices by customer
    const customerMap = new Map<
      string,
      {
        customerId: string;
        customerName: string;
        customerGst: string;
        invoices: Array<{
          invoiceId: string;
          invoiceNumber: string;
          invoiceDate: string;
          dueDate: string | null;
          invoiceValue: number;
          amountPaid: number;
          amountPending: number;
          paymentStatus: string;
          isOverdue: boolean;
          overdueDays: number;
          agingBucket: AgingBucketKey;
          salespersonName?: string | null;
          activeTaskId: string | null;
          isPendingRecovery: boolean;
          flaggedByName: string | null;
          flaggedAt: string | null;
        }>;
        salespersonNames: Set<string>;
      }
    >();

    const allSalespersons = new Set<string>();

    for (const inv of openInvoices) {
      if (!inv.customerId) continue;

      const custId = inv.customerId;
      const custName = inv.customerName || 'Unknown Customer';
      const custGst = inv.customerGst || dbCustomerMap.get(custId)?.gstNumber || '';

      const { isOverdue, overdueDays } = getInvoiceOverdueDays(inv, now);
      const agingBucket = getAgingBucket(overdueDays);
      const activeTask = activeTaskMap.get(inv.invoiceId);

      if (inv.salespersonName) {
        allSalespersons.add(inv.salespersonName.trim());
      }

      let entry = customerMap.get(custId);
      if (!entry) {
        entry = {
          customerId: custId,
          customerName: custName,
          customerGst: custGst,
          invoices: [],
          salespersonNames: new Set(),
        };
        customerMap.set(custId, entry);
      }

      entry.invoices.push({
        invoiceId: inv.invoiceId,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        invoiceValue: inv.invoiceValue,
        amountPaid: inv.amountPaid,
        amountPending: inv.amountPending,
        paymentStatus: inv.paymentStatus,
        isOverdue,
        overdueDays,
        agingBucket,
        salespersonName: inv.salespersonName,
        activeTaskId: activeTask?.id || null,
        isPendingRecovery: Boolean(activeTask),
        flaggedByName: activeTask?.flaggedByName || null,
        flaggedAt: activeTask?.flaggedAt?.toISOString() || null,
      });

      if (inv.salespersonName) {
        entry.salespersonNames.add(inv.salespersonName.trim());
      }
    }

    // 5. Aggregate per-customer metrics
    const allCustomersList = Array.from(customerMap.values()).map((c) => {
      const rec = recoveryRecordMap.get(c.customerId);
      const dbCust = dbCustomerMap.get(c.customerId);
      const invoicePendingSum = c.invoices.reduce((sum, i) => sum + i.amountPending, 0);

      // Authoritative calculation: derive from Customer Statement API / database closing balance
      // Net Balance = Net Receivable − Net Payable
      // Net Outstanding = max(Net Balance, 0)
      // Net Payable Balance = max(-Net Balance, 0)
      const balanceMetrics = computeCustomerNetOutstanding(
        dbCust?.netOutstandingBalance,
        invoicePendingSum
      );

      const totalOutstanding = balanceMetrics.netOutstanding;
      const isAdvance = balanceMetrics.isAdvance;
      const netBalance = balanceMetrics.netBalance;
      const netPayableBalance = balanceMetrics.netPayableBalance;

      // Overdue invoices calculation:
      // If customer has net credit balance (advance), net receivable is 0
      const rawOverdueInvoices = c.invoices.filter((i) => i.isOverdue);
      const rawOverdueAmount = rawOverdueInvoices.reduce((sum, i) => sum + i.amountPending, 0);
      const overdueAmount = isAdvance ? 0 : Math.min(totalOutstanding, rawOverdueAmount);

      const oldestOverdueDays =
        c.invoices.length > 0 ? Math.max(...c.invoices.map((i) => i.overdueDays)) : 0;

      const oldestDueDate =
        c.invoices
          .filter((i) => i.dueDate)
          .map((i) => i.dueDate!)
          .sort()[0] || null;

      const overallAgingBucket = getAgingBucket(oldestOverdueDays);
      const primarySalesperson = Array.from(c.salespersonNames)[0] || null;
      const activeInvoices = c.invoices.filter((i) => i.isPendingRecovery);
      const activeInvoicesCount = activeInvoices.length;

      return {
        customerId: c.customerId,
        customerName: c.customerName,
        customerGst: c.customerGst,
        totalOutstanding,
        netBalance,
        netPayableBalance,
        isAdvance,
        overdueAmount,
        invoiceCount: c.invoices.length,
        oldestOverdueDays,
        oldestDueDate,
        overallAgingBucket,
        salesperson: primarySalesperson,
        allSalespersons: Array.from(c.salespersonNames),
        recoveryStatus: rec?.status || 'PENDING_FOLLOW_UP',
        nextFollowUpDate: rec?.nextFollowUpDate?.toISOString() || null,
        lastActivityAt: rec?.lastActivityAt?.toISOString() || null,
        internalNotes: rec?.internalNotes || null,
        assignedStaffName: rec?.assignedStaffName || null,
        invoices: activeInvoices, // Strictly active recovery tasks for the active queue
        openInvoices: c.invoices, // All operationally open invoices for selector modal
        hasActiveTask: activeInvoicesCount > 0,
        activeTaskCount: activeInvoicesCount,
      };
    });

    // 5b. Authoritative Active Recovery Queue Eligibility:
    // A customer belongs in the active Recovery Queue only when they have at least one active recovery task.
    // Customers with only RELEASED or RESOLVED tasks (or no tasks at all) are excluded.
    const activeEligibleCustomers = allCustomersList.filter(
      (c) => c.hasActiveTask && c.activeTaskCount > 0
    );

    // 6. Calculate Global Executive KPIs from the active recovery dataset
    let globalTotalOutstanding = 0;
    let globalTotalOverdue = 0;
    let globalTotalInvoices = 0;
    let totalAdvanceInvoicePending = 0;
    let advanceInvoiceCount = 0;
    let maxCustomerOutstanding = 0;

    const globalAgingSummary: Record<AgingBucketKey, { amount: number; count: number }> = {
      '0-30': { amount: 0, count: 0 },
      '31-60': { amount: 0, count: 0 },
      '61-90': { amount: 0, count: 0 },
      '90+': { amount: 0, count: 0 },
    };

    let globalOldestInvoice: {
      customerId: string;
      customerName: string;
      invoiceNumber: string;
      invoiceDate: string;
      dueDate: string | null;
      overdueDays: number;
      amountPending: number;
    } | null = null;

    for (const cust of activeEligibleCustomers) {
      globalTotalOutstanding += cust.totalOutstanding;
      globalTotalOverdue += cust.overdueAmount;
      globalTotalInvoices += cust.invoices.length; // Count active recovery invoices
      if (cust.totalOutstanding > maxCustomerOutstanding) {
        maxCustomerOutstanding = cust.totalOutstanding;
      }

      for (const inv of cust.invoices) {
        if (!cust.isAdvance) {
          globalAgingSummary[inv.agingBucket].amount += inv.amountPending;
          globalAgingSummary[inv.agingBucket].count += 1;
        } else {
          totalAdvanceInvoicePending += inv.amountPending;
          advanceInvoiceCount += 1;
        }

        if (
          !cust.isAdvance &&
          (!globalOldestInvoice ||
            inv.overdueDays > globalOldestInvoice.overdueDays ||
            (inv.overdueDays === globalOldestInvoice.overdueDays && inv.amountPending > globalOldestInvoice.amountPending))
        ) {
          globalOldestInvoice = {
            customerId: cust.customerId,
            customerName: cust.customerName,
            invoiceNumber: inv.invoiceNumber,
            invoiceDate: inv.invoiceDate,
            dueDate: inv.dueDate,
            overdueDays: inv.overdueDays,
            amountPending: inv.amountPending,
          };
        }
      }
    }

    // Diagnostic reconciliation metrics across all accounts vs active accounts
    const allAccountsNetReceivables = allCustomersList.reduce((sum, c) => sum + c.totalOutstanding, 0);
    const allAccountsInvoicePending = allCustomersList.reduce(
      (sum, c) => sum + (!c.isAdvance ? c.openInvoices.reduce((s, i) => s + i.amountPending, 0) : 0),
      0
    );

    const kpis = {
      totalOutstanding: globalTotalOutstanding,
      totalOverdue: globalTotalOverdue,
      totalCustomers: activeEligibleCustomers.length,
      totalInvoices: globalTotalInvoices,
      agingSummary: globalAgingSummary,
      advanceInvoices: {
        amount: totalAdvanceInvoicePending,
        count: advanceInvoiceCount,
      },
      oldestOverdue: globalOldestInvoice,
      maxOutstanding: maxCustomerOutstanding,
      reconciliation: {
        activeNetReceivables: globalTotalOutstanding,
        activeAgingInvoiceBalances: Object.values(globalAgingSummary).reduce((s, b) => s + b.amount, 0),
        activeAdvanceInvoices: totalAdvanceInvoicePending,
        allAccountsNetReceivables,
        allAccountsInvoicePending,
        allAccountsDifference: allAccountsNetReceivables - allAccountsInvoicePending,
      },
      lastRefreshedAt: cache?.generatedAt?.toISOString() || null,
    };

    // 7. Apply Filters (AND semantics) on the active recovery dataset
    let filteredCustomers = activeEligibleCustomers;

    if (q) {
      filteredCustomers = filteredCustomers.filter((c) => {
        const nameMatch = c.customerName.toLowerCase().includes(q);
        const idMatch = c.customerId.toLowerCase().includes(q);
        const gstMatch = c.customerGst.toLowerCase().includes(q);
        const invMatch = c.openInvoices.some((i) => i.invoiceNumber.toLowerCase().includes(q));
        return nameMatch || idMatch || gstMatch || invMatch;
      });
    }

    if (salespersonFilter) {
      filteredCustomers = filteredCustomers.filter((c) =>
        c.allSalespersons.includes(salespersonFilter) || c.salesperson === salespersonFilter
      );
    }

    if (agingFilter) {
      filteredCustomers = filteredCustomers.filter((c) => c.overallAgingBucket === agingFilter);
    }

    if (minAmount !== null && !isNaN(minAmount)) {
      filteredCustomers = filteredCustomers.filter((c) => c.totalOutstanding >= minAmount);
    }

    if (maxAmount !== null && !isNaN(maxAmount)) {
      filteredCustomers = filteredCustomers.filter((c) => c.totalOutstanding <= maxAmount);
    }

    if (dueFrom) {
      filteredCustomers = filteredCustomers.filter((c) => c.oldestDueDate && c.oldestDueDate >= dueFrom);
    }

    if (dueTo) {
      filteredCustomers = filteredCustomers.filter((c) => c.oldestDueDate && c.oldestDueDate <= dueTo);
    }

    // 8. Sorting
    filteredCustomers.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'outstanding':
          comparison = a.totalOutstanding - b.totalOutstanding;
          break;
        case 'overdueAmount':
          comparison = a.overdueAmount - b.overdueAmount;
          break;
        case 'overdueDays':
          comparison = a.oldestOverdueDays - b.oldestOverdueDays;
          break;
        case 'oldestDue':
          if (!a.oldestDueDate && !b.oldestDueDate) comparison = 0;
          else if (!a.oldestDueDate) comparison = 1;
          else if (!b.oldestDueDate) comparison = -1;
          else comparison = a.oldestDueDate.localeCompare(b.oldestDueDate);
          break;
        case 'customerName':
          comparison = a.customerName.localeCompare(b.customerName);
          break;
        case 'invoiceCount':
          comparison = a.invoiceCount - b.invoiceCount;
          break;
        case 'nextFollowUp':
          if (!a.nextFollowUpDate && !b.nextFollowUpDate) comparison = 0;
          else if (!a.nextFollowUpDate) comparison = 1;
          else if (!b.nextFollowUpDate) comparison = -1;
          else comparison = a.nextFollowUpDate.localeCompare(b.nextFollowUpDate);
          break;
        case 'lastActivity':
          if (!a.lastActivityAt && !b.lastActivityAt) comparison = 0;
          else if (!a.lastActivityAt) comparison = 1;
          else if (!b.lastActivityAt) comparison = -1;
          else comparison = a.lastActivityAt.localeCompare(b.lastActivityAt);
          break;
        default:
          comparison = a.totalOutstanding - b.totalOutstanding;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // 9. Pagination
    const totalCount = filteredCustomers.length;
    const isAll = searchParams.get('all') === 'true' || searchParams.get('pageSize') === 'all';
    const totalPages = isAll ? 1 : Math.ceil(totalCount / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedCustomers = isAll ? filteredCustomers : filteredCustomers.slice(startIndex, startIndex + pageSize);

    return NextResponse.json({
      success: true,
      data: {
        customers: paginatedCustomers,
        kpis,
        pagination: {
          currentPage: isAll ? 1 : page,
          pageSize: isAll ? totalCount : pageSize,
          totalCount,
          totalPages,
        },
        salespersons: Array.from(allSalespersons).sort(),
        releaseAllowed,
      },
    });
  } catch (error: any) {
    console.error('[Recovery Queue API Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
