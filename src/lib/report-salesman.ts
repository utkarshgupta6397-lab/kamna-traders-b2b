// ============================================================
// Sales by Salesman — Core Data Pipeline
// Single source of truth for all types, calculations, and
// aggregations. All functions are pure — no side effects.
// ============================================================

// ------------------------------------
// Core Order Type (normalized from API)
// ------------------------------------

export interface PaymentRecord {
  amount: number;
  paymentDate: string; // ISO string
  paymentMode: string;
}

export interface NormalizedOrder {
  id: string;
  orderNumber: string;
  orderDate: string; // ISO string
  status: string;
  customerName: string;
  leadSource: string;
  salesmanId: string | null;
  salesmanName: string | null;
  callingExecutiveId: string | null;
  callingExecutiveName: string | null;
  subVendorId: string | null;
  subVendorName: string | null;
  totalOrderAmount: number;
  systemSize: number;
  systemType: string;
  zohoLinked: boolean;
  loanCustomer: boolean;
  approvedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  // Derived payment fields — computed server-side once
  effectivePendingAmount: number; // Zoho-linked → pendingAmount, else → totalOrderAmount
  paidAmount: number;             // totalOrderAmount - effectivePendingAmount
  paymentPercentage: number;      // 0–100
  payments: PaymentRecord[];
}

// ------------------------------------
// Financial Year Helpers
// Indian FY: April 1 → March 31
// Q1: Apr–Jun | Q2: Jul–Sep | Q3: Oct–Dec | Q4: Jan–Mar
// ------------------------------------

export interface FYInfo {
  fy: string;         // '2025-26'
  quarter: string;    // 'Q1'
  quarterKey: string; // 'Q1-2025-26'
  monthKey: string;   // '2025-04'
  fyStartYear: number;
}

export function getFYInfo(date: Date): FYInfo {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed

  const fyStartYear = month >= 3 ? year : year - 1;
  const fyEndYear = fyStartYear + 1;
  const fy = `${fyStartYear}-${String(fyEndYear).slice(2)}`;

  let quarter: string;
  if (month >= 3 && month <= 5) quarter = 'Q1';
  else if (month >= 6 && month <= 8) quarter = 'Q2';
  else if (month >= 9 && month <= 11) quarter = 'Q3';
  else quarter = 'Q4'; // Jan(0), Feb(1), Mar(2)

  const monthKey = `${date.getFullYear()}-${String(month + 1).padStart(2, '0')}`;

  return { fy, quarter, quarterKey: `${quarter}-${fy}`, monthKey, fyStartYear };
}

export function formatFYQuarter(quarterKey: string): string {
  // 'Q1-2025-26' → 'Q1 FY25-26'
  const parts = quarterKey.split('-');
  // parts: ['Q1', '2025', '26']
  return `${parts[0]} FY${parts[1].slice(2)}-${parts[2]}`;
}

export function formatMonth(monthKey: string): string {
  // '2025-04' → 'Apr 25'
  const [y, m] = monthKey.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

// ------------------------------------
// Label Maps
// ------------------------------------

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  WALK_IN: 'Walk In',
  WHATSAPP: 'WhatsApp',
  REFERRAL: 'Referral',
  FRIENDS_AND_FAMILY: 'Friends & Family',
  CALLING_ACTIVITY: 'Calling Activity',
  SUB_VENDOR: 'Sub Vendor',
  OTHER: 'Other',
};

export const SYSTEM_TYPE_LABELS: Record<string, string> = {
  ON_GRID: 'On Grid',
  OFF_GRID: 'Off Grid',
  HYBRID: 'Hybrid',
};

export const STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Approved',
  EXECUTION: 'In Execution',
  INSTALLATION_IN_PROGRESS: 'Installation In Progress',
  COMPLETED: 'Completed',
  PENDING_APPROVAL: 'Pending Approval',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  ARCHIVED: 'Archived',
  DRAFT: 'Draft',
};

export const STATUS_COLORS: Record<string, string> = {
  APPROVED: '#1976D2',
  EXECUTION: '#7B1FA2',
  INSTALLATION_IN_PROGRESS: '#00796B',
  COMPLETED: '#388E3C',
  PENDING_APPROVAL: '#F57C00',
  REJECTED: '#D32F2F',
  CANCELLED: '#64748b',
  ARCHIVED: '#94a3b8',
  DRAFT: '#64748b',
};

export const CHART_COLORS = [
  '#1976D2', '#388E3C', '#F57C00', '#7B1FA2',
  '#D32F2F', '#00796B', '#64748b', '#0288D1',
  '#558B2F', '#E64A19', '#5E35B1', '#00838F',
];

// ------------------------------------
// Filter State
// ------------------------------------

export interface FilterState {
  financialYears: string[];  // ['2025-26']
  quarters: string[];        // ['Q1-2025-26']
  months: string[];          // ['2025-04']
  salesmanIds: string[];
  callingExecIds: string[];
  leadSources: string[];
  subVendorIds: string[];
  orderStatuses: string[];
  systemTypes: string[];
  paymentStatus: 'all' | 'pending' | 'partial' | 'paid';
}

export const DEFAULT_FILTER_STATE: FilterState = {
  financialYears: [],
  quarters: [],
  months: [],
  salesmanIds: [],
  callingExecIds: [],
  leadSources: [],
  subVendorIds: [],
  orderStatuses: [],
  systemTypes: [],
  paymentStatus: 'all',
};

export function isFilterEmpty(f: FilterState): boolean {
  return (
    f.financialYears.length === 0 &&
    f.quarters.length === 0 &&
    f.months.length === 0 &&
    f.salesmanIds.length === 0 &&
    f.callingExecIds.length === 0 &&
    f.leadSources.length === 0 &&
    f.subVendorIds.length === 0 &&
    f.orderStatuses.length === 0 &&
    f.systemTypes.length === 0 &&
    f.paymentStatus === 'all'
  );
}

export function countActiveFilters(f: FilterState): number {
  let count = 0;
  if (f.financialYears.length > 0) count++;
  if (f.quarters.length > 0) count++;
  if (f.months.length > 0) count++;
  if (f.salesmanIds.length > 0) count++;
  if (f.callingExecIds.length > 0) count++;
  if (f.leadSources.length > 0) count++;
  if (f.subVendorIds.length > 0) count++;
  if (f.orderStatuses.length > 0) count++;
  if (f.systemTypes.length > 0) count++;
  if (f.paymentStatus !== 'all') count++;
  return count;
}

// ------------------------------------
// Payment Status Helper
// ------------------------------------

export function getPaymentStatus(o: NormalizedOrder): 'pending' | 'partial' | 'paid' {
  if (o.paymentPercentage >= 99.9) return 'paid';
  if (o.paymentPercentage <= 0.01) return 'pending';
  return 'partial';
}

// ------------------------------------
// Filter Application — O(n) single pass
// ------------------------------------

export function applyFilters(orders: NormalizedOrder[], f: FilterState): NormalizedOrder[] {
  if (isFilterEmpty(f)) return orders; // Fast path: no active filters

  return orders.filter(o => {
    const date = new Date(o.orderDate);
    const { fy, quarterKey, monthKey } = getFYInfo(date);

    if (f.financialYears.length > 0 && !f.financialYears.includes(fy)) return false;
    if (f.quarters.length > 0 && !f.quarters.includes(quarterKey)) return false;
    if (f.months.length > 0 && !f.months.includes(monthKey)) return false;
    if (f.salesmanIds.length > 0 && (o.salesmanId === null || !f.salesmanIds.includes(o.salesmanId))) return false;
    if (f.callingExecIds.length > 0 && (o.callingExecutiveId === null || !f.callingExecIds.includes(o.callingExecutiveId))) return false;
    if (f.leadSources.length > 0 && !f.leadSources.includes(o.leadSource)) return false;
    if (f.subVendorIds.length > 0 && (o.subVendorId === null || !f.subVendorIds.includes(o.subVendorId))) return false;
    if (f.orderStatuses.length > 0 && !f.orderStatuses.includes(o.status)) return false;
    if (f.systemTypes.length > 0 && !f.systemTypes.includes(o.systemType)) return false;
    if (f.paymentStatus !== 'all' && getPaymentStatus(o) !== f.paymentStatus) return false;

    return true;
  });
}

// ------------------------------------
// Dynamic Filter Options (from dataset)
// ------------------------------------

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterOptions {
  financialYears: FilterOption[];
  quarters: FilterOption[];
  months: FilterOption[];
  salesmen: FilterOption[];
  callingExecs: FilterOption[];
  subVendors: FilterOption[];
  statuses: FilterOption[];
  systemTypes: FilterOption[];
  leadSources: FilterOption[];
}

export function buildFilterOptions(orders: NormalizedOrder[]): FilterOptions {
  const fySeen = new Map<string, number>(); // fy → fyStartYear
  const quarterSeen = new Set<string>();
  const monthSeen = new Set<string>();
  const salesmanSeen = new Map<string, string>(); // id → name
  const callingExecSeen = new Map<string, string>();
  const subVendorSeen = new Map<string, string>();
  const statusSeen = new Set<string>();
  const systemTypeSeen = new Set<string>();
  const leadSourceSeen = new Set<string>();

  for (const o of orders) {
    const date = new Date(o.orderDate);
    const { fy, quarterKey, monthKey, fyStartYear } = getFYInfo(date);

    fySeen.set(fy, fyStartYear);
    quarterSeen.add(quarterKey);
    monthSeen.add(monthKey);
    statusSeen.add(o.status);
    systemTypeSeen.add(o.systemType);
    leadSourceSeen.add(o.leadSource);

    if (o.salesmanId && o.salesmanName) salesmanSeen.set(o.salesmanId, o.salesmanName);
    if (o.callingExecutiveId && o.callingExecutiveName) callingExecSeen.set(o.callingExecutiveId, o.callingExecutiveName);
    if (o.subVendorId && o.subVendorName) subVendorSeen.set(o.subVendorId, o.subVendorName);
  }

  return {
    financialYears: Array.from(fySeen.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([fy]) => ({ value: fy, label: `FY ${fy}` })),
    quarters: Array.from(quarterSeen)
      .sort()
      .map(q => ({ value: q, label: formatFYQuarter(q) })),
    months: Array.from(monthSeen)
      .sort()
      .map(m => ({ value: m, label: formatMonth(m) })),
    salesmen: Array.from(salesmanSeen.entries())
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    callingExecs: Array.from(callingExecSeen.entries())
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    subVendors: Array.from(subVendorSeen.entries())
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    statuses: Array.from(statusSeen)
      .map(s => ({ value: s, label: STATUS_LABELS[s] ?? s })),
    systemTypes: Array.from(systemTypeSeen)
      .map(t => ({ value: t, label: SYSTEM_TYPE_LABELS[t] ?? t })),
    leadSources: Array.from(leadSourceSeen)
      .map(s => ({ value: s, label: LEAD_SOURCE_LABELS[s] ?? s })),
  };
}

// ------------------------------------
// Report Data Types
// ------------------------------------

export interface SalesmanSummary {
  id: string;
  name: string;
  orders: number;
  totalSales: number;
  pendingAmount: number;
  paidAmount: number;
  collectionPct: number;
  avgOrderValue: number;
  totalKW: number;
  leadSources: Record<string, number>;    // leadSource → count
  monthly: Record<string, { sales: number; orders: number }>; // monthKey → data
  quarterly: Record<string, { sales: number; orders: number }>; // quarterKey → data
}

export interface CallingExecSummary {
  id: string;
  name: string;
  orders: number;
  totalSales: number;
  pendingAmount: number;
  paidAmount: number;
  collectionPct: number;
  avgOrderValue: number;
}

export interface MonthlyData {
  monthKey: string;
  label: string;
  sales: number;
  orders: number;
  pending: number;
  collected: number;
}

export interface QuarterlyData {
  quarterKey: string;
  label: string;
  fy: string;
  quarter: string;
  sales: number;
  orders: number;
  bySalesman: Record<string, number>; // salesmanId → sales
}

export interface StatusData {
  status: string;
  label: string;
  color: string;
  count: number;
  revenue: number;
}

export interface AgeBucket {
  label: string;
  count: number;
  pendingAmount: number;
}

export interface ReportData {
  kpis: {
    totalSales: number;
    totalOrders: number;
    avgOrderValue: number;
    activeCustomers: number;
    totalPending: number;
    collectionPct: number;
    totalKW: number;
  };
  monthly: MonthlyData[];
  quarterly: QuarterlyData[];
  salesmanRanking: SalesmanSummary[];
  callingExecRanking: CallingExecSummary[];
  leadSource: { source: string; label: string; sales: number; orders: number }[];
  systemType: { type: string; label: string; sales: number; orders: number }[];
  statusDistribution: StatusData[];
  paymentMode: { mode: string; label: string; amount: number; count: number }[];
  ageBuckets: AgeBucket[];
  avgPricePerKW: number;
}

// ------------------------------------
// buildReportData — Single pass O(n)
// All charts read from this output.
// ------------------------------------

const PAYMENT_MODE_LABELS: Record<string, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque',
  UPI: 'UPI',
};

const ACTIVE_STATUSES = new Set(['APPROVED', 'EXECUTION', 'INSTALLATION_IN_PROGRESS', 'COMPLETED']);

export function buildReportData(orders: NormalizedOrder[]): ReportData {
  if (orders.length === 0) {
    return {
      kpis: { totalSales: 0, totalOrders: 0, avgOrderValue: 0, activeCustomers: 0, totalPending: 0, collectionPct: 0, totalKW: 0 },
      monthly: [], quarterly: [], salesmanRanking: [], callingExecRanking: [],
      leadSource: [], systemType: [], statusDistribution: [], paymentMode: [],
      ageBuckets: [
        { label: '< 30 Days', count: 0, pendingAmount: 0 },
        { label: '30–60 Days', count: 0, pendingAmount: 0 },
        { label: '60–90 Days', count: 0, pendingAmount: 0 },
        { label: '90+ Days', count: 0, pendingAmount: 0 },
      ],
      avgPricePerKW: 0,
    };
  }

  const now = Date.now();

  // --- KPI accumulators ---
  let totalSales = 0;
  let totalPending = 0;
  let totalKW = 0;
  const activeCustomers = new Set<string>();

  // --- Time series ---
  const monthlyMap = new Map<string, MonthlyData>();
  const quarterlyMap = new Map<string, QuarterlyData>();

  // --- Dimension maps ---
  const salesmanMap = new Map<string, SalesmanSummary>();
  const callingExecMap = new Map<string, CallingExecSummary>();
  const leadSourceMap = new Map<string, { sales: number; orders: number }>();
  const systemTypeMap = new Map<string, { sales: number; orders: number }>();
  const statusMap = new Map<string, StatusData>();
  const paymentModeMap = new Map<string, { amount: number; count: number }>();

  // --- Age buckets ---
  const bucketKeys = ['<30', '30-60', '60-90', '90+'] as const;
  type BucketKey = typeof bucketKeys[number];
  const ageBucketLabels: Record<BucketKey, string> = {
    '<30': '< 30 Days',
    '30-60': '30–60 Days',
    '60-90': '60–90 Days',
    '90+': '90+ Days',
  };
  const ageBucketsAcc: Record<BucketKey, AgeBucket> = {
    '<30':  { label: '< 30 Days',  count: 0, pendingAmount: 0 },
    '30-60': { label: '30–60 Days', count: 0, pendingAmount: 0 },
    '60-90': { label: '60–90 Days', count: 0, pendingAmount: 0 },
    '90+':  { label: '90+ Days',   count: 0, pendingAmount: 0 },
  };

  // === Single loop over all orders ===
  for (const o of orders) {
    const date = new Date(o.orderDate);
    const { fy, quarter, quarterKey, monthKey } = getFYInfo(date);
    const monthLabel = formatMonth(monthKey);
    const quarterLabel = formatFYQuarter(quarterKey);

    // KPIs
    totalSales += o.totalOrderAmount;
    totalPending += o.effectivePendingAmount;
    totalKW += o.systemSize;
    if (ACTIVE_STATUSES.has(o.status)) {
      activeCustomers.add(o.customerName);
    }

    // --- Monthly ---
    let mEntry = monthlyMap.get(monthKey);
    if (!mEntry) {
      mEntry = { monthKey, label: monthLabel, sales: 0, orders: 0, pending: 0, collected: 0 };
      monthlyMap.set(monthKey, mEntry);
    }
    mEntry.sales += o.totalOrderAmount;
    mEntry.orders += 1;
    mEntry.pending += o.effectivePendingAmount;
    mEntry.collected += o.paidAmount;

    // --- Quarterly ---
    let qEntry = quarterlyMap.get(quarterKey);
    if (!qEntry) {
      qEntry = { quarterKey, label: quarterLabel, fy, quarter, sales: 0, orders: 0, bySalesman: {} };
      quarterlyMap.set(quarterKey, qEntry);
    }
    qEntry.sales += o.totalOrderAmount;
    qEntry.orders += 1;
    if (o.salesmanId) {
      qEntry.bySalesman[o.salesmanId] = (qEntry.bySalesman[o.salesmanId] ?? 0) + o.totalOrderAmount;
    }

    // --- Salesman ---
    if (o.salesmanId) {
      let sm = salesmanMap.get(o.salesmanId);
      if (!sm) {
        sm = {
          id: o.salesmanId,
          name: o.salesmanName ?? 'Unknown',
          orders: 0, totalSales: 0, pendingAmount: 0, paidAmount: 0,
          collectionPct: 0, avgOrderValue: 0, totalKW: 0,
          leadSources: {}, monthly: {}, quarterly: {},
        };
        salesmanMap.set(o.salesmanId, sm);
      }
      sm.orders += 1;
      sm.totalSales += o.totalOrderAmount;
      sm.pendingAmount += o.effectivePendingAmount;
      sm.paidAmount += o.paidAmount;
      sm.totalKW += o.systemSize;
      sm.leadSources[o.leadSource] = (sm.leadSources[o.leadSource] ?? 0) + 1;

      const smMonth = sm.monthly[monthKey] ?? { sales: 0, orders: 0 };
      smMonth.sales += o.totalOrderAmount;
      smMonth.orders += 1;
      sm.monthly[monthKey] = smMonth;

      const smQtr = sm.quarterly[quarterKey] ?? { sales: 0, orders: 0 };
      smQtr.sales += o.totalOrderAmount;
      smQtr.orders += 1;
      sm.quarterly[quarterKey] = smQtr;
    }

    // --- Calling Executive ---
    if (o.callingExecutiveId) {
      let ce = callingExecMap.get(o.callingExecutiveId);
      if (!ce) {
        ce = {
          id: o.callingExecutiveId,
          name: o.callingExecutiveName ?? 'Unknown',
          orders: 0, totalSales: 0, pendingAmount: 0, paidAmount: 0,
          collectionPct: 0, avgOrderValue: 0,
        };
        callingExecMap.set(o.callingExecutiveId, ce);
      }
      ce.orders += 1;
      ce.totalSales += o.totalOrderAmount;
      ce.pendingAmount += o.effectivePendingAmount;
      ce.paidAmount += o.paidAmount;
    }

    // --- Lead Source ---
    let ls = leadSourceMap.get(o.leadSource);
    if (!ls) {
      ls = { sales: 0, orders: 0 };
      leadSourceMap.set(o.leadSource, ls);
    }
    ls.sales += o.totalOrderAmount;
    ls.orders += 1;

    // --- System Type ---
    let st = systemTypeMap.get(o.systemType);
    if (!st) {
      st = { sales: 0, orders: 0 };
      systemTypeMap.set(o.systemType, st);
    }
    st.sales += o.totalOrderAmount;
    st.orders += 1;

    // --- Status Distribution ---
    let sd = statusMap.get(o.status);
    if (!sd) {
      sd = {
        status: o.status,
        label: STATUS_LABELS[o.status] ?? o.status,
        color: STATUS_COLORS[o.status] ?? '#64748b',
        count: 0, revenue: 0,
      };
      statusMap.set(o.status, sd);
    }
    sd.count += 1;
    sd.revenue += o.totalOrderAmount;

    // --- Payment Mode ---
    for (const p of o.payments) {
      let pm = paymentModeMap.get(p.paymentMode);
      if (!pm) {
        pm = { amount: 0, count: 0 };
        paymentModeMap.set(p.paymentMode, pm);
      }
      pm.amount += p.amount;
      pm.count += 1;
    }

    // --- Age Buckets (outstanding orders only) ---
    if (o.effectivePendingAmount > 0) {
      const daysSince = Math.floor((now - date.getTime()) / 86_400_000);
      let key: BucketKey;
      if (daysSince < 30) key = '<30';
      else if (daysSince < 60) key = '30-60';
      else if (daysSince < 90) key = '60-90';
      else key = '90+';
      ageBucketsAcc[key].count += 1;
      ageBucketsAcc[key].pendingAmount += o.effectivePendingAmount;
    }
  }

  // --- Finalize derived fields ---
  const totalOrders = orders.length;
  const collectionPct = totalSales > 0 ? ((totalSales - totalPending) / totalSales) * 100 : 0;

  const salesmanRanking = Array.from(salesmanMap.values())
    .map(sm => ({
      ...sm,
      collectionPct: sm.totalSales > 0 ? (sm.paidAmount / sm.totalSales) * 100 : 0,
      avgOrderValue: sm.orders > 0 ? sm.totalSales / sm.orders : 0,
    }))
    .sort((a, b) => b.totalSales - a.totalSales);

  const callingExecRanking = Array.from(callingExecMap.values())
    .map(ce => ({
      ...ce,
      collectionPct: ce.totalSales > 0 ? (ce.paidAmount / ce.totalSales) * 100 : 0,
      avgOrderValue: ce.orders > 0 ? ce.totalSales / ce.orders : 0,
    }))
    .sort((a, b) => b.totalSales - a.totalSales);

  return {
    kpis: {
      totalSales,
      totalOrders,
      avgOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
      activeCustomers: activeCustomers.size,
      totalPending,
      collectionPct,
      totalKW,
    },
    monthly: Array.from(monthlyMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey)),
    quarterly: Array.from(quarterlyMap.values()).sort((a, b) => a.quarterKey.localeCompare(b.quarterKey)),
    salesmanRanking,
    callingExecRanking,
    leadSource: Array.from(leadSourceMap.entries())
      .map(([source, data]) => ({ source, label: LEAD_SOURCE_LABELS[source] ?? source, ...data }))
      .sort((a, b) => b.sales - a.sales),
    systemType: Array.from(systemTypeMap.entries())
      .map(([type, data]) => ({ type, label: SYSTEM_TYPE_LABELS[type] ?? type, ...data }))
      .sort((a, b) => b.sales - a.sales),
    statusDistribution: Array.from(statusMap.values()).sort((a, b) => b.count - a.count),
    paymentMode: Array.from(paymentModeMap.entries())
      .map(([mode, data]) => ({ mode, label: PAYMENT_MODE_LABELS[mode] ?? mode, ...data }))
      .sort((a, b) => b.amount - a.amount),
    ageBuckets: bucketKeys.map(k => ageBucketsAcc[k]),
    avgPricePerKW: totalKW > 0 ? totalSales / totalKW : 0,
  };
}

// ------------------------------------
// CSV Export (client-side)
// ------------------------------------

export function exportOrdersToCSV(orders: NormalizedOrder[], filename: string): void {
  const headers = [
    'Order Number', 'Order Date', 'Customer Name', 'Salesman', 'Calling Executive',
    'Lead Source', 'System Size (kW)', 'System Type', 'Order Amount (₹)',
    'Paid Amount (₹)', 'Pending Amount (₹)', 'Payment %', 'Status',
  ];

  const rows = orders.map(o => [
    o.orderNumber,
    new Date(o.orderDate).toLocaleDateString('en-IN'),
    o.customerName,
    o.salesmanName ?? '',
    o.callingExecutiveName ?? '',
    LEAD_SOURCE_LABELS[o.leadSource] ?? o.leadSource,
    o.systemSize.toFixed(1),
    SYSTEM_TYPE_LABELS[o.systemType] ?? o.systemType,
    o.totalOrderAmount.toFixed(2),
    o.paidAmount.toFixed(2),
    o.effectivePendingAmount.toFixed(2),
    o.paymentPercentage.toFixed(1) + '%',
    STATUS_LABELS[o.status] ?? o.status,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
