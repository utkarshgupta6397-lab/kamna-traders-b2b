import { prisma } from './db';

export interface DailySalesTrendPoint {
  date: string; // ISO date format in IST: YYYY-MM-DD
  dayOfWeek: string; // 'Mon', 'Tue', 'Wed', etc.
  formattedDate: string; // '16 Sep'
  fullDate: string; // '16 Sep 2026'
  isToday: boolean;
  sales: number;
  invoiceCount: number;
  movingAverage: number;
  formattedSales: string;
  formattedMovingAverage: string;
}

export interface PostDispatchDashboardSummary {
  totalSalesToday: number;
  totalInvoiceToday: number;
  dateRange: {
    start: string;
    end: string;
  };
  salesTrend: DailySalesTrendPoint[];
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
 * Computes the 9-day IST calendar days (2 historical buffer days + 7 visible days).
 * IST offset: UTC+5:30.
 */
export function getIst9DayRange(): {
  allDays: Array<{
    dateStr: string;
    dayOfWeek: string;
    formattedDate: string;
    fullDate: string;
    start: Date;
    end: Date;
    isToday: boolean;
  }>;
  start9Days: Date;
  todayEnd: Date;
} {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);

  const istYear = istNow.getUTCFullYear();
  const istMonth = istNow.getUTCMonth();
  const istDate = istNow.getUTCDate();

  const allDays = [];

  // Generate 9 days in chronological order: i=8 (8 days ago) down to i=0 (today)
  for (let i = 8; i >= 0; i--) {
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
    start9Days: allDays[0].start,
    todayEnd: allDays[8].end,
  };
}

/**
 * Authoritative service to fetch Post-Dispatch summary KPIs and 7-day sales trend
 * with a 3-day moving average overlay.
 */
export async function getPostDispatchDashboardSummary(): Promise<PostDispatchDashboardSummary> {
  const { allDays, start9Days, todayEnd } = getIst9DayRange();

  // Authoritative SQL aggregation using PostDispatchInvoice with erpStatus = 'Active'
  // and grouping by date in Asia/Kolkata timezone
  const rows = await prisma.$queryRaw<Array<{ ist_date: string; count: number; total_sales: number }>>`
    SELECT 
      TO_CHAR("zohoCreatedTime" AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') as ist_date,
      COUNT(*)::int as count,
      COALESCE(SUM("total"), 0)::float as total_sales
    FROM "PostDispatchInvoice"
    WHERE "erpStatus" = 'Active'
      AND "zohoCreatedTime" >= ${start9Days}
      AND "zohoCreatedTime" <= ${todayEnd}
    GROUP BY ist_date
    ORDER BY ist_date ASC;
  `;

  const salesMap = new Map<string, { count: number; total: number }>();
  for (const r of rows) {
    salesMap.set(r.ist_date, {
      count: Number(r.count || 0),
      total: Number(r.total_sales || 0),
    });
  }

  // Populate sales data across all 9 calendar days (including zero-sales days)
  const populatedDays = allDays.map((d) => {
    const data = salesMap.get(d.dateStr) || { count: 0, total: 0 };
    return {
      ...d,
      sales: data.total,
      invoiceCount: data.count,
    };
  });

  // Calculate 3-day trailing moving average for the 7 visible days (indices 2 to 8)
  // For visible index v (0 to 6), full index is v + 2
  // MA = (sales[v+2] + sales[v+1] + sales[v]) / 3
  const visibleTrend: DailySalesTrendPoint[] = [];

  for (let v = 0; v < 7; v++) {
    const fullIdx = v + 2;
    const currentDay = populatedDays[fullIdx];
    const prevDay1 = populatedDays[fullIdx - 1];
    const prevDay2 = populatedDays[fullIdx - 2];

    const s0 = currentDay.sales;
    const s1 = prevDay1.sales;
    const s2 = prevDay2.sales;

    const ma = (s0 + s1 + s2) / 3;

    visibleTrend.push({
      date: currentDay.dateStr,
      dayOfWeek: currentDay.dayOfWeek,
      formattedDate: currentDay.formattedDate,
      fullDate: currentDay.fullDate,
      isToday: currentDay.isToday,
      sales: Math.round(s0 * 100) / 100,
      invoiceCount: currentDay.invoiceCount,
      movingAverage: Math.round(ma * 100) / 100,
      formattedSales: formatInr(s0),
      formattedMovingAverage: formatInr(Math.round(ma)),
    });
  }

  // Today is the last day (index 6 of visibleTrend)
  const todayItem = visibleTrend[6];
  const todayRange = {
    start: allDays[8].start.toISOString(),
    end: allDays[8].end.toISOString(),
  };

  return {
    totalSalesToday: todayItem.sales,
    totalInvoiceToday: todayItem.invoiceCount,
    dateRange: todayRange,
    salesTrend: visibleTrend,
  };
}
