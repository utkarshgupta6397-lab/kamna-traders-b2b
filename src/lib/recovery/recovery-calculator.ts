/**
 * Authoritative Recovery Queue Calculations & Rules
 * Kamna Traders ERP | Accounts Module
 */

export interface RawInvoiceRow {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  createdTime?: string | null;
  customerId: string;
  customerName: string;
  customerGst?: string | null;
  salespersonName?: string | null;
  invoiceValue: number;
  amountPaid: number;
  amountPending: number;
  paymentStatus: string; // 'paid' | 'partially_paid' | 'unpaid' | 'void'
  lastPaymentDate?: string | null;
}

export type AgingBucketKey = '0-30' | '31-60' | '61-90' | '90+';

export const RECOVERY_STATUSES = [
  { id: 'PENDING_FOLLOW_UP', label: 'Pending Follow-up', color: 'slate' },
  { id: 'CONTACTED', label: 'Contacted', color: 'blue' },
  { id: 'PROMISE_TO_PAY', label: 'Promise to Pay', color: 'amber' },
  { id: 'PAYMENT_DISPUTED', label: 'Payment Disputed / Reconciliation Required', color: 'rose' },
  { id: 'PARTIALLY_RECOVERED', label: 'Partially Recovered', color: 'cyan' },
  { id: 'FULLY_RECOVERED', label: 'Fully Recovered', color: 'emerald' },
  { id: 'ON_HOLD', label: 'On Hold / Management Review', color: 'purple' },
  { id: 'CUSTOMER_UNREACHABLE', label: 'Customer Unreachable', color: 'orange' },
] as const;

export type RecoveryStatusId = typeof RECOVERY_STATUSES[number]['id'];

/**
 * Authoritative business rule: whether an invoice is operationally open.
 * Preserves the exact ERP logic:
 * 1) Any invoice with status 'paid' or 'void' is closed.
 * 2) Any invoice with amountPending <= 0 is closed.
 * 3) Any invoice with |amountPending| <= 10 is considered settled (tolerance).
 * 4) Any invoice with invoiceValue > 100,000 and |amountPending| <= 100 is considered settled.
 */
export function isOperationallyOpen(row: {
  paymentStatus?: string | null;
  amountPending?: number | null;
  invoiceValue?: number | null;
}): boolean {
  const status = (row.paymentStatus || '').toLowerCase();
  if (status === 'paid' || status === 'void') return false;

  const pending = Number(row.amountPending || 0);
  if (pending <= 0) return false;

  const absPending = Math.abs(pending);
  const total = Number(row.invoiceValue || 0);

  // Rule 1: <= ₹10 variance is always ignored
  if (absPending <= 10) return false;

  // Rule 2: Large invoices can have <= ₹100 variance
  if (total > 100000 && absPending <= 100) return false;

  return true;
}

/**
 * Computes overdue days relative to a reference date.
 */
export function getInvoiceOverdueDays(
  row: { dueDate?: string | null; invoiceDate?: string | null },
  asOfDate: Date = new Date()
): { isOverdue: boolean; overdueDays: number } {
  const asOfTime = asOfDate.getTime();
  const dateStr = row.dueDate || row.invoiceDate;

  if (!dateStr) {
    return { isOverdue: false, overdueDays: 0 };
  }

  const targetDate = new Date(dateStr);
  if (isNaN(targetDate.getTime())) {
    return { isOverdue: false, overdueDays: 0 };
  }

  // Calculate elapsed days
  const diffMs = asOfTime - targetDate.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (row.dueDate) {
    // If dueDate specified, overdue only if targetDate is before asOfDate
    const isOverdue = diffDays > 0;
    return {
      isOverdue,
      overdueDays: Math.max(0, diffDays),
    };
  }

  // Fallback to invoice age if no due date
  return {
    isOverdue: diffDays > 30, // 30-day grace assumption if no due date
    overdueDays: Math.max(0, diffDays),
  };
}

/**
 * Classifies overdue or invoice age into aging buckets.
 */
export function getAgingBucket(days: number): AgingBucketKey {
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

/**
 * Formats a number as Indian currency with symbol and grouping (e.g. ₹1,23,456.78).
 */
export function formatINR(val: number, options: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {}): string {
  if (isNaN(val) || val === null || val === undefined) return '₹0.00';
  const isNegative = val < 0;
  const absVal = Math.abs(val);

  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  }).format(absVal);

  return isNegative ? `-${formatted}` : formatted;
}

export interface CustomerBalanceMetrics {
  netBalance: number;
  netOutstanding: number;
  netPayableBalance: number;
  isAdvance: boolean;
}

/**
 * Computes customer net outstanding based on authoritative closing balance:
 * Net Balance = Net Receivable − Net Payable
 * Net Outstanding = max(Net Balance, 0)
 * Net Payable Balance = max(-Net Balance, 0)
 * Total Outstanding = Σ max(Net Receivable − Net Payable, 0)
 * If customer is in advance / net credit balance (closingBalance < 0), netOutstanding is 0.
 */
export function computeCustomerNetOutstanding(
  closingBalance: number | null | undefined,
  fallbackInvoicePending: number = 0
): CustomerBalanceMetrics {
  const hasAuthoritativeBalance =
    closingBalance !== null && closingBalance !== undefined && !isNaN(Number(closingBalance));

  const netBalance = hasAuthoritativeBalance ? Number(closingBalance) : Number(fallbackInvoicePending || 0);
  const netOutstanding = Math.max(0, netBalance);
  const netPayableBalance = Math.max(0, -netBalance);
  const isAdvance = netBalance < 0;

  return {
    netBalance,
    netOutstanding,
    netPayableBalance,
    isAdvance,
  };
}

/**
 * Generates direct Zoho Books contact deep-link URL.
 */
export function getZohoContactUrl(contactId: string, orgId: string = '60027595766'): string {
  if (!contactId) return '#';
  return `https://books.zoho.in/app/${orgId}#/contacts/${contactId}`;
}
