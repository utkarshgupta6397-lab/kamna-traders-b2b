
/**
 * Shared logic for inventory consumption (CPD) and DOI calculations.
 * Ensures consistency across main dashboard, SKU insights, and reports.
 */

import { DOI_THRESHOLDS } from '../config';

/**
 * Calculates the denominator for Average Daily Outward (CPD).
 * 
 * Logic:
 * - If SKU is mature (>= 7 days since first sale), denominator is 7.
 * - If SKU is new (< 7 days), denominator is the count of distinct days it had movement.
 * - Default is 7 if no history exists.
 */
export function calculateConsumptionDenominator(
  firstSaleDate: Date | string | null | undefined,
  activeMovementDaysCount: number
): number {
  if (!firstSaleDate) return 7;
  
  const firstDate = firstSaleDate instanceof Date ? firstSaleDate : new Date(firstSaleDate);
  const now = new Date();
  const msDiff = now.getTime() - firstDate.getTime();
  const ageInDays = Math.ceil(msDiff / (1000 * 60 * 60 * 24));
  
  if (ageInDays >= 7) return 7;
  return Math.max(1, activeMovementDaysCount);
}

/**
 * Formats DOI (Days of Inventory) based on stock and consumption.
 */
export function calculateDOIInfo(stock: number, cpd: number) {
  if (cpd <= 0) return { text: '∞', status: 'HEALTHY' as const, value: Infinity };
  
  const doi = Math.round(stock / cpd);
  let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
  
  if (doi <= DOI_THRESHOLDS.CRITICAL) status = 'CRITICAL';
  else if (doi <= DOI_THRESHOLDS.WARNING) status = 'WARNING';
  
  return { 
    text: `${doi}d`, 
    status, 
    value: doi 
  };
}

/**
 * Formats Consumption Per Day (CPD) for display.
 */
export function formatCPDValue(val: number): string {
  if (val === 0) return '0';
  if (val >= 100) return Math.round(val).toString();
  return val.toFixed(1);
}
