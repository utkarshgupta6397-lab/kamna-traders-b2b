import { prisma } from './db';

export const PAYMENT_MODES = ['POS'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PAYMENT_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

/**
 * Returns today's date string YYYY-MM-DD in Asia/Kolkata business timezone
 */
export function getTodayDateStringIST(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date()); // Outputs YYYY-MM-DD
}

/**
 * Returns YYMMDD string in Asia/Kolkata business timezone for request numbering
 */
export function getDatePartForSequenceIST(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);

  const year = parts.find((p) => p.type === 'year')?.value || '00';
  const month = parts.find((p) => p.type === 'month')?.value || '00';
  const day = parts.find((p) => p.type === 'day')?.value || '00';

  return `${year}${month}${day}`; // e.g. 260916
}

/**
 * Atomic, collision-safe, concurrency-safe server-side request number generator
 * Returns format: PAY-YYMMDD-NNN (e.g. PAY-260916-001)
 */
export async function generatePaymentRequestNumber(): Promise<string> {
  const dateKey = getDatePartForSequenceIST();

  const result = await prisma.$queryRawUnsafe<Array<{ sequence: number }>>(
    `INSERT INTO "PaymentSequence" ("date", "sequence")
     VALUES ($1, 1)
     ON CONFLICT ("date")
     DO UPDATE SET "sequence" = "PaymentSequence"."sequence" + 1
     RETURNING "sequence"`,
    dateKey
  );

  const seq = result[0]?.sequence ?? 1;
  const seqStr = String(seq).padStart(3, '0');
  return `PAY-${dateKey}-${seqStr}`;
}

/**
 * Returns start and end UTC Date for a given YYYY-MM-DD
 */
export function getISTDayRange(dateStr: string = getTodayDateStringIST()): { start: Date; end: Date } {
  return {
    start: new Date(`${dateStr}T00:00:00.000Z`),
    end: new Date(`${dateStr}T23:59:59.999Z`),
  };
}

/**
 * Returns allowed payment date range in IST:
 * maxDate = today
 * minDate = today - 15 calendar days
 */
export function getAllowedPaymentDateRangeIST(): { minDate: string; maxDate: string } {
  const maxDate = getTodayDateStringIST();
  const [year, month, day] = maxDate.split('-').map(Number);
  const minDateObj = new Date(Date.UTC(year, month - 1, day - 15));
  const minFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const minDate = minFormatter.format(minDateObj);
  return { minDate, maxDate };
}

