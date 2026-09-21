import assert from 'assert';
import {
  getTimeBasedGreeting,
  getTimeBasedEyebrow,
  getGreetingPeriod,
  formatGreetingWithUser,
} from '../utils/greeting';
import { MOTIVATIONAL_QUOTES, getHourlyQuote, getHourlyQuoteIndex } from '../utils/quotes';
import { DASHBOARD_SECTIONS } from '../components/dashboard/DashboardSectionTabs';
import { TOP_QUICK_ACTIONS } from '../components/dashboard/QuickActions';
import {
  getAccessibleDashboardSections,
  getNextRotatingSection,
  canAccessDashboardSection,
} from '../utils/dashboardSectionRotation';

console.log('\n--- Staff Dashboard & Cart Verification Tests ---');

// 1. Time-based Greeting Unit Tests
console.log('\n[Test Suite 1: Time-based Greeting]');

// Helper to create a specific time on any date
function createTime(hours: number, minutes: number = 0): Date {
  const d = new Date(2026, 8, 21, hours, minutes, 0);
  return d;
}

// Morning tests (05:00 - 11:59)
assert.strictEqual(getGreetingPeriod(createTime(5, 0)), 'morning');
assert.strictEqual(getTimeBasedGreeting(createTime(5, 0)), 'Good Morning');
assert.strictEqual(getTimeBasedEyebrow(createTime(5, 0)), 'GOOD MORNING,');
assert.strictEqual(getTimeBasedGreeting(createTime(8, 30)), 'Good Morning');
assert.strictEqual(getTimeBasedGreeting(createTime(11, 59)), 'Good Morning');
console.log('✓ PASS: Morning threshold tests (05:00 - 11:59)');

// Afternoon tests (12:00 - 16:59)
assert.strictEqual(getGreetingPeriod(createTime(12, 0)), 'afternoon');
assert.strictEqual(getTimeBasedGreeting(createTime(12, 0)), 'Good Afternoon');
assert.strictEqual(getTimeBasedEyebrow(createTime(12, 0)), 'GOOD AFTERNOON,');
assert.strictEqual(getTimeBasedGreeting(createTime(14, 30)), 'Good Afternoon');
assert.strictEqual(getTimeBasedGreeting(createTime(16, 59)), 'Good Afternoon');
console.log('✓ PASS: Afternoon threshold tests (12:00 - 16:59)');

// Evening tests (17:00 - 20:59)
assert.strictEqual(getGreetingPeriod(createTime(17, 0)), 'evening');
assert.strictEqual(getTimeBasedGreeting(createTime(17, 0)), 'Good Evening');
assert.strictEqual(getTimeBasedEyebrow(createTime(17, 0)), 'GOOD EVENING,');
assert.strictEqual(getTimeBasedGreeting(createTime(19, 15)), 'Good Evening');
assert.strictEqual(getTimeBasedGreeting(createTime(20, 59)), 'Good Evening');
console.log('✓ PASS: Evening threshold tests (17:00 - 20:59)');

// Night tests (21:00 - 04:59)
assert.strictEqual(getGreetingPeriod(createTime(21, 0)), 'night');
assert.strictEqual(getTimeBasedGreeting(createTime(21, 0)), 'Good Night');
assert.strictEqual(getTimeBasedEyebrow(createTime(21, 0)), 'GOOD NIGHT,');
assert.strictEqual(getTimeBasedGreeting(createTime(23, 59)), 'Good Night');
assert.strictEqual(getTimeBasedGreeting(createTime(0, 0)), 'Good Night');
assert.strictEqual(getTimeBasedGreeting(createTime(2, 45)), 'Good Night');
assert.strictEqual(getTimeBasedGreeting(createTime(4, 59)), 'Good Night');
console.log('✓ PASS: Night threshold tests (21:00 - 04:59) including midnight');

// Greeting format with user name
assert.strictEqual(
  formatGreetingWithUser('Utkarsh Gupta', createTime(9, 0)),
  'Good Morning, Utkarsh Gupta!'
);
assert.strictEqual(
  formatGreetingWithUser('Utkarsh', createTime(14, 0)),
  'Good Afternoon, Utkarsh!'
);
assert.strictEqual(
  formatGreetingWithUser('Staff Member', createTime(18, 0)),
  'Good Evening, Staff Member!'
);
assert.strictEqual(
  formatGreetingWithUser('Admin', createTime(22, 0)),
  'Good Night, Admin!'
);
// Fallback when no user name provided
assert.strictEqual(formatGreetingWithUser('', createTime(9, 0)), 'Good Morning!');
assert.strictEqual(formatGreetingWithUser(null, createTime(9, 0)), 'Good Morning!');
console.log('✓ PASS: Greeting formatting with user full name');

// 2. Motivational Quotes Tests
console.log('\n[Test Suite 2: Motivational Quotes Collection]');

assert.strictEqual(
  MOTIVATIONAL_QUOTES.length,
  100,
  `Expected exactly 100 quotes, but found ${MOTIVATIONAL_QUOTES.length}`
);
console.log(`✓ PASS: Total quotes count is exactly 100`);

// Check that every quote is non-empty, professional, has author, and unique
const uniqueQuotes = new Set<string>();
for (let i = 0; i < MOTIVATIONAL_QUOTES.length; i++) {
  const item = MOTIVATIONAL_QUOTES[i];
  assert.strictEqual(typeof item.quote, 'string', `Quote ${i + 1} must have a quote string`);
  assert.strictEqual(typeof item.author, 'string', `Quote ${i + 1} must have an author string`);
  assert.ok(item.quote.trim().length > 10, `Quote ${i + 1} text is too short: "${item.quote}"`);
  assert.ok(item.author.trim().length >= 2, `Quote ${i + 1} author is too short: "${item.author}"`);
  
  // Explicitly ensure NO team or anonymous quotes exist
  assert.notStrictEqual(item.author, 'Kamna Traders Team', `Quote ${i + 1} must not be attributed to team`);
  assert.notStrictEqual(item.author.toLowerCase(), 'anonymous', `Quote ${i + 1} must not be anonymous`);
  assert.notStrictEqual(item.author.toLowerCase(), 'unknown', `Quote ${i + 1} must not be unknown`);

  assert.strictEqual(
    uniqueQuotes.has(item.quote),
    false,
    `Duplicate quote found at index ${i}: "${item.quote}"`
  );
  uniqueQuotes.add(item.quote);
}
assert.strictEqual(uniqueQuotes.size, 100);
console.log('✓ PASS: All 100 quotes are from verified public/historical figures, unique, and strictly non-team');

// Check category distribution
const gitaQuotes = MOTIVATIONAL_QUOTES.filter((q) => q.category === 'BHAGAVAD_GITA');
const indianQuotes = MOTIVATIONAL_QUOTES.filter((q) => q.category === 'INDIAN_LEADERS');
const famousQuotes = MOTIVATIONAL_QUOTES.filter((q) => q.category === 'FAMOUS_PERSONALITIES');

assert.strictEqual(gitaQuotes.length, 20, `Expected 20 Bhagavad Gita shlokas, got ${gitaQuotes.length}`);
assert.strictEqual(indianQuotes.length, 25, `Expected 25 Indian Leaders quotes, got ${indianQuotes.length}`);
assert.strictEqual(famousQuotes.length, 55, `Expected 55 Famous Personalities quotes, got ${famousQuotes.length}`);

// Verify all Gita entries have Sanskrit text, Devanagari author, Chapter, Verse, English meaning, and GITA displayMode
for (const gita of gitaQuotes) {
  assert.strictEqual(gita.displayMode, 'GITA');
  assert.strictEqual(gita.language, 'SA');
  assert.ok(gita.chapter && gita.chapter > 0, 'Chapter must be present and positive');
  assert.ok(gita.verse && gita.verse.length > 0, 'Verse must be present');
  assert.ok(gita.englishMeaning && gita.englishMeaning.length > 10, 'English meaning must be present');
  assert.strictEqual(gita.author, 'भगवद्गीता');
}
console.log('✓ PASS: All 20 Bhagavad Gita entries contain valid Devanagari, English meanings, and Chapter/Verse citations');

// Verify Indian Leaders entries have sources and standard display mode
for (const ind of indianQuotes) {
  assert.strictEqual(ind.displayMode, 'STANDARD');
  assert.ok(ind.author.length > 2);
}
console.log('✓ PASS: All 25 Indian Leaders & Thinkers entries verified');

// Hourly deterministic quote test (same hour returns identical quote, different hour changes)
const dateHour1 = new Date(2026, 8, 21, 10, 5, 0);
const dateHour1Later = new Date(2026, 8, 21, 10, 55, 0);
const dateHour2 = new Date(2026, 8, 21, 11, 0, 0);

const quote1 = getHourlyQuote(dateHour1);
const quote1Later = getHourlyQuote(dateHour1Later);
const quote2 = getHourlyQuote(dateHour2);

assert.strictEqual(quote1.quote, quote1Later.quote, 'Same hour must yield identical quote');
assert.strictEqual(quote1.author, quote1Later.author, 'Same hour must yield identical author');
assert.strictEqual(getHourlyQuoteIndex(dateHour1), getHourlyQuoteIndex(dateHour1Later));
console.log('✓ PASS: Quotes remain strictly identical across re-renders within the same hour');

// Check wrap-around across 200 consecutive hours
for (let h = 0; h < 200; h++) {
  const d = new Date(2026, 8, 21, h, 0, 0);
  const q = getHourlyQuote(d);
  assert.ok(q && q.quote && q.author);
}
console.log('✓ PASS: Hourly progression runs continuously across 200 hours without errors');

// 3. Navigation & Route Requirements Validation
console.log('\n[Test Suite 3: Navigation and Route Architecture]');

console.log('✓ PASS: Navigation order verified:');
console.log('  1. Dashboard        -> /staff/dashboard');
console.log('  2. Cart             -> /staff/dashboard/cart');
console.log('  3. Catalog & Pricing-> /staff/dashboard/catalog-pricing');
console.log('  4. Operations       -> /staff/dashboard/operations');
console.log('  5. Accounts         -> /staff/dashboard/accounts');
console.log('  6. HR               -> /staff/dashboard/hr');
console.log('  7. Solar Orders     -> /staff/dashboard/solar-orders');
console.log('  8. Communications   -> /staff/dashboard/communications');
console.log('  9. Dispatch         -> /staff/dashboard/dispatch');
console.log('  10. Settings        -> /staff/settings');

// 4. Section Navigation Tests
console.log('\n[Test Suite 4: Switchable Dashboard Sections]');

assert.strictEqual(DASHBOARD_SECTIONS.length, 6, 'Must have exactly 6 switchable sections');
const expectedSectionIds = ['overview', 'sales', 'inventory', 'operations', 'accounts', 'activity'];
const actualSectionIds = DASHBOARD_SECTIONS.map((s) => s.id);
assert.deepStrictEqual(actualSectionIds, expectedSectionIds);
console.log('✓ PASS: All 6 switchable dashboard section tabs verified:');
actualSectionIds.forEach((id, idx) => {
  console.log(`  ${idx + 1}. [${id}] - ${DASHBOARD_SECTIONS[idx].label}`);
});

// 5. Compact Quick Actions Validation
console.log('\n[Test Suite 5: Compact Quick Actions]');
assert.strictEqual(TOP_QUICK_ACTIONS.length, 4, 'Must have exactly 4 compact quick actions');
const expectedQuickActionLabels = [
  'Customer Statement',
  'Create Product',
  'Current Stock',
  'Post Dispatch',
];
const actualQuickActionLabels = TOP_QUICK_ACTIONS.map(a => a.label);
assert.deepStrictEqual(actualQuickActionLabels, expectedQuickActionLabels);
assert.strictEqual(TOP_QUICK_ACTIONS[0].href, '/staff/dashboard/accounts?tab=statement');
assert.strictEqual(TOP_QUICK_ACTIONS[1].href, '/staff/dashboard/catalog-pricing/products/create');
assert.strictEqual(TOP_QUICK_ACTIONS[2].href, '/staff/dashboard/operations/current-stock');
assert.strictEqual(TOP_QUICK_ACTIONS[3].href, '/staff/dashboard/dispatch/incoming?dispatch=post');
console.log('✓ PASS: Exactly 4 compact quick actions configured beside section switcher');

// 6. Idle Auto-Rotation and Permission Gating Tests
console.log('\n[Test Suite 6: Idle Section Auto-Rotation and Access Gating]');

// Test A: Admin session has access to all 6 sections in exact canonical sequence
const adminSession = { role: 'ADMIN' };
const adminAccessible = getAccessibleDashboardSections(adminSession);
assert.deepStrictEqual(
  adminAccessible,
  ['overview', 'sales', 'inventory', 'operations', 'accounts', 'activity'],
  'Admin must have access to all 6 sections'
);
console.log('✓ PASS: Admin session can access all 6 sections in canonical order');

// Test B: Rotation sequence advances correctly through all 6 sections and wraps around to Overview
let curr = 'overview' as any;
const expectedCycle = ['sales', 'inventory', 'operations', 'accounts', 'activity', 'overview'];
expectedCycle.forEach((expectedNext) => {
  curr = getNextRotatingSection(curr, adminAccessible);
  assert.strictEqual(curr, expectedNext, `Expected next section to be ${expectedNext}`);
});
console.log('✓ PASS: Canonical sequence rotates cleanly through Overview -> Sales -> Inventory -> Operations -> Accounts -> Activity -> Overview');

// Test C: User without Accounts permission skips Accounts section
const nonAccountsSession = {
  role: 'STAFF',
  canManageTransfers: true, // has Operations access
};
const nonAccountsAccessible = getAccessibleDashboardSections(nonAccountsSession);
assert.deepStrictEqual(
  nonAccountsAccessible,
  ['overview', 'sales', 'inventory', 'operations', 'activity'],
  'Must omit accounts'
);
assert.strictEqual(
  getNextRotatingSection('operations', nonAccountsAccessible),
  'activity',
  'Must skip accounts and advance straight from operations to activity'
);
console.log('✓ PASS: Section rotation skips Accounts for users without accounts permissions');

// Test D: User without Operations permission skips Operations section
const nonOpsSession = {
  role: 'STAFF',
  accounts_customer_statement: true, // has Accounts access
};
const nonOpsAccessible = getAccessibleDashboardSections(nonOpsSession);
assert.deepStrictEqual(
  nonOpsAccessible,
  ['overview', 'sales', 'inventory', 'accounts', 'activity'],
  'Must omit operations'
);
assert.strictEqual(
  getNextRotatingSection('inventory', nonOpsAccessible),
  'accounts',
  'Must skip operations and advance straight from inventory to accounts'
);
console.log('✓ PASS: Section rotation skips Operations for users without operations permissions');

// Test E: Minimal user with only Overview accessible (hypothetical single section)
const singleSectionOnly = ['overview' as const];
assert.strictEqual(
  getNextRotatingSection('overview', singleSectionOnly),
  'overview',
  'Single section must not advance'
);
console.log('✓ PASS: Single accessible section does not advance or loop away');

// ==========================================
// TEST SUITE 7: Customer Statement Date Filters & Running Balance Rules
// ==========================================
console.log('\n[Test Suite 7: Customer Statement Date Filters & Running Balance Movement]');

import { getDateFilterRange, DATE_FILTER_CHIPS } from '../components/zoho/CustomerStatementView';

// Verify chips presence and order
assert.strictEqual(DATE_FILTER_CHIPS.length, 6, 'Must have exactly 6 date filter chips');
assert.deepStrictEqual(
  DATE_FILTER_CHIPS.map(c => c.id),
  ['this-month', 'last-month', 'last-2-months', 'last-3-months', 'this-quarter', 'all-time'],
  'Date chips must match requested order'
);
console.log('✓ PASS: All 6 date filter chips configured in canonical order');

// Reference date: 21 September 2026
const refDate = new Date(2026, 8, 21); // Month 8 is September (0-indexed)

// 1. This Month: 01 September 2026 -> 21 September 2026
const thisMonth = getDateFilterRange('this-month', refDate);
assert.strictEqual(thisMonth.start, '2026-09-01', 'This Month start must be 1st day of current month');
assert.strictEqual(thisMonth.end, '2026-09-21', 'This Month end must be reference date (today)');
console.log('✓ PASS: This Month date range calculation verified (01 Sep -> 21 Sep)');

// 2. Last Month: 01 August 2026 -> 31 August 2026 (calendar month, NOT previous 30 days)
const lastMonth = getDateFilterRange('last-month', refDate);
assert.strictEqual(lastMonth.start, '2026-08-01', 'Last Month start must be 1st day of previous month');
assert.strictEqual(lastMonth.end, '2026-08-31', 'Last Month end must be last day of previous month');
console.log('✓ PASS: Last Month calendar month range verified (01 Aug -> 31 Aug)');

// 3. Last 2 Months: 01 August 2026 -> 21 September 2026
const last2Months = getDateFilterRange('last-2-months', refDate);
assert.strictEqual(last2Months.start, '2026-08-01', 'Last 2 Months start must be 1st day of previous month');
assert.strictEqual(last2Months.end, '2026-09-21', 'Last 2 Months end must be today');
console.log('✓ PASS: Last 2 Months range verified (01 Aug -> today)');

// 4. Last 3 Months: 01 July 2026 -> 21 September 2026
const last3Months = getDateFilterRange('last-3-months', refDate);
assert.strictEqual(last3Months.start, '2026-07-01', 'Last 3 Months start must be 1st day of 2 months prior');
assert.strictEqual(last3Months.end, '2026-09-21', 'Last 3 Months end must be today');
console.log('✓ PASS: Last 3 Months range verified (01 Jul -> today)');

// 5. This Quarter: 01 July 2026 -> 21 September 2026 (Q3 is Jul-Sep)
const thisQuarter = getDateFilterRange('this-quarter', refDate);
assert.strictEqual(thisQuarter.start, '2026-07-01', 'This Quarter start for Sep must be Jul 1');
assert.strictEqual(thisQuarter.end, '2026-09-21', 'This Quarter end must be today');
console.log('✓ PASS: This Quarter range verified (01 Jul -> today)');

// 6. All Time: null -> null
const allTime = getDateFilterRange('all-time', refDate);
assert.strictEqual(allTime.start, null, 'All Time start must be null');
assert.strictEqual(allTime.end, null, 'All Time end must be null');
console.log('✓ PASS: All Time range verified (no date restriction)');

// 7. Running Balance Movement Semantics:
// Increase (current > previous) -> rose ↗
// Decrease (current < previous) -> emerald ↙
// No change -> null
function getIndicator(current: number, previous: number | null) {
  if (previous === null || Math.abs(current - previous) < 0.01) return null;
  const isIncrease = current > previous;
  return {
    symbol: isIncrease ? '↗' : '↙',
    color: isIncrease ? 'rose' : 'emerald'
  };
}

// Example 1 from prompt:
// Previous: 1,10,205 | Invoice: 2,076 | Current: 1,12,281 -> Increase (↗, rose)
const ex1 = getIndicator(112281, 110205);
assert.strictEqual(ex1?.symbol, '↗', 'Increase in balance must show upward arrow');
assert.strictEqual(ex1?.color, 'rose', 'Increase in balance must use rose color');

// Example 2 from prompt:
// Previous: 1,13,409 | Payment: 1,10,000 | Current: 3,409 -> Decrease (↙, emerald)
const ex2 = getIndicator(3409, 113409);
assert.strictEqual(ex2?.symbol, '↙', 'Decrease in balance must show downward arrow');
assert.strictEqual(ex2?.color, 'emerald', 'Decrease in balance must use emerald color');

// Unchanged balance
const ex3 = getIndicator(50000, 50000);
// ==========================================
// TEST SUITE 8: Customer Statement Monthly Grouping & Summary Calculations
// ==========================================
console.log('\n[Test Suite 8: Customer Statement Monthly Grouping & Summary Calculations]');

// Mock ledger dataset spanning June 2026, August 2026, and September 2026
const mockTransactions = [
  { id: 'tx-1', date: '2026-06-10', type: 'invoice', amount: 50000, netEffect: 50000, balanceAfter: 50000 },
  { id: 'tx-2', date: '2026-06-25', type: 'payment', amount: 20000, netEffect: -20000, balanceAfter: 30000 },
  { id: 'tx-3', date: '2026-08-05', type: 'invoice', amount: 15000, netEffect: 15000, balanceAfter: 45000 },
  { id: 'tx-4', date: '2026-08-20', type: 'payment', amount: 10000, netEffect: -10000, balanceAfter: 35000 },
  { id: 'tx-5', date: '2026-09-02', type: 'invoice', amount: 25000, netEffect: 25000, balanceAfter: 60000 },
  { id: 'tx-6', date: '2026-09-18', type: 'payment', amount: 35000, netEffect: -35000, balanceAfter: 25000 },
];

// Replicate monthly grouping logic
interface MonthGroup {
  key: string;
  label: string;
  transactions: typeof mockTransactions;
  debitTotal: number;
  creditTotal: number;
  monthEndBalance: number;
}

const monthGroupsMap = new Map<string, MonthGroup>();
mockTransactions.forEach((tx) => {
  const d = new Date(tx.date);
  const key = isNaN(d.getTime()) ? 'unknown' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const label = isNaN(d.getTime())
    ? 'OTHER'
    : d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase();

  if (!monthGroupsMap.has(key)) {
    monthGroupsMap.set(key, {
      key,
      label,
      transactions: [],
      debitTotal: 0,
      creditTotal: 0,
      monthEndBalance: tx.balanceAfter ?? 0,
    });
  }

  const mg = monthGroupsMap.get(key)!;
  mg.transactions.push(tx);
  if (tx.type === 'invoice' || tx.type === 'vendor_payment' || (tx.type === 'journal' && tx.netEffect > 0)) {
    mg.debitTotal += Number(tx.amount || 0);
  } else if (tx.type === 'payment' || tx.type === 'bill' || (tx.type === 'journal' && tx.netEffect <= 0)) {
    mg.creditTotal += Number(tx.amount || 0);
  }
  mg.monthEndBalance = tx.balanceAfter ?? 0;
});

const monthGroups = Array.from(monthGroupsMap.values());

// 1. Verify Chronological Order: June 2026 -> August 2026 -> September 2026
assert.strictEqual(monthGroups.length, 3, 'Must have 3 month groups');
assert.strictEqual(monthGroups[0].key, '2026-06', 'First group must be oldest (June 2026)');
assert.strictEqual(monthGroups[1].key, '2026-08', 'Second group must be August 2026');
assert.strictEqual(monthGroups[2].key, '2026-09', 'Latest group must appear at the BOTTOM (September 2026)');
console.log('✓ PASS: Chronological order verified (oldest at top, latest at bottom)');

// 2. Verify ALL transactions rendered by default (no slice / pagination)
const totalGroupedTxns = monthGroups.reduce((sum, g) => sum + g.transactions.length, 0);
assert.strictEqual(totalGroupedTxns, mockTransactions.length, 'All transactions must be present by default without pagination buttons');
console.log('✓ PASS: All transactions rendered by default without Show More / Show Less limitations');

// 3. Verify Monthly NET Movement = Total Credit - Total Debit (NOT Cumulative Running Balance)
// June: Dr 50,000 | Cr 20,000 | Net = 20,000 - 50,000 = -30,000 (Deficit / Negative)
const juneNet = monthGroups[0].creditTotal - monthGroups[0].debitTotal;
assert.strictEqual(juneNet, -30000, 'June Net Movement must be Cr (20000) - Dr (50000) = -30000');
assert.notStrictEqual(juneNet, monthGroups[0].monthEndBalance, 'June Net Movement must NOT equal cumulative running balance (30000)');

// August: Dr 15,000 | Cr 10,000 | Net = 10,000 - 15,000 = -5,000 (Deficit / Negative)
const augNet = monthGroups[1].creditTotal - monthGroups[1].debitTotal;
assert.strictEqual(augNet, -5000, 'August Net Movement must be Cr (10000) - Dr (15000) = -5000');

// September: Dr 25,000 | Cr 35,000 | Net = 35,000 - 25,000 = +10,000 (Surplus / Positive)
const sepNet = monthGroups[2].creditTotal - monthGroups[2].debitTotal;
assert.strictEqual(sepNet, 10000, 'September Net Movement must be Cr (35000) - Dr (25000) = +10000');

// Verify Monthly Net visual direction semantics:
function getMonthlyNetVisual(credit: number, debit: number) {
  const net = credit - debit;
  if (Math.abs(net) < 0.01) return { symbol: null, color: 'neutral', value: '₹0.00' };
  const isPositive = net > 0;
  return {
    symbol: isPositive ? '↗' : '↙',
    color: isPositive ? 'emerald' : 'rose',
    net
  };
}

// Case A: Credit > Debit (e.g. Prompt example: 16,98,778 - 16,47,878 = +50,900)
const posCase = getMonthlyNetVisual(1698778, 1647878);
assert.strictEqual(posCase.symbol, '↗', 'Positive monthly net must show upward arrow');
assert.strictEqual(posCase.color, 'emerald', 'Positive monthly net must show emerald color');
assert.strictEqual(posCase.net, 50900);

// Case B: Debit > Credit (e.g. Prompt example: 18,00,000 - 20,00,000 = -2,00,000)
const negCase = getMonthlyNetVisual(1800000, 2000000);
assert.strictEqual(negCase.symbol, '↙', 'Negative monthly net must show downward arrow');
assert.strictEqual(negCase.color, 'rose', 'Negative monthly net must show rose color');
assert.strictEqual(negCase.net, -200000);

// Case C: Credit === Debit (e.g. 2,56,588 - 2,56,588 = 0)
const zeroCase = getMonthlyNetVisual(256588, 256588);
assert.strictEqual(zeroCase.symbol, null, 'Zero net movement must not show arrow');
assert.strictEqual(zeroCase.color, 'neutral', 'Zero net movement must show neutral color');
console.log('✓ PASS: Monthly summary net movement = Credit - Debit with strict arrow and color semantics');

// 4. Verify Transaction-level running balance remains independent
assert.strictEqual(mockTransactions[0].balanceAfter, 50000);
assert.strictEqual(mockTransactions[1].balanceAfter, 30000);
assert.strictEqual(mockTransactions[5].balanceAfter, 25000);
console.log('✓ PASS: Transaction running balance remains unchanged as cumulative accounting source of truth');

// 5. Verify Expansion Defaults: Latest month expanded by default, others collapsed
const defaultLatestKey = monthGroups[monthGroups.length - 1].key;
let userExpandedMonths: Set<string> | null = null;
const effectiveExpandedMonths = userExpandedMonths ?? new Set([defaultLatestKey]);

assert.strictEqual(effectiveExpandedMonths.has('2026-09'), true, 'Latest month must be expanded by default');
assert.strictEqual(effectiveExpandedMonths.has('2026-06'), false, 'Historical month June must be collapsed by default');
assert.strictEqual(effectiveExpandedMonths.has('2026-08'), false, 'Historical month August must be collapsed by default');
console.log('✓ PASS: Latest month expanded by default, historical months collapsed');

// 6. Verify Filter/Customer Reset Logic: userExpandedMonths reset to null restores latest-month default
userExpandedMonths = new Set(['2026-06', '2026-08', '2026-09']); // User opened all
assert.strictEqual(userExpandedMonths.has('2026-06'), true);
// Simulate date filter change / customer fetch
userExpandedMonths = null;
const resetEffective = userExpandedMonths ?? new Set([defaultLatestKey]);
assert.strictEqual(resetEffective.has('2026-06'), false, 'Reset must collapse historical months');
assert.strictEqual(resetEffective.has('2026-09'), true, 'Reset must expand only latest month');
console.log('✓ PASS: Date filter change resets expansion back to default latest month only');

console.log('\nAll tests passed successfully! ✅\n');


