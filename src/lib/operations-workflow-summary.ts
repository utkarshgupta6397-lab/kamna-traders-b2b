import { prisma } from './db';

export type OperationsStage = 'RECEIVING' | 'CHECK' | 'INVENTORY' | 'TOTAL';

export interface OperationsDateBucket {
  key: string;
  label: string;
  isToday: boolean;
  start: Date;
  end: Date;
}

export interface OperationsStageCounts {
  byDate: Record<string, number>;
  total: number;
}

export interface OperationsWarehouseRow {
  name: string;
  totalPending: number;
  totalPendingByDate: Record<string, number>;
  receiving: OperationsStageCounts;
  check: OperationsStageCounts;
  inventory: OperationsStageCounts;
}

export interface OperationsGrandTotal {
  totalPending: number;
  totalPendingByDate: Record<string, number>;
  receiving: OperationsStageCounts;
  check: OperationsStageCounts;
  inventory: OperationsStageCounts;
}

export interface OperationsWorkflowSummary {
  dateBuckets: Array<{ key: string; label: string; isToday: boolean }>;
  warehouses: OperationsWarehouseRow[];
  availableWarehouses: string[];
  grandTotal: OperationsGrandTotal;
  totals: {
    receivingPending: number;
    checkPending: number;
    inventoryPending: number;
    totalPending: number; // Distinct invoices requiring any action
  };
  lastUpdated: string;
}

export interface OperationsCellInvoiceItem {
  id: string;
  invoiceNumber: string;
  customerName: string;
  warehouse: string;
  amount: number;
  formattedAmount: string;
  invoiceDate: string;
  currentStatus: string;
  ageFormatted: string;
  rawDate: string;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Authoritative Post-Dispatch Workflow Predicates (reconciles 100% with Post-Dispatch page):
 *
 * 1. RECEIVING PENDING:
 *    Matches buildPostDispatchWhereClause({ tab: 'receiving_pending' }):
 *    erpStatus = 'Active' and workflows has RECEIVING in ['PENDING', 'REWORK_REQUIRED'].
 */
export function isInvoiceReceivingPending(inv: {
  workflows?: Array<{ workflowType: string; status: string }>;
}): boolean {
  return (
    inv.workflows?.some(
      (w) => w.workflowType === 'RECEIVING' && (w.status === 'PENDING' || w.status === 'REWORK_REQUIRED')
    ) ?? false
  );
}

/**
 * 2. CHECK PENDING:
 *    Matches buildPostDispatchWhereClause({ tab: 'check_pending' }):
 *    erpStatus = 'Active' and workflows has CHECKED in ['PENDING', 'REWORK_REQUIRED'].
 */
export function isInvoiceCheckPending(inv: {
  workflows?: Array<{ workflowType: string; status: string }>;
}): boolean {
  return (
    inv.workflows?.some(
      (w) => w.workflowType === 'CHECKED' && (w.status === 'PENDING' || w.status === 'REWORK_REQUIRED')
    ) ?? false
  );
}

/**
 * 3. INVENTORY PENDING:
 *    Matches buildPostDispatchWhereClause({ tab: 'inventory_pending' }):
 *    erpStatus = 'Active', zohoStatus not in ['void', 'draft'],
 *    INVENTORY_DEDUCTION workflow status != 'COMPLETED', and at least one actionable line.
 */
export function isInvoiceInventoryPending(inv: {
  zohoStatus?: string | null;
  workflows?: Array<{ workflowType: string; status: string }>;
  lines?: Array<{ id: string; stockDeductionAllocation?: { status: string } | null }>;
}): boolean {
  const zStatus = (inv.zohoStatus || '').toLowerCase();
  if (zStatus === 'void' || zStatus === 'draft') return false;

  const invWf = inv.workflows?.find((w) => w.workflowType === 'INVENTORY_DEDUCTION');
  if (!invWf || invWf.status === 'COMPLETED') return false;

  if (!inv.lines || inv.lines.length === 0) return true;

  return inv.lines.some(
    (l) =>
      !l.stockDeductionAllocation ||
      !['DEDUCTED', 'SUBMITTED_FOR_APPROVAL', 'APPROVED'].includes(l.stockDeductionAllocation.status)
  );
}

/**
 * 4. IS ACTIONABLE:
 *    Invoice requires any of the 3 operational actions (Receiving, Check, or Inventory).
 *    Used to calculate distinct "Total Pending" without double-counting.
 */
export function isInvoiceActionable(inv: {
  zohoStatus?: string | null;
  workflows?: Array<{ workflowType: string; status: string }>;
  lines?: Array<{ id: string; stockDeductionAllocation?: { status: string } | null }>;
}): boolean {
  return isInvoiceReceivingPending(inv) || isInvoiceCheckPending(inv) || isInvoiceInventoryPending(inv);
}

/**
 * Calculates rolling 8 date buckets based on TODAY in IST (UTC+5:30)
 * strictly ordered with LATEST DATE FIRST:
 *
 * 1. [Today] (e.g. 22 Sep)
 * 2. [Day -1] (e.g. 21 Sep)
 * 3. [Day -2] (e.g. 20 Sep)
 * 4. [Day -3] (e.g. 19 Sep)
 * 5. [Day -4] (e.g. 18 Sep)
 * 6. [Day -5] (e.g. 17 Sep)
 * 7. [Day -6] (e.g. 16 Sep)
 * 8. Before [Day -6] (e.g. Before 16 Sep - older than 7 days)
 */
export function getIstOperationsDateBuckets(referenceDate: Date = new Date()): OperationsDateBucket[] {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(referenceDate.getTime() + istOffsetMs);

  const istYear = istNow.getUTCFullYear();
  const istMonth = istNow.getUTCMonth();
  const istDate = istNow.getUTCDate();

  // 7 individual days ordered from Today (i=0) down to Day -6 (i=6)
  const days: OperationsDateBucket[] = [];
  for (let i = 0; i <= 6; i++) {
    const startUtc = new Date(Date.UTC(istYear, istMonth, istDate - i, 0, 0, 0, 0) - istOffsetMs);
    const endUtc = new Date(Date.UTC(istYear, istMonth, istDate - i, 23, 59, 59, 999) - istOffsetMs);

    const istDayObj = new Date(startUtc.getTime() + istOffsetMs);
    const dayNum = istDayObj.getUTCDate();
    const monthStr = MONTH_NAMES[istDayObj.getUTCMonth()];
    const weekdayStr = WEEKDAY_NAMES[istDayObj.getUTCDay()];
    const label = `${weekdayStr}, ${dayNum} ${monthStr}`;
    const dateKey = `${istDayObj.getUTCFullYear()}-${String(istDayObj.getUTCMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

    days.push({
      key: dateKey,
      label,
      isToday: i === 0,
      start: startUtc,
      end: endUtc,
    });
  }

  // 8th bucket: Before [Day -6] (e.g. Before 16 Sep - older than 7 days)
  const oldestIndividualDay = days[6];
  const oldestIstObj = new Date(oldestIndividualDay.start.getTime() + istOffsetMs);
  const oldestDayNum = oldestIstObj.getUTCDate();
  const oldestMonthStr = MONTH_NAMES[oldestIstObj.getUTCMonth()];
  const beforeStart = new Date(0);
  const beforeEnd = new Date(oldestIndividualDay.start.getTime() - 1);
  const beforeBucket: OperationsDateBucket = {
    key: 'before',
    label: `Before ${oldestDayNum} ${oldestMonthStr}`,
    isToday: false,
    start: beforeStart,
    end: beforeEnd,
  };

  return [...days, beforeBucket];
}

/**
 * Matches a given UTC date to one of the 8 date bucket keys in IST.
 */
export function matchDateToBucketKey(date: Date, buckets: OperationsDateBucket[]): string {
  const t = date.getTime();
  const beforeBucket = buckets[7]; // 8th bucket is 'before'
  if (t <= beforeBucket.end.getTime()) {
    return beforeBucket.key;
  }
  for (let i = 0; i < 7; i++) {
    if (t >= buckets[i].start.getTime() && t <= buckets[i].end.getTime()) {
      return buckets[i].key;
    }
  }
  // Fallback for current/future to Today bucket
  return buckets[0].key;
}

/**
 * Formats duration from past date until now into a clean human-readable age.
 */
export function formatWaitingDuration(fromDate: Date, toDate: Date = new Date()): string {
  const elapsedMs = Math.max(0, toDate.getTime() - fromDate.getTime());
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${Math.max(1, minutes)}m`;
}

/**
 * Authoritative service to fetch scalable warehouse-wise operational pivot data.
 */
export async function getOperationsWorkflowSummary(): Promise<OperationsWorkflowSummary> {
  const buckets = getIstOperationsDateBuckets();

  // Query all active invoices with their workflows, lines, and allocations
  const invoices = await prisma.postDispatchInvoice.findMany({
    where: {
      erpStatus: 'Active',
    },
    select: {
      id: true,
      zohoStatus: true,
      zohoCreatedTime: true,
      zohoDetailsJson: true,
      workflows: {
        select: {
          workflowType: true,
          status: true,
        },
      },
      lines: {
        select: {
          id: true,
          stockDeductionAllocation: {
            select: { status: true },
          },
        },
      },
    },
  });

  // Discover all distinct warehouses from DB
  const rawWarehouses = await prisma.$queryRaw<{ wh: string | null }[]>`
    SELECT DISTINCT "zohoDetailsJson"->>'location_name' as wh
    FROM "PostDispatchInvoice"
    WHERE "zohoDetailsJson" IS NOT NULL
      AND "zohoDetailsJson"->>'location_name' IS NOT NULL
    ORDER BY wh ASC
  `;

  const distinctWarehousesSet = new Set<string>();
  for (const r of rawWarehouses) {
    if (r.wh && r.wh.trim()) {
      distinctWarehousesSet.add(r.wh.trim());
    }
  }

  // Also include any active system warehouses
  const activeSystemWarehouses = await prisma.warehouse.findMany({
    where: { active: true, isSystemWarehouse: false },
    select: { name: true },
  });
  for (const sw of activeSystemWarehouses) {
    if (sw.name && sw.name.trim()) {
      distinctWarehousesSet.add(sw.name.trim());
    }
  }

  // Ensure warehouses from the current dataset are present
  for (const inv of invoices) {
    const wh = ((inv.zohoDetailsJson as any)?.location_name || '').trim();
    if (wh) distinctWarehousesSet.add(wh);
  }

  const sortedWarehouseNames = Array.from(distinctWarehousesSet).sort((a, b) => a.localeCompare(b));

  // Initialize data structures for each warehouse
  interface WhAcc {
    name: string;
    distinctInvoices: Set<string>;
    distinctInvoicesByDate: Record<string, Set<string>>;
    receivingByDate: Record<string, number>;
    checkByDate: Record<string, number>;
    inventoryByDate: Record<string, number>;
    receivingTotal: number;
    checkTotal: number;
    inventoryTotal: number;
  }

  const whMap = new Map<string, WhAcc>();
  const createEmptyWhAcc = (name: string): WhAcc => {
    const distinctByDate: Record<string, Set<string>> = {};
    const rByDate: Record<string, number> = {};
    const cByDate: Record<string, number> = {};
    const iByDate: Record<string, number> = {};
    for (const b of buckets) {
      distinctByDate[b.key] = new Set<string>();
      rByDate[b.key] = 0;
      cByDate[b.key] = 0;
      iByDate[b.key] = 0;
    }
    return {
      name,
      distinctInvoices: new Set<string>(),
      distinctInvoicesByDate: distinctByDate,
      receivingByDate: rByDate,
      checkByDate: cByDate,
      inventoryByDate: iByDate,
      receivingTotal: 0,
      checkTotal: 0,
      inventoryTotal: 0,
    };
  };

  for (const name of sortedWarehouseNames) {
    whMap.set(name, createEmptyWhAcc(name));
  }

  // Grand Total accumulators
  const grandDistinctInvoices = new Set<string>();
  const grandDistinctByDate: Record<string, Set<string>> = {};
  const grandReceivingByDate: Record<string, number> = {};
  const grandCheckByDate: Record<string, number> = {};
  const grandInventoryByDate: Record<string, number> = {};

  for (const b of buckets) {
    grandDistinctByDate[b.key] = new Set<string>();
    grandReceivingByDate[b.key] = 0;
    grandCheckByDate[b.key] = 0;
    grandInventoryByDate[b.key] = 0;
  }

  let totalR = 0;
  let totalC = 0;
  let totalI = 0;

  // Process all invoices
  for (const inv of invoices) {
    const isR = isInvoiceReceivingPending(inv);
    const isC = isInvoiceCheckPending(inv);
    const isI = isInvoiceInventoryPending(inv);
    const isAct = isR || isC || isI;

    if (!isAct) continue; // Skip completed / non-pending invoices

    const rawWh = ((inv.zohoDetailsJson as any)?.location_name || '').trim() || 'Unassigned';
    if (!whMap.has(rawWh)) {
      whMap.set(rawWh, createEmptyWhAcc(rawWh));
    }

    const whAcc = whMap.get(rawWh)!;
    const bucketKey = matchDateToBucketKey(new Date(inv.zohoCreatedTime), buckets);

    // Track distinct pending invoices
    whAcc.distinctInvoices.add(inv.id);
    whAcc.distinctInvoicesByDate[bucketKey].add(inv.id);

    grandDistinctInvoices.add(inv.id);
    grandDistinctByDate[bucketKey].add(inv.id);

    if (isR) {
      whAcc.receivingByDate[bucketKey]++;
      whAcc.receivingTotal++;
      grandReceivingByDate[bucketKey]++;
      totalR++;
    }
    if (isC) {
      whAcc.checkByDate[bucketKey]++;
      whAcc.checkTotal++;
      grandCheckByDate[bucketKey]++;
      totalC++;
    }
    if (isI) {
      whAcc.inventoryByDate[bucketKey]++;
      whAcc.inventoryTotal++;
      grandInventoryByDate[bucketKey]++;
      totalI++;
    }
  }

  // Format warehouse rows
  const warehouseRows: OperationsWarehouseRow[] = [];
  const finalWarehouseKeys = Array.from(whMap.keys()).sort((a, b) => {
    if (a === 'Unassigned') return 1;
    if (b === 'Unassigned') return -1;
    return a.localeCompare(b);
  });

  for (const name of finalWarehouseKeys) {
    const acc = whMap.get(name)!;

    // Filter out inactive warehouses: only include warehouses with at least 1 pending invoice
    if (acc.distinctInvoices.size === 0) {
      continue;
    }

    const totalPendingByDate: Record<string, number> = {};
    for (const b of buckets) {
      totalPendingByDate[b.key] = acc.distinctInvoicesByDate[b.key].size;
    }

    warehouseRows.push({
      name,
      totalPending: acc.distinctInvoices.size,
      totalPendingByDate,
      receiving: {
        byDate: acc.receivingByDate,
        total: acc.receivingTotal,
      },
      check: {
        byDate: acc.checkByDate,
        total: acc.checkTotal,
      },
      inventory: {
        byDate: acc.inventoryByDate,
        total: acc.inventoryTotal,
      },
    });
  }

  // Format grand totals
  const grandTotalPendingByDate: Record<string, number> = {};
  for (const b of buckets) {
    grandTotalPendingByDate[b.key] = grandDistinctByDate[b.key].size;
  }

  const grandTotal: OperationsGrandTotal = {
    totalPending: grandDistinctInvoices.size,
    totalPendingByDate: grandTotalPendingByDate,
    receiving: {
      byDate: grandReceivingByDate,
      total: totalR,
    },
    check: {
      byDate: grandCheckByDate,
      total: totalC,
    },
    inventory: {
      byDate: grandInventoryByDate,
      total: totalI,
    },
  };

  return {
    dateBuckets: buckets.map((b) => ({ key: b.key, label: b.label, isToday: b.isToday })),
    warehouses: warehouseRows,
    availableWarehouses: finalWarehouseKeys.filter(
      (w) => w !== 'Unassigned' && (whMap.get(w)?.distinctInvoices.size || 0) > 0
    ),
    grandTotal,
    totals: {
      receivingPending: totalR,
      checkPending: totalC,
      inventoryPending: totalI,
      totalPending: grandDistinctInvoices.size,
    },
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Drill-down lookup service:
 * Fetches the specific list of invoices for a clicked cell in the pivot table or KPI cards.
 */
export async function getOperationsCellInvoices(params: {
  warehouse?: string; // Specific warehouse or 'ALL'
  bucketKey?: string; // Specific bucket key or 'ALL'
  stage: OperationsStage; // 'RECEIVING' | 'CHECK' | 'INVENTORY' | 'TOTAL'
}): Promise<{
  warehouse: string;
  bucketKey: string;
  bucketLabel: string;
  stage: string;
  stageTitle: string;
  invoices: OperationsCellInvoiceItem[];
}> {
  const { warehouse = 'ALL', bucketKey = 'ALL', stage = 'TOTAL' } = params;
  const buckets = getIstOperationsDateBuckets();

  const where: any = {
    erpStatus: 'Active',
  };

  // Warehouse filter
  if (warehouse && warehouse !== 'ALL' && warehouse !== 'Unassigned') {
    where.zohoDetailsJson = {
      path: ['location_name'],
      equals: warehouse,
    };
  }

  // Date filter
  let targetBucketLabel = 'All Dates';
  if (bucketKey && bucketKey !== 'ALL') {
    const targetBucket = buckets.find((b) => b.key === bucketKey);
    if (!targetBucket) {
      throw new Error(`Invalid bucket key: ${bucketKey}`);
    }
    targetBucketLabel = targetBucket.label;

    if (bucketKey === 'before') {
      const oldestDay = buckets[6];
      where.zohoCreatedTime = { lt: oldestDay.start };
    } else {
      where.zohoCreatedTime = {
        gte: targetBucket.start,
        lte: targetBucket.end,
      };
    }
  }

  const rawInvoices = await prisma.postDispatchInvoice.findMany({
    where,
    select: {
      id: true,
      invoiceNumber: true,
      customerName: true,
      total: true,
      zohoStatus: true,
      zohoCreatedTime: true,
      zohoDetailsJson: true,
      workflows: {
        select: {
          workflowType: true,
          status: true,
        },
      },
      lines: {
        select: {
          id: true,
          stockDeductionAllocation: {
            select: { status: true },
          },
        },
      },
    },
    orderBy: { zohoCreatedTime: 'desc' },
  });

  // Filter invoices according to the clicked stage
  const matchingInvoices = rawInvoices.filter((inv) => {
    // If specific warehouse was Unassigned, ensure location_name is empty
    if (warehouse === 'Unassigned') {
      const wh = ((inv.zohoDetailsJson as any)?.location_name || '').trim();
      if (wh) return false;
    }

    if (stage === 'RECEIVING') {
      return isInvoiceReceivingPending(inv);
    }
    if (stage === 'CHECK') {
      return isInvoiceCheckPending(inv);
    }
    if (stage === 'INVENTORY') {
      return isInvoiceInventoryPending(inv);
    }
    // stage === 'TOTAL'
    return isInvoiceActionable(inv);
  });

  const now = new Date();
  const stageLabels: Record<OperationsStage, string> = {
    RECEIVING: 'Receiving Pending',
    CHECK: 'Check Pending',
    INVENTORY: 'Inventory Pending',
    TOTAL: 'Total Pending',
  };

  const formattedInvoices: OperationsCellInvoiceItem[] = matchingInvoices.map((inv) => {
    const createdDate = new Date(inv.zohoCreatedTime);
    const istCreated = new Date(createdDate.getTime() + 5.5 * 60 * 60 * 1000);
    const day = istCreated.getUTCDate();
    const month = MONTH_NAMES[istCreated.getUTCMonth()];
    const year = istCreated.getUTCFullYear();

    // Determine current pending status description
    const statuses: string[] = [];
    if (isInvoiceReceivingPending(inv)) statuses.push('Receiving');
    if (isInvoiceCheckPending(inv)) statuses.push('Check');
    if (isInvoiceInventoryPending(inv)) statuses.push('Inventory');
    const statusText = statuses.length > 0 ? `${statuses.join(', ')} Pending` : 'Actionable';

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customerName,
      warehouse: ((inv.zohoDetailsJson as any)?.location_name || '').trim() || 'Unassigned',
      amount: inv.total,
      formattedAmount: new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(inv.total),
      invoiceDate: `${day} ${month} ${year}`,
      currentStatus: statusText,
      ageFormatted: formatWaitingDuration(createdDate, now),
      rawDate: inv.zohoCreatedTime.toISOString(),
    };
  });

  return {
    warehouse: warehouse === 'ALL' ? 'All Warehouses' : warehouse,
    bucketKey,
    bucketLabel: targetBucketLabel,
    stage,
    stageTitle: stageLabels[stage] || stage,
    invoices: formattedInvoices,
  };
}
