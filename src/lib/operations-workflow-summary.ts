import { prisma } from './db';

export type OperationsPendingState = 'RECEIVING' | 'CHECK' | 'INVENTORY' | 'COMPLETED';

export interface OperationsDateBucket {
  key: string;
  label: string;
  isToday: boolean;
  start: Date;
  end: Date;
}

export interface OperationsRow {
  bucketKey: string;
  label: string;
  isToday: boolean;
  receiving: number;
  check: number;
  inventory: number;
  total: number;
}

export interface OperationsWarehousePivot {
  warehouse: string;
  rows: OperationsRow[];
  totals: {
    receiving: number;
    check: number;
    inventory: number;
    total: number;
  };
}

export interface OperationsWorkflowSummary {
  buckets: Array<{ key: string; label: string; isToday: boolean }>;
  warehouses: OperationsWarehousePivot[];
  totals: {
    receivingPending: number;
    checkPending: number;
    inventoryPending: number;
    grandTotal: number;
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

/**
 * Calculates the rolling 8 date buckets based on TODAY in IST (UTC+5:30):
 * 1. Before [Day -6] (older than 7 days)
 * 2. [Day -6]
 * 3. [Day -5]
 * 4. [Day -4]
 * 5. [Day -3]
 * 6. [Day -2]
 * 7. [Day -1]
 * 8. [Today] (Today at the bottom)
 */
export function getIstOperationsDateBuckets(referenceDate: Date = new Date()): OperationsDateBucket[] {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(referenceDate.getTime() + istOffsetMs);

  const istYear = istNow.getUTCFullYear();
  const istMonth = istNow.getUTCMonth();
  const istDate = istNow.getUTCDate();

  // 7 days: Day -6 to Day 0 (today)
  const days: OperationsDateBucket[] = [];
  for (let i = 6; i >= 0; i--) {
    const startUtc = new Date(Date.UTC(istYear, istMonth, istDate - i, 0, 0, 0, 0) - istOffsetMs);
    const endUtc = new Date(Date.UTC(istYear, istMonth, istDate - i, 23, 59, 59, 999) - istOffsetMs);

    const istDayObj = new Date(startUtc.getTime() + istOffsetMs);
    const dayNum = istDayObj.getUTCDate();
    const monthStr = MONTH_NAMES[istDayObj.getUTCMonth()];
    const label = `${dayNum} ${monthStr}`;
    const dateKey = `${istDayObj.getUTCFullYear()}-${String(istDayObj.getUTCMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

    days.push({
      key: dateKey,
      label,
      isToday: i === 0,
      start: startUtc,
      end: endUtc,
    });
  }

  // Bucket 1: Before [Day -6]
  const beforeStart = new Date(0);
  const beforeEnd = new Date(days[0].start.getTime() - 1);
  const beforeBucket: OperationsDateBucket = {
    key: 'before',
    label: `Before ${days[0].label}`,
    isToday: false,
    start: beforeStart,
    end: beforeEnd,
  };

  return [beforeBucket, ...days];
}

/**
 * Strict Exclusivity Hierarchy:
 * State 1 (Receiving Pending): If Receiving is pending/not completed -> Count ONLY under Receiving Pending.
 * State 2 (Check Pending): If Receiving is completed, but Check is pending -> Count ONLY under Check Pending.
 * State 3 (Inventory Pending): If Receiving is completed AND Check is completed, but Inventory is pending -> Count ONLY under Inventory Pending.
 * State 4 (Completed): If all 3 are completed -> Excluded from pending.
 *
 * Exactly ONE pending bucket per invoice.
 */
export function getInvoicePendingState(
  workflows: Array<{ workflowType: string; status: string }>
): OperationsPendingState {
  const rWf = workflows.find((w) => w.workflowType === 'RECEIVING');
  const cWf = workflows.find((w) => w.workflowType === 'CHECKED');
  const iWf = workflows.find((w) => w.workflowType === 'INVENTORY_DEDUCTION');

  const isReceivingCompleted = rWf?.status === 'COMPLETED';
  const isCheckedCompleted = cWf?.status === 'COMPLETED';
  const isInventoryCompleted = iWf?.status === 'COMPLETED';

  if (!isReceivingCompleted) return 'RECEIVING';
  if (!isCheckedCompleted) return 'CHECK';
  if (!isInventoryCompleted) return 'INVENTORY';
  return 'COMPLETED';
}

/**
 * Maps a given invoice date to one of the 8 date bucket keys.
 */
export function matchDateToBucketKey(date: Date, buckets: OperationsDateBucket[]): string {
  const t = date.getTime();
  if (t <= buckets[0].end.getTime()) {
    return buckets[0].key;
  }
  for (let i = 1; i < buckets.length; i++) {
    if (t >= buckets[i].start.getTime() && t <= buckets[i].end.getTime()) {
      return buckets[i].key;
    }
  }
  // If slightly in the future due to clock differences, place into today bucket
  return buckets[buckets.length - 1].key;
}

/**
 * Formats duration from past date until now into human-readable age.
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
 * Computes authoritative Operations Workflow Summary aggregated by warehouse and 8 IST date buckets.
 */
export async function getOperationsWorkflowSummary(): Promise<OperationsWorkflowSummary> {
  const buckets = getIstOperationsDateBuckets();

  const invoices = await prisma.postDispatchInvoice.findMany({
    where: {
      erpStatus: 'Active',
      zohoStatus: { notIn: ['void', 'draft'], mode: 'insensitive' },
      OR: [
        { erpSubStatus: null },
        { erpSubStatus: { not: 'Void' } },
      ],
    },
    select: {
      id: true,
      zohoCreatedTime: true,
      zohoDetailsJson: true,
      workflows: {
        select: {
          workflowType: true,
          status: true,
        },
      },
    },
  });

  // Map: warehouse -> bucketKey -> counts
  const warehouseDataMap = new Map<string, Map<string, { receiving: number; check: number; inventory: number }>>();

  for (const inv of invoices) {
    const pendingState = getInvoicePendingState(inv.workflows);
    if (pendingState === 'COMPLETED') continue;

    const details = inv.zohoDetailsJson as any;
    const warehouseName = (details?.location_name || '').trim() || 'Unassigned';
    const bucketKey = matchDateToBucketKey(new Date(inv.zohoCreatedTime), buckets);

    if (!warehouseDataMap.has(warehouseName)) {
      warehouseDataMap.set(warehouseName, new Map());
    }

    const bucketMap = warehouseDataMap.get(warehouseName)!;
    if (!bucketMap.has(bucketKey)) {
      bucketMap.set(bucketKey, { receiving: 0, check: 0, inventory: 0 });
    }

    const counts = bucketMap.get(bucketKey)!;
    if (pendingState === 'RECEIVING') {
      counts.receiving++;
    } else if (pendingState === 'CHECK') {
      counts.check++;
    } else if (pendingState === 'INVENTORY') {
      counts.inventory++;
    }
  }

  // Sort warehouses alphabetically, keeping 'Unassigned' at the very bottom
  const sortedWarehouses = Array.from(warehouseDataMap.keys()).sort((a, b) => {
    if (a === 'Unassigned') return 1;
    if (b === 'Unassigned') return -1;
    return a.localeCompare(b);
  });

  let grandReceiving = 0;
  let grandCheck = 0;
  let grandInventory = 0;

  const warehousePivots: OperationsWarehousePivot[] = [];

  for (const wh of sortedWarehouses) {
    const bucketMap = warehouseDataMap.get(wh) || new Map();
    const rows: OperationsRow[] = [];
    let whReceiving = 0;
    let whCheck = 0;
    let whInventory = 0;

    for (const b of buckets) {
      const counts = bucketMap.get(b.key) || { receiving: 0, check: 0, inventory: 0 };
      const rowTotal = counts.receiving + counts.check + counts.inventory;

      whReceiving += counts.receiving;
      whCheck += counts.check;
      whInventory += counts.inventory;

      rows.push({
        bucketKey: b.key,
        label: b.label,
        isToday: b.isToday,
        receiving: counts.receiving,
        check: counts.check,
        inventory: counts.inventory,
        total: rowTotal,
      });
    }

    grandReceiving += whReceiving;
    grandCheck += whCheck;
    grandInventory += whInventory;

    warehousePivots.push({
      warehouse: wh,
      rows,
      totals: {
        receiving: whReceiving,
        check: whCheck,
        inventory: whInventory,
        total: whReceiving + whCheck + whInventory,
      },
    });
  }

  return {
    buckets: buckets.map((b) => ({ key: b.key, label: b.label, isToday: b.isToday })),
    warehouses: warehousePivots,
    totals: {
      receivingPending: grandReceiving,
      checkPending: grandCheck,
      inventoryPending: grandInventory,
      grandTotal: grandReceiving + grandCheck + grandInventory,
    },
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Fetches the specific list of invoices for a given cell click:
 * Filtered by warehouse, date bucket, and specific pending state.
 */
export async function getOperationsCellInvoices(params: {
  warehouse: string;
  bucketKey: string;
  state: 'RECEIVING' | 'CHECK' | 'INVENTORY';
}): Promise<{
  warehouse: string;
  bucketKey: string;
  bucketLabel: string;
  state: string;
  invoices: OperationsCellInvoiceItem[];
}> {
  const { warehouse, bucketKey, state } = params;
  const buckets = getIstOperationsDateBuckets();
  const targetBucket = buckets.find((b) => b.key === bucketKey);

  if (!targetBucket) {
    throw new Error(`Invalid bucket key: ${bucketKey}`);
  }

  // Find all active non-void invoices for the target warehouse and date range
  const dateFilter: any = {};
  if (bucketKey === 'before') {
    dateFilter.lt = buckets[1].start;
  } else {
    dateFilter.gte = targetBucket.start;
    dateFilter.lte = targetBucket.end;
  }

  const where: any = {
    erpStatus: 'Active',
    zohoStatus: { notIn: ['void', 'draft'], mode: 'insensitive' },
    OR: [
      { erpSubStatus: null },
      { erpSubStatus: { not: 'Void' } },
    ],
    zohoCreatedTime: dateFilter,
  };

  if (warehouse && warehouse !== 'Unassigned') {
    where.zohoDetailsJson = {
      path: ['location_name'],
      equals: warehouse,
    };
  }

  const invoices = await prisma.postDispatchInvoice.findMany({
    where,
    select: {
      id: true,
      invoiceNumber: true,
      customerName: true,
      total: true,
      zohoCreatedTime: true,
      zohoStatus: true,
      zohoDetailsJson: true,
      workflows: {
        select: {
          workflowType: true,
          status: true,
        },
      },
    },
    orderBy: { zohoCreatedTime: 'desc' },
  });

  const now = new Date();

  // Filter invoices strictly matching the requested exclusive state
  const matchingInvoices = invoices.filter((inv) => {
    // If warehouse is Unassigned, ensure location_name is empty or null
    if (warehouse === 'Unassigned') {
      const wh = ((inv.zohoDetailsJson as any)?.location_name || '').trim();
      if (wh) return false;
    }
    return getInvoicePendingState(inv.workflows) === state;
  });

  const stateLabels: Record<string, string> = {
    RECEIVING: 'Receiving Pending',
    CHECK: 'Check Pending',
    INVENTORY: 'Inventory Pending',
  };

  const formattedInvoices: OperationsCellInvoiceItem[] = matchingInvoices.map((inv) => {
    const createdDate = new Date(inv.zohoCreatedTime);
    const istCreated = new Date(createdDate.getTime() + 5.5 * 60 * 60 * 1000);
    const day = istCreated.getUTCDate();
    const month = MONTH_NAMES[istCreated.getUTCMonth()];
    const year = istCreated.getUTCFullYear();

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
      currentStatus: stateLabels[state] || state,
      ageFormatted: formatWaitingDuration(createdDate, now),
      rawDate: inv.zohoCreatedTime.toISOString(),
    };
  });

  return {
    warehouse,
    bucketKey,
    bucketLabel: targetBucket.label,
    state: stateLabels[state] || state,
    invoices: formattedInvoices,
  };
}
