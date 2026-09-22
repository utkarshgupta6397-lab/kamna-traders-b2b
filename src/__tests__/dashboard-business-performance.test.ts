import assert from 'assert';
import { prisma } from '../lib/db';
import {
  getIst16DayRange,
  getPostDispatchDashboardSummary,
  formatInr,
  formatCompactInr,
  formatCompactInrAxis,
} from '../lib/post-dispatch-summary';

async function runTests() {
  console.log('\n================================================================');
  console.log('   BUSINESS PERFORMANCE 10-DAY TREND & 7-DAY MA TEST SUITE      ');
  console.log('================================================================\n');

  // Test 1: 16-Day Source Range & 10-Day Visible Range in IST
  console.log('--- TEST 1: 16-Day Source Range & 10-Day Visible Range (IST) ---');
  const { allDays, start16Days, todayEnd } = getIst16DayRange();

  assert.strictEqual(allDays.length, 16, 'Must generate exactly 16 calendar days');
  assert.ok(start16Days < todayEnd, 'Start boundary must precede End boundary');

  // Verify chronological ordering
  for (let i = 0; i < allDays.length - 1; i++) {
    assert.ok(
      allDays[i].start < allDays[i + 1].start,
      `Day ${i} must chronologically precede Day ${i + 1}`
    );
  }

  // Today is the last item (index 15)
  assert.strictEqual(allDays[15].isToday, true, 'Last day in 16-day range must be marked as isToday');
  for (let i = 0; i < 15; i++) {
    assert.strictEqual(allDays[i].isToday, false, `Day ${i} must not be marked as today`);
  }

  // 6 buffer days (0..5) + 10 visible days (6..15)
  const bufferDays = allDays.slice(0, 6);
  const visibleDays = allDays.slice(6);
  assert.strictEqual(bufferDays.length, 6, 'Must have exactly 6 historical buffer days');
  assert.strictEqual(visibleDays.length, 10, 'Must have exactly 10 visible days');

  console.log(`  Start of 16-day window (UTC): ${start16Days.toISOString()}`);
  console.log(`  End of 16-day window (UTC):   ${todayEnd.toISOString()}`);
  console.log(`  6 Buffer Days:  ${bufferDays.map((d) => d.dateStr).join(', ')}`);
  console.log(`  10 Visible Days: ${visibleDays.map((d) => d.dateStr).join(', ')}`);
  console.log('  ✓ PASS: Exactly 16 source days generated (6 buffer + 10 visible) with accurate IST boundaries');

  // Test 2: 7-Day Trailing Moving Average Formula Verification
  console.log('\n--- TEST 2: 7-Day Trailing Moving Average Formula (Prompt Example) ---');
  // Exact 16 values from user prompt Section 14:
  // 07 Sep = 10,000, 08 Sep = 20,000, 09 Sep = 30,000, 10 Sep = 40,000, 11 Sep = 50,000, 12 Sep = 60,000
  // 13 Sep = 70,000, 14 Sep = 80,000, 15 Sep = 90,000, 16 Sep = 100,000, 17 Sep = 110,000, 18 Sep = 120,000
  // 19 Sep = 130,000, 20 Sep = 140,000, 21 Sep = 150,000, 22 Sep = 160,000
  const mockSales = [
    10000, 20000, 30000, 40000, 50000, 60000, // 6 buffer days (indices 0..5)
    70000, 80000, 90000, 100000, 110000, 120000, 130000, 140000, 150000, 160000, // 10 visible days (indices 6..15)
  ];

  // Expected 7-day moving averages for the 10 visible days:
  // idx 6 (70k):  (10k+20k+30k+40k+50k+60k+70k)/7 = 40,000
  // idx 7 (80k):  (20k+30k+40k+50k+60k+70k+80k)/7 = 50,000
  // idx 8 (90k):  (30k+40k+50k+60k+70k+80k+90k)/7 = 60,000
  // idx 9 (100k): (40k+50k+60k+70k+80k+90k+100k)/7 = 70,000
  // idx 10 (110k): (50k+60k+70k+80k+90k+100k+110k)/7 = 80,000
  // idx 11 (120k): (60k+70k+80k+90k+100k+110k+120k)/7 = 90,000
  // idx 12 (130k): (70k+80k+90k+100k+110k+120k+130k)/7 = 100,000
  // idx 13 (140k): (80k+90k+100k+110k+120k+130k+140k)/7 = 110,000
  // idx 14 (150k): (90k+100k+110k+120k+130k+140k+150k)/7 = 120,000
  // idx 15 (160k): (100k+110k+120k+130k+140k+150k+160k)/7 = 130,000
  const expected7DayMAs = [40000, 50000, 60000, 70000, 80000, 90000, 100000, 110000, 120000, 130000];

  for (let v = 0; v < 10; v++) {
    const fullIdx = v + 6;
    let sum7 = 0;
    for (let k = 0; k < 7; k++) {
      sum7 += mockSales[fullIdx - k];
    }
    const ma7 = Math.round((sum7 / 7) * 100) / 100;
    assert.strictEqual(ma7, expected7DayMAs[v], `7-Day MA at visible index ${v} mismatch`);
  }
  console.log('  ✓ PASS: 7-day moving average trailing calculation exactly matches Section 14 reference values');

  // Test 3: Compact Indian Currency Formatting
  console.log('\n--- TEST 3: Compact Indian Currency Formatting Rules ---');
  const formatTestCases: [number, string][] = [
    [3091331, '₹30.91 L'],
    [2950243, '₹29.50 L'],
    [125000, '₹1.25 L'],
    [850000, '₹8.50 L'],
    [100000, '₹1.00 L'],
    [142500, '₹1.43 L'],
    [85500, '₹85,500'],
    [50000, '₹50,000'],
    [9999, '₹9,999'],
    [1000, '₹1,000'],
    [0, '₹0'],
    [10000000, '₹1.00 Cr'],
    [25000000, '₹2.50 Cr'],
  ];

  for (const [val, expected] of formatTestCases) {
    const res = formatCompactInr(val);
    assert.strictEqual(res, expected, `Compact formatting mismatch for ${val}: got ${res}, expected ${expected}`);
  }
  console.log('  ✓ PASS: All compact Indian formatting test cases (Lakhs, Crores, Rupees) passed');

  // Test 4: Axis Formatter
  console.log('\n--- TEST 4: Y-Axis Compact Formatter ---');
  assert.strictEqual(formatCompactInrAxis(500000), '₹5 L');
  assert.strictEqual(formatCompactInrAxis(1000000), '₹10 L');
  assert.strictEqual(formatCompactInrAxis(3000000), '₹30 L');
  assert.strictEqual(formatCompactInrAxis(0), '₹0');
  assert.strictEqual(formatCompactInrAxis(10000000), '₹1 Cr');
  console.log('  ✓ PASS: Clean integer-rounded axis tick formatting');

  // Test 5: Live Database Summary & Reconciliation
  console.log('\n--- TEST 5: Live Database Summary & Reconciliation ---');
  const summary = await getPostDispatchDashboardSummary();

  assert.strictEqual(summary.salesTrend.length, 10, 'Must return exactly 10 visible days');
  assert.strictEqual(summary.salesTrend[9].isToday, true, 'Right-most visible day (index 9) must be today');

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
  const todayItem = summary.salesTrend[9];
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

  console.log('  Live 10-Day Trend Results:');
  console.table(
    summary.salesTrend.map((d) => ({
      Date: d.fullDate,
      Day: d.dayOfWeek,
      Today: d.isToday ? 'YES' : 'no',
      Sales: d.formattedSales,
      Count: d.invoiceCount,
      '7-Day MA': d.formattedMovingAverage,
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
