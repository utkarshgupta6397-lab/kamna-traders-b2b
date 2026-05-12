import { format } from 'date-fns';

/**
 * Standardizes date formatting to: 05-May-2026
 */
export function formatStockDate(date: Date | string | number): string {
  if (!date) return '-';
  const d = new Date(date);
  return format(d, 'dd-MMM-yyyy');
}

/**
 * Standardizes date and time formatting to: 05-May-2026 14:30
 */
export function formatStockDateTime(date: Date | string | number): string {
  if (!date) return '-';
  const d = new Date(date);
  return format(d, 'dd-MMM-yyyy HH:mm');
}
