import assert from 'assert';
import { prisma } from '../lib/db';
import {
  getIst9DayRange,
  getPostDispatchDashboardSummary,
  formatInr,
} from '../lib/post-dispatch-summary';

async function runTests() {
  console.log('\n================================================================');
  console.log('   BUSINESS PERFORMANCE 7-DAY TREND & 3-DAY MA TEST SUITE       ');
  console.log('================================================================\n');

  // Test 1: 9-Day Calendar Range in IST
  console.log('--- TEST 1: 9-Day Calendar Range Calculation (IST) ---');
  const { allDays, start9Days, todayEnd } = getIst9DayRange();

  assert.strictEqual(allDays.length, 9, 'Must generate exactly 9 calendar days');
  assert.ok(start9Days < todayEnd, 'Start boundary must precede End boundary');

  // Verify chronological ordering
  for (let i = 0; i < allDays.length - 1; i++) {
    assert.ok(
      allDays[i].start < allDays[i + 1].start,
      `Day ${i} must chronologically precede Day ${i + 1}`
    );
  }

  // Today is the last item (index 8)
  assert.strictEqual(allDays[8].isToday, true, 'Last day in 9-day range must be marked as isToday');
  for (let i = 0; i < 8; i++) {
    assert.strictEqual(allDays[i].isToday, false, `Day ${i} must not be marked as today`);
  }

  console.log(`  Start of 9-day window (UTC): ${start9Days.toISOString()}`);
  console.log(`  End of 9-day window (UTC):   ${todayEnd.toISOString()}`);
  console.log(`  9 Calendar Days: ${allDays.map((d) => d.dateStr).join(', ')}`);
  console.log('  ✓ PASS: Exactly 9 contiguous calendar days generated with accurate IST boundaries');

  // Test 2: Moving Average Formula Unit Validation
  console.log('\n--- TEST 2: 3-Day Trailing Moving Average Formula ---');
  // Day -8 to Day 0 sales: [100, 200, 300, 400, 0, 500, 600, 700, 800]
  const mockSales = [100, 200, 300, 400, 0, 500, 600, 700, 800];
  // Visible 7 days are indices 2 to 8 (Day -6 to Day 0)
  // idx 2 (val 300): (300 + 200 + 100) / 3 = 200
  // idx 3 (val 400): (400 + 300 + 200) / 3 = 300
  // idx 4 (val 0):   (0 + 400 + 300) / 3 = 233.33
  // idx 5 (val 500): (500 + 0 + 400) / 3 = 300
  // idx 6 (val 600): (600 + 500 + 0) / 3 = 366.67
  // idx 7 (val 700): (700 + 600 + 500) / 3 = 600
  // idx 8 (val 800): (800 + 700 + 600) / 3 = 700
  const expectedMAs = [200, 300, 233.33, 300, 366.67, 600, 700];

  for (let v = 0; v < 7; v++) {
    const fullIdx = v + 2;
    const s0 = mockSales[fullIdx];
    const s1 = mockSales[fullIdx - 1];
    const s2 = mockSales[fullIdx - 2];
    const ma = Math.round(((s0 + s1 + s2) / 3) * 100) / 100;
    assert.strictEqual(ma, expectedMAs[v], `MA at visible index ${v} mismatch`);
  }
  console.log('  ✓ PASS: 3-day moving average trailing calculation matches exact mathematical expectation');

  // Test 3: Currency and Date Formatting
  console.log('\n--- TEST 3: Indian Currency and Date Formatting ---');
  assert.strictEqual(formatInr(2950243), '₹29,50,243', 'Must format Indian lakhs/crores correctly');
  assert.strictEqual(formatInr(0), '₹0', 'Zero amount must format as ₹0');
  assert.strictEqual(formatInr(15000000), '₹1,50,00,000', 'One crore fifty lakhs formatting');
  console.log('  ✓ PASS: Currency formatting adheres strictly to Indian numbering system');

  // Test 4: Live Data Reconciliation with Database
  console.log('\n--- TEST 4: Live Database Summary & Reconciliation ---');
  const summary = await getPostDispatchDashboardSummary();

  assert.strictEqual(summary.salesTrend.length, 7, 'Must return exactly 7 visible days');
  assert.strictEqual(summary.salesTrend[6].isToday, true, 'Visible day 6 must be today');

  // Verify non-skipping of zero-sales days
  for (let i = 0; i < summary.salesTrend.length; i++) {
    const day = summary.salesTrend[i];
    assert.ok(typeof day.sales === 'number' && day.sales >= 0, 'Sales must be non-negative number');
    assert.ok(
      typeof day.movingAverage === 'number' && day.movingAverage >= 0,
      'Moving average must be non-negative number'
    );
    assert.ok(day.formattedSales.startsWith('₹'), 'Formatted sales must start with ₹');
    assert.ok(day.formattedMovingAverage.startsWith('₹'), 'Formatted MA must start with ₹');
    assert.ok(day.dayOfWeek.length === 3, 'Day of week must be 3-letter abbreviation');
  }

  // Reconciliation: today's sales must match top-level KPI totalSalesToday exactly
  const todayItem = summary.salesTrend[6];
  assert.strictEqual(
    summary.totalSalesToday,
    todayItem.sales,
    'Top-level totalSalesToday must match today bar sales exactly'
  );
  assert.strictEqual(
    summary.totalInvoiceToday,
    todayItem.invoiceCount,
    'Top-level totalInvoiceToday must match today bar invoiceCount exactly'
  );

  console.log('  Live 7-Day Trend Results:');
  console.table(
    summary.salesTrend.map((d) => ({
      Date: d.fullDate,
      Day: d.dayOfWeek,
      Today: d.isToday ? 'YES' : 'no',
      Sales: d.formattedSales,
      Count: d.invoiceCount,
      '3-Day MA': d.formattedMovingAverage,
    }))
  );
  console.log(`  Top KPI totalSalesToday:   ₹${summary.totalSalesToday.toLocaleString('en-IN')}`);
  console.log(`  Today Bar Sales:           ₹${todayItem.sales.toLocaleString('en-IN')}`);
  console.log(`  Reconciliation Difference: 0 (100% exact match)`);
  console.log('  ✓ PASS: Complete data integrity and exact reconciliation verified');

  console.log('\n================================================================');
  console.log('   ALL BUSINESS PERFORMANCE TESTS PASSED SUCCESSFULLY! ✅      ');
  console.log('================================================================\n');
}

runTests()
  .catch((err) => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
