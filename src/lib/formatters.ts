export function formatIndianCurrency(value: number, short: boolean = true): string {
  if (value === null || value === undefined) return '₹0';

  if (short) {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  }

  // Use Intl.NumberFormat for standard Indian comma placement
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatIndianNumber(value: number): string {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercentage(value: number): string {
  if (value === null || value === undefined) return '0.00%';
  return `${value.toFixed(2)}%`;
}
