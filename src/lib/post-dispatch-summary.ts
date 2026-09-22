import { prisma } from './db';

export interface DailySalesTrendPoint {
  date: string; // ISO date format in IST: YYYY-MM-DD
  dayOfWeek: string; // 'Mon', 'Tue', 'Wed', etc.
  formattedDate: string; // '13 Sep'
  fullDate: string; // '13 Sep 2026'
  isToday: boolean;
  sales: number;
  invoiceCount: number;
  movingAverage: number;
  formattedSales: string; // Compact Indian format e.g. "₹30.91 L" or "₹85,500"
  formattedMovingAverage: string; // Compact Indian format e.g. "₹24.52 L"
  fullFormattedSales?: string; // Standard INR e.g. "₹30,91,331"
  fullFormattedMovingAverage?: string; // Standard INR e.g. "₹24,51,890"
}

export interface PostDispatchDashboardSummary {
  totalSalesToday: number;
  totalInvoiceToday: number;
  pendingStockApprovals: number;
  dateRange: {
    start: string;
    end: string;
  };
  salesTrend: DailySalesTrendPoint[]; // 10 visible days (oldest to newest, today is index 9)
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formats currency values in compact Indian notation:
 * >= ₹1,00,00,000: Crores (e.g. ₹1.00 Cr, ₹2.50 Cr)
 * >= ₹1,00,000: Lakhs (e.g. ₹30.91 L, ₹1.00 L, ₹8.50 L)
 * < ₹1,00,000: Standard rupees (e.g. ₹85,500, ₹50,000, ₹9,999, ₹0)
 */
export function formatCompactInr(amount: number): string {
  if (!amount || amount === 0) return '₹0';
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (absAmount >= 10000000) {
    const cr = absAmount / 10000000;
    return `${sign}₹${cr.toFixed(2)} Cr`;
  } else if (absAmount >= 100000) {
    const lakh = absAmount / 100000;
    return `${sign}₹${lakh.toFixed(2)} L`;
  } else {
    return `${sign}${new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(absAmount)}`;
  }
}

/**
 * Formatter for compact Y-axis tick values (e.g. ₹0, ₹5 L, ₹10 L, ₹1 Cr)
 */
export function formatCompactInrAxis(amount: number): string {
  if (!amount || amount === 0) return '₹0';
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (absAmount >= 10000000) {
    const cr = absAmount / 10000000;
    const formatted = cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1);
    return `${sign}₹${formatted} Cr`;
  } else if (absAmount >= 100000) {
    const lakh = absAmount / 100000;
    const formatted = lakh % 1 === 0 ? lakh.toFixed(0) : lakh.toFixed(1);
    return `${sign}₹${formatted} L`;
  } else {
    return `${sign}${new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(absAmount)}`;
  }
}

/**
 * Computes 16-day IST calendar days (6 historical buffer days + 10 visible days).
 * IST offset: UTC+5:30.
 *
 * Days index 0..5: 6 buffer days (Day -15 through Day -10)
 * Days index 6..15: 10 visible days (Day -9 through Day 0/Today)
 */
export function getIst16DayRange(): {
  allDays: Array<{
    dateStr: string;
    dayOfWeek: string;
    formattedDate: string;
    fullDate: string;
    start: Date;
    end: Date;
    isToday: boolean;
  }>;
  start16Days: Date;
  todayEnd: Date;
} {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);

  const istYear = istNow.getUTCFullYear();
  const istMonth = istNow.getUTCMonth();
  const istDate = istNow.getUTCDate();

  const allDays = [];

  // Generate 16 days in chronological order: i=15 (15 days ago) down to i=0 (today)
  for (let i = 15; i >= 0; i--) {
    const dayStartUtc = Date.UTC(istYear, istMonth, istDate - i, 0, 0, 0, 0) - istOffsetMs;
    const dayEndUtc = Date.UTC(istYear, istMonth, istDate - i, 23, 59, 59, 999) - istOffsetMs;

    // Date object representing midnight in IST
    const d = new Date(dayStartUtc + istOffsetMs);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const dayNum = d.getUTCDate();
    const dayOfWeek = DAY_NAMES[d.getUTCDay()];

    const yStr = String(y);
    const mStr = String(m + 1).padStart(2, '0');
    const dStr = String(dayNum).padStart(2, '0');
    const dateStr = `${yStr}-${mStr}-${dStr}`;

    allDays.push({
      dateStr,
      dayOfWeek,
      formattedDate: `${dayNum} ${MONTH_NAMES[m]}`,
      fullDate: `${dayNum} ${MONTH_NAMES[m]} ${y}`,
      start: new Date(dayStartUtc),
      end: new Date(dayEndUtc),
      isToday: i === 0,
    });
  }

  return {
    allDays,
    start16Days: allDays[0].start,
    todayEnd: allDays[15].end,
  };
}

/**
 * Deprecated alias maintained for backward compatibility.
 */
export function getIst9DayRange() {
  const { allDays, todayEnd } = getIst16DayRange();
  // Return last 9 days
  const subDays = allDays.slice(7);
  return {
    allDays: subDays,
    start9Days: subDays[0].start,
    todayEnd,
  };
}

/**
 * Authoritative service to fetch Post-Dispatch summary KPIs and 10-day sales trend
 * with a 7-day rolling moving average overlay.
 */
export async function getPostDispatchDashboardSummary(): Promise<PostDispatchDashboardSummary> {
  const { allDays, start16Days, todayEnd } = getIst16DayRange();

  // Authoritative SQL aggregation using PostDispatchInvoice (Active and valid Archived invoices)
  // excluding void and draft invoices, grouped by date in Asia/Kolkata timezone
  const [rows, pendingStockApprovals] = await Promise.all([
    prisma.$queryRaw<Array<{ ist_date: string; count: number; total_sales: number }>>`
      SELECT 
        TO_CHAR("zohoCreatedTime" AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') as ist_date,
        COUNT(*)::int as count,
        COALESCE(SUM("total"), 0)::float as total_sales
      FROM "PostDispatchInvoice"
      WHERE LOWER("zohoStatus") NOT IN ('void', 'draft')
        AND ("erpSubStatus" IS NULL OR LOWER("erpSubStatus") != 'void')
        AND "zohoCreatedTime" >= ${start16Days}
        AND "zohoCreatedTime" <= ${todayEnd}
      GROUP BY ist_date
      ORDER BY ist_date ASC;
    `,
    prisma.stockDeductionAllocation.count({
      where: { status: 'SUBMITTED_FOR_APPROVAL' },
    }),
  ]);

  const salesMap = new Map<string, { count: number; total: number }>();
  for (const r of rows) {
    salesMap.set(r.ist_date, {
      count: Number(r.count || 0),
      total: Number(r.total_sales || 0),
    });
  }

  // Populate sales data across all 16 calendar days (including zero-sales days)
  const populatedDays = allDays.map((d) => {
    const data = salesMap.get(d.dateStr) || { count: 0, total: 0 };
    return {
      ...d,
      sales: data.total,
      invoiceCount: data.count,
    };
  });

  // Calculate 7-day trailing moving average for the 10 visible days (indices 6 to 15)
  // For visible index v (0 to 9), full index is v + 6
  // MA(v) = (sum of sales for day fullIdx and previous 6 days) / 7
  const visibleTrend: DailySalesTrendPoint[] = [];

  for (let v = 0; v < 10; v++) {
    const fullIdx = v + 6;
    const currentDay = populatedDays[fullIdx];

    let sum7 = 0;
    for (let k = 0; k < 7; k++) {
      sum7 += populatedDays[fullIdx - k].sales;
    }
    const ma7 = sum7 / 7;

    const s0 = currentDay.sales;

    visibleTrend.push({
      date: currentDay.dateStr,
      dayOfWeek: currentDay.dayOfWeek,
      formattedDate: currentDay.formattedDate,
      fullDate: currentDay.fullDate,
      isToday: currentDay.isToday,
      sales: Math.round(s0 * 100) / 100,
      invoiceCount: currentDay.invoiceCount,
      movingAverage: Math.round(ma7 * 100) / 100,
      formattedSales: formatCompactInr(s0),
      formattedMovingAverage: formatCompactInr(ma7),
      fullFormattedSales: formatInr(s0),
      fullFormattedMovingAverage: formatInr(Math.round(ma7)),
    });
  }

  // Today is the right-most day (index 9 of visibleTrend)
  const todayItem = visibleTrend[9];
  const todayRange = {
    start: allDays[15].start.toISOString(),
    end: allDays[15].end.toISOString(),
  };

  return {
    totalSalesToday: todayItem.sales,
    totalInvoiceToday: todayItem.invoiceCount,
    pendingStockApprovals,
    dateRange: todayRange,
    salesTrend: visibleTrend,
  };
}
