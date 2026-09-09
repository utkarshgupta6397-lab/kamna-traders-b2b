/**
 * Unit tests for Payment Verification Balance Calculation and Presentation Logic
 *
 * Verifies:
 * 1. Order Amount ₹1,16,516 with Advance Balance -₹1,099 -> Operator '-', Advance ₹1,099, Net Due ₹1,15,417
 * 2. Order Amount ₹50,000 with Advance Balance -₹70,000 -> Operator '-', Advance ₹70,000, Remaining Advance ₹20,000
 * 3. Order Amount ₹1,16,516 with Outstanding Balance +₹10,000 -> Operator '+', Due ₹10,000, Total Due ₹1,26,516
 * 4. Order Amount ₹1,16,516 with Zero Balance ₹0 -> Operator '+', Balance ₹0, Total Due ₹1,16,516
 */

export interface BalancePresentationResult {
  orderAmount: number;
  operator: '−' | '+';
  customerBalanceDisplay: number;
  customerBalanceLabel: string;
  isAdvance: boolean;
  adjustedBalance: number;
  adjustedBalanceLabel: string;
  isRemainingAdvance: boolean;
  rawNetBalance: number;
}

export function computeAdjustedBalancePresentation(
  orderTotal: number,
  rawClosingBalance: number
): BalancePresentationResult {
  const isAdvance = rawClosingBalance < 0;
  const operator: '−' | '+' = isAdvance ? '−' : '+';
  const customerBalanceDisplay = Math.abs(rawClosingBalance);
  
  // Business logic:
  // An advance (negative balance) reduces what the customer owes on this order.
  // An outstanding debt (positive balance) increases what the customer owes.
  const rawNetBalance = orderTotal + rawClosingBalance;
  const isRemainingAdvance = rawNetBalance < 0;
  const adjustedBalance = Math.abs(rawNetBalance);

  let customerBalanceLabel = 'Closing Balance';
  if (rawClosingBalance < 0) {
    customerBalanceLabel = 'Advance Balance';
  } else if (rawClosingBalance > 0) {
    customerBalanceLabel = 'Outstanding Balance';
  }

  let adjustedBalanceLabel = 'Adjusted Balance';
  if (isRemainingAdvance) {
    adjustedBalanceLabel = 'Adjusted (Advance)';
  } else if (rawNetBalance > 0) {
    adjustedBalanceLabel = isAdvance ? 'Adjusted (Net Due)' : 'Adjusted Balance';
  } else {
    adjustedBalanceLabel = 'Adjusted (Settled)';
  }

  return {
    orderAmount: orderTotal,
    operator,
    customerBalanceDisplay,
    customerBalanceLabel,
    isAdvance,
    adjustedBalance,
    adjustedBalanceLabel,
    isRemainingAdvance,
    rawNetBalance,
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: any) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`, details ? `\n    Details: ${JSON.stringify(details)}` : '');
    failed++;
  }
}

console.log('\n--- 1. Test Case 12: Order ₹1,16,516 with Advance -₹1,099 ---');
const tc1 = computeAdjustedBalancePresentation(116516, -1099);
assert(tc1.operator === '−', 'Operator is subtraction (−)');
assert(tc1.customerBalanceDisplay === 1099, 'Displayed advance balance is 1099 (positive absolute amount)');
assert(tc1.isAdvance === true, 'Identified as Advance');
assert(tc1.adjustedBalance === 115417, 'Adjusted balance is 115417 (116516 - 1099)');
assert(tc1.isRemainingAdvance === false, 'Adjusted balance is Net Due, not remaining advance');
assert(tc1.rawNetBalance === 115417, 'Raw net position is positive (+115417)');

console.log('\n--- 2. Advance Exceeds Order: Order ₹50,000 with Advance -₹70,000 ---');
const tc2 = computeAdjustedBalancePresentation(50000, -70000);
assert(tc2.operator === '−', 'Operator is subtraction (−)');
assert(tc2.customerBalanceDisplay === 70000, 'Displayed advance balance is 70000');
assert(tc2.adjustedBalance === 20000, 'Adjusted balance is 20000');
assert(tc2.isRemainingAdvance === true, 'Adjusted balance is remaining advance');
assert(tc2.rawNetBalance === -20000, 'Raw net position is negative (-20000)');

console.log('\n--- 3. Existing Outstanding: Order ₹1,16,516 with Debt +₹10,000 ---');
const tc3 = computeAdjustedBalancePresentation(116516, 10000);
assert(tc3.operator === '+', 'Operator is addition (+)');
assert(tc3.customerBalanceDisplay === 10000, 'Displayed outstanding balance is 10000');
assert(tc3.isAdvance === false, 'Identified as Outstanding');
assert(tc3.adjustedBalance === 126516, 'Adjusted balance is 126516 (116516 + 10000)');
assert(tc3.isRemainingAdvance === false, 'Customer owes total balance');
assert(tc3.rawNetBalance === 126516, 'Raw net position is +126516');

console.log('\n--- 4. Zero Balance: Order ₹1,16,516 with Balance ₹0 ---');
const tc4 = computeAdjustedBalancePresentation(116516, 0);
assert(tc4.operator === '+', 'Operator is +');
assert(tc4.customerBalanceDisplay === 0, 'Displayed balance is 0');
assert(tc4.adjustedBalance === 116516, 'Adjusted balance equals order amount 116516');
assert(tc4.rawNetBalance === 116516, 'Raw net position is +116516');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
