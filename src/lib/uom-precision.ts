/**
 * UOM-level quantity precision control utility.
 * 
 * Rules:
 * - isDecimal = false: Whole numbers (integers) only. Decimals forbidden.
 * - isDecimal = true: Quantities may contain up to 2 decimal places. More than 2 rejected.
 * - Negative values are allowed where supported (e.g. inventory adjustments).
 * - Never silently round invalid values.
 */

export interface PrecisionValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates whether a quantity string or number strictly complies with the UOM's precision rule.
 */
export function validateQuantityPrecision(
  qty: number | string | null | undefined,
  isDecimal: boolean
): PrecisionValidationResult {
  if (qty === null || qty === undefined) {
    return { valid: false, error: 'Quantity is required.' };
  }

  const str = String(qty).trim();
  if (!str) {
    return { valid: false, error: 'Quantity is required.' };
  }

  const num = parseFloat(str);
  if (isNaN(num)) {
    return { valid: false, error: 'Invalid numeric quantity.' };
  }

  if (isDecimal) {
    // Allows up to 2 decimal places (e.g. 10, 10.5, 10.25, -5.3, -12.34)
    if (!/^[-+]?\d+(\.\d{1,2})?$/.test(str)) {
      return { valid: false, error: 'Invalid quantity: Maximum 2 decimal places allowed.' };
    }
  } else {
    // Allows integers only (e.g. 10, -5, +20)
    if (!/^[-+]?\d+$/.test(str)) {
      return { valid: false, error: 'Invalid quantity: Decimals are not allowed for this unit of measurement (whole numbers only).' };
    }
  }

  return { valid: true };
}

/**
 * Validates intermediate/live user input into an input element.
 * Allows empty string, solitary '-' or '+', or partial '.' during typing if isDecimal is true.
 */
export function isValidPrecisionInput(val: string, isDecimal: boolean, allowNegative: boolean = true): boolean {
  if (val === '') return true;

  if (allowNegative && (val === '-' || val === '+')) {
    return true;
  }

  if (isDecimal) {
    if (allowNegative) {
      return /^[-+]?(\d+(\.\d{0,2})?|\.\d{0,2})?$/.test(val);
    }
    return /^(\d+(\.\d{0,2})?|\.\d{0,2})?$/.test(val);
  } else {
    if (allowNegative) {
      return /^[-+]?\d*$/.test(val);
    }
    return /^\d*$/.test(val);
  }
}
