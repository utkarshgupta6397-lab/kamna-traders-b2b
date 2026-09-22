import assert from 'assert';
import { prisma } from '../lib/db';
import { getIstTodayRange } from '../lib/post-dispatch-sync';
import { buildPostDispatchWhereClause } from '../lib/post-dispatch-query';
import { hasPostDispatchAccess } from '../lib/post-dispatch-auth';

async function runTests() {
  console.log('\n================================================================');
  console.log('   HERO DASHBOARD POST-DISPATCH KPI RECONCILIATION TEST SUITE   ');
  console.log('================================================================\n');

  // Test 1: Timezone boundaries calculation (IST UTC+5:30)
  console.log('--- TEST 1: IST Today Range Boundaries ---');
  const { start, end } = getIstTodayRange();
  console.log(`  Calculated Start (UTC): ${start.toISOString()}`);
  console.log(`  Calculated End   (UTC): ${end.toISOString()}`);

  assert.ok(start < end, 'Start boundary must be strictly before End boundary');

  // IST offset is 5.5 hours = 330 minutes
  const startIstHours = new Date(start.getTime() + 5.5 * 3600 * 1000).getUTCHours();
  const startIstMinutes = new Date(start.getTime() + 5.5 * 3600 * 1000).getUTCMinutes();
  const startIstSeconds = new Date(start.getTime() + 5.5 * 3600 * 1000).getUTCSeconds();
  assert.strictEqual(startIstHours, 0, 'IST start hour must be 00');
  assert.strictEqual(startIstMinutes, 0, 'IST start minute must be 00');
  assert.strictEqual(startIstSeconds, 0, 'IST start second must be 00');

  const endIstHours = new Date(end.getTime() + 5.5 * 3600 * 1000).getUTCHours();
  const endIstMinutes = new Date(end.getTime() + 5.5 * 3600 * 1000).getUTCMinutes();
  const endIstSeconds = new Date(end.getTime() + 5.5 * 3600 * 1000).getUTCSeconds();
  assert.strictEqual(endIstHours, 23, 'IST end hour must be 23');
  assert.strictEqual(endIstMinutes, 59, 'IST end minute must be 59');
  assert.strictEqual(endIstSeconds, 59, 'IST end second must be 59');
  console.log('  ✓ PASS: Today range corresponds precisely to 00:00:00 to 23:59:59 in IST');

  // Test 2: Query construction and date field verification
  console.log('\n--- TEST 2: Authoritative Post-Dispatch Where Clause ---');
  const where = buildPostDispatchWhereClause({
    tab: 'all_pending',
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  });

  assert.strictEqual(where.erpStatus, 'Active', 'Where clause must filter for Active erpStatus');
  assert.ok(where.zohoCreatedTime, 'Date filter must target zohoCreatedTime, NOT createdAt');
  assert.strictEqual(
    (where.zohoCreatedTime as any)?.gte?.toISOString(),
    start.toISOString(),
    'zohoCreatedTime gte must match IST start'
  );
  assert.strictEqual(
    (where.zohoCreatedTime as any)?.lte?.toISOString(),
    end.toISOString(),
    'zohoCreatedTime lte must match IST end'
  );
  console.log('  ✓ PASS: Where clause uses zohoCreatedTime date field matching Post-Dispatch logic');

  // Test 3: Reconciliation with Live Database Post-Dispatch Data
  console.log('\n--- TEST 3: Dynamic Data Reconciliation with Post-Dispatch Dataset ---');
  const [aggregateResult, postDispatchCount, postDispatchRows] = await Promise.all([
    prisma.postDispatchInvoice.aggregate({
      _sum: { total: true },
      where,
    }),
    prisma.postDispatchInvoice.count({ where }),
    prisma.postDispatchInvoice.findMany({
      where,
      select: { id: true, invoiceNumber: true, total: true, zohoCreatedTime: true },
    }),
  ]);

  const totalSalesToday = aggregateResult._sum.total ?? 0;
  const manualSum = postDispatchRows.reduce((acc, row) => acc + (row.total || 0), 0);

  console.log(`  Live Today Post-Dispatch Invoices Count: ${postDispatchCount}`);
  console.log(`  Live Today Post-Dispatch Sales Total: ₹${totalSalesToday.toLocaleString('en-IN')}`);

  assert.strictEqual(postDispatchCount, postDispatchRows.length, 'Count must match number of rows');
  assert.strictEqual(
    Math.round(totalSalesToday),
    Math.round(manualSum),
    'Aggregated total must exactly equal the sum of individual invoice totals'
  );
  console.log('  ✓ PASS: Aggregate sum and count reconcile 100% with Post-Dispatch rows');

  // Test 4: Currency and Number Formatting Rules
  console.log('\n--- TEST 4: Formatting Rules for Dashboard Display ---');
  const formattedCurrency = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(totalSalesToday);

  const formattedCount = postDispatchCount.toLocaleString('en-IN');

  assert.ok(formattedCurrency.startsWith('₹'), 'Currency formatting must begin with ₹');
  console.log(`  Formatted KPI 1 (TOTAL SALES TODAY):   ${formattedCurrency}`);
  console.log(`  Formatted KPI 2 (TOTAL INVOICE TODAY): ${formattedCount}`);
  console.log('  ✓ PASS: Correct Indian currency and number formatting');

  // Test 5: Permission & Access Control
  console.log('\n--- TEST 5: Permission and Access Control ---');
  assert.strictEqual(hasPostDispatchAccess({ role: 'ADMIN' }), true, 'Admin has access');
  assert.strictEqual(
    hasPostDispatchAccess({ role: 'STAFF', dispatch_view: true, dispatch_post_dispatch: true }),
    true,
    'Staff with dispatch_view & dispatch_post_dispatch has access'
  );
  assert.strictEqual(
    hasPostDispatchAccess({ role: 'STAFF', dispatch_view: true, dispatch_post_dispatch: false }),
    false,
    'Staff without dispatch_post_dispatch is denied'
  );
  assert.strictEqual(
    hasPostDispatchAccess(null),
    false,
    'Unauthenticated session is denied'
  );
  console.log('  ✓ PASS: Post-Dispatch permission checks enforced strictly');

  console.log('\n================================================================');
  console.log('   ALL RECONCILIATION TESTS PASSED SUCCESSFULLY! ✅            ');
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
